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

Repeated detection refreshes the same open incident, increments `detection_count`, advances `last_detected_at` using the supplied observation time, and can escalate severity but never lower it automatically. Once resolved, a later occurrence creates a new incident while retaining the resolved history. Phase 1 has no schedule, Supabase Cron job, email or Slack delivery, admin UI, automated recovery, refund workflow, or frontend monitoring service.

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
- Administrator monitoring alerts and visibility
- Production activation of Phase 2 scheduled monitoring
- Isolated staging/Test Mode Supabase environment
- Final production origin allow-list verification
