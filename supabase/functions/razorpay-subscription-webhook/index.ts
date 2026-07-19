import {
  handleCorsPreflight,
  jsonError,
  jsonSuccess,
  requireMethod,
  type JsonValue,
} from "../_shared/http.ts";
import { createWebhookContext } from "../_shared/supabaseClients.ts";
import {
  getRazorpayWebhookConfig,
  RAZORPAY_INTERNAL_PLAN_ID,
  RazorpayConfigurationError,
  verifyRazorpayWebhookSignature,
} from "../_shared/razorpay.ts";

const MAX_WEBHOOK_BYTES = 512 * 1024;
const MAX_EVENT_ID_LENGTH = 255;
const MAX_EVENT_TYPE_LENGTH = 100;
const MAX_CONTAINS_VALUE_LENGTH = 100;
const MAX_UNIX_SECONDS = 8_640_000_000_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

const SUPPORTED_EVENTS = new Set([
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
]);

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

type WebhookConfig = ReturnType<typeof getRazorpayWebhookConfig>;

type WebhookEnvelope = {
  eventType: string;
  providerCreatedAt: string;
  contains: string[];
  payload: Record<string, unknown>;
};

type CorrelationNotes = {
  sbp_owner_id: string;
  sbp_subscription_id: string;
  sbp_plan_id: "pro_analytics";
  sbp_creation_attempt_id: string;
  sbp_environment: "test" | "live";
};

type SubscriptionEvent = {
  id: string;
  planId: string;
  customerId: string | null;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  endedAt: string | null;
  notes: CorrelationNotes;
};

