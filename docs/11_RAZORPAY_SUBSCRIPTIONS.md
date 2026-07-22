# Razorpay Subscriptions

## Overview

Razorpay Subscriptions is the approved payment provider for Smart Business Profile. The current paid product is Pro Analytics at ₹45 per month in Razorpay Live Mode.

Subscriptions are account-level. A paid subscription belongs to the authenticated Business Owner account and applies to every business profile owned by that account.

Public business profiles and Follow remain free. Analytics is the paid entitlement.

## Current Live Mode plan

| Setting | Value |
|---|---|
| Product | Pro Analytics |
| Internal plan ID | `pro_analytics` |
| Amount | `4500` minor units / ₹45 |
| Currency | `INR` |
| Billing interval | monthly |
| Environment | Razorpay Live Mode |
| Scope | Account-level Business Owner subscription |

The Razorpay provider Plan ID is server-controlled configuration through `RAZORPAY_PLAN_ID`. It is not accepted from the frontend and is not documented here.

## Product rules

- Free owners receive public profiles and Follow.
- Pro Analytics unlocks paid Analytics.
- Checkout success never activates Pro directly.
- Checkout signature verification never activates Pro directly.
- Paid entitlement comes only from verified provider lifecycle state processed through the webhook path or authenticated reconciliation path.
- Invalid, missing, or uncertain subscription state fails safely to Free.
- Failed recurring payments receive a maximum three-day grace period when provider lifecycle state verifies that condition.
- Repeated pending events do not extend an existing grace period.
- Halted events do not start or extend grace.
- Paused status locks Pro by clearing grace access.
- Cancellation currently happens outside the application through Razorpay or the payment mandate.
- In-app cancellation is pending.

## Edge Functions

The Live Mode implementation uses four deployed Supabase Edge Functions:

1. `create-razorpay-subscription` is an authenticated endpoint. It uses fixed server plan configuration, calls the creation-claim RPC, creates a provider subscription server-to-server, and finalizes only as `incomplete`.
2. `verify-razorpay-subscription-checkout` is an authenticated endpoint. It verifies the Razorpay Checkout signature and never activates Pro.
3. `reconcile-razorpay-subscription` is an authenticated endpoint. It accepts only `{}`, fetches the provider subscription and latest paid invoice state server-to-server, validates paid payment state, and processes a sanitized lifecycle snapshot through the reconciliation RPC.
4. `razorpay-subscription-webhook` is a public HTTP endpoint. It uses raw-body Razorpay HMAC verification and processes verified provider lifecycle state through the atomic webhook RPC.

## Function authentication configuration

Current `supabase/config.toml` configuration:

```toml
[functions.create-razorpay-subscription]
verify_jwt = true

[functions.verify-razorpay-subscription-checkout]
verify_jwt = true

[functions.reconcile-razorpay-subscription]
verify_jwt = true

[functions.razorpay-subscription-webhook]
verify_jwt = false
```

Platform JWT validation is distinct from an authenticated Supabase request context, an RLS-scoped client, an admin client, and Razorpay provider signature verification. The create, Checkout verification, and reconciliation functions require a user JWT. The webhook cannot have a Supabase user JWT, so it must authenticate its request with a valid Razorpay HMAC before using admin access.

## Supabase client model

The shared foundation uses `npm:@supabase/server@^1`. The authenticated context uses `auth: 'user'`; the webhook context uses `auth: 'none'` and does not authorize Razorpay by itself.

- `context.supabase` respects RLS and the verified caller identity.
- `context.supabaseAdmin` bypasses RLS and is permitted only after proper user authorization or verified provider signature validation.
- No frontend keys are manually read by server code.
- No `VITE_*` values are used by server code.
- Service credentials never enter React.

`@supabase/server` is currently a v1 public-beta package and remains constrained to the v1 major until an explicitly reviewed upgrade.

## Database foundation

The database foundation contains:

- `business_owner_subscriptions`
- `subscription_webhook_events`
- `get_my_business_subscription()`
- `claim_razorpay_subscription_creation(...)`
- `finalize_razorpay_subscription_creation(...)`
- `release_razorpay_subscription_creation(...)`
- `process_razorpay_subscription_webhook(...)`
- `reconcile_razorpay_subscription_snapshot(...)`

Backend RPCs are service-role only. Creation leases fail closed: stale claims require reconciliation rather than automatic retry. Webhook processing is idempotent, stale provider events cannot overwrite newer processed state, and stored webhook payloads are sanitized.

Effective Pro access is true only when `get_my_business_subscription()` reports backend entitlement from one of these states:

- `active` with an unexpired paid period
- `past_due` with an unexpired grace period
- `canceled` with an unexpired paid period

Free is represented by the absence of a subscription row or by fail-safe subscription lookup behavior.

## Required server configuration

| Variable | Classification | Purpose |
|---|---|---|
| `RAZORPAY_KEY_ID` | Sensitive server credential/configuration | Razorpay API key identifier |
| `RAZORPAY_KEY_SECRET` | Secret | Razorpay API and Checkout HMAC secret |
| `RAZORPAY_PLAN_ID` | Server-controlled configuration | Provider plan selected by server code |
| `RAZORPAY_WEBHOOK_SECRET` | Secret | Razorpay webhook HMAC secret |
| `RAZORPAY_ENVIRONMENT` | Server-controlled configuration | Exactly `test` or `live` |
| `SBP_ALLOWED_ORIGINS` | Server-controlled configuration | Exact browser-origin allow-list |

