import { constantTimeEqual } from "./razorpay.ts";

export type PaymentMonitoringAlertSeverity = "high" | "critical";

export type PaymentMonitoringAlertDelivery = {
  delivery_id: string;
  claim_token: string;
  delivery_key: string;
  incident_id: string;
  incident_type: string;
  alert_severity: PaymentMonitoringAlertSeverity;
  diagnostic_code: string | null;
  source_table: string;
  source_record_id: string;
  first_detected_at: string;
  last_detected_at: string;
  detection_count: number;
  provider_subscription_id: string | null;
  provider_event_id: string | null;
};

export type PaymentMonitoringAlertErrorCode =
  | "email_network_error"
  | "email_timeout"
  | "email_provider_conflict"
  | "email_rate_limited"
  | "email_provider_unavailable"
  | "email_invalid_configuration"
  | "email_authentication_failed"
  | "email_authorization_failed"
  | "email_invalid_recipient"
  | "email_invalid_sender"
  | "email_idempotency_conflict"
  | "email_unknown_failure";

export type PaymentMonitoringAlertSendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; errorCode: PaymentMonitoringAlertErrorCode; retryable: boolean };

export type PaymentMonitoringEmailConfig = {
  resendApiKey: string;
  adminEmail: string;
  fromEmail: string;
  cronSecret: string;
};

export type PaymentMonitoringAlertRunSummary = {
  status: "completed";
  enqueued: number;
  claimed: number;
  sent: number;
  retry_scheduled: number;
  failed: number;
  suppressed: number;
  observed_at: string;
};

export type PaymentMonitoringAlertOperationalLog = {
  event: "payment_monitoring_alert_delivery_completed" | "payment_monitoring_alert_delivery_failed";
  invocation_id: string;
  status: "completed" | "failed";
  enqueued: number;
  claimed: number;
  sent: number;
  retry_scheduled: number;
  failed: number;
  suppressed: number;
  diagnostic_code?: string;
  duration_ms?: number;
};

export type PaymentMonitoringAlertRunDependencies = {
  enqueue: () => Promise<{ enqueued: number; suppressed: number }>;
  claim: (maxBatchSize: number) => Promise<PaymentMonitoringAlertDelivery[]>;
  send: (delivery: PaymentMonitoringAlertDelivery) => Promise<PaymentMonitoringAlertSendResult>;
  markSent: (delivery: PaymentMonitoringAlertDelivery, providerMessageId: string) => Promise<void>;
  markFailed: (
    delivery: PaymentMonitoringAlertDelivery,
    errorCode: PaymentMonitoringAlertErrorCode,
    retryable: boolean,
  ) => Promise<void>;
};

const RESEND_API_URL = "https://api.resend.com/emails";
const PAYMENT_MONITORING_CRON_HEADER = "x-payment-monitoring-cron-secret";
const MAX_DELIVERY_KEY_LENGTH = 255;
const PROVIDER_REQUEST_TIMEOUT_MS = 10_000;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_OPERATIONAL_CODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

function readServerEnvironment(name: string): string | undefined {
  return Deno.env.get(name);
}

function requiredServerValue(value: string | undefined): string {
  const trimmed = value?.trim();
  if (trimmed === undefined || trimmed.length === 0) {
    throw new PaymentMonitoringAlertConfigurationError();
  }

  return trimmed;
}

export class PaymentMonitoringAlertConfigurationError extends Error {
  readonly code = "email_invalid_configuration";

  constructor() {
    super("Payment-monitoring email configuration is unavailable.");
    this.name = "PaymentMonitoringAlertConfigurationError";
  }
}

export function getPaymentMonitoringEmailConfig(
  readEnvironment: (name: string) => string | undefined = readServerEnvironment,
): PaymentMonitoringEmailConfig {
  const resendApiKey = requiredServerValue(readEnvironment("RESEND_API_KEY"));
  const adminEmail = requiredServerValue(readEnvironment("PAYMENT_MONITORING_ADMIN_EMAIL"));
  const fromEmail = requiredServerValue(readEnvironment("PAYMENT_MONITORING_FROM_EMAIL"));
  const cronSecret = requiredServerValue(readEnvironment("PAYMENT_MONITORING_CRON_SECRET"));

  if (!EMAIL_PATTERN.test(adminEmail) || !EMAIL_PATTERN.test(fromEmail) || cronSecret.length < 32) {
    throw new PaymentMonitoringAlertConfigurationError();
  }

  return { resendApiKey, adminEmail, fromEmail, cronSecret };
}

export function isPaymentMonitoringCronRequestAuthorized(
  request: Request,
  expectedSecret: string,
): boolean {
  const suppliedSecret = request.headers.get(PAYMENT_MONITORING_CRON_HEADER);
  if (suppliedSecret === null || expectedSecret.length === 0) {
    return false;
  }

  return constantTimeEqual(
    new TextEncoder().encode(suppliedSecret),
    new TextEncoder().encode(expectedSecret),
  );
}

