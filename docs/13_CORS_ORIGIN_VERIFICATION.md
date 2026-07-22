# Issue 10 — Production CORS Origin Verification, Phase 1

## Status

Phase 1 is repository-only. No Vercel or Supabase deployment was performed, and the final Vercel production domain does not yet exist. The code, tests, and documentation are ready for a later deployed-domain browser verification.

## Approved configuration contract

The future production configuration must use:

```text
RAZORPAY_ENVIRONMENT=live
SBP_ALLOWED_ORIGINS=https://<final-vercel-production-domain>
```

Multiple approved origins use an exact comma-separated list:

```text
SBP_ALLOWED_ORIGINS=https://<final-vercel-production-domain>,https://<approved-secondary-origin>
```

Every entry must contain only an `http` or `https` scheme, hostname, and optional port. The shared helper rejects:

- `*` and wildcard patterns
- missing or empty entries
- paths such as `/callback`
- query strings and hashes
- usernames and passwords
- malformed or unsupported-scheme URLs

Origin comparison is exact after URL normalization. The helper never reflects an unknown origin. Test Mode may use the existing `http://localhost:5000` fallback when `SBP_ALLOWED_ORIGINS` is missing. Live Mode browser-origin requests fail closed with the sanitized `server_configuration_error` response when the variable is missing or invalid. No-Origin requests remain valid for legitimate server-to-server calls.

## Edge Function audit and classifications

| Edge Function | Classification | CORS behavior | Authentication boundary |
|---|---|---|---|
| `create-razorpay-subscription` | Browser-invoked authenticated function | Handles `OPTIONS` before method/auth/body/provider work; all success, expected errors, and internal errors pass the original request to shared helpers. | `verify_jwt = true`, then verified owner claims and subscription authorization. |
| `verify-razorpay-subscription-checkout` | Browser-invoked authenticated function | Handles `OPTIONS` before JWT/body/database/signature work; all response paths preserve the original request. | `verify_jwt = true`, then authenticated owner lookup and Checkout signature verification. |
| `reconcile-razorpay-subscription` | Browser-invoked authenticated function | Handles `OPTIONS` before JWT/body/Razorpay work; all response paths preserve the original request. | `verify_jwt = true`, then authenticated owner authorization. |
| `razorpay-subscription-webhook` | External webhook | Does not require an Origin header. The shared preflight/response behavior does not weaken POST signature validation. | `verify_jwt = false`; Razorpay HMAC signature, event validation, and webhook context remain authoritative. |
| `deliver-payment-monitoring-alerts` | Internal Cron/service-to-service function | Does not require an Origin header or browser access; method/error responses preserve the request when present. | `verify_jwt = false`; dedicated Cron secret and invocation correlation remain authoritative. |

No Edge Function defines a wildcard CORS object, hardcodes localhost or a production hostname, or bypasses the shared JSON response helper for a browser-facing response. No handler rewrites were required by the audit.

## Shared helper behavior

`supabase/functions/_shared/http.ts` owns the CORS and response headers. It provides:

- `handleCorsPreflight` for explicit `OPTIONS` handling.
- `jsonSuccess`, `jsonError`, `internalServerError`, and `methodNotAllowed` with request-aware CORS behavior.
- `getAllowedOrigins` for environment-driven exact-origin parsing.
- `getRequestOrigin` for validating the request’s Origin header.
- `buildCorsHeaders` for reviewed shared header construction.

Unknown browser origins receive HTTP 403 without `Access-Control-Allow-Origin`. Missing/invalid Live Mode configuration receives HTTP 500 with only the sanitized `server_configuration_error` payload. No-Origin requests bypass browser CORS evaluation but do not bypass JWT, webhook signature, or Cron-secret checks.

## Automated verification

`src/test/payment/cors.test.ts` verifies locally without network calls:

- exact comma-separated allow-lists and deduplication
- Test Mode localhost fallback
- Live Mode missing configuration failure
- wildcard, path, query, hash, credential, malformed, and unsupported origin rejection
- approved preflight headers
- unknown-origin rejection with no allow-origin reflection
- sanitized Live Mode configuration errors
- CORS preservation on success, expected errors, internal errors, and method-not-allowed responses
- legitimate no-Origin server-to-server success

The test suite does not call Supabase, Razorpay, Vercel, or any external service.

## Later deployed-domain verification

After the final Vercel production domain exists:

1. Configure `RAZORPAY_ENVIRONMENT=live` and the exact final domain in `SBP_ALLOWED_ORIGINS` through the approved secret/configuration channel.
2. Confirm the deployed Edge Function configuration contains no wildcard or unexpected origin.
3. From the final Vercel origin, verify successful preflight and authenticated calls to the three browser-invoked functions.
4. From an unknown browser origin, verify preflight and normal requests receive no `Access-Control-Allow-Origin` and are rejected safely.
5. Verify the Razorpay webhook and alert-delivery functions still accept legitimate no-Origin server-to-server calls.
6. Verify invalid or missing Live Mode origin configuration fails closed without exposing configuration values.
7. Record only sanitized status codes, origin classification, and safe error codes; do not record secrets, tokens, signatures, raw bodies, customer data, or payment data.

## Rollback

If a later origin configuration is incorrect, remove the incorrect origin from the allow-list or restore the last approved exact list through the configuration-management process. Do not replace it with `*`, add a broad hostname pattern, change webhook authentication, or alter payment behavior. No Phase 1 deployment rollback is required because this phase performs no deployment.