No real secret values are documented. Provider identifiers and account-specific identifiers are also not documented.

## CORS policy

Browser origins use exact normalized allow-list matching; wildcards are never used. When no allowed-origin configuration is supplied, Test Mode permits only `http://localhost:5000`. Live Mode requires an explicit non-empty allow-list and does not automatically allow localhost.

The handlers process browser preflight requests explicitly. Server-to-server webhooks do not depend on browser CORS. CORS is not authentication.

Final production origin allow-list verification remains pending.

## Razorpay API security

Server-to-server Razorpay API requests use Basic Authentication. The Key Secret never reaches the frontend, request bodies are not logged, and the shared API helper performs no automatic retries.

GET failures may be marked retryable because GET does not modify provider state. POST and PATCH failures are not safely retryable when they are network errors, timeouts, aborts, HTTP 408, HTTP 429, 5xx responses, or invalid successful responses: those failures may represent an unknown mutation outcome. Unknown outcomes fail closed, and the handler must reconcile provider state before attempting another mutation. Creation requests place `sbp_creation_attempt_id` in approved provider notes.

Every Razorpay API caller must provide a runtime response parser. TypeScript generic types alone are not trusted: successful JSON is validated before provider fields are used, and parser failures produce sanitized provider errors. Raw provider responses are never exposed or logged.

Shared JSON helpers own CORS and security headers. Callers cannot override the origin, CORS, content-type, cache, or `Vary` headers. Only the reviewed `Allow` response header is currently accepted from helper options; expanding this allow-list requires explicit security review.

## Authenticated Edge Function endpoints

### Create subscription

`POST /functions/v1/create-razorpay-subscription` requires an authenticated Supabase user context and accepts only an empty body or `{}`. The owner ID comes exclusively from verified Supabase claims; billing configuration is fixed on the server. The function validates payment configuration before acquiring an atomic creation claim and uses the five approved Razorpay notes: `sbp_owner_id`, `sbp_subscription_id`, `sbp_plan_id`, `sbp_creation_attempt_id`, and `sbp_environment`.

The provider request uses the configured Plan ID, 120 billing cycles, quantity 1, customer notifications, and a 24-hour authorization expiry. Mutation requests are never automatically retried. Unknown outcomes retain the creation lease, while deterministic failures may release only the matching claim. `inspect_existing` fails closed after validating provider identity and correlation notes; an existing `created` subscription may be safely reused. Finalization leaves the internal subscription `incomplete` and never activates Pro Analytics.

The safe Checkout response contains only the provider, environment, Checkout key ID, provider subscription ID, display name and description, amount, currency, and a `reused` flag. It does not expose secrets, internal identifiers, notes, or provider response data.

### Checkout verification

`POST /functions/v1/verify-razorpay-subscription-checkout` requires an authenticated Supabase user context and exactly three fields: `razorpay_payment_id`, `razorpay_subscription_id`, and `razorpay_signature`. The expected provider subscription ID is loaded from the server database before comparison. HMAC verification uses the payment ID plus that server-stored subscription ID and makes no Razorpay API request.

This endpoint performs no database lifecycle mutation, entitlement activation, or webhook processing. A successful response means Checkout authorization was received; verified provider lifecycle state is still required before paid access can change.

### Reconciliation

`POST /functions/v1/reconcile-razorpay-subscription` requires an authenticated Supabase user context and accepts only `{}` with `Content-Type: application/json`.

The function loads the caller's internal Razorpay subscription, fetches the provider subscription from Razorpay, fetches the latest paid invoice, validates captured payment state, and sends a sanitized provider snapshot to `reconcile_razorpay_subscription_snapshot(...)`.

Reconciliation can grant paid entitlement only when provider state and payment evidence prove a verified paid future period. Manual-review payment state, missing payment confirmation, missing provider state, plan mismatch, stale state, or unsupported lifecycle state fails closed and does not grant Pro.

The frontend uses this endpoint for authenticated post-Checkout refresh and manual status checks. It never locally grants access after reconciliation; it refreshes `get_my_business_subscription()` and trusts only the returned backend entitlement.

## Public webhook endpoint

`POST /functions/v1/razorpay-subscription-webhook` is public with `verify_jwt = false`; Razorpay HMAC verification is the endpoint authentication mechanism. The raw request body is read once and verified before JSON parsing or creation of the webhook Supabase context. The `x-razorpay-event-id` header is the provider event identity used for idempotency under at-least-once delivery, so duplicate events are expected.

