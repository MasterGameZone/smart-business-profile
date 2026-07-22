import type { JsonValue } from "./json.ts";

const MAX_EVENT_TYPE_LENGTH = 100;
const MAX_CONTAINS_VALUE_LENGTH = 100;
const MAX_UNIX_SECONDS = 8_640_000_000_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SUPPORTED_WEBHOOK_EVENTS = [
  "subscription.authenticated",
  "subscription.activated",
  "subscription.charged",
  "subscription.completed",
  "subscription.updated",
  "subscription.pending",
  "subscription.halted",
  "subscription.cancelled",
  "subscription.paused",
  "subscription.resumed",
] as const;

export const PROVIDER_STATUSES = [
  "created",
  "authenticated",
  "active",
  "pending",
  "halted",
  "paused",
  "cancelled",
  "completed",
  "expired",
] as const;

const INTERNAL_STATUSES = new Set(["incomplete", "active", "past_due", "canceled", "expired"]);
const EVENT_STATUS: Readonly<Record<string, string | null>> = {
  "subscription.authenticated": "authenticated",
  "subscription.activated": "active",
  "subscription.charged": "active",
  "subscription.completed": "completed",
  "subscription.updated": null,
  "subscription.pending": "pending",
  "subscription.halted": "halted",
  "subscription.cancelled": "cancelled",
  "subscription.paused": "paused",
  "subscription.resumed": "active",
};

const CORRELATION_NOTE_KEYS = [
  "sbp_owner_id",
  "sbp_subscription_id",
  "sbp_plan_id",
  "sbp_creation_attempt_id",
  "sbp_environment",
] as const;

export type WebhookValidationConfig = { environment: "test" | "live" };

export type WebhookEnvelope = {
  eventType: string;
  providerCreatedAt: string;
  contains: string[];
  payload: Record<string, unknown>;
};

export type CorrelationNotes = {
  sbp_owner_id: string;
  sbp_subscription_id: string;
  sbp_plan_id: "pro_analytics";
  sbp_creation_attempt_id: string;
  sbp_environment: "test" | "live";
};

export type SubscriptionEvent = {
  id: string;
  planId: string;
  customerId: string | null;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  endedAt: string | null;
  notes: CorrelationNotes;
};

