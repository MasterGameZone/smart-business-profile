import {
  handleCorsPreflight,
  internalServerError,
  jsonError,
  jsonSuccess,
  requireMethod,
} from "../_shared/http.ts";
import { createAuthenticatedContext } from "../_shared/supabaseClients.ts";
import {
  RazorpayConfigurationError,
  verifyRazorpayCheckoutSignature,
} from "../_shared/razorpay.ts";

const MAX_REQUEST_BODY_BYTES = 4_096;
const MAX_IDENTIFIER_LENGTH = 200;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EXPECTED_BILLING_PROVIDER = "razorpay";
const EXPECTED_INTERNAL_PLAN_ID = "pro_analytics";
const CHECKOUT_VERIFIABLE_STATUSES = new Set(["incomplete", "active"]);

type CheckoutResponse = {
  paymentId: string;
  subscriptionId: string;
  signature: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  return ownerId !== null && UUID_PATTERN.test(ownerId) ? ownerId : null;
}

async function parseCheckoutBody(
  request: Request,
): Promise<CheckoutResponse | null> {
  try {
    const rawBody = await request.text();

    if (
      new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BODY_BYTES
    ) {
      return null;
    }

    const parsed: unknown = JSON.parse(rawBody);

    if (!isRecord(parsed)) {
      return null;
    }

    const keys = Object.keys(parsed);

    if (
      keys.length !== 3 ||
      !keys.includes("razorpay_payment_id") ||
      !keys.includes("razorpay_subscription_id") ||
      !keys.includes("razorpay_signature")
    ) {
      return null;
    }

    const paymentId = nonBlankString(parsed.razorpay_payment_id);
    const subscriptionId = nonBlankString(
      parsed.razorpay_subscription_id,
    );
    const signature = parsed.razorpay_signature;

    if (
      paymentId === null ||
      subscriptionId === null ||
      paymentId.length > MAX_IDENTIFIER_LENGTH ||
      subscriptionId.length > MAX_IDENTIFIER_LENGTH ||
      !paymentId.startsWith("pay_") ||
      !subscriptionId.startsWith("sub_") ||
      typeof signature !== "string" ||
      signature.length > MAX_IDENTIFIER_LENGTH ||
      !/^[0-9a-f]{64}$/i.test(signature)
    ) {
      return null;
    }

    return {
      paymentId,
      subscriptionId,
      signature,
    };
  } catch {
    return null;
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
      return jsonError(authResult.code, authResult.message, {
        request,
        status: authResult.status,
      });
    }

    const ownerId = ownerIdFromClaims(authResult.context.userClaims);

    if (ownerId === null) {
      return jsonError(
        "invalid_authentication",
        "Authentication could not be verified.",
        {
          request,
          status: 401,
        },
      );
    }

    const checkout = await parseCheckoutBody(request);

    if (checkout === null) {
      return jsonError(
        "invalid_checkout_response",
        "The Checkout response is invalid.",
        {
          request,
          status: 400,
        },
      );
    }

    let providerSubscriptionId: string | null = null;
    let subscriptionStatus: string | null = null;
    let billingProvider: string | null = null;
    let internalPlanId: string | null = null;

    try {
      const { data, error } = await authResult.context.supabaseAdmin
        .from("business_owner_subscriptions")
        .select(
          "provider_subscription_id,status,billing_provider,plan_id",
        )
        .eq("owner_id", ownerId)
        .maybeSingle();

      if (error !== null) {
        return jsonError(
          "subscription_lookup_failed",
          "The subscription could not be verified.",
          {
            request,
            status: 500,
          },
        );
      }

      if (data !== null && !isRecord(data)) {
        return jsonError(
          "subscription_lookup_failed",
          "The subscription could not be verified.",
          {
            request,
            status: 500,
          },
        );
      }

      if (data !== null) {
        providerSubscriptionId = nonBlankString(
          data.provider_subscription_id,
        );
        subscriptionStatus = nonBlankString(data.status);
        billingProvider = nonBlankString(data.billing_provider);
        internalPlanId = nonBlankString(data.plan_id);
      }
    } catch {
      return jsonError(
        "subscription_lookup_failed",
        "The subscription could not be verified.",
        {
          request,
          status: 500,
        },
      );
    }

    if (
      providerSubscriptionId === null ||
      billingProvider !== EXPECTED_BILLING_PROVIDER ||
      internalPlanId !== EXPECTED_INTERNAL_PLAN_ID ||
      subscriptionStatus === null ||
      !CHECKOUT_VERIFIABLE_STATUSES.has(subscriptionStatus)
    ) {
      return jsonError(
        "subscription_not_ready",
        "No subscription is available for Checkout verification.",
        {
          request,
          status: 409,
        },
      );
    }

    if (checkout.subscriptionId !== providerSubscriptionId) {
      return jsonError(
        "invalid_checkout_response",
        "The Checkout response is invalid.",
        {
          request,
          status: 400,
        },
      );
    }

    let verified: boolean;

    try {
      verified = await verifyRazorpayCheckoutSignature(
        checkout.paymentId,
        providerSubscriptionId,
        checkout.signature,
      );
    } catch (error) {
      if (error instanceof RazorpayConfigurationError) {
        return jsonError(
          "server_configuration_error",
          "Server payment configuration is invalid.",
          {
            request,
            status: 500,
          },
        );
      }

      return internalServerError(request);
    }

    if (!verified) {
      return jsonError(
        "invalid_checkout_signature",
        "The Checkout signature could not be verified.",
        {
          request,
          status: 400,
        },
      );
    }

    return jsonSuccess(
      {
        verified: true,
        message:
          "Payment authorization received. Subscription activation is being confirmed.",
      },
      {
        request,
        status: 200,
      },
    );
  },
};
