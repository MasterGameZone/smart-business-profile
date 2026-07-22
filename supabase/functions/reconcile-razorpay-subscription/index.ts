import {
  handleCorsPreflight,
  internalServerError,
  jsonError,
  jsonSuccess,
  requireMethod,
} from "../_shared/http.ts";
import { createAuthenticatedContext } from "../_shared/supabaseClients.ts";
import {
  getRazorpayApiConfig,
  RazorpayApiError,
  RazorpayConfigurationError,
  razorpayApiRequest,
} from "../_shared/razorpay.ts";
import {
  hasValidFuturePaidPeriod,
  invalidProviderResponse,
  parseInternalSubscription,
  parseInvoiceCollection,
  parsePaidInvoice,
  parsePayment,
  parseProviderSubscription,
  parseReconciliationLifecycleResult,
  sanitizedReconciliationPayload,
  type InternalSubscription,
  type LifecycleResult,
  type PaidInvoice,
  type PaymentValidation,
  type ProviderSubscription,
  type UnixTimestamp,
} from "../_shared/razorpayReconciliationValidation.ts";

const MAX_REQUEST_BODY_BYTES = 4_096;
const SUBSCRIPTION_TOTAL_COUNT = 120;
const INVOICE_PAGE_SIZE = 100;
const MAX_INVOICE_PAGES = Math.ceil(SUBSCRIPTION_TOTAL_COUNT / INVOICE_PAGE_SIZE);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function nonBlankString(value: unknown, maxLength = 255): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

function ownerIdFromClaims(claims: unknown): string | null {
  if (!isRecord(claims)) {
    return null;
  }

  const ownerId = nonBlankString(claims.id);
  return ownerId !== null && isUuid(ownerId) ? ownerId : null;
}

async function hasEmptyJsonObjectBody(request: Request): Promise<boolean> {
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    return false;
  }

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BODY_BYTES) {
      return false;
    }

    const body: unknown = JSON.parse(rawBody);
    return isRecord(body) && Object.keys(body).length === 0;
  } catch {
    return false;
  }
}

async function fetchLatestPaidInvoice(providerSubscriptionId: string): Promise<PaidInvoice | null> {
  const invoices: PaidInvoice[] = [];

  for (let page = 0; page < MAX_INVOICE_PAGES; page += 1) {
    const skip = page * INVOICE_PAGE_SIZE;
    const items = await razorpayApiRequest(
      `/invoices?subscription_id=${encodeURIComponent(providerSubscriptionId)}&count=${INVOICE_PAGE_SIZE}&skip=${skip}`,
      { method: "GET" },
      parseInvoiceCollection,
    );

    if (items.length > INVOICE_PAGE_SIZE || invoices.length + items.length > SUBSCRIPTION_TOTAL_COUNT) {
      throw invalidProviderResponse();
    }

    for (const item of items) {
      const invoice = parsePaidInvoice(item, providerSubscriptionId);
      if (invoice !== null) {
        invoices.push(invoice);
      }
    }

    if (items.length < INVOICE_PAGE_SIZE) {
      break;
    }

    if (page === MAX_INVOICE_PAGES - 1) {
      throw invalidProviderResponse();
    }
  }

  invoices.sort((left, right) => {
    if (left.paidAt.seconds !== right.paidAt.seconds) {
      return right.paidAt.seconds - left.paidAt.seconds;
    }

    return right.id.localeCompare(left.id);
  });

  return invoices[0] ?? null;
}

function eventTypeForProviderStatus(status: string): string {
  switch (status) {
    case "created":
    case "expired":
      return "subscription.updated";
    case "authenticated":
      return "subscription.authenticated";
    case "active":
      return "subscription.activated";
    case "pending":
      return "subscription.pending";
    case "halted":
      return "subscription.halted";
    case "paused":
      return "subscription.paused";
    case "cancelled":
      return "subscription.cancelled";
    case "completed":
      return "subscription.completed";
    default:
      throw invalidProviderResponse();
  }
}

function providerCreatedAt(
  providerSubscription: ProviderSubscription,
  invoice: PaidInvoice | null,
): UnixTimestamp {
  if (providerSubscription.status === "cancelled" && providerSubscription.endedAt !== null) {
    return providerSubscription.endedAt;
  }

  return invoice?.paidAt ?? providerSubscription.createdAt;
}

