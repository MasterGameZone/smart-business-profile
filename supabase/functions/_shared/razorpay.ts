import type { JsonValue } from "./http.ts";

export const RAZORPAY_API_BASE_URL = "https://api.razorpay.com/v1";
export const RAZORPAY_INTERNAL_PLAN_ID = "pro_analytics";
export const RAZORPAY_AMOUNT_MINOR_UNITS = 4500;
export const RAZORPAY_CURRENCY = "INR";
export const RAZORPAY_BILLING_INTERVAL = "monthly";
export const RAZORPAY_CHECKOUT_NAME = "Smart Business Profile";
export const RAZORPAY_CHECKOUT_DESCRIPTION = "Pro Analytics — ₹45/month";

const REQUEST_TIMEOUT_MS = 15_000;
const SHA256_HEX_LENGTH = 64;

export type RazorpayEnvironment = "test" | "live";

// This is a server-only configuration object, never a browser response type.
export type RazorpayApiConfig = {
  environment: RazorpayEnvironment;
  keyId: string;
  keySecret: string;
  planId: string;
};

type RazorpayWebhookConfig = {
  environment: RazorpayEnvironment;
  webhookSecret: string;
};

export type RazorpayApiRequestOptions = {
  method: "GET" | "POST" | "PATCH";
  body?: JsonValue;
  signal?: AbortSignal;
};

export type RazorpayApiErrorCategory =
  | "configuration"
  | "network"
  | "provider"
  | "invalid_response";

export class RazorpayConfigurationError extends Error {
  readonly code = "server_configuration_error";

  constructor(message: string) {
    super(message);
    this.name = "RazorpayConfigurationError";
  }
}

export class RazorpayApiError extends Error {
  readonly category: RazorpayApiErrorCategory;
  readonly status: number;
  readonly providerCode: string | null;
  readonly retryable: boolean;
  readonly outcomeUnknown: boolean;

  constructor(
    category: RazorpayApiErrorCategory,
    status: number,
    providerCode: string | null,
    retryable: boolean,
    outcomeUnknown: boolean,
    message = "Razorpay request failed.",
  ) {
    super(message);
    this.name = "RazorpayApiError";
    this.category = category;
    this.status = status;
    this.providerCode = providerCode;
    this.retryable = retryable;
    this.outcomeUnknown = outcomeUnknown;
  }
}

function requiredIdentifier(name: string): string {
  const value = Deno.env.get(name)?.trim();

  if (value === undefined || value.length === 0) {
    throw new RazorpayConfigurationError(`Missing required server configuration: ${name}.`);
  }

  return value;
}

function requiredSecret(name: string): string {
  const value = Deno.env.get(name);

  if (value === undefined || /^\s*$/.test(value)) {
    throw new RazorpayConfigurationError(`Missing required server configuration: ${name}.`);
  }

  return value;
}

function getRazorpayEnvironment(): RazorpayEnvironment {
  const environment = requiredIdentifier("RAZORPAY_ENVIRONMENT");

  if (environment === "test" || environment === "live") {
    return environment;
  }

  throw new RazorpayConfigurationError("RAZORPAY_ENVIRONMENT must be test or live.");
}

export function getRazorpayApiConfig(): RazorpayApiConfig {
  const environment = getRazorpayEnvironment();
  const keyId = requiredIdentifier("RAZORPAY_KEY_ID");
  const keySecret = requiredSecret("RAZORPAY_KEY_SECRET");
  const planId = requiredIdentifier("RAZORPAY_PLAN_ID");

  if (!planId.startsWith("plan_")) {
    throw new RazorpayConfigurationError("RAZORPAY_PLAN_ID is invalid.");
  }

  const requiredKeyPrefix = environment === "test" ? "rzp_test_" : "rzp_live_";
  if (!keyId.startsWith(requiredKeyPrefix)) {
    throw new RazorpayConfigurationError("RAZORPAY_KEY_ID does not match RAZORPAY_ENVIRONMENT.");
  }

  return { environment, keyId, keySecret, planId };
}

export function getRazorpayWebhookConfig(): RazorpayWebhookConfig {
  return {
    environment: getRazorpayEnvironment(),
    webhookSecret: requiredSecret("RAZORPAY_WEBHOOK_SECRET"),
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

// Server-internal only: callers must never log or return this header value.
export function buildRazorpayBasicAuthHeader(config: RazorpayApiConfig): string {
  const credentials = new TextEncoder().encode(`${config.keyId}:${config.keySecret}`);
  return `Basic ${bytesToBase64(credentials)}`;
}

function buildRazorpayApiUrl(path: string): URL {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new RazorpayApiError("configuration", 500, null, false, false, "Razorpay request failed.");
  }

  const baseUrl = new URL(`${RAZORPAY_API_BASE_URL}/`);
  const url = new URL(path.slice(1), baseUrl);

  if (url.origin !== baseUrl.origin || !url.pathname.startsWith("/v1/")) {
    throw new RazorpayApiError("configuration", 500, null, false, false, "Razorpay request failed.");
  }

  return url;
}

function composeAbortSignal(externalSignal?: AbortSignal): {
  signal: AbortSignal;
  dispose: () => void;
} {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abortFromExternalSignal = (): void => controller.abort();

  if (externalSignal !== undefined) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
    }
  }

  return {
    signal: controller.signal,
    dispose: (): void => {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortFromExternalSignal);
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function safeProviderErrorCode(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.error)) {
    return null;
  }

  const code = value.error.code;
  if (typeof code !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(code)) {
    return null;
  }

  return code;
}

