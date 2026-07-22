# Payment Lifecycle Staging Environment

## Status

The isolated Razorpay Test Mode staging environment is activated and remains separate from production. The staging migrations, four payment Edge Functions, Test Mode webhook, exact staging CORS origin, and two synthetic Business Owner accounts were verified through the approved staging workflow.

Phase 2A multi-user initial lifecycle verification completed on 2026-07-22. It covered two independent initial Test Mode purchases, webhook processing, account-level entitlement activation, and logout/account-switch isolation. Renewal, failure, grace-period, cancellation, refund, and later lifecycle states remain outside this phase.

Remote activation is permitted only after every required staging identifier and credential has been supplied through an approved secure channel. Never supply secret values in chat, source control, terminal output, application logs, or documentation.

## Environment matrix

| Boundary | Local development | Isolated staging | Production |
| --- | --- | --- | --- |
| Supabase project | Local Supabase stack or developer-local configuration only | Separate Supabase project; never the production project | Existing production project only |
| Frontend Supabase configuration | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from ignored local configuration | Staging-only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the staging Vercel deployment | Production-only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the production Vercel deployment |
| Razorpay environment | Fake values in unit tests; Test Mode only if a local Edge Function is explicitly configured | `RAZORPAY_ENVIRONMENT=test` | `RAZORPAY_ENVIRONMENT=live` |
| Razorpay credentials and plan | Fake fixtures only | Separate Test Mode Key ID, Key Secret, plan, and webhook secret | Live Mode Key ID, Key Secret, plan, and webhook secret only |
| Webhook endpoint | None unless a local test explicitly requires one | `https://<staging-project-ref>.supabase.co/functions/v1/razorpay-subscription-webhook` | Production webhook endpoint only |
| CORS | Local approved origin only | Exact staging Vercel origin only in `SBP_ALLOWED_ORIGINS` | Exact approved production origin only in `SBP_ALLOWED_ORIGINS` |
| Users and payment data | Fake fixtures or developer-local test users | Test-only business-owner accounts, Test Mode subscriptions, and Test Mode webhook events | Real production users and Live Mode provider data only |
| Deployment and rollback | Local only | Explicit staging project reference for every remote command; revert staging configuration only | Production change control only; never used for staging verification |

The frontend receives only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Razorpay credentials, plan identifiers, webhook secrets, service-role credentials, and all Edge Function configuration are server-only and must never use a `VITE_` prefix.

## Repository configuration templates

`.env.example` remains the browser-safe frontend template and uses the repository's existing variable names. `supabase/.env.staging.example` is a placeholder-only server configuration template for the staging secret manager. It must not be copied into a frontend environment or committed with real values.

The repository does not define additional application-owned Supabase server secrets for these payment functions. Supabase provides the server context used by the existing Edge Function helpers. Do not replace it with `VITE_*` variables or copy production Supabase credentials into staging.

## Existing configuration validation

`supabase/functions/_shared/razorpay.ts` accepts only `RAZORPAY_ENVIRONMENT=test` or `RAZORPAY_ENVIRONMENT=live` and fails closed for missing or invalid configuration. It also validates the documented Razorpay Key ID prefixes:

- Test Mode requires `rzp_test_`.
- Live Mode requires `rzp_live_`.

This prevents obvious Test/Live Key ID mixing without reading, logging, or returning Key Secrets. It is not a substitute for isolated projects and credentials: Razorpay Plan IDs and webhook secrets do not provide a documented environment prefix, so separation for them is enforced operationally through distinct Test Mode resources and staging-only secret configuration.

## Required activation inputs

All of the following must be explicitly supplied and approved before any remote write:

1. Staging Supabase project reference and project URL.
2. Staging frontend public/anon key.
3. Exact staging Vercel origin, with scheme and no trailing path, query, hash, wildcard, or preview-domain pattern.
4. Razorpay Test Mode Key ID.
5. Razorpay Test Mode Key Secret.
6. Razorpay Test Mode subscription Plan ID.
7. Razorpay Test Mode webhook secret.
8. Confirmation of the separate Razorpay Test Mode webhook endpoint.
9. Confirmation of any platform-provided server-only Supabase configuration required by the new staging project.

Missing values must be requested through an approved secure channel, never placed in this repository or chat. The production project, origin, credentials, webhook, users, database, Edge Functions, Cron jobs, Vault values, and Vercel environment must remain untouched.

## Activation order

Use the staging project reference explicitly for every remote command. Never rely on the currently linked project. Stop immediately if a command resolves to the production project.