export function isPaymentMonitoringAlertPostRequest(request: Request): boolean {
  return request.method.toUpperCase() === "POST";
}

export function parsePaymentMonitoringInvocationId(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

export function buildPaymentMonitoringAlertOperationalLog(
  event: PaymentMonitoringAlertOperationalLog["event"],
  invocationId: string,
  fields: Omit<PaymentMonitoringAlertOperationalLog, "event" | "invocation_id">,
): PaymentMonitoringAlertOperationalLog {
  const log: PaymentMonitoringAlertOperationalLog = {
    event,
    invocation_id: invocationId,
    status: fields.status,
    enqueued: fields.enqueued,
    claimed: fields.claimed,
    sent: fields.sent,
    retry_scheduled: fields.retry_scheduled,
    failed: fields.failed,
    suppressed: fields.suppressed,
  };

  if (fields.diagnostic_code !== undefined) {
    log.diagnostic_code = SAFE_OPERATIONAL_CODE_PATTERN.test(fields.diagnostic_code)
      ? fields.diagnostic_code
      : "unknown";
  }
  if (fields.duration_ms !== undefined) {
    log.duration_ms = fields.duration_ms;
  }

  return log;
}

export function sanitizeOperationalField(value: string | number | null | undefined, fallback = "not provided"): string {
  const sanitized = Array.from(String(value ?? fallback), (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127 ? " " : character;
  })
    .join("")
    .trim()
    .slice(0, 256);

  return sanitized.length > 0 ? sanitized : fallback;
}

export function escapePaymentMonitoringHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function formatUtc(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? sanitizeOperationalField(value) : new Date(timestamp).toISOString();
}

export function buildPaymentMonitoringAlertEmail(delivery: PaymentMonitoringAlertDelivery): {
  subject: string;
  text: string;
  html: string;
} {
  const severity = delivery.alert_severity.toUpperCase();
  const fields = {
    severity,
    incidentType: sanitizeOperationalField(delivery.incident_type),
    diagnosticCode: sanitizeOperationalField(delivery.diagnostic_code),
    incidentId: sanitizeOperationalField(delivery.incident_id),
    firstDetectedAt: formatUtc(delivery.first_detected_at),
    lastDetectedAt: formatUtc(delivery.last_detected_at),
    detectionCount: sanitizeOperationalField(delivery.detection_count),
    sourceTable: sanitizeOperationalField(delivery.source_table),
    sourceRecordId: sanitizeOperationalField(delivery.source_record_id),
    providerSubscriptionId: sanitizeOperationalField(delivery.provider_subscription_id),
    providerEventId: sanitizeOperationalField(delivery.provider_event_id),
  };

  const subject = `[Smart Business Profile][${severity}] Payment monitoring incident`;
  const text = [
    "Smart Business Profile payment monitoring incident",
    "",
    `Severity: ${fields.severity}`,
    `Incident type: ${fields.incidentType}`,
    `Diagnostic code: ${fields.diagnosticCode}`,
    `Incident UUID: ${fields.incidentId}`,
    `First detected (UTC): ${fields.firstDetectedAt}`,
    `Last detected (UTC): ${fields.lastDetectedAt}`,
    `Detection count: ${fields.detectionCount}`,
    `Source table: ${fields.sourceTable}`,
    `Source record identifier: ${fields.sourceRecordId}`,
    `Provider subscription ID: ${fields.providerSubscriptionId}`,
    `Provider event ID: ${fields.providerEventId}`,
    "",
    "Inspect the database incident log for operational details.",
    "No automated recovery was performed.",
  ].join("\n");

  const htmlFields = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, escapePaymentMonitoringHtml(value)]),
  ) as Record<keyof typeof fields, string>;
  const html = [
    `<h2>Smart Business Profile payment monitoring incident</h2>`,
    `<p><strong>Severity:</strong> ${htmlFields.severity}</p>`,
    `<p><strong>Incident type:</strong> ${htmlFields.incidentType}</p>`,
    `<p><strong>Diagnostic code:</strong> ${htmlFields.diagnosticCode}</p>`,
    `<p><strong>Incident UUID:</strong> ${htmlFields.incidentId}</p>`,
    `<p><strong>First detected (UTC):</strong> ${htmlFields.firstDetectedAt}</p>`,
    `<p><strong>Last detected (UTC):</strong> ${htmlFields.lastDetectedAt}</p>`,
    `<p><strong>Detection count:</strong> ${htmlFields.detectionCount}</p>`,
    `<p><strong>Source table:</strong> ${htmlFields.sourceTable}</p>`,
    `<p><strong>Source record identifier:</strong> ${htmlFields.sourceRecordId}</p>`,
    `<p><strong>Provider subscription ID:</strong> ${htmlFields.providerSubscriptionId}</p>`,
    `<p><strong>Provider event ID:</strong> ${htmlFields.providerEventId}</p>`,
    `<p>Inspect the database incident log for operational details.</p>`,
    `<p>No automated recovery was performed.</p>`,
  ].join("");

  return { subject, text, html };
}