export type WebhookRpcResult = {
  result: "processed" | "duplicate" | "ignored" | "stale_event" | "subscription_not_found" | "plan_mismatch" | "failed";
  webhookEventId: string;
  internalSubscriptionId: string | null;
  internalStatus: string | null;
  processingAttempts: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function nonBlankString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

function unixSecondsToIso(value: unknown): string | null {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > MAX_UNIX_SECONDS
  ) {
    return null;
  }

  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function nullableUnixSecondsToIso(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  return unixSecondsToIso(value) ?? undefined;
}

export function parseWebhookEnvelope(payload: unknown): WebhookEnvelope | null {
  if (!isRecord(payload) || payload.entity !== "event") {
    return null;
  }

  const eventType = nonBlankString(payload.event, MAX_EVENT_TYPE_LENGTH);
  const providerCreatedAt = unixSecondsToIso(payload.created_at);
  const contains = payload.contains;
  const eventPayload = payload.payload;

  if (
    eventType === null ||
    providerCreatedAt === null ||
    !Array.isArray(contains) ||
    !contains.every((value) => nonBlankString(value, MAX_CONTAINS_VALUE_LENGTH) !== null) ||
    !isRecord(eventPayload)
  ) {
    return null;
  }

  return {
    eventType,
    providerCreatedAt,
    contains: contains.map((value) => String(value)),
    payload: eventPayload,
  };
}

export function parseWebhookCorrelationNotes(
  value: unknown,
  config: WebhookValidationConfig,
): CorrelationNotes | null {
  if (!isRecord(value)) {
    return null;
  }

  const ownerId = value.sbp_owner_id;
  const subscriptionId = value.sbp_subscription_id;
  const planId = value.sbp_plan_id;
  const creationAttemptId = value.sbp_creation_attempt_id;
  const environment = value.sbp_environment;

  if (
    CORRELATION_NOTE_KEYS.some((key) => typeof value[key] !== "string" || value[key] === "") ||
    !isUuid(ownerId) ||
    !isUuid(subscriptionId) ||
    planId !== "pro_analytics" ||
    !isUuid(creationAttemptId) ||
    environment !== config.environment
  ) {
    return null;
  }

  return {
    sbp_owner_id: ownerId,
    sbp_subscription_id: subscriptionId,
    sbp_plan_id: "pro_analytics",
    sbp_creation_attempt_id: creationAttemptId,
    sbp_environment: config.environment,
  };
}

export function parseWebhookSubscriptionEntity(
  value: unknown,
  config: WebhookValidationConfig,
): SubscriptionEvent | null {
  if (!isRecord(value) || value.entity !== "subscription") {
    return null;
  }

  const id = nonBlankString(value.id, 255);
  const planId = nonBlankString(value.plan_id, 255);
  const customerId = value.customer_id === null ? null : nonBlankString(value.customer_id, 255);
  const status = nonBlankString(value.status, 50);
  const notes = parseWebhookCorrelationNotes(value.notes, config);
  const currentPeriodStart = nullableUnixSecondsToIso(value.current_start);
  const currentPeriodEnd = nullableUnixSecondsToIso(value.current_end);
  const endedAt = nullableUnixSecondsToIso(value.ended_at);

  if (
    id === null ||
    !id.startsWith("sub_") ||
    planId === null ||
    !planId.startsWith("plan_") ||
    (value.customer_id !== null && (customerId === null || !customerId.startsWith("cust_"))) ||
    status === null ||
    !(PROVIDER_STATUSES as readonly string[]).includes(status) ||
    value.quantity !== 1 ||
    value.total_count !== 120 ||
    value.customer_notify !== true ||
    notes === null ||
    currentPeriodStart === undefined ||
    currentPeriodEnd === undefined ||
    endedAt === undefined ||
    (currentPeriodStart !== null && currentPeriodEnd !== null && currentPeriodEnd <= currentPeriodStart) ||
    (status === "active" && (currentPeriodStart === null || currentPeriodEnd === null))
  ) {
    return null;
  }

  return { id, planId, customerId, status, currentPeriodStart, currentPeriodEnd, endedAt, notes };
}

export function webhookEventStatusMatches(eventType: string, status: string): boolean {
  if (eventType === "subscription.authenticated") {
    return status === "authenticated" || status === "active";
  }

  const expectedStatus = EVENT_STATUS[eventType];
  return expectedStatus === null || expectedStatus === status;
}

export function webhookPlanMatchesConfiguredPlan(
  subscription: SubscriptionEvent,
  configuredPlanId: string,
): boolean {
  return subscription.planId === configuredPlanId;
}

export function parseWebhookRpcResult(data: unknown): WebhookRpcResult | null {
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
    return null;
  }

  const row = data[0];
  const result = row.result;
  const webhookEventId = row.webhook_event_id;
  const internalSubscriptionId = row.internal_subscription_id;
  const internalStatus = row.internal_status;
  const processingAttempts = row.processing_attempts;
  const allowedResults = [
    "processed",
    "duplicate",
    "ignored",
    "stale_event",
    "subscription_not_found",
    "plan_mismatch",
    "failed",
  ];

  if (
    typeof result !== "string" ||
    !allowedResults.includes(result) ||
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
    result: result as WebhookRpcResult["result"],
    webhookEventId,
    internalSubscriptionId,
    internalStatus,
    processingAttempts,
  };
}

export function sanitizedWebhookPayload(
  eventId: string,
  envelope: WebhookEnvelope,
  subscription: SubscriptionEvent,
): JsonValue {
  return {
    schema_version: 1,
    provider_event_id: eventId,
    event_type: envelope.eventType,
    provider_created_at: envelope.providerCreatedAt,
    subscription: {
      id: subscription.id,
      plan_id: subscription.planId,
      customer_id: subscription.customerId,
      status: subscription.status,
      current_period_start: subscription.currentPeriodStart,
      current_period_end: subscription.currentPeriodEnd,
      ended_at: subscription.endedAt,
      quantity: 1,
      total_count: 120,
      customer_notify: true,
      notes: subscription.notes,
    },
  };
}

export function webhookCorrelationMatchesRow(
  row: Record<string, unknown>,
  subscription: SubscriptionEvent,
  configuredPlanId: string,
): boolean {
  const rowId = row.id;
  const ownerId = row.owner_id;
  const providerSubscriptionId = row.provider_subscription_id;
  const providerPlanId = row.provider_plan_id;

  return (
    isUuid(rowId) &&
    isUuid(ownerId) &&
    row.plan_id === "pro_analytics" &&
    row.billing_provider === "razorpay" &&
    providerSubscriptionId === subscription.id &&
    (providerPlanId === null || providerPlanId === configuredPlanId) &&
    subscription.notes.sbp_subscription_id === rowId &&
    subscription.notes.sbp_owner_id === ownerId
  );
}