1. Create or approve the separate Supabase staging project and verify its reference and URL.
2. Create a separate Vercel staging deployment or project and record its exact origin.
3. Apply the existing migrations to the staging database only, using an explicit staging database connection supplied through a secure channel. Run a dry run first; do not use `--linked` for this staging procedure.
4. Deploy the existing payment Edge Functions to the explicit staging project reference only:

   ```text
   npx supabase functions deploy create-razorpay-subscription verify-razorpay-subscription-checkout reconcile-razorpay-subscription razorpay-subscription-webhook --project-ref <STAGING_SUPABASE_PROJECT_REF>
   ```

5. Configure the Test Mode secrets only in the staging project, using a secure non-repository source. The required names are `RAZORPAY_ENVIRONMENT`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_ID`, `RAZORPAY_WEBHOOK_SECRET`, and `SBP_ALLOWED_ORIGINS`.
6. Set `RAZORPAY_ENVIRONMENT=test` and set `SBP_ALLOWED_ORIGINS` to the one exact staging Vercel origin.
7. Configure the staging Vercel deployment with the staging-only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
8. Configure the Razorpay Test Mode webhook to call only the staging webhook function and use its separate Test Mode webhook secret.
9. Create test-only Business Owner accounts in the staging Supabase project. Do not copy, import, or use production customer, subscription, webhook, or payment data.
10. Run the non-payment smoke verification below.

Rollback is scoped to staging: remove the staging webhook, revoke or rotate staging Test Mode secrets, remove staging Vercel variables/deployment, and retire the staging project only through approved change control. Never use rollback steps against production.

## Phase 2A multi-user initial lifecycle verification

Verification date: 2026-07-22.

Two synthetic staging owners were tested: Test Owner A and Test Owner B. Both showed Free/Locked Analytics before Checkout. Each completed one independent Razorpay Test Mode initial purchase through the staging frontend. No real customer or payment data was used.

The sanitized staging result was:

| Check | Result |
| --- | --- |
| Account-level subscription rows | 2 |
| Distinct owners with subscriptions | 2 |
| Duplicate owner rows | 0 |
| Active subscriptions | 2 |
| Paid Analytics entitlements | 2 |
| Distinct provider subscriptions | 2 |
| Processed webhook events | 6 |
| Duplicate provider events | 0 |
| Webhook event types | `subscription.authenticated`, `subscription.activated`, `subscription.charged` — 2 each |
| Webhook processing result | All 6 processed |
| Monitoring incidents | 0 |
| Outbound monitoring alert requests | 0 |
| Alert emails sent | 0 |

The staging webhook returned successful HTTP 200 outcomes for the verified initial lifecycle processing. Razorpay Test Mode webhook delivery and supported subscription events were confirmed. Checkout success and Checkout signature verification did not activate Pro directly; paid access appeared only after verified provider lifecycle processing.

The operator signed out and switched accounts between the two purchases. Owner B remained Free/Locked before its purchase, and the final account-level data showed one subscription, provider subscription, entitlement, and lifecycle event set per owner with no cross-owner correlation.

Production resources were not accessed or modified. No provider identifiers, user identifiers, credentials, signatures, payment details, or raw webhook bodies are recorded here.

Still pending for later lifecycle phases:

- Successful recurring renewal and duplicate renewal delivery behavior.
- Out-of-order lifecycle events.
- Failed renewal, pending state, and three-day grace-period behavior.
- Recovery after a failed renewal, retry exhaustion, and halted state.
- Grace-period expiry.
- Pause and resume.
- Immediate cancellation and end-of-cycle cancellation.
- Completion/expiry.
- Resubscription.
- Automated refund workflow.
- Manual-review tooling.
- Automated payment integration tests.
- Production monitoring and alerts activation.
- In-app cancellation, which remains outside the application through Razorpay or the payment mandate.

## Non-payment staging smoke verification

Do not start Razorpay Checkout or create a subscription during Phase 1.

1. Open the staging frontend and confirm its browser requests target only the staging Supabase project.
2. Confirm a test-only user can authenticate in staging.
3. Send approved-origin `OPTIONS` requests to `create-razorpay-subscription`, `verify-razorpay-subscription-checkout`, and `reconcile-razorpay-subscription`; each must return the staging origin exactly.
4. Confirm an unknown origin and a lookalike origin are rejected without `Access-Control-Allow-Origin`.
5. Send one harmless unauthenticated request to a browser function and confirm it fails safely with CORS preserved for the approved staging origin.
6. Send a fake no-Origin webhook request and confirm it reaches signature validation without processing an event.
7. Confirm no request targeted a production endpoint and that no payment, subscription, entitlement, webhook event, or database state changed.

## Verification and logging policy

Run `npm run test`, `npm run test:coverage`, and `npm run build` before activation. Run local Supabase database tests when Docker is available; otherwise record the unavailable Docker prerequisite without bypassing the remaining checks.

Only record sanitized results: environment class, approved origin count, function name, HTTP status, and safe error code. Never record credentials, Basic Auth values, raw webhook bodies, signatures, customer details, payment details, real provider identifiers, or service-role credentials.
