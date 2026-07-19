# Razorpay Subscriptions

## Overview

Razorpay Subscriptions is the approved payment provider for Smart Business Profile. The first paid product is Pro Analytics at ₹45 per month (`INR`). Subscriptions are account-level: every business profile owned by the subscribed account shares the same entitlement.

There is no trial and no annual plan initially. Follow and public profiles remain free. Analytics is the paid entitlement.

## Approved Test Mode plan

| Setting | Value |
|---|---|
| Plan name | Pro Analytics Monthly - Test |
| Razorpay Plan ID | `plan_TF1IGMjRDF1FU0` |
| Internal plan ID | `pro_analytics` |
| Amount | 4500 minor units / ₹45 |
| Interval | monthly |
| Environment | test |

The Plan ID is not a password, but it remains server-controlled configuration and must never be accepted from the frontend.

## Product rules

- Free owners receive public profiles and Follow.
- Pro Analytics unlocks full analytics.
- Checkout success alone cannot activate Pro.
- Only verified provider state processed through the webhook database path can activate Pro.
- Invalid, missing, or uncertain subscription state fails safely to Free.
- Failed recurring payments receive a maximum three-day grace period; repeated pending events do not extend it.
- Halted events do not start or extend grace. Paused status locks Pro immediately.
- Cancellation will later occur at cycle end. Refund automation is not part of the MVP.

## Architecture

The implementation consists of three Edge Functions:

1. `create-razorpay-subscription` is an authenticated endpoint. It uses fixed server plan configuration, calls the creation-claim RPC, creates a provider subscription server-to-server, and finalizes only as `incomplete`.
2. `verify-razorpay-subscription-checkout` is an authenticated endpoint. It verifies the Razorpay Checkout signature and never activates Pro.
3. `razorpay-subscription-webhook` is a public HTTP endpoint. It uses raw-body HMAC verification and processes verified provider state through the atomic webhook RPC. It is the only path in this integration that can move verified provider state into paid access.

## Function authentication configuration

```toml
[functions.create-razorpay-subscription]
verify_jwt = true

[functions.verify-razorpay-subscription-checkout]
verify_jwt = true

[functions.razorpay-subscription-webhook]
verify_jwt = false
```

Platform JWT validation is distinct from an authenticated Supabase request context, an RLS-scoped client, an admin client, and Razorpay provider signature verification. The first two functions require a user JWT. The webhook cannot have a Supabase user JWT, so it must authenticate its request with a valid Razorpay HMAC before using admin access.

## Supabase client model

The shared foundation uses `npm:@supabase/server@^1`. The authenticated context uses `auth: 'user'`; the webhook context uses `auth: 'none'` and does not authorize Razorpay by itself.

- `context.supabase` respects RLS and the verified caller identity.
- `context.supabaseAdmin` bypasses RLS and is permitted only after proper user authorization or verified provider signature validation.
- No frontend keys are manually read, no `VITE_*` values are used by server code, and service credentials never enter React.

`@supabase/server` is currently a v1 public-beta package and remains constrained to the v1 major until an explicitly reviewed upgrade.

## Existing database foundation

The database foundation contains:

- `business_owner_subscriptions`
- `subscription_webhook_events`
- `get_my_business_subscription()`
- `claim_razorpay_subscription_creation(...)`
- `finalize_razorpay_subscription_creation(...)`
- `release_razorpay_subscription_creation(...)`
- `process_razorpay_subscription_webhook(...)`

The atomic migration is applied and live verification passed. Backend RPCs are service-role only. Creation leases fail closed: stale claims require reconciliation rather than an automatic retry. Webhook processing is idempotent, stale provider events cannot overwrite newer processed state, and stored webhook payloads are sanitized.

## Required server configuration

| Variable | Classification | Purpose |
|---|---|---|
| `RAZORPAY_KEY_ID` | Sensitive server credential/configuration | Razorpay API key identifier |
| `RAZORPAY_KEY_SECRET` | Secret | Razorpay API and Checkout HMAC secret |
| `RAZORPAY_PLAN_ID` | Server-controlled configuration | Provider plan selected by server code |
| `RAZORPAY_WEBHOOK_SECRET` | Secret | Razorpay webhook HMAC secret |
| `RAZORPAY_ENVIRONMENT` | Server-controlled configuration | Exactly `test` or `live` |
| `SBP_ALLOWED_ORIGINS` | Server-controlled configuration | Exact browser-origin allow-list |

