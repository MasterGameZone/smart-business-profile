import {
  handleCorsPreflight,
  internalServerError,
  jsonError,
  jsonSuccess,
  requireMethod,
  type JsonValue,
} from "../_shared/http.ts";
import {
  createAuthenticatedContext,
  type AuthenticatedSupabaseContext,
} from "../_shared/supabaseClients.ts";
import {
  getRazorpayApiConfig,
  RAZORPAY_AMOUNT_MINOR_UNITS,
  RAZORPAY_CHECKOUT_DESCRIPTION,
  RAZORPAY_CHECKOUT_NAME,
  RAZORPAY_CURRENCY,
  RAZORPAY_INTERNAL_PLAN_ID,
  RazorpayApiError,
  RazorpayConfigurationError,
  razorpayApiRequest,
} from "../_shared/razorpay.ts";

const MAX_REQUEST_BODY_BYTES = 4_096;
const TOTAL_COUNT = 120;
const QUANTITY = 1;
const AUTHORIZATION_EXPIRY_SECONDS = 24 * 60 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUBSCRIPTION_STATUSES = new Set([
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
const CORRELATION_NOTE_KEYS = [
  "sbp_owner_id",
  "sbp_subscription_id",
  "sbp_plan_id",
  "sbp_creation_attempt_id",
  "sbp_environment",
] as const;

type ClaimDecision = "create" | "in_progress" | "blocked" | "inspect_existing";

type ClaimResult = {
  decision: ClaimDecision;
  internalSubscriptionId: string;
  creationAttemptId: string | null;
  providerSubscriptionId: string | null;
  internalStatus: string;
};

type SubscriptionSnapshot = {
  id: string;
  planId: string;
  status: string;
  notes: Record<string, string>;
};

type CheckoutResponse = {
  provider: "razorpay";
  environment: "test" | "live";
  keyId: string;
  subscriptionId: string;
  checkoutName: string;
  checkoutDescription: string;
  amountMinorUnits: number;
  currency: "INR";
  reused: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

function isClaimDecision(value: unknown): value is ClaimDecision {
  return value === "create" || value === "in_progress" || value === "blocked" || value === "inspect_existing";
}

function nonBlankString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function ownerIdFromClaims(claims: unknown): string | null {
  if (!isRecord(claims)) {
    return null;
  }

  const ownerId = nonBlankString(claims.id);
  return ownerId !== null && isUuid(ownerId) ? ownerId : null;
}

async function hasEmptyRequestBody(request: Request): Promise<boolean> {
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BODY_BYTES) {
      return false;
    }

    if (rawBody.trim().length === 0) {
      return true;
    }

    const parsed: unknown = JSON.parse(rawBody);
    return isRecord(parsed) && Object.keys(parsed).length === 0;
  } catch {
    return false;
  }
}

function parseClaimResult(data: unknown): ClaimResult | null {
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
    return null;
  }

  const row = data[0];
  const decision = row.decision;
  const internalSubscriptionId = nonBlankString(row.internal_subscription_id);
  const internalStatus = nonBlankString(row.internal_status);
  const creationAttemptId = row.creation_attempt_id;
  const providerSubscriptionId = row.provider_subscription_id;

  if (
    !isClaimDecision(decision) ||
    internalSubscriptionId === null ||
    !isUuid(internalSubscriptionId) ||
    internalStatus === null
  ) {
    return null;
  }

  if (creationAttemptId !== null && (!isUuid(creationAttemptId) || typeof creationAttemptId !== "string")) {
    return null;
  }

  if (providerSubscriptionId !== null && nonBlankString(providerSubscriptionId) === null) {
    return null;
  }

  return {
    decision,
    internalSubscriptionId: internalSubscriptionId.trim(),
    creationAttemptId: creationAttemptId === null ? null : creationAttemptId.trim(),
    providerSubscriptionId: providerSubscriptionId === null ? null : nonBlankString(providerSubscriptionId),
    internalStatus,
  };
}

function parseNotes(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    throw new Error("Invalid provider notes.");
  }

  const notes: Record<string, string> = {};
  for (const key of CORRELATION_NOTE_KEYS) {
    if (value[key] !== undefined && typeof value[key] !== "string") {
      throw new Error("Invalid provider note.");
    }
    const note = value[key];
    if (typeof note === "string") {
      notes[key] = note;
    }
  }
  return notes;
}

function parseExistingSubscription(payload: JsonValue): SubscriptionSnapshot {
  if (!isRecord(payload)) {
    throw new Error("Invalid provider response.");
  }

  const id = nonBlankString(payload.id);
  const planId = nonBlankString(payload.plan_id);
  const status = nonBlankString(payload.status);
  if (
    payload.entity !== "subscription" ||
    id === null ||
    !id.startsWith("sub_") ||
    planId === null ||
    !planId.startsWith("plan_") ||
    status === null ||
    !SUBSCRIPTION_STATUSES.has(status)
  ) {
    throw new Error("Invalid provider response.");
  }

  return { id, planId, status, notes: parseNotes(payload.notes) };
}

