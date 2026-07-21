import {
  handleCorsPreflight,
  internalServerError,
  jsonError,
  jsonSuccess,
  requireMethod,
  type JsonValue,
} from "../_shared/http.ts";
import { createAuthenticatedContext } from "../_shared/supabaseClients.ts";
import {
  getRazorpayApiConfig,
  RAZORPAY_AMOUNT_MINOR_UNITS,
  RAZORPAY_CURRENCY,
  RAZORPAY_INTERNAL_PLAN_ID,
  RazorpayApiError,
  RazorpayConfigurationError,
  razorpayApiRequest,
} from "../_shared/razorpay.ts";

const MAX_REQUEST_BODY_BYTES = 4_096;
const MAX_IDENTIFIER_LENGTH = 255;
const MAX_UNIX_SECONDS = 8_640_000_000_000;
const SUBSCRIPTION_TOTAL_COUNT = 120;
const SUBSCRIPTION_QUANTITY = 1;
const INVOICE_PAGE_SIZE = 100;
const MAX_INVOICE_PAGES = Math.ceil(SUBSCRIPTION_TOTAL_COUNT / INVOICE_PAGE_SIZE);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PROVIDER_STATUSES = new Set([
  "created",
  "authenticated",
  "active",
  "pending",
  "halted",
  "paused",
  "cancelled",
  "completed",
  "expired",
]);

const INTERNAL_STATUSES = new Set(["incomplete", "active", "past_due", "canceled", "expired"]);
const LIFECYCLE_RESULTS = new Set([
  "processed",
  "duplicate",
  "ignored",
  "stale_event",
  "subscription_not_found",
  "plan_mismatch",
  "failed",
]);

type UnixTimestamp = {
  seconds: number;
  iso: string;
};

type InternalSubscription = {
  id: string;
  ownerId: string;
  providerSubscriptionId: string;
  providerPlanId: string;
  status: "incomplete" | "active" | "past_due" | "canceled" | "expired";
};

type ProviderSubscription = {
  id: string;
  planId: string;
  customerId: string | null;
  status: string;
  createdAt: UnixTimestamp;
  currentStart: UnixTimestamp | null;
  currentEnd: UnixTimestamp | null;
  endedAt: UnixTimestamp | null;
  paidCount: number;
  totalCount: number;
};

type PaidInvoice = {
  id: string;
  paymentId: string;
  orderId: string | null;
  paidAt: UnixTimestamp;
};

type VerifiedPayment = {
  id: string;
};

type PaymentValidation =
  | { kind: "verified"; payment: VerifiedPayment }
  | { kind: "not_confirmed" }
  | { kind: "manual_review_required" };

type LifecycleResult = {
  result: "processed" | "duplicate" | "ignored" | "stale_event" | "subscription_not_found" | "plan_mismatch" | "failed";
  webhookEventId: string;
  internalSubscriptionId: string | null;
  internalStatus: "incomplete" | "active" | "past_due" | "canceled" | "expired" | null;
  processingAttempts: number;
};

type ReconciliationResult =
  | "reconciled"
  | "already_reconciled"
  | "no_provider_subscription"
  | "payment_not_confirmed"
  | "manual_review_required"
  | "provider_state_not_entitled";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function nonBlankString(value: unknown, maxLength = MAX_IDENTIFIER_LENGTH): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

function providerIdentifier(value: unknown, prefix: string): string | null {
  const identifier = nonBlankString(value);
  if (identifier === null || identifier !== value || !identifier.startsWith(prefix)) {
    return null;
  }

  return /^[A-Za-z0-9_]+$/.test(identifier) ? identifier : null;
}

function nullableProviderIdentifier(value: unknown, prefix: string): string | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }

  return providerIdentifier(value, prefix) ?? undefined;
}

function validUnixTimestamp(value: unknown): UnixTimestamp | null {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > MAX_UNIX_SECONDS
  ) {
    return null;
  }

  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? null : { seconds: value, iso: date.toISOString() };
}

function nullableUnixTimestamp(value: unknown): UnixTimestamp | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }

  return validUnixTimestamp(value) ?? undefined;
}

function isNotFuture(timestamp: UnixTimestamp): boolean {
  return timestamp.seconds * 1000 <= Date.now();
}

function invalidProviderResponse(): RazorpayApiError {
  return new RazorpayApiError("invalid_response", 502, null, false, false);
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

function parseInternalSubscription(value: unknown, ownerId: string): InternalSubscription | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = nonBlankString(value.id);
  const rowOwnerId = nonBlankString(value.owner_id);
  const providerSubscriptionId = providerIdentifier(value.provider_subscription_id, "sub_");
  const providerPlanId = providerIdentifier(value.provider_plan_id, "plan_");
  const status = value.status;

  if (
    id === null ||
    !isUuid(id) ||
    rowOwnerId !== ownerId ||
    value.plan_id !== RAZORPAY_INTERNAL_PLAN_ID ||
    value.billing_provider !== "razorpay" ||
    providerSubscriptionId === null ||
    providerPlanId === null ||
    typeof status !== "string" ||
    !INTERNAL_STATUSES.has(status)
  ) {
    return null;
  }

  return {
    id,
    ownerId: rowOwnerId,
    providerSubscriptionId,
    providerPlanId,
    status: status as InternalSubscription["status"],
  };
}