function safeProviderCode(value: unknown): string | null {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) {
    return null;
  }

  return value.toLowerCase();
}

async function readProviderCode(response: Response): Promise<string | null> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      return null;
    }

    const error = (payload as Record<string, unknown>).error;
    if (typeof error !== "object" || error === null || Array.isArray(error)) {
      return null;
    }

    return safeProviderCode((error as Record<string, unknown>).code);
  } catch {
    return null;
  }
}

export function classifyPaymentMonitoringProviderStatus(
  status: number,
  providerCode: string | null = null,
): { errorCode: PaymentMonitoringAlertErrorCode; retryable: boolean } {
  if (status === 408) {
    return { errorCode: "email_timeout", retryable: true };
  }

  if (status === 409) {
    if (providerCode === "idempotency_key_reused" || providerCode === "idempotency_key_conflict") {
      return { errorCode: "email_idempotency_conflict", retryable: false };
    }
    return { errorCode: "email_provider_conflict", retryable: true };
  }

  if (status === 429) {
    return { errorCode: "email_rate_limited", retryable: true };
  }

  if (status >= 500) {
    return { errorCode: "email_provider_unavailable", retryable: true };
  }

  if (status === 401) {
    return { errorCode: "email_authentication_failed", retryable: false };
  }

  if (status === 403) {
    return { errorCode: "email_authorization_failed", retryable: false };
  }

  if (providerCode === "invalid_recipient") {
    return { errorCode: "email_invalid_recipient", retryable: false };
  }

  if (providerCode === "invalid_sender" || providerCode === "sender_not_verified") {
    return { errorCode: "email_invalid_sender", retryable: false };
  }

  if (status >= 400 && status < 500) {
    return { errorCode: "email_invalid_configuration", retryable: false };
  }

  return { errorCode: "email_unknown_failure", retryable: false };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function providerMessageId(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return null;
  }

  const identifier = (payload as Record<string, unknown>).id;
  return typeof identifier === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(identifier)
    ? identifier
    : null;
}

export async function sendPaymentMonitoringAlertEmail(
  delivery: PaymentMonitoringAlertDelivery,
  config: PaymentMonitoringEmailConfig,
  fetchImplementation: typeof fetch = fetch,
): Promise<PaymentMonitoringAlertSendResult> {
  if (delivery.delivery_key.length === 0 || delivery.delivery_key.length > MAX_DELIVERY_KEY_LENGTH) {
    return { ok: false, errorCode: "email_idempotency_conflict", retryable: false };
  }

  const email = buildPaymentMonitoringAlertEmail(delivery);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImplementation(RESEND_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": delivery.delivery_key,
      },
      body: JSON.stringify({
        from: config.fromEmail,
        to: [config.adminEmail],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        ...classifyPaymentMonitoringProviderStatus(response.status, await readProviderCode(response)),
      };
    }

    const messageId = providerMessageId(await response.json());
    if (messageId === null) {
      return { ok: false, errorCode: "email_unknown_failure", retryable: false };
    }

    return { ok: true, providerMessageId: messageId };
  } catch (error) {
    return {
      ok: false,
      errorCode: isAbortError(error) ? "email_timeout" : "email_network_error",
      retryable: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runPaymentMonitoringAlertDelivery(
  dependencies: PaymentMonitoringAlertRunDependencies,
  observedAt: string,
  maxBatchSize = 10,
): Promise<PaymentMonitoringAlertRunSummary> {
  const safeBatchSize = Math.min(Math.max(Math.trunc(maxBatchSize), 1), 10);
  const enqueueResult = await dependencies.enqueue();
  const claimed = (await dependencies.claim(safeBatchSize)).slice(0, safeBatchSize);
  let sent = 0;
  let retryScheduled = 0;
  let failed = 0;

  for (const delivery of claimed) {
    const result = await dependencies.send(delivery);
    if (result.ok) {
      await dependencies.markSent(delivery, result.providerMessageId);
      sent += 1;
      continue;
    }

    await dependencies.markFailed(delivery, result.errorCode, result.retryable);
    if (result.retryable) {
      retryScheduled += 1;
    } else {
      failed += 1;
    }
  }

  return {
    status: "completed",
    enqueued: enqueueResult.enqueued,
    claimed: claimed.length,
    sent,
    retry_scheduled: retryScheduled,
    failed,
    suppressed: enqueueResult.suppressed,
    observed_at: observedAt,
  };
}

export { PAYMENT_MONITORING_CRON_HEADER, RESEND_API_URL };
