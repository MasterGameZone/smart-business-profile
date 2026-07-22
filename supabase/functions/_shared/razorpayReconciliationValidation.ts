import type { JsonValue } from "./json.ts";
import {
  RAZORPAY_AMOUNT_MINOR_UNITS,
  RAZORPAY_CURRENCY,
  RAZORPAY_INTERNAL_PLAN_ID,
  RazorpayApiError,
  type RazorpayApiConfig,
} from "./razorpay.ts";

const MAX_IDENTIFIER_LENGTH = 255;
const MAX_UNIX_SECONDS = 8_640_000_000_000;
const SUBSCRIPTION_TOTAL_COUNT = 120;
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

export type UnixTimestamp = { seconds: number; iso: string };

export type InternalSubscription = {
  id: string;
  ownerId: string;
  providerSubscriptionId: string;
  providerPlanId: string;
  status: "incomplete" | "active" | "past_due" | "canceled" | "expired";
};

export type ProviderSubscription = {
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

export type PaidInvoice = {
  id: string;
  paymentId: string;
  orderId: string | null;
  paidAt: UnixTimestamp;
};

export type VerifiedPayment = { id: string };

export type PaymentValidation =
  | { kind: "verified"; payment: VerifiedPayment }
  | { kind: "not_confirmed" }
  | { kind: "manual_review_required" };

export type LifecycleResult = {
  result: "processed" | "duplicate" | "ignored" | "stale_event" | "subscription_not_found" | "plan_mismatch" | "failed";
  webhookEventId: string;
  internalSubscriptionId: string | null;
  internalStatus: "incomplete" | "active" | "past_due" | "canceled" | "expired" | null;
  processingAttempts: number;
};

export type ReconciliationResult =
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

export function providerIdentifier(value: unknown, prefix: string): string | null {
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

export function validUnixTimestamp(value: unknown): UnixTimestamp | null {
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

export function invalidProviderResponse(): RazorpayApiError {
  return new RazorpayApiError("invalid_response", 502, null, false, false);
}

export function parseInternalSubscription(value: unknown, ownerId: string): InternalSubscription | null {
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

export function parseProviderSubscription(
  payload: JsonValue,
  subscription: InternalSubscription,
  config: RazorpayApiConfig,
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
    payload.quantity !== 1 ||
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

export function parseInvoiceCollection(payload: JsonValue): JsonValue[] {
  if (!isRecord(payload) || payload.entity !== "collection" || !Array.isArray(payload.items)) {
    throw invalidProviderResponse();
  }

  const count = payload.count;
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0 || count !== payload.items.length) {
    throw invalidProviderResponse();
  }

  return payload.items;
}

export function parsePaidInvoice(value: JsonValue, providerSubscriptionId: string): PaidInvoice | null {
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

export function parsePayment(payload: JsonValue, invoice: PaidInvoice): PaymentValidation {
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
    typeof amountRefunded !== "number" ||
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

export function hasValidFuturePaidPeriod(
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

export function parseReconciliationLifecycleResult(data: unknown): LifecycleResult | null {
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

export function sanitizedReconciliationPayload(
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
