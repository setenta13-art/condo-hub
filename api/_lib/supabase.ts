export type AppAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type AuthSession = {
  access_token: string;
  refresh_token: string;
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
  return new URL(requireEnv("SUPABASE_URL")).origin;
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
        ? { access_token: payload.access_token, refresh_token: payload.refresh_token, expires_in: payload.expires_in }
        : null,
    },
    error: null,
  };
}

export async function signUp(
  email: string,
  password: string,
  name?: string,
  redirectTo?: string,
): Promise<AuthResult> {
  const key = requireEnv("SUPABASE_ANON_KEY");
  const signupUrl = new URL(`${baseUrl()}/auth/v1/signup`);
  if (redirectTo) signupUrl.searchParams.set("redirect_to", redirectTo);

  const response = await fetch(signupUrl, {
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
        ? { access_token: payload.access_token, refresh_token: payload.refresh_token, expires_in: payload.expires_in }
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
  const configuredAdminEmail = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const shouldBePlatformAdmin =
    Boolean(configuredAdminEmail) &&
    authUser.email?.trim().toLowerCase() === configuredAdminEmail;

  const payload = {
    auth_user_id: authUser.id,
    open_id: authUser.id,
    name: (authUser.user_metadata?.name as string | undefined) ?? authUser.email ?? null,
    email: authUser.email ?? null,
    login_method: "supabase",
    last_signed_in: new Date().toISOString(),
    ...(shouldBePlatformAdmin ? { role: "admin" } : {}),
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


export async function sendPasswordRecovery(email: string, redirectTo?: string) {
  const key = requireEnv("SUPABASE_ANON_KEY");
  const url = new URL(`${baseUrl()}/auth/v1/recover`);
  if (redirectTo) url.searchParams.set("redirect_to", redirectTo);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  const payload = await json(response);
  return {
    ok: response.ok,
    error: response.ok ? null : errorMessage(payload, "Não foi possível enviar a recuperação."),
  };
}

export async function updatePassword(accessToken: string, password: string) {
  const key = requireEnv("SUPABASE_ANON_KEY");
  const response = await fetch(`${baseUrl()}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });

  const payload = await json(response);
  return {
    ok: response.ok,
    error: response.ok ? null : errorMessage(payload, "Não foi possível atualizar a senha."),
  };
}


export async function refreshSession(refreshToken: string): Promise<AuthResult> {
  const key = requireEnv("SUPABASE_ANON_KEY");
  const response = await fetch(`${baseUrl()}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const payload = await json(response);
  if (!response.ok) {
    return { data: { user: null, session: null }, error: { message: errorMessage(payload, "Sessão expirada.") } };
  }
  return {
    data: {
      user: payload?.user ?? null,
      session: payload?.access_token && payload?.refresh_token && payload?.expires_in
        ? { access_token: payload.access_token, refresh_token: payload.refresh_token, expires_in: payload.expires_in }
        : null,
    },
    error: null,
  };
}

export type InvitationAcceptanceResult = {
  ok: boolean;
  code?: string;
  message?: string;
  condominiumId?: number | string;
  membershipId?: number | string;
};

export async function acceptInvitationForUser(
  token: string,
  appUserId: number,
  email?: string | null,
): Promise<InvitationAcceptanceResult> {
  if (!/^[A-Za-z0-9_-]{20,96}$/.test(token)) {
    return { ok: false, code: "INVALID_TOKEN", message: "Convite inválido." };
  }

  const response = await adminFetch("rpc/accept_invitation", {
    method: "POST",
    body: JSON.stringify({
      p_token: token,
      p_user_id: appUserId,
      p_user_email: email?.trim().toLowerCase() || null,
    }),
  });
  const payload = await json(response);
  if (!response.ok) {
    return {
      ok: false,
      code: "RPC_ERROR",
      message: errorMessage(payload, "Não foi possível ativar o convite."),
    };
  }
  return (payload ?? { ok: false, code: "EMPTY_RESPONSE", message: "Não foi possível ativar o convite." }) as InvitationAcceptanceResult;
}


export type InvitationActivationResult = InvitationAcceptanceResult & {
  attempted: boolean;
  source?: "token" | "email";
};

async function findSinglePendingInvitationTokenForEmail(email?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return { token: null as string | null, multiple: false };

  const response = await adminFetch(
    `invitations?status=eq.pending&email=ilike.${encodeURIComponent(normalizedEmail)}&select=token,expires_at&order=created_at.asc&limit=3`,
  );
  const payload = await json(response);
  if (!response.ok || !Array.isArray(payload)) {
    return { token: null as string | null, multiple: false };
  }

  const valid = payload.filter(row =>
    typeof row?.token === "string" &&
    typeof row?.expires_at === "string" &&
    new Date(row.expires_at).getTime() > Date.now(),
  );

  if (valid.length === 1) {
    return { token: valid[0].token as string, multiple: false };
  }

  return { token: null as string | null, multiple: valid.length > 1 };
}

export async function activateInvitationForAuthenticatedUser(
  inviteToken: string | null | undefined,
  appUserId: number,
  email?: string | null,
): Promise<InvitationActivationResult> {
  const safeToken =
    typeof inviteToken === "string" && /^[A-Za-z0-9_-]{20,96}$/.test(inviteToken)
      ? inviteToken
      : null;

  let directResult: InvitationAcceptanceResult | null = null;
  if (safeToken) {
    directResult = await acceptInvitationForUser(safeToken, appUserId, email);
    if (directResult.ok) return { ...directResult, attempted: true, source: "token" };
    if (directResult.code === "EMAIL_MISMATCH") {
      return { ...directResult, attempted: true, source: "token" };
    }
  }

  const pending = await findSinglePendingInvitationTokenForEmail(email);
  if (pending.token) {
    const result = await acceptInvitationForUser(pending.token, appUserId, email);
    return { ...result, attempted: true, source: "email" };
  }

  if (pending.multiple) {
    return {
      ok: false,
      code: "MULTIPLE_PENDING_INVITES",
      message: "Há mais de um convite pendente para este e-mail. Escolha qual acesso deseja ativar.",
      attempted: false,
    };
  }

  return directResult
    ? { ...directResult, attempted: true, source: "token" }
    : { ok: false, code: "NO_PENDING_INVITE", attempted: false };
}

export async function validateInvitationForSignup(token: string, email: string) {
  const response = await adminFetch(
    `invitations?token=eq.${encodeURIComponent(token)}&select=id,email,status,expires_at&limit=1`,
  );
  const payload = await json(response);
  const invitation = Array.isArray(payload) ? payload[0] : null;
  if (!response.ok || !invitation) return { ok: false, error: "Convite inválido ou não encontrado." } as const;
  if (invitation.status !== "pending") return { ok: false, error: "Este convite não está mais disponível." } as const;
  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    return { ok: false, error: "Este convite expirou. Solicite um novo link à administração." } as const;
  }
  const invitedEmail = typeof invitation.email === "string" ? invitation.email.trim().toLowerCase() : "";
  if (invitedEmail && invitedEmail !== email.trim().toLowerCase()) {
    return { ok: false, error: "Use o mesmo e-mail informado no convite." } as const;
  }
  return { ok: true } as const;
}
