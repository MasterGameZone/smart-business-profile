import { createSupabaseContext } from "npm:@supabase/server@^1";
import type { SupabaseContext } from "npm:@supabase/server@^1";

type ServerContext = SupabaseContext<unknown>;

export type ContextFailure = {
  ok: false;
  status: number;
  code: "unauthorized" | "invalid_authentication" | "server_configuration_error";
  message: string;
};

export type AuthenticatedSupabaseContext = {
  // RLS-scoped to the verified caller identity. Use this for user-owned reads.
  supabase: ServerContext["supabase"];
  // Bypasses RLS. Use only for trusted backend RPCs after authorization checks.
  // This client must never be exported to React or constructed from VITE_* values.
  supabaseAdmin: ServerContext["supabaseAdmin"];
  userClaims: NonNullable<ServerContext["userClaims"]>;
  jwtClaims: ServerContext["jwtClaims"];
};

export type WebhookSupabaseContext = {
  // auth: 'none' leaves this client anonymous and does not authenticate Razorpay.
  supabase: ServerContext["supabase"];
  // The future webhook handler must verify the Razorpay signature before using this
  // RLS-bypassing admin client. This helper does not authorize provider requests.
  supabaseAdmin: ServerContext["supabaseAdmin"];
};

export type AuthenticatedContextResult =
  | { ok: true; context: AuthenticatedSupabaseContext }
  | ContextFailure;

export type WebhookContextResult =
  | { ok: true; context: WebhookSupabaseContext }
  | ContextFailure;

function authenticationFailure(request: Request, status: number): ContextFailure {
  if (status >= 500) {
    return {
      ok: false,
      status: 500,
      code: "server_configuration_error",
      message: "Server authentication configuration is invalid.",
    };
  }

  if (request.headers.has("authorization")) {
    return {
      ok: false,
      status: 401,
      code: "invalid_authentication",
      message: "Authentication could not be verified.",
    };
  }

  return {
    ok: false,
    status: 401,
    code: "unauthorized",
    message: "Authentication is required.",
  };
}

function configurationFailure(): ContextFailure {
  return {
    ok: false,
    status: 500,
    code: "server_configuration_error",
    message: "Server authentication configuration is invalid.",
  };
}

export async function createAuthenticatedContext(
  request: Request,
): Promise<AuthenticatedContextResult> {
  try {
    const { data, error } = await createSupabaseContext(request, {
      auth: "user",
      cors: "disabled",
    });

    if (error !== null || data === null) {
      return authenticationFailure(request, error?.status ?? 500);
    }

    if (data.userClaims === null) {
      return authenticationFailure(request, 401);
    }

    return {
      ok: true,
      context: {
        supabase: data.supabase,
        supabaseAdmin: data.supabaseAdmin,
        userClaims: data.userClaims,
        jwtClaims: data.jwtClaims,
      },
    };
  } catch {
    return configurationFailure();
  }
}

export async function createWebhookContext(request: Request): Promise<WebhookContextResult> {
  try {
    const { data, error } = await createSupabaseContext(request, {
      auth: "none",
      cors: "disabled",
    });

    if (error !== null || data === null) {
      return configurationFailure();
    }

    return {
      ok: true,
      context: {
        supabase: data.supabase,
        supabaseAdmin: data.supabaseAdmin,
      },
    };
  } catch {
    return configurationFailure();
  }
}