type RpcResult = {
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

function invalidWebhookEvent(request: Request): Response {
  return jsonError("invalid_webhook_event", "The webhook event is invalid.", { request, status: 400 });
}

function processingFailure(request: Request): Response {
  return jsonError("webhook_processing_failed", "The webhook could not be processed.", {
    request,
    status: 500,
  });
}

function invalidSignature(request: Request): Response {
  return jsonError("invalid_webhook_signature", "The webhook signature could not be verified.", {
    request,
    status: 400,
  });
}

function configuredPlanId(): string | null {
  const planId = Deno.env.get("RAZORPAY_PLAN_ID")?.trim();
  return planId !== undefined && planId.length > 0 && planId.startsWith("plan_") ? planId : null;
}

function contentLengthStatus(request: Request): "missing" | "valid" | "invalid" | "too_large" {
  const rawContentLength = request.headers.get("content-length");
  if (rawContentLength === null) {
    return "missing";
  }

  const value = rawContentLength.trim();
  if (!/^\d+$/.test(value)) {
    return "invalid";
  }

  const length = Number(value);
  if (!Number.isSafeInteger(length) || length < 0) {
    return "invalid";
  }

  return length > MAX_WEBHOOK_BYTES ? "too_large" : "valid";
}

function validContentType(request: Request): boolean {
  const contentType = request.headers.get("content-type");
  if (contentType === null) {
    return false;
  }

  return contentType.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

function validEventId(request: Request): string | null {
  const eventId = request.headers.get("x-razorpay-event-id");
  if (eventId === null) {
    return null;
  }

  const trimmed = eventId.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_EVENT_ID_LENGTH ||
    CONTROL_CHARACTER_PATTERN.test(trimmed)
  ) {
    return null;
  }

  return trimmed;
}

function validSignature(request: Request): string | null {
  const signature = request.headers.get("x-razorpay-signature");
  if (signature === null || !/^[0-9a-fA-F]{64}$/.test(signature)) {
    return null;
  }

  return signature;
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

function parseEnvelope(payload: unknown): WebhookEnvelope | null {
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

function parseCorrelationNotes(value: unknown, config: WebhookConfig): CorrelationNotes | null {
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
    planId !== RAZORPAY_INTERNAL_PLAN_ID ||
    !isUuid(creationAttemptId) ||
    environment !== config.environment
  ) {
    return null;
  }

  return {
    sbp_owner_id: ownerId,
    sbp_subscription_id: subscriptionId,
    sbp_plan_id: RAZORPAY_INTERNAL_PLAN_ID,
    sbp_creation_attempt_id: creationAttemptId,
    sbp_environment: config.environment,
  };
}

function parseSubscriptionEntity(value: unknown, config: WebhookConfig): SubscriptionEvent | null {
  if (!isRecord(value) || value.entity !== "subscription") {
    return null;
  }

  const id = nonBlankString(value.id, 255);
  const planId = nonBlankString(value.plan_id, 255);
  const customerId = value.customer_id === null
    ? null
    : nonBlankString(value.customer_id, 255);
  const status = nonBlankString(value.status, 50);
  const notes = parseCorrelationNotes(value.notes, config);
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
    !PROVIDER_STATUSES.has(status) ||
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

  return {
    id,
    planId,
    customerId,
    status,
    currentPeriodStart,
    currentPeriodEnd,
    endedAt,
    notes,
  };
}

function eventStatusMatches(eventType: string, status: string): boolean {
  const expectedStatus = EVENT_STATUS[eventType];
  return expectedStatus === null || expectedStatus === status;
}

function parseRpcResult(data: unknown): RpcResult | null {
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
    return null;
  }

  const row = data[0];
  const result = row.result;
  const webhookEventId = row.webhook_event_id;
  const internalSubscriptionId = row.internal_subscription_id;
  const internalStatus = row.internal_status;
  const processingAttempts = row.processing_attempts;
  const isAllowedResult = (value: unknown): value is RpcResult["result"] =>
    value === "processed" ||
    value === "duplicate" ||
    value === "ignored" ||
    value === "stale_event" ||
    value === "subscription_not_found" ||
    value === "plan_mismatch" ||
    value === "failed";

  if (
    !isAllowedResult(result) ||
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
    result,
    webhookEventId,
    internalSubscriptionId,
    internalStatus,
    processingAttempts,
  };
}

function sanitizedPayload(
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

function correlationMatchesRow(
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
    row.plan_id === RAZORPAY_INTERNAL_PLAN_ID &&
    row.billing_provider === "razorpay" &&
    providerSubscriptionId === subscription.id &&
    (providerPlanId === null || providerPlanId === configuredPlanId) &&
    subscription.notes.sbp_subscription_id === rowId &&
    subscription.notes.sbp_owner_id === ownerId
  );
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

    const lengthStatus = contentLengthStatus(request);
    if (lengthStatus === "too_large") {
      return jsonError("webhook_payload_too_large", "The webhook payload is too large.", {
        request,
        status: 413,
      });
    }
    if (lengthStatus === "invalid") {
      return invalidWebhookEvent(request);
    }

    const signature = validSignature(request);
    if (signature === null) {
      return invalidSignature(request);
    }

    const eventId = validEventId(request);
    if (eventId === null) {
      return invalidWebhookEvent(request);
    }

    if (!validContentType(request)) {
      return jsonError("unsupported_media_type", "The webhook content type is not supported.", {
        request,
        status: 415,
      });
    }

    let rawBody: string;
    try {
      rawBody = await request.text();
    } catch {
      return invalidWebhookEvent(request);
    }

    if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BYTES) {
      return jsonError("webhook_payload_too_large", "The webhook payload is too large.", {
        request,
        status: 413,
      });
    }

    let webhookConfig: WebhookConfig;
    try {
      webhookConfig = getRazorpayWebhookConfig();
    } catch (error) {
      if (error instanceof RazorpayConfigurationError) {
        return jsonError("server_configuration_error", "Server payment configuration is invalid.", {
          request,
          status: 500,
        });
      }
      return processingFailure(request);
    }

    let signatureVerified: boolean;
    try {
      signatureVerified = await verifyRazorpayWebhookSignature(rawBody, signature);
    } catch (error) {
      if (error instanceof RazorpayConfigurationError) {
        return jsonError("server_configuration_error", "Server payment configuration is invalid.", {
          request,
          status: 500,
        });
      }
      return invalidSignature(request);
    }

    if (!signatureVerified) {
      return invalidSignature(request);
    }

    const configuredPlan = configuredPlanId();
    if (configuredPlan === null) {
      return jsonError("server_configuration_error", "Server payment configuration is invalid.", {
        request,
        status: 500,
      });
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return invalidWebhookEvent(request);
    }

    const envelope = parseEnvelope(parsedBody);
    if (envelope === null) {
      return invalidWebhookEvent(request);
    }

    if (!SUPPORTED_EVENTS.has(envelope.eventType)) {
      return jsonSuccess({ received: true, ignored: true }, { request, status: 200 });
    }

    if (!envelope.contains.includes("subscription")) {
      return invalidWebhookEvent(request);
    }

    const subscription = parseSubscriptionEntity(envelope.payload.subscription, webhookConfig);
    if (subscription === null) {
      return invalidWebhookEvent(request);
    }
    if (!eventStatusMatches(envelope.eventType, subscription.status)) {
      return invalidWebhookEvent(request);
    }
    if (subscription.planId !== configuredPlan) {
      return jsonError("webhook_correlation_failed", "The webhook subscription could not be correlated.", {
        request,
        status: 409,
      });
    }

    const contextResult = await createWebhookContext(request);
    if (!contextResult.ok) {
      return jsonError(contextResult.code, contextResult.message, { request, status: contextResult.status });
    }

    try {
      const { data, error } = await contextResult.context.supabaseAdmin
        .from("business_owner_subscriptions")
        .select("id,owner_id,plan_id,billing_provider,provider_subscription_id,provider_plan_id")
        .eq("billing_provider", "razorpay")
        .eq("provider_subscription_id", subscription.id)
        .maybeSingle();

      if (error !== null) {
        return processingFailure(request);
      }

      if (data !== null) {
        if (!isRecord(data) || !correlationMatchesRow(data, subscription, configuredPlan)) {
          return jsonError("webhook_correlation_failed", "The webhook subscription could not be correlated.", {
            request,
            status: 409,
          });
        }
      }
    } catch {
      return processingFailure(request);
    }

    const payload = sanitizedPayload(eventId, envelope, subscription);
    let rpcData: unknown;
    try {
      const { data, error } = await contextResult.context.supabaseAdmin.rpc("process_razorpay_subscription_webhook", {
        p_provider_event_id: eventId,
        p_event_type: envelope.eventType,
        p_provider_created_at: envelope.providerCreatedAt,
        p_provider_subscription_id: subscription.id,
        p_provider_plan_id: subscription.planId,
        p_provider_customer_id: subscription.customerId,
        p_provider_status: subscription.status,
        p_current_period_start: subscription.currentPeriodStart,
        p_current_period_end: subscription.currentPeriodEnd,
        p_ended_at: subscription.endedAt,
        p_sanitized_payload: payload,
      });

      if (error !== null) {
        return processingFailure(request);
      }
      rpcData = data;
    } catch {
      return processingFailure(request);
    }

    const result = parseRpcResult(rpcData);
    if (result === null) {
      return processingFailure(request);
    }

    if (result.result === "processed" || result.result === "duplicate" || result.result === "ignored" || result.result === "stale_event") {
      return jsonSuccess({ received: true, result: result.result }, { request, status: 200 });
    }
    if (result.result === "subscription_not_found") {
      return jsonError("webhook_processing_deferred", "The webhook subscription is not ready for processing.", {
        request,
        status: 503,
      });
    }
    if (result.result === "plan_mismatch") {
      return jsonError("webhook_correlation_failed", "The webhook subscription could not be correlated.", {
        request,
        status: 409,
      });
    }
    return processingFailure(request);
  },
};
