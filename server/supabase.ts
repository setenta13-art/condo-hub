import { createClient, type SupabaseClient, type User as SupabaseAuthUser } from "@supabase/supabase-js";
import { ENV } from "./_core/env";

let adminClient: SupabaseClient | null = null;
let authClient: SupabaseClient | null = null;

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

export type AppAuthUser = SupabaseAuthUser;

export async function getSupabaseUser(accessToken: string) {
  const { data, error } = await getSupabaseAdmin().auth.getUser(accessToken);
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
  } as any;
}
