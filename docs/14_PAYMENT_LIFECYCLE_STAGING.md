# Payment Lifecycle Staging Environment

## Status

This document defines the repository-side foundation for an isolated Razorpay Test Mode staging environment. No staging project, Vercel deployment, Razorpay Test Mode plan, webhook, user, migration, secret, or Edge Function deployment has been created or changed by this phase.

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