function parseCreatedSubscription(payload: JsonValue, expected: {
  ownerId: string;
  internalSubscriptionId: string;
  creationAttemptId: string;
  environment: "test" | "live";
  planId: string;
}): SubscriptionSnapshot {
  if (!isRecord(payload)) {
    throw new Error("Invalid provider response.");
  }

  const id = nonBlankString(payload.id);
  const planId = nonBlankString(payload.plan_id);
  const status = nonBlankString(payload.status);
  if (
    payload.entity !== "subscription" ||
    id === null ||
    !id.startsWith("sub_") ||
    planId !== expected.planId ||
    status !== "created" ||
    payload.total_count !== TOTAL_COUNT ||
    payload.quantity !== QUANTITY ||
    payload.customer_notify !== true
  ) {
    throw new Error("Invalid provider response.");
  }

  const notes = parseNotes(payload.notes);
  if (
    notes.sbp_owner_id !== expected.ownerId ||
    notes.sbp_subscription_id !== expected.internalSubscriptionId ||
    notes.sbp_plan_id !== RAZORPAY_INTERNAL_PLAN_ID ||
    notes.sbp_creation_attempt_id !== expected.creationAttemptId ||
    notes.sbp_environment !== expected.environment
  ) {
    throw new Error("Invalid provider response.");
  }

  return { id, planId, status, notes };
}

function correlationMatches(
  snapshot: SubscriptionSnapshot,
  claim: ClaimResult,
  ownerId: string,
  environment: "test" | "live",
  planId: string,
): boolean {
  return (
    claim.providerSubscriptionId === snapshot.id &&
    snapshot.planId === planId &&
    snapshot.notes.sbp_owner_id === ownerId &&
    snapshot.notes.sbp_subscription_id === claim.internalSubscriptionId &&
    snapshot.notes.sbp_plan_id === RAZORPAY_INTERNAL_PLAN_ID &&
    snapshot.notes.sbp_environment === environment &&
    (claim.creationAttemptId === null || snapshot.notes.sbp_creation_attempt_id === claim.creationAttemptId)
  );
}

function checkoutResponse(
  config: ReturnType<typeof getRazorpayApiConfig>,
  subscriptionId: string,
  reused: boolean,
): CheckoutResponse {
  return {
    provider: "razorpay",
    environment: config.environment,
    keyId: config.keyId,
    subscriptionId,
    checkoutName: RAZORPAY_CHECKOUT_NAME,
    checkoutDescription: RAZORPAY_CHECKOUT_DESCRIPTION,
    amountMinorUnits: RAZORPAY_AMOUNT_MINOR_UNITS,
    currency: RAZORPAY_CURRENCY,
    reused,
  };
}

function reconciliationRequired(request: Request, message = "The subscription was created but requires reconciliation before Checkout can continue."): Response {
  return jsonError("subscription_reconciliation_required", message, { request, status: 503 });
}

async function releaseClaim(
  context: AuthenticatedSupabaseContext,
  ownerId: string,
  creationAttemptId: string,
): Promise<boolean> {
  try {
    const { data, error } = await context.supabaseAdmin.rpc("release_razorpay_subscription_creation", {
      p_owner_id: ownerId,
      p_creation_attempt_id: creationAttemptId,
    });
    return error === null && data === true;
  } catch {
    return false;
  }
}

async function handleProviderMutationError(
  error: unknown,
  context: AuthenticatedSupabaseContext,
  ownerId: string,
  creationAttemptId: string,
  request: Request,
): Promise<Response> {
  if (!(error instanceof RazorpayApiError) || error.outcomeUnknown) {
    return jsonError(
      "subscription_outcome_unknown",
      "The subscription request outcome is being reconciled. Do not try again yet.",
      { request, status: 503 },
    );
  }

  if (await releaseClaim(context, ownerId, creationAttemptId)) {
    return jsonError("provider_request_failed", "Razorpay could not create the subscription.", {
      request,
      status: 502,
    });
  }

  return reconciliationRequired(request);
}