async function readSafeProviderErrorCode(response: Response): Promise<string | null> {
  try {
    return safeProviderErrorCode(await response.json());
  } catch {
    return null;
  }
}

function isMutationMethod(method: RazorpayApiRequestOptions["method"]): boolean {
  return method === "POST" || method === "PATCH";
}

function classifyNetworkFailure(method: RazorpayApiRequestOptions["method"]): {
  retryable: boolean;
  outcomeUnknown: boolean;
} {
  if (isMutationMethod(method)) {
    return { retryable: false, outcomeUnknown: true };
  }

  return { retryable: true, outcomeUnknown: false };
}

function classifyHttpFailure(
  method: RazorpayApiRequestOptions["method"],
  status: number,
): { retryable: boolean; outcomeUnknown: boolean } {
  const providerMayHaveMutated = isMutationMethod(method) &&
    (status === 408 || status === 429 || status >= 500);

  if (providerMayHaveMutated) {
    return { retryable: false, outcomeUnknown: true };
  }

  if (!isMutationMethod(method) && (status === 408 || status === 429 || status >= 500)) {
    return { retryable: true, outcomeUnknown: false };
  }

  return { retryable: false, outcomeUnknown: false };
}

function classifyInvalidResponse(method: RazorpayApiRequestOptions["method"]): {
  retryable: boolean;
  outcomeUnknown: boolean;
} {
  if (isMutationMethod(method)) {
    return { retryable: false, outcomeUnknown: true };
  }

  return { retryable: true, outcomeUnknown: false };
}

export type RazorpayResponseParser<T> = (payload: JsonValue) => T;

export async function razorpayApiRequest<T>(
  path: string,
  options: RazorpayApiRequestOptions,
  parseResponse: RazorpayResponseParser<T>,
): Promise<T> {
  const config = getRazorpayApiConfig();
  const apiUrl = buildRazorpayApiUrl(path);
  const requestSignal = composeAbortSignal(options.signal);
  const headers = new Headers({
    Accept: "application/json",
    Authorization: buildRazorpayBasicAuthHeader(config),
  });

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: requestSignal.signal,
    });
  } catch {
    const classification = classifyNetworkFailure(options.method);
    throw new RazorpayApiError(
      "network",
      502,
      null,
      classification.retryable,
      classification.outcomeUnknown,
      "Razorpay request failed.",
    );
  } finally {
    requestSignal.dispose();
  }

  if (!response.ok) {
    const providerCode = await readSafeProviderErrorCode(response);
    const classification = classifyHttpFailure(options.method, response.status);
    throw new RazorpayApiError(
      "provider",
      response.status,
      providerCode,
      classification.retryable,
      classification.outcomeUnknown,
      "Razorpay request failed.",
    );
  }

  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    const classification = classifyInvalidResponse(options.method);
    throw new RazorpayApiError(
      "invalid_response",
      502,
      null,
      classification.retryable,
      classification.outcomeUnknown,
      "Razorpay request failed.",
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    const classification = classifyInvalidResponse(options.method);
    throw new RazorpayApiError(
      "invalid_response",
      502,
      null,
      classification.retryable,
      classification.outcomeUnknown,
      "Razorpay request failed.",
    );
  }

  if (!isJsonValue(payload)) {
    const classification = classifyInvalidResponse(options.method);
    throw new RazorpayApiError(
      "invalid_response",
      502,
      null,
      classification.retryable,
      classification.outcomeUnknown,
      "Razorpay request failed.",
    );
  }

  try {
    return parseResponse(payload);
  } catch (error) {
    if (error instanceof RazorpayApiError) {
      throw error;
    }

    const classification = classifyInvalidResponse(options.method);
    throw new RazorpayApiError(
      "invalid_response",
      502,
      null,
      classification.retryable,
      classification.outcomeUnknown,
      "Razorpay request failed.",
    );
  }
}

export async function hmacSha256Bytes(message: string, secret: string): Promise<Uint8Array> {
  const textEncoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(message));
  return new Uint8Array(signature);
}

export async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const bytes = await hmacSha256Bytes(message, secret);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: unknown): Uint8Array | null {
  if (typeof hex !== "string" || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    return null;
  }

  const bytes = new Uint8Array(SHA256_HEX_LENGTH / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

export function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return difference === 0;
}

export async function verifyHmacSha256Hex(
  message: string,
  suppliedSignature: unknown,
  secret: string,
): Promise<boolean> {
  const suppliedBytes = hexToBytes(suppliedSignature);
  if (suppliedBytes === null) {
    return false;
  }

  const expectedBytes = await hmacSha256Bytes(message, secret);
  return constantTimeEqual(expectedBytes, suppliedBytes);
}

export async function verifyRazorpayWebhookSignature(
  rawBody: string,
  suppliedSignature: unknown,
): Promise<boolean> {
  const config = getRazorpayWebhookConfig();
  // rawBody is intentionally not parsed, normalized, or reserialized before HMAC verification.
  return verifyHmacSha256Hex(rawBody, suppliedSignature, config.webhookSecret);
}

export async function verifyRazorpayCheckoutSignature(
  paymentId: string,
  serverStoredExpectedSubscriptionId: string,
  suppliedSignature: unknown,
): Promise<boolean> {
  if (paymentId.trim().length === 0 || serverStoredExpectedSubscriptionId.trim().length === 0) {
    return false;
  }

  const config = getRazorpayApiConfig();
  return verifyHmacSha256Hex(
    `${paymentId}|${serverStoredExpectedSubscriptionId}`,
    suppliedSignature,
    config.keySecret,
  );
}