function parseProviderSubscription(
  payload: JsonValue,
  subscription: InternalSubscription,
  config: ReturnType<typeof getRazorpayApiConfig>,
): ProviderSubscription {
  if (!isRecord(payload) || !isRecord(payload.notes)) {
    throw invalidProviderResponse();
  }

  const id = providerIdentifier(payload.id, "sub_");
  const planId = providerIdentifier(payload.plan_id, "plan_");
  const status = nonBlankString(payload.status, 50);
  const createdAt = validUnixTimestamp(payload.created_at);
  const currentStart = nullableUnixTimestamp(payload.current_start);
  const currentEnd = nullableUnixTimestamp(payload.current_end);
  const endedAt = nullableUnixTimestamp(payload.ended_at);
  const customerId = providerIdentifier(payload.customer_id, "cust_");
  const paidCount = payload.paid_count;

  if (
    payload.entity !== "subscription" ||
    id === null ||
    id !== subscription.providerSubscriptionId ||
    planId === null ||
    planId !== subscription.providerPlanId ||
    planId !== config.planId ||
    payload.quantity !== SUBSCRIPTION_QUANTITY ||
    payload.total_count !== SUBSCRIPTION_TOTAL_COUNT ||
    payload.customer_notify !== true ||
    status === null ||
    !PROVIDER_STATUSES.has(status) ||
    createdAt === null ||
    !isNotFuture(createdAt) ||
    currentStart === undefined ||
    currentEnd === undefined ||
    endedAt === undefined ||
    typeof paidCount !== "number" ||
    !Number.isSafeInteger(paidCount) ||
    paidCount < 0 ||
    paidCount > SUBSCRIPTION_TOTAL_COUNT
  ) {
    throw invalidProviderResponse();
  }

  const notes = payload.notes;
  const creationAttemptId = notes.sbp_creation_attempt_id;
  if (
    notes.sbp_owner_id !== subscription.ownerId ||
    notes.sbp_subscription_id !== subscription.id ||
    notes.sbp_plan_id !== RAZORPAY_INTERNAL_PLAN_ID ||
    notes.sbp_environment !== config.environment ||
    (creationAttemptId !== undefined && !isUuid(creationAttemptId))
  ) {
    throw invalidProviderResponse();
  }

  return {
    id,
    planId,
    customerId,
    status,
    createdAt,
    currentStart,
    currentEnd,
    endedAt: endedAt === null || isNotFuture(endedAt) ? endedAt : null,
    paidCount,
    totalCount: SUBSCRIPTION_TOTAL_COUNT,
  };
}

function parseInvoiceCollection(payload: JsonValue): JsonValue[] {
  if (!isRecord(payload) || payload.entity !== "collection" || !Array.isArray(payload.items)) {
    throw invalidProviderResponse();
  }

  const count = payload.count;
  if (!Number.isSafeInteger(count) || count < 0 || count !== payload.items.length) {
    throw invalidProviderResponse();
  }

  return payload.items;
}

function parsePaidInvoice(value: JsonValue, providerSubscriptionId: string): PaidInvoice | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = providerIdentifier(value.id, "inv_");
  const paymentId = providerIdentifier(value.payment_id, "pay_");
  const orderId = nullableProviderIdentifier(value.order_id, "order_");
  const paidAt = validUnixTimestamp(value.paid_at);

  if (
    value.entity !== "invoice" ||
    id === null ||
    value.subscription_id !== providerSubscriptionId ||
    value.status !== "paid" ||
    value.currency !== RAZORPAY_CURRENCY ||
    value.amount !== RAZORPAY_AMOUNT_MINOR_UNITS ||
    value.amount_paid !== RAZORPAY_AMOUNT_MINOR_UNITS ||
    value.amount_due !== 0 ||
    paymentId === null ||
    orderId === undefined ||
    paidAt === null ||
    !isNotFuture(paidAt)
  ) {
    return null;
  }

  return { id, paymentId, orderId, paidAt };
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

