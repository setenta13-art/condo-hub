import { ENV } from "./_core/env.js";

export type AppAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type AuthSession = {
  access_token: string;
  expires_in: number;
};

type AuthResult = {
  data: { user: AppAuthUser | null; session: AuthSession | null };
  error: { message: string } | null;
};

function requireValue(value: string, name: string) {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function supabaseUrl() {
  return requireValue(ENV.supabaseUrl, "SUPABASE_URL").replace(/\/$/, "");
}

function anonKey() {
  return requireValue(ENV.supabaseAnonKey, "SUPABASE_ANON_KEY");
}

function serviceRoleKey() {
  return requireValue(ENV.supabaseServiceRoleKey, "SUPABASE_SERVICE_ROLE_KEY");
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as any;
  } catch {
    return { message: text };
  }
}

function authError(payload: any, fallback: string) {
  return {
    message:
      payload?.msg ??
      payload?.message ??
      payload?.error_description ??
      payload?.error ??
      fallback,
  };
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const key = anonKey();
  const response = await fetch(`${supabaseUrl()}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = await readJson(response);
  if (!response.ok) {
    return {
      data: { user: null, session: null },
      error: authError(payload, "Não foi possível entrar."),
    };
  }

  return {
    data: {
      user: payload?.user ?? null,
      session:
        payload?.access_token && payload?.expires_in
          ? { access_token: payload.access_token, expires_in: payload.expires_in }
          : null,
    },
    error: null,
  };
}

export async function signUpWithPassword(
  email: string,
  password: string,
  name?: string,
): Promise<AuthResult> {
  const key = anonKey();
  const response = await fetch(`${supabaseUrl()}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      data: name ? { name } : {},
    }),
  });

  const payload = await readJson(response);
  if (!response.ok) {
    return {
      data: { user: null, session: null },
      error: authError(payload, "Não foi possível criar a conta."),
    };
  }

  return {
    data: {
      user: payload?.user ?? payload ?? null,
      session:
        payload?.access_token && payload?.expires_in
          ? { access_token: payload.access_token, expires_in: payload.expires_in }
          : null,
    },
    error: null,
  };
}

export async function getSupabaseUser(accessToken: string): Promise<AppAuthUser | null> {
  const key = anonKey();
  const response = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return null;
  return (await readJson(response)) as AppAuthUser;
}

export async function supabaseAdminFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const key = serviceRoleKey();
  return fetch(`${supabaseUrl()}/rest/v1/${path.replace(/^\//, "")}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export async function upsertAppUser(authUser: AppAuthUser) {
  const payload = {
    auth_user_id: authUser.id,
    open_id: authUser.id,
    name: (authUser.user_metadata?.name as string | undefined) ?? authUser.email ?? null,
    email: authUser.email ?? null,
    login_method: "supabase",
    last_signed_in: new Date().toISOString(),
  };

  const response = await supabaseAdminFetch(
    "app_users?on_conflict=auth_user_id&select=id,open_id,name,email,login_method,role,created_at,updated_at,last_signed_in",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    },
  );

  const rows = await readJson(response);
  const data = Array.isArray(rows) ? rows[0] : rows;
  if (!response.ok || !data) {
    throw new Error(
      authError(rows, "Unable to sync app user").message,
    );
  }

  return {
    id: Number(data.id),
    openId: data.open_id,
    name: data.name,
    email: data.email,
    loginMethod: data.login_method,
    role: data.role,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    lastSignedIn: new Date(data.last_signed_in),
  };
}
