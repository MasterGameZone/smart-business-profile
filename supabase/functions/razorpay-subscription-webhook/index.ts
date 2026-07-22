import {
  handleCorsPreflight,
  jsonError,
  jsonSuccess,
  requireMethod,
} from "../_shared/http.ts";
import { createWebhookContext } from "../_shared/supabaseClients.ts";
import {
  getRazorpayWebhookConfig,
  RazorpayConfigurationError,
  verifyRazorpayWebhookSignature,
} from "../_shared/razorpay.ts";
import {
  SUPPORTED_WEBHOOK_EVENTS,
  parseWebhookEnvelope,
  parseWebhookRpcResult,
  parseWebhookSubscriptionEntity,
  sanitizedWebhookPayload,
  webhookCorrelationMatchesRow,
  webhookEventStatusMatches,
  webhookPlanMatchesConfiguredPlan,
} from "../_shared/razorpayWebhookValidation.ts";

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

const MAX_WEBHOOK_BYTES = 512 * 1024;
const MAX_EVENT_ID_LENGTH = 255;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

    const envelope = parseWebhookEnvelope(parsedBody);
    if (envelope === null) {
      return invalidWebhookEvent(request);
    }

    if (!SUPPORTED_WEBHOOK_EVENTS.includes(envelope.eventType as (typeof SUPPORTED_WEBHOOK_EVENTS)[number])) {
      return jsonSuccess({ received: true, ignored: true }, { request, status: 200 });
    }

    if (!envelope.contains.includes("subscription")) {
      return invalidWebhookEvent(request);
    }

    const subscriptionPayload = envelope.payload.subscription;
    if (!isRecord(subscriptionPayload)) {
      return invalidWebhookEvent(request);
    }

    const subscription = parseWebhookSubscriptionEntity(subscriptionPayload.entity, webhookConfig);
    if (subscription === null) {
      return invalidWebhookEvent(request);
    }
    if (!webhookEventStatusMatches(envelope.eventType, subscription.status)) {
      return invalidWebhookEvent(request);
    }
    if (!webhookPlanMatchesConfiguredPlan(subscription, configuredPlan)) {
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
        if (!isRecord(data) || !webhookCorrelationMatchesRow(data, subscription, configuredPlan)) {
          return jsonError("webhook_correlation_failed", "The webhook subscription could not be correlated.", {
            request,
            status: 409,
          });
        }
      }
    } catch {
      return processingFailure(request);
    }

    const payload = sanitizedWebhookPayload(eventId, envelope, subscription);
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

    const result = parseWebhookRpcResult(rpcData);
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