The function supports `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.completed`, `subscription.updated`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.paused`, and `subscription.resumed`.

Event/status consistency, the server-configured Plan ID, and all five SBP correlation notes are validated before processing. Razorpay may send `subscription.authenticated` with provider status `authenticated` or `active`; both are valid for that event. Strict status validation remains in place for all other lifecycle events.

Payment entities and payment/card/mandate information are discarded; only a sanitized subscription-only payload is stored. No admin context is created before a valid signature. The existing atomic webhook RPC owns status mapping, stale-event handling, grace periods, and idempotency. `processed`, `duplicate`, `ignored`, and `stale_event` return HTTP 200; retryable processing failures return non-2xx.

This verified webhook database path is one of the two paid-entitlement activation paths. The other is authenticated reconciliation processing.

## Signature security

Webhook signatures use the unchanged raw request body, HMAC-SHA256, strict hexadecimal-signature validation, and constant-time byte comparison. Checkout verification uses the payment ID plus the server-stored expected subscription ID. Signature verification alone never grants Pro access.

## Frontend Checkout flow

The frontend Razorpay Checkout flow is implemented, committed, and verified. The existing Analytics locked-preview `Upgrade` button starts the subscription Checkout flow for eligible free business owners. It invokes `create-razorpay-subscription` with an empty object and uses the validated response to obtain the public Checkout Key ID and provider `subscription_id`.

The Razorpay Checkout script is lazy-loaded only after the button is clicked, through one shared module-level loader. Checkout receives only `key`, `subscription_id`, `name`, `description`, `handler`, and `modal.ondismiss`; it does not receive `amount`, currency, plan identifiers, owner identifiers, internal identifiers, or secrets. The server-created subscription determines the amount.

Checkout success is runtime-validated for the three required fields: `razorpay_payment_id`, `razorpay_subscription_id`, and `razorpay_signature`. The returned subscription ID must match the server-created subscription ID. The validated fields are sent exactly to `verify-razorpay-subscription-checkout`, and payment fields are kept in memory only.

Verification does not activate Pro Analytics. After verification, the existing business subscription context is refreshed immediately and then polled approximately every 2.5 seconds for no more than 30 seconds. Polling stops when backend entitlement reports Pro, the component unmounts, the authenticated owner changes or logs out, or the timeout is reached. The timeout remains safely locked and offers a manual status refresh without reopening Checkout.

Checkout dismissal does not change entitlement. Payment authorization failures show a safe message, and malformed Checkout or server responses fail closed. Pro Analytics is shown only when the existing backend entitlement reports Pro; Checkout success and signature verification never set Pro locally.

## Verified Live Mode production behavior

Verified production behavior:

- A real ₹45 Razorpay Live Mode subscription was successfully purchased.
- Account-level Pro Analytics unlocked successfully.
- `subscription.authenticated` returned HTTP 200.
- `subscription.activated` returned HTTP 200.
- `subscription.charged` returned HTTP 200.
- The verified entitlement was account-level, not profile-level.

Old HTTP 400 and HTTP 500 webhook attempts remain only as historical Razorpay logs from earlier validation/configuration attempts. They are not the current verified production behavior.

No real payment ID, subscription ID, account ID, owner UUID, creation-attempt UUID, webhook event ID, customer phone number, customer email address, payment detail, card data, UPI detail, raw webhook body, webhook signature, or service-role credential is documented.

## Migration history repair and database alignment

Supabase migration history has been repaired and aligned.

Verified migration/database state:

- Local and remote migration versions match.
- Schema diff reported no changes.
- `npx supabase db push --linked --dry-run` reported the remote database is up to date.

The relevant payment-system migrations are:

- `20260718160000_add_business_owner_subscription_foundation.sql`
- `20260718160002_add_razorpay_subscription_atomic_backend_rpcs.sql`
- `20260721034651_fix_razorpay_webhook_processing_attempts_ambiguity.sql`
- `20260721052114_add_razorpay_subscription_reconciliation_rpc.sql`

## Test and Live separation

Test and Live use separate API credentials, Plan IDs, webhook secrets, webhook endpoints or Supabase environments where practical, and provider data. The database provider value remains `razorpay` in both environments; do not use `razorpay_test` or `razorpay_live`.

An isolated staging/Test Mode Supabase environment remains pending.

## Local development and operational commands

The following commands are operational procedures and were not run for this documentation update:

```bash
npx supabase functions serve <function-name> --env-file <local-env-file>
npx supabase functions deploy <function-name>
npx supabase secrets set --env-file <secure-env-file>
```

No local secret file is committed. This documentation update does not redeploy functions or change hosted secrets.

## Automated payment test foundation

Phase 1 automated payment testing adds only local/CI test infrastructure. Phase 2 adds unit coverage for existing frontend response validation, Checkout and webhook HMAC verification, webhook event/status validation, sanitized payload validation, reconciliation result parsing, and Razorpay API error classification. These tests exercise pure logic with fake data and mocked Supabase, `fetch`, time, and Deno environment boundaries; they never call Razorpay, Supabase, or any external network service.

Available commands:

```bash
npm run test
npm run test:watch
npm run test:coverage
```

The test foundation uses Vitest with the `jsdom` environment, V8 coverage, React Testing Library, and fake Razorpay fixtures only. Tests must not call Razorpay, Supabase, or any external network service, and must not use real customer, payment, provider, webhook, or credential data.

Phase 2 tests do not claim to verify database idempotency, grace-period state transitions, actual duplicate-event protection, cancellation behavior, refunds, or the complete reconciliation lifecycle; those database and lifecycle areas are covered by Phase 3 below. Automated payment testing is therefore not fully resolved.

## Phase 3 local database integration tests

Phase 3 adds pgTAP integration coverage for the existing subscription tables, grants, RLS policies, creation leases, webhook lifecycle RPC, duplicate and stale-event handling, grace periods, cancellation, reconciliation snapshots, sanitized payload storage, and entitlement calculation. Tests use only the local Supabase database, deterministic fake users and Razorpay identifiers, transaction-local fixtures, and rollback cleanup. They do not use a linked project, production credentials, Razorpay, or any external network service.

Run the database test foundation locally:

```bash
npx supabase start
npx supabase db reset --local --no-seed
npx supabase test db --local supabase/tests/database
npx supabase stop --no-backup
```

Each SQL test starts a transaction, declares a pgTAP plan, calls `finish()`, and rolls back. The Phase 3 suite covers backend permissions and RLS, subscription creation/finalization/release, supported webhook lifecycle states, idempotency, stale-event protection, reconciliation result classification, and the database entitlement contract.

## Phase 4 frontend interaction tests

Phase 4 adds automated React Testing Library and Vitest interaction coverage for the existing Business Owner Pro Analytics flow. The suite covers locked and paid entitlement rendering, explicit Checkout start, Checkout field safety, success-response validation, backend verification, bounded polling and timeout handling, manual reconciliation, dismissal, payment failure, safe error mapping, concurrency guards, account changes, logout, stale async work, unmount cleanup, and the `BusinessSubscriptionProvider` contract.

All frontend interaction tests mock the Razorpay Checkout constructor, Checkout loader, and business subscription service/Supabase boundaries. They use deterministic fake identifiers and customer values only. No real payment, Checkout script, database, Supabase, Razorpay, or external network request occurs.

Phases 1 through 4 of the currently implemented payment system are covered by the automated test foundation, frontend unit tests, local database integration tests, and frontend interaction tests. This does not fully resolve the payment-testing issue: true automated refund workflow testing remains pending because refund automation is not implemented, and in-app cancellation UI testing remains pending because cancellation currently occurs outside the application through Razorpay or the payment mandate.

## Phase 1 payment monitoring database foundation

Phase 1 adds the observation-only migration `20260722073730_add_payment_monitoring_foundation.sql` and the local pgTAP test `payment_monitoring_foundation.test.sql`. It does not change payment lifecycle processing, entitlement calculation, webhook processing, reconciliation, creation leases, provider calls, or frontend behavior.

The private `public.payment_monitoring_incidents` table stores sanitized operational incidents only. It keeps a deterministic open incident key composed of the incident type, source table, and stable source row identifier. It records severity, open/resolved status, detection timestamps and count, optional owner and provider correlation identifiers, and a fixed diagnostic code. Webhook payloads, request bodies, signatures, provider errors, payment details, customer data, secrets, and stack traces are prohibited.

The internal `detect_payment_monitoring_incidents(p_observed_at)` RPC uses the existing `subscription_webhook_events` and `business_owner_subscriptions` schema. It is a `SECURITY DEFINER` function with an empty search path and is executable only by `service_role`; `anon` and `authenticated` have no table privileges or monitoring RPC execution privileges. RLS is enabled, and the table is not exposed to business owners, customers, or frontend Data API access. `resolve_payment_monitoring_incident(...)` accepts only a non-empty sanitized summary, preserves history, is idempotent for an already resolved incident, and never auto-resolves an incident because a later observation is clean.

The current detector classifications and thresholds are:

- Failed webhook processing: `high` for one failed event and `critical` for three or more processing attempts. Correlation failures are `critical`; received events that remain neither processed nor intentionally ignored for 15 minutes are `high`.
- Stale subscription creation lease: `high` after five minutes, using the authoritative `creation_started_at` lease window from the creation-claim RPC. Monitoring does not release the lease.
- Stale incomplete subscription without a provider subscription or active creation lease: `high` after 30 minutes, using the best available lifecycle timestamp (`updated_at`, then `created_at`).
- Provider subscription created but not internally activated: `critical` after 30 minutes while the internal row remains `incomplete` and has a provider subscription ID. This is kept separate from the generic incomplete detector to avoid duplicate root-cause incidents.
- Reconciliation failures: existing reconciliation processing is recorded in `subscription_webhook_events` with the sanitized `provider_api_reconciliation` source marker, so those rows are monitored using the same failure, repeated-attempt, unprocessed, and correlation rules. The repository has no separate reconciliation-required state or reconciliation-audit table; no new state or table was added merely for monitoring.
- Expired grace period: `critical` when an existing `past_due` row has `grace_period_end <= p_observed_at`. The detector does not normalize the subscription, remove entitlement, or invoke recovery.

Repeated detection refreshes the same open incident, increments `detection_count`, advances `last_detected_at` using the supplied observation time, and can escalate severity but never lower it automatically. Once resolved, a later occurrence creates a new incident while retaining the resolved history. Phase 1 itself has no email or Slack delivery, admin UI, automated recovery, refund workflow, or frontend monitoring service; Phase 2 provides the separate database schedule.

The proposed rollback is a controlled reverse migration after confirming that no internal monitoring caller depends on the RPCs: preserve or export operational incident history as required, revoke monitoring execution, then remove the monitoring functions, trigger, indexes, and table in dependency order. No rollback is currently applied to the remote project.

## Phase 2 scheduled monitoring

Phase 2 schedules the existing Phase 1 detector directly inside Postgres. The migration enables `pg_cron` when it is absent and creates exactly one active job named `payment-monitoring-detection` with the schedule `*/5 * * * *`. The stored command is:

```sql
select public.run_payment_monitoring_cycle();
```

The job runs as the existing database owner role, `postgres`. The restricted wrapper is `public.run_payment_monitoring_cycle(p_observed_at timestamptz default now())`, returns a sanitized `jsonb` summary, uses an empty `search_path`, and is executable by `service_role` and the Cron/database-owner role only. `anon` and `authenticated` cannot execute it. It passes one stable observation timestamp to `detect_payment_monitoring_incidents(...)` and reports only `observed_at`, `outcome`, `skipped`, and `incident_candidates_detected`.

Each cycle uses `pg_try_advisory_xact_lock` with the stable key `smart-business-profile:payment-monitoring-cycle`. A concurrent cycle returns a sanitized `skipped` outcome without creating an incident; the transaction-scoped lock releases automatically at transaction completion. The lock is limited to monitoring orchestration and does not lock subscription rows or interfere with checkout, webhook, reconciliation, or entitlement operations.

The Cron command contains no URL, HTTP call, Edge Function invocation, `pg_net`, Vault lookup, API key, token, authorization header, or user-controlled input. A detector failure propagates as a failed Cron execution, rolls back the cycle transaction, and is visible through Cron run history. Phase 2 adds no custom retry loop, monitoring-system incident, alert delivery, automatic recovery, automatic resolution, administrator email, Slack integration, alert Edge Function, frontend, or admin UI.

Operational inspection queries are:

```sql
select jobid, jobname, schedule, command, active, username
from cron.job
where jobname = 'payment-monitoring-detection';

