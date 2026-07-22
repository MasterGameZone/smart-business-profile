# Payment Monitoring Operations Runbook

## Scope and current state

This runbook covers the Phase 1–4 payment-monitoring system. Monitoring is observational: it records sanitized operational incidents and alert-delivery state, but it never activates, cancels, reconciles, refunds, or otherwise changes a subscription entitlement.

Phase 4 adds read-only operational views, a restricted health RPC, and durable correlation between the alert Cron wrapper, `pg_net`, and the alert Edge Function. The migration, tests, and documentation are present locally only until a separately approved production activation. No production secret, provider payload, customer contact detail, or live payment identifier belongs in this runbook.

There is no existing secure administrator authorization model or administrator route in the application. No admin UI is added. Authorized operators use the Supabase Dashboard SQL editor, `pg_cron` metadata, `pg_net` safe metadata, and Edge Function logs under the project’s existing operator access controls. Frontend clients have no access to the monitoring tables, views, or RPCs.

## Access and safe inspection

The following operational interfaces are restricted to `service_role` or the database owner. Use a controlled operator session and copy only sanitized UUIDs, safe codes, statuses, counts, and timestamps.

### Overall health

```sql
select public.get_payment_monitoring_operational_health(now());
```

The result contains two independent health sections:

- `monitoring_system.health`: `healthy`, `degraded`, `critical`, or `not_configured`.
- `payment_incidents.health`: `clear`, `warning`, `high`, or `critical`.

Monitoring-system health is not made unhealthy merely because a payment incident is open. The incident health is based only on open incident severity.

The detector is stale when its latest successful run is more than 15 minutes old. The alert scheduler is stale when alert configuration exists and its latest successful run is more than 20 minutes old. Pending or retry-scheduled work due more than 15 minutes ago is overdue. Processing claims whose expiry is at or before the observation time are stale. Recent Cron failures and `pg_net` failures are counted only as safe counts; response bodies and error text are never operational output.

Critical conditions include missing, duplicated, inactive, or incorrectly scheduled/commanded jobs; a stale detector; repeated recent job failures; stale claims; terminal failed deliveries for open incidents; and reliable recent `pg_net` failures. Degraded conditions include overdue pending/retry work, an isolated failure followed by a later successful run, and a temporary retry backlog. Missing alert Vault configuration is `not_configured` when structural monitoring conditions are otherwise sound.

### Incidents and delivery state

```sql
select incident_id, incident_type, severity, status,
       source_table, source_record_id, diagnostic_code,
       first_detected_at, last_detected_at, detection_count,
       latest_delivery_status, latest_delivery_attempt_count,
       latest_delivery_error_code
from public.payment_monitoring_incident_operations
order by last_detected_at desc, incident_id desc
limit 100;

select delivery_id, incident_id, incident_type, incident_severity,
       incident_status, alert_severity, status, attempt_count,
       max_attempts, available_at, claim_started_at, claim_expires_at,
       last_attempt_at, last_error_code, sent_at, failed_at,
       suppressed_at, claim_is_stale
from public.payment_monitoring_alert_delivery_operations
order by updated_at desc, delivery_id desc
limit 100;
```

These views expose one row per incident and one row per sanitized delivery. The incident view selects the latest delivery deterministically by `created_at desc, id desc`. Neither view exposes email addresses, payloads, signatures, provider response bodies, secrets, payment details, card/UPI/mandate data, or customer contact data.

### Invocation correlation

```sql
select id, pg_net_request_id, status, invoked_at, started_at,
       completed_at, http_status, enqueued_count, claimed_count,
       sent_count, retry_scheduled_count, failed_count,
       suppressed_count, diagnostic_code
from public.payment_monitoring_alert_invocations
order by invoked_at desc, id desc
limit 100;
```

