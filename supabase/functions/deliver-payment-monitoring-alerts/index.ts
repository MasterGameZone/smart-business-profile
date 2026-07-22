import {
  getPaymentMonitoringEmailConfig,
  isPaymentMonitoringAlertPostRequest,
  isPaymentMonitoringCronRequestAuthorized,
  runPaymentMonitoringAlertDelivery,
  sendPaymentMonitoringAlertEmail,
  type PaymentMonitoringAlertDelivery,
  type PaymentMonitoringAlertErrorCode,
  type PaymentMonitoringEmailConfig,
} from "../_shared/paymentMonitoringAlerts.ts";
import { jsonError, jsonSuccess, methodNotAllowed } from "../_shared/http.ts";
import { createWebhookContext } from "../_shared/supabaseClients.ts";

const MAX_BATCH_SIZE = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function parseEnqueueSummary(value: unknown): { enqueued: number; suppressed: number } {
  if (!isRecord(value)) {
    throw new Error("enqueue_rpc_invalid_result");
  }

  return {
    enqueued: parseCount(value.enqueued),
    suppressed: parseCount(value.suppressed),
  };
}

function parseClaimedDelivery(value: unknown): PaymentMonitoringAlertDelivery | null {
  if (!isRecord(value)) {
    return null;
  }

  const severity = value.alert_severity;
  if (severity !== "high" && severity !== "critical") {
    return null;
  }

  const deliveryId = requiredString(value.delivery_id);
  const claimToken = requiredString(value.claim_token);
  const deliveryKey = requiredString(value.delivery_key);
  const incidentId = requiredString(value.incident_id);
  const incidentType = requiredString(value.incident_type);
  const sourceTable = requiredString(value.source_table);
  const sourceRecordId = requiredString(value.source_record_id);
  const firstDetectedAt = requiredString(value.first_detected_at);
  const lastDetectedAt = requiredString(value.last_detected_at);
  if (
    deliveryId === null ||
    claimToken === null ||
    deliveryKey === null ||
    incidentId === null ||
    incidentType === null ||
    sourceTable === null ||
    sourceRecordId === null ||
    firstDetectedAt === null ||
    lastDetectedAt === null
  ) {
    return null;
  }

  return {
    delivery_id: deliveryId,
    claim_token: claimToken,
    delivery_key: deliveryKey,
    incident_id: incidentId,
    incident_type: incidentType,
    alert_severity: severity,
    diagnostic_code: typeof value.diagnostic_code === "string" ? value.diagnostic_code : null,
    source_table: sourceTable,
    source_record_id: sourceRecordId,
    first_detected_at: firstDetectedAt,
    last_detected_at: lastDetectedAt,
    detection_count: parseCount(value.detection_count),
    provider_subscription_id:
      typeof value.provider_subscription_id === "string" ? value.provider_subscription_id : null,
    provider_event_id: typeof value.provider_event_id === "string" ? value.provider_event_id : null,
  };
}

function parseClaimedDeliveries(value: unknown): PaymentMonitoringAlertDelivery[] {
  if (!Array.isArray(value)) {
    throw new Error("claim_rpc_invalid_result");
  }

  return value.flatMap((item) => {
    const delivery = parseClaimedDelivery(item);
    return delivery === null ? [] : [delivery];
  });
}

function configurationErrorResponse(request: Request): Response {
  return jsonError("server_configuration_error", "Alert delivery is not configured.", {
    request,
    status: 500,
  });
}

async function deliverAlerts(request: Request, config: PaymentMonitoringEmailConfig): Promise<Response> {
  const contextResult = await createWebhookContext(request);
  if (!contextResult.ok) {
    return jsonError(contextResult.code, contextResult.message, {
      request,
      status: contextResult.status,
    });
  }

  const observedAt = new Date().toISOString();
  const supabaseAdmin = contextResult.context.supabaseAdmin;
  const summary = await runPaymentMonitoringAlertDelivery(
    {
      enqueue: async () => {
        const { data, error } = await supabaseAdmin.rpc("enqueue_payment_monitoring_alert_deliveries", {
          p_observed_at: observedAt,
        });
        if (error !== null) {
          throw new Error("enqueue_rpc_failed");
        }
        return parseEnqueueSummary(data);
      },
      claim: async (maxBatchSize) => {
        const { data, error } = await supabaseAdmin.rpc("claim_payment_monitoring_alert_deliveries", {
          p_max_batch_size: maxBatchSize,
          p_observed_at: observedAt,
          p_lease_seconds: 300,
        });
        if (error !== null) {
          throw new Error("claim_rpc_failed");
        }
        return parseClaimedDeliveries(data);
      },
      send: (delivery) => sendPaymentMonitoringAlertEmail(delivery, config),
      markSent: async (delivery, providerMessageId) => {
        const { error } = await supabaseAdmin.rpc("mark_payment_monitoring_alert_delivery_sent", {
          p_delivery_id: delivery.delivery_id,
          p_claim_token: delivery.claim_token,
          p_observed_at: observedAt,
          p_provider_message_id: providerMessageId,
        });
        if (error !== null) {
          throw new Error("sent_rpc_failed");
        }
      },
      markFailed: async (delivery, errorCode: PaymentMonitoringAlertErrorCode, retryable) => {
        const { error } = await supabaseAdmin.rpc("mark_payment_monitoring_alert_delivery_failed", {
          p_delivery_id: delivery.delivery_id,
          p_claim_token: delivery.claim_token,
          p_observed_at: observedAt,
          p_error_code: errorCode,
          p_retryable: retryable,
        });
        if (error !== null) {
          throw new Error("failed_rpc_failed");
        }
      },
    },
    observedAt,
    MAX_BATCH_SIZE,
  );

  return jsonSuccess(summary, { request });
}

Deno.serve(async (request) => {
  if (!isPaymentMonitoringAlertPostRequest(request)) {
    return methodNotAllowed(["POST"], request);
  }

  const expectedSecret = Deno.env.get("PAYMENT_MONITORING_CRON_SECRET")?.trim();
  if (expectedSecret === undefined || expectedSecret.length < 32) {
    return configurationErrorResponse(request);
  }

  if (!isPaymentMonitoringCronRequestAuthorized(request, expectedSecret)) {
    return jsonError("unauthorized", "Request authorization failed.", { request, status: 401 });
  }

  let config: PaymentMonitoringEmailConfig;
  try {
    config = getPaymentMonitoringEmailConfig();
  } catch {
    return configurationErrorResponse(request);
  }

  try {
    return await deliverAlerts(request, config);
  } catch {
    return jsonError("internal_error", "Alert delivery could not be completed.", {
      request,
      status: 500,
    });
  }
});