No real secret values are documented. The approved Test Plan ID above is not a credential, but remains server-controlled.

The three Edge Functions are deployed in Test Mode. The required hosted function secrets are configured, and their values are not documented.

## CORS policy

Browser origins use exact normalized allow-list matching; wildcards are never used. When no allowed-origin configuration is supplied, Test Mode permits only `http://localhost:5000`. Live Mode requires an explicit non-empty allow-list and does not automatically allow localhost.

The handlers process browser preflight requests explicitly. Server-to-server webhooks do not depend on browser CORS. CORS is not authentication.

## Razorpay API security

Server-to-server Razorpay API requests use Basic Authentication. The Key Secret never reaches the frontend, request bodies are not logged, and the shared API helper performs no automatic retries. GET failures may be marked retryable because GET does not modify provider state. POST and PATCH failures are not safely retryable when they are network errors, timeouts, aborts, HTTP 408, HTTP 429, 5xx responses, or invalid successful responses: those failures may represent an unknown mutation outcome. Unknown outcomes fail closed, and the handler must reconcile provider state before attempting another mutation. Creation requests place `sbp_creation_attempt_id` in approved provider notes.

Every Razorpay API caller must provide a runtime response parser. TypeScript generic types alone are not trusted: successful JSON is validated before provider fields are used, and parser failures produce sanitized provider errors. Raw provider responses are never exposed or logged.

Shared JSON helpers own CORS and security headers. Callers cannot override the origin, CORS, content-type, cache, or `Vary` headers. Only the reviewed `Allow` response header is currently accepted from helper options; expanding this allow-list requires explicit security review.

## Authenticated Edge Function endpoints

### Create subscription

`POST /functions/v1/create-razorpay-subscription` requires an authenticated Supabase user context and accepts only an empty body or `{}`. The owner ID comes exclusively from verified Supabase claims; billing configuration is fixed on the server. The function validates payment configuration before acquiring an atomic creation claim and uses the five approved Razorpay notes: `sbp_owner_id`, `sbp_subscription_id`, `sbp_plan_id`, `sbp_creation_attempt_id`, and `sbp_environment`.

The provider request uses the configured Plan ID, 120 billing cycles, quantity 1, customer notifications, and a 24-hour authorization expiry. Mutation requests are never automatically retried. Unknown outcomes retain the creation lease, while deterministic failures may release only the matching claim. `inspect_existing` fails closed after validating provider identity and correlation notes; an existing `created` subscription may be safely reused. Finalization leaves the internal subscription `incomplete` and never activates Pro Analytics.

The safe Checkout response contains only the provider, environment, Checkout key ID, provider subscription ID, display name and description, amount, currency, and a `reused` flag. It does not expose secrets, internal identifiers, notes, or provider response data.

### Checkout verification

`POST /functions/v1/verify-razorpay-subscription-checkout` requires an authenticated Supabase user context and exactly three fields: `razorpay_payment_id`, `razorpay_subscription_id`, and `razorpay_signature`. The expected provider subscription ID is loaded from the server database before comparison. HMAC verification uses the payment ID plus that server-stored subscription ID and makes no Razorpay API request.

This endpoint performs no database lifecycle mutation, entitlement activation, or webhook processing. A successful response means Checkout authorization was received; verified provider webhook confirmation is still pending before paid access can change.

## Public webhook endpoint

`POST /functions/v1/razorpay-subscription-webhook` is public with `verify_jwt = false`; Razorpay HMAC verification is the endpoint authentication mechanism. The raw request body is read once and verified before JSON parsing or creation of the webhook Supabase context. The `x-razorpay-event-id` header is the provider event identity used for idempotency under at-least-once delivery, so duplicate events are expected.