select *
from cron.job_run_details
where jobid = (
  select jobid from cron.job
  where jobname = 'payment-monitoring-detection'
)
order by start_time desc
limit 20;

select public.run_payment_monitoring_cycle('2026-07-22T12:00:00Z'::timestamptz);
```

Local verification confirms one active named job, the five-minute schedule, the exact schema-qualified command, the `postgres` execution role, and the restricted wrapper privileges. Deterministic tests invoke the wrapper directly rather than waiting five minutes. A short local test run may produce no Cron history rows, and runtime overlap behavior requires two concurrent database sessions; the function source and lock key are verified in pgTAP.

Production activation is a controlled migration deployment after reviewing the named-job metadata and confirming that no unrelated Cron job is affected. After activation, inspect `cron.job` and recent `cron.job_run_details`; do not add a second job manually. The safe rollback is:

```sql
select cron.unschedule('payment-monitoring-detection');

select 1
from cron.job
where jobname = 'payment-monitoring-detection';
```

After confirming that no job references the wrapper, a later controlled rollback may drop only `run_payment_monitoring_cycle`. Preserve the Phase 1 incidents, detector, resolution RPC, payment source tables, and unrelated Cron jobs. Do not drop `pg_cron`, delete Cron history, or apply rollback during normal verification.

## Phase 3 administrator alert delivery

Phase 3 adds sanitized administrator email delivery for newly detected open `high` and `critical` incidents. It does not change payment lifecycle state, entitlement calculation, webhook processing, reconciliation, detection rules, incident resolution, creation leases, or automated recovery. The implementation is present in the migration `20260722085723_add_payment_monitoring_alert_delivery.sql`, the server-only Edge Function `deliver-payment-monitoring-alerts`, its shared pure helpers, and focused local tests. It has not been deployed, given production secrets, or used to send a real email.

### Audit result and provider choice

The audit found no existing approved transactional-email provider, provider client, administrator-alert integration, `pg_net` wrapper, Vault secret configuration, or general-purpose email utility in the repository. The existing business-owner and customer notification tables are user-facing and are not used for operational alerts. The reusable constant-time byte comparison helper in `supabase/functions/_shared/razorpay.ts` is used for the dedicated invocation secret. Resend is therefore the MVP provider for this phase, using its HTTP API through the platform `fetch` implementation; no Resend package was added.

The local Supabase image already provides `pg_net` and Vault’s `vault.decrypted_secrets` view. The migration enables `pg_net` only when it is absent and does not recreate or move an existing extension. Production Vault and `pg_net` availability must be confirmed before activation.

### Durable delivery outbox

`public.payment_monitoring_alert_deliveries` is a private RLS-protected outbox with one durable row per incident, channel, and alert severity. It stores the incident foreign key, `email` channel, `high`/`critical` severity, deterministic delivery key, attempt counters, availability time, claim lease, sanitized provider message ID, sanitized error code, terminal timestamps, and audit timestamps. It does not store the administrator address, email HTML, complete email bodies, provider requests or responses, webhook payloads, signatures, payment details, or customer contact information. The incident foreign key uses the default non-cascading behavior so delivery history is not deleted automatically.

Allowed delivery statuses are:

- `pending`: newly enqueued and due for its first attempt.
- `processing`: atomically claimed with a token and lease.
- `retry_scheduled`: a retryable failure has a future `available_at`.
- `sent`: a provider message ID and `sent_at` are recorded.
- `failed`: a terminal or exhausted failure has `failed_at`.
- `suppressed`: the incident was resolved before delivery and the history is retained.

The delivery key is `payment-monitoring-email:<incident-uuid>:<severity>`. A unique index makes insertion conflict-safe. Repeated detection and enqueue operations cannot create another delivery for the same incident and severity. A high incident gets one high delivery; when that same open incident escalates to critical, it gets exactly one additional critical delivery. An incident first seen as critical gets only its critical delivery, and a later recurrence is a new incident row with its own key. Warning and resolved incidents do not enter the send queue.

### Restricted database operations

The internal RPCs are `SECURITY DEFINER`, use an empty `search_path`, schema-qualify their objects, and are executable only by `service_role` and the required database-owner/Cron role. `PUBLIC`, `anon`, and `authenticated` cannot execute them or access the outbox table. RLS remains enabled with no frontend policies.

- `enqueue_payment_monitoring_alert_deliveries(p_observed_at timestamptz default now())` suppresses pending/retry rows whose incident is already resolved, enqueues only open high/critical incidents, uses the deterministic key, and returns only observation time and counts.
- `claim_payment_monitoring_alert_deliveries(p_max_batch_size integer default 10, p_observed_at timestamptz default now(), p_lease_seconds integer default 300)` clamps the batch to 10, accepts leases from 60 to 3,600 seconds, recovers expired claims, suppresses resolved incidents, and claims due rows with `FOR UPDATE SKIP LOCKED`. A claim increments `attempt_count` exactly once, sets `last_attempt_at`, and returns only the sanitized incident and delivery fields needed for the email.
- `mark_payment_monitoring_alert_delivery_sent(...)` requires the matching claim token and a safe provider message ID, clears the active lease, and is idempotent for the same sent result. Conflicting provider IDs are rejected.
- `mark_payment_monitoring_alert_delivery_failed(...)` requires the matching claim token and a safe error-code format. Retryable failures use bounded backoff of 5, 15, 30, and 60 minutes after attempts 1–4. The fifth attempt, any non-retryable failure, or an exhausted delivery becomes `failed`. Raw provider errors are never accepted or stored.

An expired processing claim returns to `retry_scheduled` while attempts remain or becomes terminal `failed` when the maximum is exhausted. Active claims cannot be stolen before their lease expires. Delivery operations never modify the incident, subscription, webhook-audit, reconciliation, or entitlement tables.

### Edge Function and email safety

`supabase/functions/deliver-payment-monitoring-alerts/index.ts` is configured with `verify_jwt = false` because it is server-to-server only. It accepts POST only and requires `x-payment-monitoring-cron-secret`. The expected value is `PAYMENT_MONITORING_CRON_SECRET`; it is compared with the shared constant-time helper. The secret is never accepted in a query parameter, URL path, or request body, and is never returned or logged. The function claims no more than 10 rows, processes deliveries sequentially, sends one provider request per delivery, continues after an individual failure, and uses an explicit 10-second outbound timeout without an in-function provider retry loop.

The required Edge Function secrets are `RESEND_API_KEY`, `PAYMENT_MONITORING_ADMIN_EMAIL`, `PAYMENT_MONITORING_FROM_EMAIL`, and `PAYMENT_MONITORING_CRON_SECRET`. The required Vault secrets are `payment_monitoring_alert_function_url` and `payment_monitoring_alert_cron_secret`; the Vault secret must match the Edge Function secret. These values are intentionally unset in the repository and are not placed in migrations, committed `.env` files, frontend variables, source code, or documentation examples. The Cron secret should use at least 32 bytes of high-entropy randomness. The sender must use the provider’s verified domain, and the recipient must be controlled by the platform operator. Local test values must never be reused in production.

Resend requests use the official API endpoint and send the deterministic delivery key in the `Idempotency-Key` header. Every retry of the same delivery row reuses that exact key; a critical escalation has a different key because its severity is part of the key. Database uniqueness remains authoritative if provider idempotency expires. Provider and network outcomes are mapped to safe codes such as `email_network_error`, `email_timeout`, `email_rate_limited`, `email_provider_unavailable`, `email_invalid_configuration`, `email_authentication_failed`, `email_invalid_recipient`, `email_invalid_sender`, `email_idempotency_conflict`, and `email_unknown_failure`. Only the delivery UUID, incident UUID, severity, safe error code, and attempt number are suitable log metadata.

Each email contains plain text and minimal escaped HTML with only severity, incident type, diagnostic code, incident UUID, first/last UTC detection times, detection count, source table, source record identifier, and provider subscription/event identifiers when present. It directs the administrator to inspect the database incident log and states that no automated recovery was performed. It contains no webhook payload, request body, signature, API key, secret, authorization header, provider response or raw error, stack trace, payment amount, card/payment-method data, customer or owner contact data, complete subscription object, complete audit record, tracking image, or admin-interface link.

### Vault wrapper and scheduled invocation

`public.invoke_payment_monitoring_alert_delivery()` reads only the two named Vault secrets, returns `{"status":"not_configured"}` without making an HTTP request when either is absent, and otherwise calls `net.http_post` with only a generated invocation UUID in the JSON body and the private Cron-secret header. Phase 4 persists both that invocation UUID and the asynchronous `pg_net` request ID in the restricted invocation audit table. It never returns decrypted secret values, the Cron secret, the function URL, or incident data. The request remains asynchronous and begins after transaction commit; the request ID, invocation UUID, and safe `net._http_response` metadata are the operational inspection references.

Phase 3 adds exactly one active Cron job, without changing Phase 2:

```text
Job:      payment-monitoring-alert-delivery
Schedule: 2-59/5 * * * *
Command:  select public.invoke_payment_monitoring_alert_delivery();
```

This runs at minutes 2, 7, 12, 17, 22, 27, 32, 37, 42, 47, 52, and 57—two minutes after the unchanged `payment-monitoring-detection` job. The stored command contains no URL, email address, API key, service-role key, authorization token, or invocation secret. Scheduling is keyed by the stable job name and does not create jobs per severity or incident type.

Useful inspection queries are:

```sql
select jobid, jobname, schedule, command, active, username
from cron.job
where jobname in ('payment-monitoring-detection', 'payment-monitoring-alert-delivery');