The invocation UUID is the only value passed in the JSON body to the alert Edge Function. The Cron wrapper stores the asynchronous `pg_net` request ID. The Edge Function validates the Cron secret before trusting the invocation UUID, then records `running`, `succeeded`, or `failed` with sanitized counts/codes. Missing Vault configuration is recorded as `not_configured` without creating an HTTP request. Invocation audit writes are best effort and never replace delivery claim finalization.

### Cron and `pg_net`

```sql
select jobid, jobname, schedule, command, active, username
from cron.job
where jobname in ('payment-monitoring-detection', 'payment-monitoring-alert-delivery');

select jobid, status, start_time, end_time
from cron.job_run_details
where jobid in (
  select jobid
  from cron.job
  where jobname in ('payment-monitoring-detection', 'payment-monitoring-alert-delivery')
)
order by start_time desc
limit 100;

select response.id, response.status_code, response.timed_out,
       response.created, (response.error_msg is not null) as has_error
from net._http_response as response
join public.payment_monitoring_alert_invocations as invocation
  on invocation.pg_net_request_id = response.id
order by response.created desc
limit 100;
```

Never select or copy `net._http_response.content`, headers, or raw error text into tickets, logs, incidents, or chat. The required jobs must remain exactly:

```text
payment-monitoring-detection       */5 * * * *       select public.run_payment_monitoring_cycle();
payment-monitoring-alert-delivery  2-59/5 * * * *    select public.invoke_payment_monitoring_alert_delivery();
```

## Incident triage

The detector records only sanitized source identifiers and diagnostic codes. It never copies the underlying provider error or webhook body. Review the incident view first, then the referenced source row using secure operator access if a source-level investigation is approved.

| Incident type | Meaning | Safe next step | Entitlement impact |
| --- | --- | --- | --- |
| `webhook_processing_failure` | A Razorpay webhook audit row failed, retained an error, or remained unprocessed beyond the observation window. | Inspect processing status/attempt count and the matching sanitized audit identifiers; escalate repeated failures. | None from monitoring; webhook/RPC state remains authoritative. |
| `webhook_correlation_failure` | A failed webhook could not be correlated to an internal subscription. | Verify provider subscription/event correlation using restricted access; use reconciliation when separately authorized. | No automatic activation or correction. |
| `subscription_creation_lease` | An internal subscription-creation lease exceeded its five-minute claim window. | Confirm whether the creation worker completed or safely released the lease; do not delete or rewrite the lease row. | None from monitoring. |
| `subscription_incomplete_stale` | An incomplete internal subscription has no provider subscription ID beyond the 30-minute observation window. | Inspect the creation audit and safe source identifiers; escalate a repeated creation failure. | Pro remains unavailable unless the authoritative lifecycle state says otherwise. |
| `provider_subscription_not_activated` | A provider subscription exists while the internal row remains incomplete beyond the preactivation window. | Compare provider lifecycle evidence with the internal webhook/reconciliation audit; use the authenticated reconciliation path when approved. | Monitoring does not activate Pro. |
| `reconciliation_processing_failure` | A reconciliation-sourced audit row failed or could not be correlated. | Inspect the sanitized audit row and retry only through the approved authenticated reconciliation operation. | No direct entitlement mutation. |
| `subscription_grace_period` | A `past_due` subscription passed its stored grace-period end. | Confirm provider/payment state and escalate for lifecycle review; do not manually change entitlement state. | The existing entitlement logic remains authoritative. |

Repeated-attempt diagnostics such as `webhook_repeated_attempts` or `reconciliation_repeated_attempts` raise severity; they are not a separate recovery mechanism. Resolution is allowed only after the source condition is fixed and the operator has a short sanitized resolution summary.

## Alert-delivery triage

- `pending`: queued for first delivery and waiting for its availability time.
- `processing`: claimed by the Edge Function with a bounded lease.
- `retry_scheduled`: a safe retryable error was recorded with bounded backoff.
- `sent`: provider acceptance was recorded with a sanitized provider message identifier.
- `failed`: terminal or exhausted delivery; critical while its incident remains open.
- `suppressed`: the incident was resolved before delivery; history is retained.