async function deterministicReconciliationEventId(
  providerSubscription: ProviderSubscription,
  invoice: PaidInvoice | null,
  payment: PaymentValidation,
  hasVerifiedPaidFuturePeriod: boolean,
): Promise<string> {
  const paymentId = payment.kind === "verified" ? payment.payment.id : null;
  const stableFields = [
    providerSubscription.id,
    providerSubscription.status,
    providerSubscription.currentStart?.seconds ?? "null",
    providerSubscription.currentEnd?.seconds ?? "null",
    providerSubscription.endedAt?.seconds ?? "null",
    invoice?.id ?? "null",
    paymentId ?? "null",
    hasVerifiedPaidFuturePeriod ? "true" : "false",
  ];
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableFields.join("\n")));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `reconcile_razorpay_${hash}`;
}

function successResponse(
  request: Request,
  result: ReconciliationResult,
  status: "incomplete" | "active" | "past_due" | "canceled" | "expired" | "free",
  hasPaidPeriod: boolean,
): Response {
  return jsonSuccess({ result, status, hasPaidPeriod }, { request, status: 200 });
}

function reconciliationRejected(request: Request): Response {
  return jsonError("reconciliation_rejected", "The subscription status could not be reconciled.", {
    request,
    status: 409,
  });
}

function providerStateNotFound(request: Request): Response {
  return jsonError("provider_state_not_found", "The provider subscription could not be reconciled.", {
    request,
    status: 409,
  });
}

function providerUnavailable(request: Request): Response {
  return jsonError("provider_temporarily_unavailable", "Razorpay is temporarily unavailable. Please try again later.", {
    request,
    status: 503,
  });
}

function paymentNotConfirmedResponse(
  request: Request,
  status: InternalSubscription["status"],
): Response {
  return successResponse(request, "payment_not_confirmed", status, false);
}

function handleProviderError(error: unknown, request: Request): Response {
  if (error instanceof RazorpayConfigurationError) {
    return jsonError("server_configuration_error", "Server payment configuration is invalid.", {
      request,
      status: 500,
    });
  }

  if (error instanceof RazorpayApiError) {
    if (error.retryable) {
      return providerUnavailable(request);
    }
    if (error.status === 404) {
      return providerStateNotFound(request);
    }
    return reconciliationRejected(request);
  }

  return internalServerError(request);
}

