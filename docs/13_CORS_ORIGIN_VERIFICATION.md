Issue 10 — Production CORS Origin Verification

Status

Phase 1 repository audit and tests are complete. Phase 2 configured the approved production origin and verified deployed Edge Function preflight behavior, hostile-origin rejection, authentication responses, webhook signature boundaries, and authenticated production browser navigation. No browser CORS errors were observed.

Approved configuration contract

The future production configuration must use:

RAZORPAY_ENVIRONMENT=live
SBP_ALLOWED_ORIGINS=https://<final-vercel-production-domain>

Multiple approved origins use an exact comma-separated list:

SBP_ALLOWED_ORIGINS=https://<final-vercel-production-domain>,https://<approved-secondary-origin>

Every entry must contain only an http or https scheme, hostname, and optional port. The shared helper rejects:

* and wildcard patterns

missing or empty entries

paths such as /callback

query strings and hashes

usernames and passwords

malformed or unsupported-scheme URLs

Origin comparison is exact after URL normalization. The helper never reflects an unknown origin. Test Mode may use the existing http://localhost:5000 fallback when SBP_ALLOWED_ORIGINS is missing. Live Mode browser-origin requests fail closed with the sanitized server_configuration_error response when the variable is missing or invalid. No-Origin requests remain valid for legitimate server-to-server calls.

Edge Function audit and classifications

Edge Function

Classification

CORS behavior

Authentication boundary

create-razorpay-subscription

Browser-invoked authenticated function

Handles OPTIONS before method/auth/body/provider work; all success, expected errors, and internal errors pass the original request to shared helpers.

verify_jwt = true, then verified owner claims and subscription authorization.

verify-razorpay-subscription-checkout

Browser-invoked authenticated function

Handles OPTIONS before JWT/body/database/signature work; all response paths preserve the original request.

verify_jwt = true, then authenticated owner lookup and Checkout signature verification.

reconcile-razorpay-subscription

Browser-invoked authenticated function

Handles OPTIONS before JWT/body/Razorpay work; all response paths preserve the original request.

verify_jwt = true, then authenticated owner authorization.

razorpay-subscription-webhook

External webhook

Does not require an Origin header. The shared preflight/response behavior does not weaken POST signature validation.

verify_jwt = false; Razorpay HMAC signature, event validation, and webhook context remain authoritative.

deliver-payment-monitoring-alerts

Internal Cron/service-to-service function

Does not require an Origin header or browser access; method/error responses preserve the request when present.

verify_jwt = false; dedicated Cron secret and invocation correlation remain authoritative.

No Edge Function defines a wildcard CORS object, hardcodes localhost or a production hostname, or bypasses the shared JSON response helper for a browser-facing response. No handler rewrites were required by the audit.

Shared helper behavior

supabase/functions/_shared/http.ts owns the CORS and response headers. It provides:

handleCorsPreflight for explicit OPTIONS handling.

jsonSuccess, jsonError, internalServerError, and methodNotAllowed with request-aware CORS behavior.

getAllowedOrigins for environment-driven exact-origin parsing.

getRequestOrigin for validating the request’s Origin header.

buildCorsHeaders for reviewed shared header construction.

Unknown browser origins receive HTTP 403 without Access-Control-Allow-Origin. Missing/invalid Live Mode configuration receives HTTP 500 with only the sanitized server_configuration_error payload. No-Origin requests bypass browser CORS evaluation but do not bypass JWT, webhook signature, or Cron-secret checks.

Automated verification

src/test/payment/cors.test.ts verifies locally without network calls:

exact comma-separated allow-lists and deduplication

Test Mode localhost fallback

Live Mode missing configuration failure

wildcard, path, query, hash, credential, malformed, and unsupported origin rejection

approved preflight headers

unknown-origin rejection with no allow-origin reflection

sanitized Live Mode configuration errors

CORS preservation on success, expected errors, internal errors, and method-not-allowed responses

legitimate no-Origin server-to-server success