function parsePayment(
  payload: JsonValue,
  invoice: PaidInvoice,
): PaymentValidation {
  if (!isRecord(payload)) {
    throw invalidProviderResponse();
  }

  const paymentId = providerIdentifier(payload.id, "pay_");
  const invoiceId = nullableProviderIdentifier(payload.invoice_id, "inv_");
  const orderId = nullableProviderIdentifier(payload.order_id, "order_");
  const amountRefunded = payload.amount_refunded;
  const refundStatus = payload.refund_status;

  if (
    payload.entity !== "payment" ||
    paymentId === null ||
    paymentId !== invoice.paymentId ||
    invoiceId === undefined ||
    orderId === undefined ||
    !Number.isSafeInteger(amountRefunded) ||
    amountRefunded < 0 ||
    (refundStatus !== null && typeof refundStatus !== "string")
  ) {
    throw invalidProviderResponse();
  }

  if (invoiceId !== null && invoiceId !== invoice.id) {
    throw invalidProviderResponse();
  }
  if (invoice.orderId !== null && orderId !== null && invoice.orderId !== orderId) {
    throw invalidProviderResponse();
  }
  if (invoiceId !== invoice.id && !(invoice.orderId !== null && invoice.orderId === orderId)) {
    throw invalidProviderResponse();
  }

  if (amountRefunded > 0 || refundStatus !== null) {
    return { kind: "manual_review_required" };
  }

  if (
    payload.status !== "captured" ||
    payload.captured !== true ||
    payload.amount !== RAZORPAY_AMOUNT_MINOR_UNITS ||
    payload.currency !== RAZORPAY_CURRENCY
  ) {
    return { kind: "not_confirmed" };
  }

  return { kind: "verified", payment: { id: paymentId } };
}

function hasValidFuturePaidPeriod(
  providerSubscription: ProviderSubscription,
  invoice: PaidInvoice | null,
  payment: PaymentValidation,
): boolean {
  return (
    invoice !== null &&
    payment.kind === "verified" &&
    providerSubscription.currentStart !== null &&
    providerSubscription.currentEnd !== null &&
    providerSubscription.currentEnd.seconds > providerSubscription.currentStart.seconds &&
    providerSubscription.currentEnd.seconds * 1000 > Date.now()
  );
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

function sanitizedPayload(
  providerSubscription: ProviderSubscription,
  invoice: PaidInvoice | null,
  payment: PaymentValidation,
  environment: "test" | "live",
  hasVerifiedPaidFuturePeriod: boolean,
): JsonValue {
  const verifiedPayment = payment.kind === "verified" ? payment.payment : null;

  return {
    source: "provider_api_reconciliation",
    environment,
    subscription: {
      id: providerSubscription.id,
      plan_id: providerSubscription.planId,
      status: providerSubscription.status,
      current_start: hasVerifiedPaidFuturePeriod ? providerSubscription.currentStart?.seconds ?? null : null,
      current_end: hasVerifiedPaidFuturePeriod ? providerSubscription.currentEnd?.seconds ?? null : null,
      ended_at: providerSubscription.endedAt?.seconds ?? null,
      paid_count: providerSubscription.paidCount,
      total_count: providerSubscription.totalCount,
    },
    invoice: invoice === null
      ? null
      : {
        id: invoice.id,
        status: "paid",
        amount: RAZORPAY_AMOUNT_MINOR_UNITS,
        amount_paid: RAZORPAY_AMOUNT_MINOR_UNITS,
        amount_due: 0,
        currency: RAZORPAY_CURRENCY,
        paid_at: invoice.paidAt.seconds,
      },
    payment: verifiedPayment === null
      ? null
      : {
        id: verifiedPayment.id,
        status: "captured",
        amount: RAZORPAY_AMOUNT_MINOR_UNITS,
        currency: RAZORPAY_CURRENCY,
        captured: true,
        amount_refunded: 0,
      },
    has_verified_paid_future_period: hasVerifiedPaidFuturePeriod,
  };
}

function parseLifecycleResult(data: unknown): LifecycleResult | null {
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
    return null;
  }

  const row = data[0];
  const result = row.result;
  const webhookEventId = row.webhook_event_id;
  const internalSubscriptionId = row.internal_subscription_id;
  const internalStatus = row.internal_status;
  const processingAttempts = row.processing_attempts;

  if (
    typeof result !== "string" ||
    !LIFECYCLE_RESULTS.has(result) ||
    !isUuid(webhookEventId) ||
    (internalSubscriptionId !== null && !isUuid(internalSubscriptionId)) ||
    (internalStatus !== null && (typeof internalStatus !== "string" || !INTERNAL_STATUSES.has(internalStatus))) ||
    typeof processingAttempts !== "number" ||
    !Number.isSafeInteger(processingAttempts) ||
    processingAttempts < 0
  ) {
    return null;
  }

  return {
    result: result as LifecycleResult["result"],
    webhookEventId,
    internalSubscriptionId,
    internalStatus: internalStatus as LifecycleResult["internalStatus"],
    processingAttempts,
  };
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
          p_sanitized_payload: sanitizedPayload(
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

      lifecycle = parseLifecycleResult(data);
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
