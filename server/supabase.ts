import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ENV } from "./_core/env";

let adminClient: SupabaseClient | null = null;
let authClient: SupabaseClient | null = null;

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type AuthResult = {
  data: { user: SupabaseAuthUser | null; session: { access_token: string; expires_in: number } | null };
  error: { message: string } | null;
};

type AuthFacade = {
  signInWithPassword(credentials: { email: string; password: string }): Promise<AuthResult>;
  signUp(input: {
    email: string;
    password: string;
    options?: { data?: Record<string, unknown> };
  }): Promise<AuthResult>;
  getUser(accessToken: string): Promise<{
    data: { user: SupabaseAuthUser | null };
    error: { message: string } | null;
  }>;
};

function assertConfig() {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceRoleKey) {
    throw new Error("Supabase server configuration is missing");
  }
}

export function getSupabaseAdmin() {
  assertConfig();
  if (!adminClient) {
    adminClient = createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

export function getSupabaseAuth() {
  if (!ENV.supabaseUrl || !ENV.supabaseAnonKey) {
    throw new Error("Supabase auth configuration is missing");
  }
  if (!authClient) {
    authClient = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return authClient;
}

function authApi(client: SupabaseClient): AuthFacade {
  return client.auth as unknown as AuthFacade;
}

export async function signInWithPassword(email: string, password: string) {
  return authApi(getSupabaseAuth()).signInWithPassword({ email, password });
}

export async function signUpWithPassword(email: string, password: string, name?: string) {
  return authApi(getSupabaseAuth()).signUp({
    email,
    password,
    options: { data: { name } },
  });
}

export type AppAuthUser = SupabaseAuthUser;

export async function getSupabaseUser(accessToken: string) {
  const { data, error } = await authApi(getSupabaseAdmin()).getUser(accessToken);
  if (error || !data.user) return null;
  return data.user;
}

export async function upsertAppUser(authUser: AppAuthUser) {
  const client = getSupabaseAdmin();
  const payload = {
    auth_user_id: authUser.id,
    open_id: authUser.id,
    name: (authUser.user_metadata?.name as string | undefined) ?? authUser.email ?? null,
    email: authUser.email ?? null,
    login_method: "supabase",
    last_signed_in: new Date().toISOString(),
  };
  const { data, error } = await client
    .from("app_users")
    .upsert(payload, { onConflict: "auth_user_id" })
    .select("id,open_id,name,email,login_method,role,created_at,updated_at,last_signed_in")
    .single();
  if (error || !data) throw error ?? new Error("Unable to sync app user");
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