The test suite does not call Supabase, Razorpay, Vercel, or any external service.

Phase 2 final production-origin configuration and deployed verification

Verification date: 2026-07-22

Target environment: approved Supabase production project rmwkuvbflhugftisdets.

Prerequisites were confirmed: Phase 1 commit 43822db was pushed, the user-confirmed GitHub Actions runs were green, the final Vercel deployment existed, the exact Vercel origin was supplied and approved, the Supabase project was supplied and approved, and the required browser/payment functions were deployed. deliver-payment-monitoring-alerts is not deployed and was intentionally not deployed for this task; its no-Origin verification is deferred until Issue 6 payment-monitoring production activation.

One exact production origin was configured through the approved Supabase secret channel:

SBP_ALLOWED_ORIGINS=https://smart-business-profile-967s.vercel.app

No other secret was changed and no Edge Function was redeployed; the deployed functions accepted the new configuration immediately.

Functions tested:

create-razorpay-subscription

verify-razorpay-subscription-checkout

reconcile-razorpay-subscription

razorpay-subscription-webhook for the no-Origin server-to-server check

Results:

All three browser functions returned HTTP 204 to an approved-origin OPTIONS request, with Access-Control-Allow-Origin exactly equal to the approved origin, Vary containing Origin, POST, OPTIONS in the allowed methods, the required request headers allowed, no wildcard origin, and no response body.

Both https://attacker.example and https://smart-business-profile-967s.vercel.app.attacker.example returned HTTP 403 for preflight and did not receive Access-Control-Allow-Origin.

A harmless unauthenticated POST to verify-razorpay-subscription-checkout returned HTTP 401 with the sanitized invalid_authentication response and the exact approved-origin CORS headers. The request used only the local public client configuration in memory and did not create a payment, subscription, or database record.

A separate POST that omitted the gateway authorization header was rejected by the Supabase gateway before the Edge Function and returned a gateway-generated wildcard header. That response did not execute the function's shared CORS path; repeating the harmless request with the public client authorization headers reached the function and returned the exact approved-origin headers documented above.

A no-Origin POST to razorpay-subscription-webhook with fake test data returned HTTP 400 with invalid_webhook_signature, confirming that the request reached signature validation without requiring browser CORS. No webhook event was processed.

The production Vercel application loaded successfully. Authenticated business-owner navigation was completed without browser console or network CORS errors. No Upgrade, checkout, subscription creation, reconciliation, or payment action was triggered.

A sanitized Edge Function log query showed the expected rejected webhook request and no detected reconcile or alert-delivery activity in the returned recent window. The tested requests stop at preflight, authentication, or signature validation, so no Razorpay request, subscription creation, reconciliation, alert email, entitlement change, or payment/subscription state change occurred.

Final Phase 2 status

Production CORS verified

Verified production origin:

https://smart-business-profile-967s.vercel.app

Verified Supabase project:

rmwkuvbflhugftisdets

The following checks passed:

Approved-origin preflight returned HTTP 204 for all three browser payment Edge Functions.

Access-Control-Allow-Origin exactly matched the approved production origin.

Required methods and request headers were returned.

Unknown and lookalike origins were rejected with HTTP 403 and no CORS permission.

A harmless unauthenticated POST returned HTTP 401 with the correct CORS headers.

The Razorpay webhook remained accessible without an Origin header and reached signature validation.

The deployed Vercel application loaded correctly.

Authenticated business-owner browsing completed without browser console or network CORS errors.

No payment, subscription, entitlement, webhook, reconciliation, or database state was changed.

The deliver-payment-monitoring-alerts no-Origin verification remains deferred until the payment-monitoring production activation because that function is not currently deployed.

Issue 10 is complete.

Rollback

If an origin configuration is incorrect, remove the incorrect origin from the allow-list or restore the last approved exact list through the configuration-management process. Do not replace it with *, add a broad hostname pattern, change webhook authentication, or alter payment behavior. No function redeployment was required for the Phase 2 secret update.