async function claimSubscription(
  context: AuthenticatedSupabaseContext,
  ownerId: string,
  request: Request,
): Promise<ClaimResult | Response> {
  try {
    const { data, error } = await context.supabaseAdmin.rpc("claim_razorpay_subscription_creation", {
      p_owner_id: ownerId,
    });

    if (error !== null) {
      if (typeof error.code === "string" && error.code === "42501") {
        return jsonError(
          "business_owner_not_eligible",
          "A valid Business Owner account with a business profile is required.",
          { request, status: 403 },
        );
      }
      return jsonError("subscription_claim_failed", "The subscription request could not be prepared.", {
        request,
        status: 500,
      });
    }

    const parsed = parseClaimResult(data);
    return parsed ?? jsonError("subscription_claim_failed", "The subscription request could not be prepared.", {
      request,
      status: 500,
    });
  } catch {
    return jsonError("subscription_claim_failed", "The subscription request could not be prepared.", {
      request,
      status: 500,
    });
  }
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

    if (!(await hasEmptyRequestBody(request))) {
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

    const claimResult = await claimSubscription(authResult.context, ownerId, request);
    if (claimResult instanceof Response) {
      return claimResult;
    }

    const claim = claimResult;
    if (claim.decision === "in_progress") {
      return jsonError("creation_in_progress", "A subscription request is already being processed.", {
        request,
        status: 409,
      });
    }
    if (claim.decision === "blocked") {
      return jsonError("existing_subscription", "An existing subscription currently prevents a new subscription.", {
        request,
        status: 409,
      });
    }

    if (claim.decision === "inspect_existing") {
      if (claim.providerSubscriptionId === null) {
        return jsonError(
          "subscription_reconciliation_required",
          "The previous subscription request must be reconciled before another request can be created.",
          { request, status: 409 },
        );
      }

      let existing: SubscriptionSnapshot;
      try {
        existing = await razorpayApiRequest(
          `/subscriptions/${encodeURIComponent(claim.providerSubscriptionId)}`,
          { method: "GET" },
          parseExistingSubscription,
        );
      } catch (error) {
        if (error instanceof RazorpayApiError && error.retryable) {
          return jsonError("provider_temporarily_unavailable", "Razorpay is temporarily unavailable.", {
            request,
            status: 503,
          });
        }
        if (error instanceof RazorpayApiError && error.status === 404) {
          return jsonError(
            "subscription_reconciliation_required",
            "The previous subscription request must be reconciled before another request can be created.",
            { request, status: 409 },
          );
        }
        return jsonError("provider_request_failed", "Razorpay could not retrieve the existing subscription.", {
          request,
          status: 502,
        });
      }

      if (!correlationMatches(existing, claim, ownerId, config.environment, config.planId)) {
        return jsonError(
          "subscription_reconciliation_required",
          "The previous subscription request must be reconciled before another request can be created.",
          { request, status: 409 },
        );
      }

      if (existing.status === "created") {
        return jsonSuccess(checkoutResponse(config, existing.id, true), { request, status: 200 });
      }
      if (existing.status === "authenticated" || existing.status === "active") {
        return jsonError(
          "subscription_already_authorized",
          "The existing subscription has already been authorized and is awaiting or using verified provider state.",
          { request, status: 409 },
        );
      }
      if (existing.status === "pending" || existing.status === "halted" || existing.status === "paused") {
        return jsonError(
          "existing_subscription_payment_issue",
          "The existing subscription requires payment-state resolution.",
          { request, status: 409 },
        );
      }
      return jsonError(
        "subscription_reconciliation_required",
        "The existing provider subscription must be synchronized before a replacement can be created.",
        { request, status: 409 },
      );
    }

    if (
      claim.internalSubscriptionId.length === 0 ||
      claim.creationAttemptId === null ||
      claim.providerSubscriptionId !== null
    ) {
      return internalServerError(request);
    }

    const creationAttemptId = claim.creationAttemptId;
    let created: SubscriptionSnapshot;
    try {
      created = await razorpayApiRequest(
        "/subscriptions",
        {
          method: "POST",
          body: {
            plan_id: config.planId,
            total_count: TOTAL_COUNT,
            quantity: QUANTITY,
            customer_notify: true,
            expire_by: Math.floor(Date.now() / 1000) + AUTHORIZATION_EXPIRY_SECONDS,
            notes: {
              sbp_owner_id: ownerId,
              sbp_subscription_id: claim.internalSubscriptionId,
              sbp_plan_id: RAZORPAY_INTERNAL_PLAN_ID,
              sbp_creation_attempt_id: creationAttemptId,
              sbp_environment: config.environment,
            },
          },
        },
        (payload) => parseCreatedSubscription(payload, {
          ownerId,
          internalSubscriptionId: claim.internalSubscriptionId,
          creationAttemptId,
          environment: config.environment,
          planId: config.planId,
        }),
      );
    } catch (error) {
      return handleProviderMutationError(error, authResult.context, ownerId, creationAttemptId, request);
    }

    try {
      const { data, error } = await authResult.context.supabaseAdmin.rpc("finalize_razorpay_subscription_creation", {
        p_owner_id: ownerId,
        p_creation_attempt_id: creationAttemptId,
        p_provider_subscription_id: created.id,
        p_provider_plan_id: created.planId,
      });
      if (error !== null || data !== true) {
        return reconciliationRequired(request);
      }
    } catch {
      return reconciliationRequired(request);
    }

    return jsonSuccess(checkoutResponse(config, created.id, false), { request, status: 201 });
  },
};
