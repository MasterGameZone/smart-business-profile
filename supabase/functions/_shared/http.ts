export type { JsonValue } from "./json.ts";

export type JsonSuccess<T extends JsonValue> = {
  ok: true;
  data: T;
};

export type JsonFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export type JsonResponseOptions = {
  request?: Request;
  status?: number;
  headers?: HeadersInit;
};

const ALLOWED_REQUEST_HEADERS = "authorization, apikey, x-client-info, content-type";
const ALLOWED_METHODS = "POST, OPTIONS";
const TEST_FALLBACK_ORIGIN = "http://localhost:5000";
export const SAFE_ADDITIONAL_RESPONSE_HEADERS: ReadonlySet<string> = new Set(["allow"]);

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

type CorsResolution = {
  allowed: boolean;
  headers: Headers;
};

function baseHeaders(): Headers {
  return new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
}

function normalizeConfiguredOrigin(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed === "*") {
    throw new HttpError(500, "server_configuration_error", "Server configuration is invalid.");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new HttpError(500, "server_configuration_error", "Server configuration is invalid.");
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.pathname !== "/" ||
    url.search.length > 0 ||
    url.hash.length > 0 ||
    url.username.length > 0 ||
    url.password.length > 0
  ) {
    throw new HttpError(500, "server_configuration_error", "Server configuration is invalid.");
  }

  return url.origin;
}

function getRazorpayEnvironmentForCors(): "test" | "live" {
  const environment = Deno.env.get("RAZORPAY_ENVIRONMENT")?.trim();

  if (environment === "test" || environment === "live") {
    return environment;
  }

  throw new HttpError(500, "server_configuration_error", "Server configuration is invalid.");
}

export function getAllowedOrigins(): readonly string[] {
  const configuredOrigins = Deno.env.get("SBP_ALLOWED_ORIGINS");
  const environment = getRazorpayEnvironmentForCors();

  if (configuredOrigins === undefined || configuredOrigins.trim().length === 0) {
    if (environment === "test") {
      return [TEST_FALLBACK_ORIGIN];
    }

    throw new HttpError(500, "server_configuration_error", "Server configuration is invalid.");
  }

  const origins = configuredOrigins.split(",").map(normalizeConfiguredOrigin);
  return [...new Set(origins)];
}

export function getRequestOrigin(request: Request): string | null {
  const rawOrigin = request.headers.get("origin");

  if (rawOrigin === null) {
    return null;
  }

  try {
    const url = new URL(rawOrigin);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      rawOrigin !== url.origin
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function resolveCors(request?: Request): CorsResolution {
  const headers = baseHeaders();

  if (request === undefined || !request.headers.has("origin")) {
    return { allowed: true, headers };
  }

  const requestOrigin = getRequestOrigin(request);
  const allowed = requestOrigin !== null && getAllowedOrigins().includes(requestOrigin);

  headers.set("Vary", "Origin");

  if (!allowed || requestOrigin === null) {
    return { allowed: false, headers };
  }

  headers.set("Access-Control-Allow-Origin", requestOrigin);
  headers.set("Access-Control-Allow-Headers", ALLOWED_REQUEST_HEADERS);
  headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);

  return { allowed: true, headers };
}

function validateAdditionalHeaders(headers: HeadersInit | undefined): Headers {
  const additionalHeaders = new Headers(headers);

  for (const [name] of additionalHeaders) {
    if (!SAFE_ADDITIONAL_RESPONSE_HEADERS.has(name.toLowerCase())) {
      throw new HttpError(500, "server_configuration_error", "Server configuration is invalid.");
    }
  }

  return additionalHeaders;
}

export function buildCorsHeaders(request: Request): Headers {
  return resolveCors(request).headers;
}

function createResponse<T extends JsonValue>(
  payload: T,
  status: number,
  options: JsonResponseOptions = {},
): Response {
  let cors: CorsResolution;

  try {
    cors = resolveCors(options.request);
  } catch {
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "server_configuration_error",
          message: "Server configuration is invalid.",
        },
      } satisfies JsonFailure),
      { status: 500, headers: baseHeaders() },
    );
  }

  if (!cors.allowed) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "origin_not_allowed",
          message: "Request origin is not allowed.",
        },
      } satisfies JsonFailure),
      { status: 403, headers: cors.headers },
    );
  }

  let additionalHeaders: Headers;
  try {
    additionalHeaders = validateAdditionalHeaders(options.headers);
  } catch {
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "server_configuration_error",
          message: "Server configuration is invalid.",
        },
      } satisfies JsonFailure),
      { status: 500, headers: cors.headers },
    );
  }

  additionalHeaders.forEach((value, key) => {
  cors.headers.set(key, value);
  });

  return new Response(JSON.stringify(payload), { status, headers: cors.headers });
}

export function handleCorsPreflight(request: Request): Response | null {
  if (request.method !== "OPTIONS") {
    return null;
  }

  let cors: CorsResolution;
  try {
    cors = resolveCors(request);
  } catch {
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "server_configuration_error",
          message: "Server configuration is invalid.",
        },
      } satisfies JsonFailure),
      { status: 500, headers: baseHeaders() },
    );
  }

  if (!cors.allowed) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "origin_not_allowed",
          message: "Request origin is not allowed.",
        },
      } satisfies JsonFailure),
      { status: 403, headers: cors.headers },
    );
  }

  cors.headers.delete("Content-Type");
  return new Response(null, { status: 204, headers: cors.headers });
}

export function jsonSuccess<T extends JsonValue>(
  data: T,
  options: JsonResponseOptions = {},
): Response {
  return createResponse<JsonSuccess<T>>({ ok: true, data }, options.status ?? 200, options);
}

export function jsonError(
  code: string,
  message: string,
  options: JsonResponseOptions = {},
): Response {
  return createResponse<JsonFailure>(
    { ok: false, error: { code, message } },
    options.status ?? 400,
    options,
  );
}

export function methodNotAllowed(
  allowedMethods: readonly string[],
  request?: Request,
): Response {
  return jsonError("method_not_allowed", "Method not allowed.", {
    request,
    status: 405,
    headers: { Allow: allowedMethods.join(", ") },
  });
}

export function requireMethod(
  request: Request,
  allowedMethods: readonly string[],
): Response | null {
  if (allowedMethods.includes(request.method.toUpperCase())) {
    return null;
  }

  return methodNotAllowed(allowedMethods, request);
}

export function internalServerError(request?: Request): Response {
  return jsonError("internal_error", "An unexpected server error occurred.", {
    request,
    status: 500,
  });
}