The function supports `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.completed`, `subscription.updated`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.paused`, and `subscription.resumed`. Event/status consistency, the server-configured Plan ID, and all five SBP correlation notes are validated before processing. Payment entities and payment/card/mandate information are discarded; only a sanitized subscription-only payload is stored.

No admin context is created before a valid signature. The existing atomic webhook RPC owns status mapping, stale-event handling, grace periods, and idempotency. `processed`, `duplicate`, `ignored`, and `stale_event` return HTTP 200; retryable processing failures return non-2xx. This verified webhook database path is the only paid-entitlement activation path.

The webhook function is deployed in Test Mode. The Razorpay Test Mode webhook is active and enabled for the ten approved subscription events.

## Signature security

Webhook signatures use the unchanged raw request body, HMAC-SHA256, strict hexadecimal-signature validation, and constant-time byte comparison. Checkout verification uses the payment ID plus the server-stored expected subscription ID. Signature verification alone never grants Pro access.

## Safe logging policy

Never log Razorpay Key Secrets, webhook secrets, Basic Authentication values, Supabase admin credentials, Authorization headers, complete raw webhook bodies, signatures, provider request bodies, complete provider responses, card data, mandate data, phone numbers, or email addresses.

Permitted future logs are limited to safe operational metadata such as operation name, environment, HTTP status, provider event type, sanitized internal correlation ID, safe provider error code, and elapsed time.

## Test and Live separation

Test and Live use separate API credentials, Plan IDs, webhook secrets, webhook endpoints or Supabase environments where practical, and provider data. The database provider value remains `razorpay` in both environments; do not use `razorpay_test` or `razorpay_live`.

## Local development and operational commands

The following commands are operational procedures and were not run for this correction task:

```bash
npx supabase functions serve <function-name> --env-file <local-env-file>
npx supabase functions deploy <function-name>
npx supabase secrets set --env-file <secure-env-file>
```

No local secret file is committed. This correction task does not redeploy functions or change hosted secrets.

## Frontend Checkout flow

The frontend Razorpay Checkout flow is completed locally, not yet committed or end-to-end tested. The existing Analytics locked-preview `Upgrade` button starts the subscription Checkout flow for eligible free business owners. It invokes `create-razorpay-subscription` with an empty object and uses the validated response to obtain the public Checkout Key ID and provider `subscription_id`.

The Razorpay Checkout script is lazy-loaded only after the button is clicked, through one shared module-level loader. Checkout receives only `key`, `subscription_id`, `name`, `description`, `handler`, and `modal.ondismiss`; it does not receive `amount`, currency, plan identifiers, owner identifiers, internal identifiers, or secrets. The server-created subscription determines the amount.

Checkout success is runtime-validated for the three required fields: `razorpay_payment_id`, `razorpay_subscription_id`, and `razorpay_signature`. The returned subscription ID must match the server-created subscription ID. The validated fields are sent exactly to `verify-razorpay-subscription-checkout`, and payment fields are kept in memory only.

Verification does not activate Pro Analytics. After verification, the existing business subscription context is refreshed immediately and then polled approximately every 2.5 seconds for no more than 30 seconds. Polling stops when backend entitlement reports Pro, the component unmounts, the authenticated owner changes or logs out, or the timeout is reached. The timeout remains safely locked and offers a manual `Check activation` refresh without reopening Checkout.

Checkout dismissal does not change entitlement. Payment authorization failures show a safe message, and malformed Checkout or server responses fail closed. Pro Analytics is shown only when the existing backend entitlement reports Pro; Checkout success and signature verification never set Pro locally.

Frontend Test Mode lifecycle testing is still pending. Cancellation and Live Mode remain unimplemented.

## Implementation status

Completed and deployed/configured in Test Mode:

- Product subscription rules
- Razorpay Test Mode account readiness
- Razorpay Test Plan creation
- Frontend entitlement gating
- Subscription database foundation
- Atomic backend RPC migration
- Live database verification
- Shared Edge Function infrastructure
- Create subscription Edge Function
- Checkout verification Edge Function
- Razorpay subscription webhook Edge Function
- Required Supabase Edge Function secrets
- Razorpay Test Mode webhook endpoint configuration
- Webhook enabled for the ten approved subscription events

Completed locally, not yet committed or end-to-end tested:

- Frontend Razorpay Checkout flow

Still pending:

- Test Mode end-to-end lifecycle testing
- Cancellation
- Live Mode activation
