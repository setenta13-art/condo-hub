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

// Serverless compilation may resolve Express without its inherited Node methods.
// Validate the runtime response at this adapter boundary rather than casting callers.
type HeaderResponse = {
  getHeader(name: string): unknown;
  setHeader(name: string, value: string | string[]): unknown;
};
function headerResponse(value: unknown): HeaderResponse {
  const response = value as Partial<HeaderResponse> | null;
  if (
    !response ||
    typeof response.getHeader !== "function" ||
    typeof response.setHeader !== "function"
  ) {
    throw new Error("Invalid HTTP response adapter");
  }
  return response as HeaderResponse;
}
export function writeResponseHeader(
  response: unknown,
  name: string,
  value: string | string[]
) {
  headerResponse(response).setHeader(name, value);
}
// Preserve refreshed auth cookies when a mutation selects a membership.
export function appendResponseCookie(response: unknown, cookie: string) {
  const res = headerResponse(response);
  const existing = res.getHeader("Set-Cookie");
  const cookies = Array.isArray(existing)
    ? existing.map(String)
    : typeof existing === "string"
      ? [existing]
      : [];
  res.setHeader("Set-Cookie", [...cookies, cookie]);
}