select id, incident_id, alert_severity, status, attempt_count, max_attempts,
       available_at, last_attempt_at, last_error_code, sent_at, failed_at, suppressed_at
from public.payment_monitoring_alert_deliveries
order by created_at desc
limit 50;

select *
from net._http_response
order by created desc
limit 20;
```

For retries, inspect `status`, `attempt_count`, `available_at`, and `last_error_code`. For terminal failures, inspect `failed_at` and the safe error code; never inspect or copy provider response bodies into application logs or incident rows.

### Local testing, production runbook, and rollback

Local verification uses the migration reset and the Phase 3/4 pgTAP files, including `supabase/tests/database/payment_monitoring_operations.test.sql`, which runs 46 focused operational-visibility tests without a live provider. Vitest tests import pure helpers and mock `fetch`; they cover POST-secret authorization helpers, missing configuration, UUID invocation validation, safe structured logs, HTML escaping, provider classification, timeout behavior, idempotency headers, batch limits, sanitized summaries, and continuing after a failed delivery. No test sends email, calls Resend, calls a remote Supabase project, or uses a production secret. Configured local correlation uses fake Vault values and a loopback request target only; it does not call Razorpay, a production Supabase project, or an external provider.
The Deno/Supabase Edge Runtime request path is not started inside the Vite/Vitest process; full authenticated server-to-server invocation remains part of the controlled production activation runbook and is not a Phase 3 local integration test.

Production activation is a controlled runbook and is not executed by this implementation:

1. Create or confirm the transactional-email provider and verify the sender domain.
2. Create the provider API key and generate a dedicated high-entropy Cron secret.
3. Set the four Edge Function secrets and deploy the Edge Function.
4. Store the function URL and matching Cron secret in Vault.
5. Apply the Phase 3 migration and verify both named Cron jobs.
6. Invoke the Edge Function with a controlled sanitized test incident, verify one administrator email and a `sent` row, then verify the invocation UUID, `pg_net` request ID, and a repeated invocation do not duplicate it.
7. Inspect `net._http_response` and Cron history, then remove or resolve the controlled test incident according to the approved runbook.

Secret rotation changes the Edge Function Cron secret and the matching Vault secret together, confirms the scheduled wrapper returns `requested`, and then inspects recent `net._http_response` and Cron history. Never put values into a migration or commit them. The non-destructive rollback is to unschedule only `payment-monitoring-alert-delivery`, confirm it is absent, drop the Phase 3 wrapper, disable or remove the Edge Function separately, and revoke or rotate only the dedicated Phase 3 secrets. Preserve incidents, delivery history, Phase 1 detection/resolution, Phase 2 cycle/detection job, payment lifecycle tables, webhook and reconciliation history, and unrelated Cron jobs. Do not drop `pg_cron`, `pg_net`, or Vault.

Phase 3 does not provide automatic incident resolution, subscription recovery, webhook replay, reconciliation recovery, an admin interface, a monitoring dashboard, acknowledgment or assignment workflow, Slack, SMS, push notifications, customer notifications, business-owner notifications, or frontend access. Cancellation remains outside the application through Razorpay or the payment mandate, and in-app cancellation remains pending.

## Phase 4 operational visibility

Phase 4 adds operational visibility only. It does not change payment behavior, subscription status mapping, entitlement calculation, webhook processing, reconciliation, cancellation, refund behavior, or the Phase 1–3 schedules. The implementation is local and requires a separately approved migration/Edge Function activation; no production secrets were added and nothing was deployed by this phase.

The new migration `20260722100357_add_payment_monitoring_operational_visibility.sql` provides:

- `public.payment_monitoring_incident_operations`, a restricted `security_invoker` view with one row per incident and deterministic latest-delivery information.
- `public.payment_monitoring_alert_delivery_operations`, a restricted `security_invoker` view with sanitized delivery status, lease, retry, and terminal-state fields.
- `public.get_payment_monitoring_operational_health(p_observed_at timestamptz default now())`, a restricted read-only JSON health RPC with separate monitoring-system and payment-incident health classifications.
- `public.payment_monitoring_alert_invocations`, a private RLS-protected audit table correlating the invocation UUID, `pg_net` request ID, sanitized status, timestamps, HTTP status, counters, and safe diagnostic code.

The health RPC treats the detector as stale after 15 minutes, the configured alert scheduler as stale after 20 minutes, and pending/retry work as overdue after 15 minutes. Missing/incorrect jobs, stale detector runs, repeated recent failures, stale claims, terminal failed deliveries for open incidents, and reliable `pg_net` failures are critical. Overdue pending/retry work, isolated failures followed by success, and temporary retry backlogs are degraded. Missing alert Vault configuration is `not_configured` when structural monitoring conditions remain sound. Payment-incident health is derived only from open incident severity and does not make monitoring-system health unhealthy by itself.

The wrapper now creates an invocation audit row, passes only its UUID to the Edge Function, stores the `pg_net` request ID, and records `not_configured` safely when Vault is incomplete. The Edge Function authenticates the Cron secret before trusting the UUID, marks the invocation running, and records sanitized success/failure counts. Audit-write failures do not prevent claimed-delivery finalization. Structured logs contain only invocation/incident/delivery UUIDs, severity, attempt, safe code, counters, and duration; no secrets, bodies, provider responses, customer data, or payment data are logged.

All Phase 4 tables, views, and RPCs are inaccessible to `PUBLIC`, `anon`, and `authenticated`; operational reads and internal execution are limited to the database owner and `service_role`. The repository has no approved administrator authorization model or admin route, so no UI is added. Operators use the [Payment Monitoring Operations Runbook](12_PAYMENT_MONITORING_OPERATIONS.md), Supabase Dashboard/SQL, Cron history, safe `pg_net` metadata, and Edge logs. An administrator interface remains deferred until secure authorization is approved.

Phase 4 local verification includes 46 pgTAP assertions for permissions, security-invoker views, one-row/latest-delivery behavior, sanitized fields, missing/configured request correlation, success/failure audit transitions, invalid IDs, health classifications, stale claims, and unchanged Cron identity. Vitest extends the existing helper tests for invocation UUID validation, auth-before-update design coverage, safe structured logs, idempotency, retry, and continuation behavior. The existing GitHub Actions workflows already run `npm ci`, frontend tests, coverage, production build, local migrations, and the full pgTAP directory on pushes and pull requests to `main`; no workflow change was necessary.

Phase 4 does not provide an administrator UI, automated renewal lifecycle testing, failed-renewal/grace-period verification, all provider lifecycle-state verification, automated refunds, manual-review tooling, automated payment integration tests, production monitoring/alerts activation, an isolated staging/Test Mode Supabase environment, final production origin allow-list verification, or in-app cancellation. Cancellation remains outside the application through Razorpay or the payment mandate.

## Safe logging and documentation policy

Never log or document:

- Razorpay Key Secrets
- Razorpay webhook secrets
- Basic Authentication values
- Supabase admin credentials
- Service-role credentials
- Authorization headers
- Complete raw webhook bodies
- Webhook signatures
- Provider request bodies
- Complete provider responses
- Real payment IDs
- Real subscription IDs
- Real account IDs
- Real owner UUIDs
- Real creation-attempt UUIDs
- Real webhook event IDs
- Card data
- UPI details
- Mandate data
- Payment details
- Customer phone numbers
- Customer email addresses

Permitted future logs are limited to safe operational metadata such as operation name, environment, HTTP status, provider event type, sanitized internal correlation label, safe provider error code, and elapsed time.

## Implementation status

Completed and deployed/configured in Live Mode:

- Product subscription rules
- Razorpay Live Mode account readiness
- Razorpay Live Mode Pro Analytics plan at ₹45/month
- Frontend entitlement gating
- Subscription database foundation
- Atomic backend RPC migration
- Webhook processing-attempt ambiguity fix
- Authenticated reconciliation RPC migration
- Phase 1 payment monitoring database foundation and local pgTAP coverage
- Phase 2 scheduled payment-monitoring detection migration and local pgTAP coverage
- Phase 3 sanitized administrator alert-delivery outbox, restricted RPCs, Edge Function, Cron wrapper, and local tests
- Phase 4 restricted operational views, health RPC, invocation correlation, runbook, and local tests (ready for controlled activation; not deployed by this phase)
- Migration-history repair and alignment
- Shared Edge Function infrastructure
- Create subscription Edge Function
- Checkout verification Edge Function
- Reconciliation Edge Function
- Razorpay subscription webhook Edge Function
- Phase 4 frontend payment interaction tests
- Required Supabase Edge Function secrets
- Razorpay Live Mode webhook endpoint configuration
- Frontend Razorpay Checkout flow
- Verified real ₹45 Live Mode purchase
- Verified account-level Pro Analytics unlock
- Verified HTTP 200 responses for `subscription.authenticated`, `subscription.activated`, and `subscription.charged`

Still pending:

- In-app cancellation
- Automated renewal lifecycle testing
- Failed renewal and three-day grace-period verification
- Pending, halted, paused, resumed, completed, and expired lifecycle verification
- Automated refund workflow
- Manual-review tooling
- Automated payment integration tests
- Administrator monitoring interface, dashboard, acknowledgment, and assignment visibility
- Production activation of Phase 2 scheduled monitoring
- Production activation of Phase 3 provider, Edge Function, Vault, and alert-delivery configuration
- Isolated staging/Test Mode Supabase environment
- Final production origin allow-list verification