For `processing`, compare `claim_expires_at` with the observed time. For `retry_scheduled`, compare `available_at` and `attempt_count`; do not reset attempts manually. For `failed`, inspect only `last_error_code`, `failed_at`, incident severity, and safe operational logs. A failed email does not change subscription or entitlement state.

## Safe manual actions and prohibited actions

Allowed actions after authorization and evidence review:

- Re-run the named detector or alert wrapper through its restricted schema-qualified RPC.
- Resolve an incident through `resolve_payment_monitoring_incident` only after the source condition is fixed, using a sanitized summary.
- Restore the two exact job schedules/commands if an approved change caused drift.
- Disable only a named monitoring job during an incident response, record the reason, and restore it after the incident.
- Confirm the presence of the two Vault secret names without displaying values, or rotate the dedicated secret pair through the approved secret-management process.

Do not directly update monitoring rows as normal recovery. Do not manually activate or cancel Pro, replay provider webhooks, delete leases, rewrite delivery statuses, delete delivery history, reset attempts, replace provider identifiers, force incident resolution, or edit provider/payment records. Do not add an admin UI until a secure administrator authorization model is approved.

## Escalation

- `warning`: platform operations reviews the next successful cycle and open incident trend.
- `high`: payment-integration owner reviews within the team’s operational response process; preserve sanitized incident and invocation identifiers.
- `critical`: payment-integration owner and platform/database owner investigate immediately; involve the security owner if secret exposure or unauthorized access is suspected.

Escalation records must contain only environment, timestamps, UUIDs, statuses, counts, safe diagnostic codes, and links to restricted logs. Never include secrets, raw bodies, signatures, provider response text, customer contacts, or payment data.

## Production activation checklist

1. Review the Phase 1–4 migrations and confirm no entitlement, webhook, reconciliation, cancellation, or payment behavior changed.
2. Confirm the production `pg_cron`, `pg_net`, and Vault extensions are available.
3. Apply the migration through the approved deployment path and verify local/remote migration history before activation.
4. Confirm exactly one active detector job and one active alert job with the exact schedules and commands above.
5. Configure the two Vault names and the four server-only Edge Function secrets through the approved secret-management process; do not put values in migrations or source control.
6. Deploy the alert Edge Function only through the approved release process and confirm `verify_jwt = false` remains limited to this server-to-server function.
7. Run the health RPC and confirm recent successful Cron history, no stale claims, and no unexpected delivery backlog.
8. Execute one controlled sanitized operational test using fake identifiers and verify invocation correlation, safe logs, and one expected delivery. Do not use a customer or real payment.
9. Record the activation evidence without copying raw provider data, email addresses, secrets, or payment identifiers.

## Rollback

Pause the named alert job first, preserve the invocation/outbox/incident history, and disable the alert Edge Function or rotate its dedicated secrets through the approved process. If a database rollback is approved, unschedule only `payment-monitoring-alert-delivery` and remove only Phase 4 objects after confirming no dependent operational query is in use. Preserve Phase 1 incidents/detector/resolution, Phase 2 cycle/job, Phase 3 delivery history, provider lifecycle data, webhook/reconciliation history, and unrelated Cron jobs. Never drop `pg_cron`, `pg_net`, or Vault, and never delete history as part of rollback.

## Known gaps

The following remain pending: automated renewal lifecycle testing; failed renewal and three-day grace-period verification; pending, halted, paused, resumed, completed, and expired lifecycle verification; automated refunds; manual-review tooling; automated payment integration tests; monitoring/alerting beyond this MVP; an isolated staging/Test Mode Supabase environment; final production origin allow-list verification; and in-app cancellation. Cancellation currently occurs outside the application through Razorpay or the payment mandate.