export default {
  fetch: async (request: Request): Promise<Response> => {
    const preflight = handleCorsPreflight(request);
    if (preflight !== null) {
      return preflight;
    }

    const methodError = requireMethod(request, ["POST"]);
    if (methodError !== null) {
      return methodError;
    }

    const authResult = await createAuthenticatedContext(request);
    if (!authResult.ok) {
      return jsonError(authResult.code, authResult.message, { request, status: authResult.status });
    }

    const ownerId = ownerIdFromClaims(authResult.context.userClaims);
    if (ownerId === null) {
      return jsonError("invalid_authentication", "Authentication could not be verified.", {
        request,
        status: 401,
      });
    }

    if (!(await hasEmptyJsonObjectBody(request))) {
      return jsonError("invalid_request", "The request is invalid.", { request, status: 400 });
    }

    let config: ReturnType<typeof getRazorpayApiConfig>;
    try {
      config = getRazorpayApiConfig();
    } catch (error) {
      if (error instanceof RazorpayConfigurationError) {
        return jsonError("server_configuration_error", "Server payment configuration is invalid.", {
          request,
          status: 500,
        });
      }
      return internalServerError(request);
    }

    let internalSubscription: InternalSubscription | null;
    try {
      const { data, error } = await authResult.context.supabaseAdmin
        .from("business_owner_subscriptions")
        .select("id,owner_id,plan_id,billing_provider,provider_subscription_id,provider_plan_id,status")
        .eq("owner_id", ownerId)
        .maybeSingle();

      if (error !== null) {
        return jsonError("reconciliation_failed", "The subscription status could not be refreshed.", {
          request,
          status: 500,
        });
      }

      if (data === null) {
        return successResponse(request, "no_provider_subscription", "free", false);
      }

      internalSubscription = parseInternalSubscription(data, ownerId);
    } catch {
      return jsonError("reconciliation_failed", "The subscription status could not be refreshed.", {
        request,
        status: 500,
      });
    }

    if (internalSubscription === null) {
      return reconciliationRejected(request);
    }

    let providerSubscription: ProviderSubscription;
    let invoice: PaidInvoice | null;
    let payment: PaymentValidation;
    try {
      providerSubscription = await razorpayApiRequest(
        `/subscriptions/${encodeURIComponent(internalSubscription.providerSubscriptionId)}`,
        { method: "GET" },
        (payload) => parseProviderSubscription(payload, internalSubscription, config),
      );
      invoice = await fetchLatestPaidInvoice(providerSubscription.id);
      payment = invoice === null
        ? { kind: "not_confirmed" }
        : await razorpayApiRequest(
          `/payments/${encodeURIComponent(invoice.paymentId)}`,
          { method: "GET" },
          (payload) => parsePayment(payload, invoice),
        );
    } catch (error) {
      return handleProviderError(error, request);
    }

    if (payment.kind === "manual_review_required") {
      return successResponse(request, "manual_review_required", internalSubscription.status, false);
    }

    const hasVerifiedPaidFuturePeriod = hasValidFuturePaidPeriod(providerSubscription, invoice, payment);
    if (providerSubscription.status === "active" && !hasVerifiedPaidFuturePeriod) {
      return paymentNotConfirmedResponse(request, internalSubscription.status);
    }

    const effectiveCurrentStart = hasVerifiedPaidFuturePeriod ? providerSubscription.currentStart?.iso ?? null : null;
    const effectiveCurrentEnd = hasVerifiedPaidFuturePeriod ? providerSubscription.currentEnd?.iso ?? null : null;
    const createdAt = providerCreatedAt(providerSubscription, invoice);
    let eventId: string;
    try {
      eventId = await deterministicReconciliationEventId(
        providerSubscription,
        invoice,
        payment,
        hasVerifiedPaidFuturePeriod,
      );
    } catch {
      return internalServerError(request);
    }

    let lifecycle: LifecycleResult | null;
    try {
      const { data, error } = await authResult.context.supabaseAdmin.rpc(
        "reconcile_razorpay_subscription_snapshot",
        {
          p_provider_event_id: eventId,
          p_event_type: eventTypeForProviderStatus(providerSubscription.status),
          p_provider_created_at: createdAt.iso,
          p_provider_subscription_id: providerSubscription.id,
          p_provider_plan_id: providerSubscription.planId,
          p_provider_customer_id: providerSubscription.customerId,
          p_provider_status: providerSubscription.status,
          p_current_period_start: effectiveCurrentStart,
          p_current_period_end: effectiveCurrentEnd,
          p_ended_at: providerSubscription.endedAt?.iso ?? null,
          p_has_verified_paid_future_period: hasVerifiedPaidFuturePeriod,
          p_sanitized_payload: sanitizedReconciliationPayload(
            providerSubscription,
            invoice,
            payment,
            config.environment,
            hasVerifiedPaidFuturePeriod,
          ),
        },
      );

      if (error !== null) {
        return jsonError("reconciliation_failed", "The subscription status could not be refreshed.", {
          request,
          status: 500,
        });
      }

      lifecycle = parseReconciliationLifecycleResult(data);
    } catch {
      return jsonError("reconciliation_failed", "The subscription status could not be refreshed.", {
        request,
        status: 500,
      });
    }

    if (lifecycle === null) {
      return jsonError("reconciliation_failed", "The subscription status could not be refreshed.", {
        request,
        status: 500,
      });
    }

    const normalizedStatus = lifecycle.internalStatus ?? internalSubscription.status;
    if (lifecycle.result === "processed") {
      if (!hasVerifiedPaidFuturePeriod && payment.kind === "not_confirmed") {
        return paymentNotConfirmedResponse(request, normalizedStatus);
      }

      return successResponse(
        request,
        hasVerifiedPaidFuturePeriod ? "reconciled" : "provider_state_not_entitled",
        normalizedStatus,
        hasVerifiedPaidFuturePeriod,
      );
    }
    if (lifecycle.result === "duplicate") {
      return successResponse(
        request,
        "already_reconciled",
        normalizedStatus,
        hasVerifiedPaidFuturePeriod,
      );
    }
    if (lifecycle.result === "stale_event" || lifecycle.result === "ignored") {
      return successResponse(request, "provider_state_not_entitled", normalizedStatus, false);
    }

    return reconciliationRejected(request);
  },
};
