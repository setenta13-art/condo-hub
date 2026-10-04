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

function requireEnv(name: "SUPABASE_URL" | "SUPABASE_ANON_KEY" | "SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function baseUrl() {
  return requireEnv("SUPABASE_URL").replace(/\/$/, "");
}

async function json(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as any;
  } catch {
    return { message: text };
  }
}

function errorMessage(payload: any, fallback: string) {
  return payload?.msg ?? payload?.message ?? payload?.error_description ?? payload?.error ?? fallback;
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const key = requireEnv("SUPABASE_ANON_KEY");
  const response = await fetch(`${baseUrl()}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const payload = await json(response);
  if (!response.ok) {
    return { data: { user: null, session: null }, error: { message: errorMessage(payload, "Não foi possível entrar.") } };
  }
  return {
    data: {
      user: payload?.user ?? null,
      session: payload?.access_token && payload?.expires_in
        ? { access_token: payload.access_token, expires_in: payload.expires_in }
        : null,
    },
    error: null,
  };
}

export async function signUp(email: string, password: string, name?: string): Promise<AuthResult> {
  const key = requireEnv("SUPABASE_ANON_KEY");
  const response = await fetch(`${baseUrl()}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, data: name ? { name } : {} }),
  });
  const payload = await json(response);
  if (!response.ok) {
    return { data: { user: null, session: null }, error: { message: errorMessage(payload, "Não foi possível criar a conta.") } };
  }
  return {
    data: {
      user: payload?.user ?? payload ?? null,
      session: payload?.access_token && payload?.expires_in
        ? { access_token: payload.access_token, expires_in: payload.expires_in }
        : null,
    },
    error: null,
  };
}

export async function getUser(accessToken: string): Promise<AppAuthUser | null> {
  const key = requireEnv("SUPABASE_ANON_KEY");
  const response = await fetch(`${baseUrl()}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  return (await json(response)) as AppAuthUser;
}

export async function adminFetch(path: string, init: RequestInit = {}) {
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return fetch(`${baseUrl()}/rest/v1/${path.replace(/^\//, "")}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export async function syncAppUser(authUser: AppAuthUser) {
  const payload = {
    auth_user_id: authUser.id,
    open_id: authUser.id,
    name: (authUser.user_metadata?.name as string | undefined) ?? authUser.email ?? null,
    email: authUser.email ?? null,
    login_method: "supabase",
    last_signed_in: new Date().toISOString(),
  };
  const response = await adminFetch(
    "app_users?on_conflict=auth_user_id&select=id,open_id,name,email,login_method,role,created_at,updated_at,last_signed_in",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(payload),
    },
  );
  const rows = await json(response);
  const data = Array.isArray(rows) ? rows[0] : rows;
  if (!response.ok || !data) throw new Error(errorMessage(rows, "Unable to sync app user"));
  return {
    id: Number(data.id),
    openId: data.open_id as string | null,
    name: data.name as string | null,
    email: data.email as string | null,
    loginMethod: data.login_method as string | null,
    role: data.role as "user" | "admin",
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    lastSignedIn: new Date(data.last_signed_in),
  };
}
