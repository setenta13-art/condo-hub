type RequestLike = {
  protocol?: string;
  headers?: Record<string, string | string[] | undefined>;
};

export type SessionCookieOptions = {
  domain?: string;
  httpOnly: boolean;
  path: string;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
};

function isSecureRequest(req: RequestLike) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers?.["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(
    (proto: string) => proto.trim().toLowerCase() === "https"
  );
}

export function getSessionCookieOptions(
  req: RequestLike
): SessionCookieOptions {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req),
  };
}

// Preserve refreshed auth cookies when a mutation selects a membership.
export function appendResponseCookie(
  res: {
    get(name: string): unknown;
    set(name: string, value: string[]): unknown;
  },
  cookie: string
) {
  const existing = res.get("Set-Cookie");
  const cookies = Array.isArray(existing)
    ? existing.map(String)
    : typeof existing === "string"
      ? [existing]
      : [];
  res.set("Set-Cookie", [...cookies, cookie]);
}
