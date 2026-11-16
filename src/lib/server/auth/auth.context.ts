import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import type { DatabaseRepositories } from "@/lib/server/database/database.types";
import type { AuthContext } from "@/types/auth";
import { isAuthRequired } from "./authorization";

export { isAuthRequired };

export const ACCESS_TOKEN_COOKIE = "afh_access_token";
export const REFRESH_TOKEN_COOKIE = "afh_refresh_token";

export interface ServerExecutionContext {
  auth: AuthContext;
  accessToken: string | null;
  refreshToken: string | null;
  repos: DatabaseRepositories;
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

export function extractRequestTokens(request: Request | undefined): {
  accessToken: string | null;
  refreshToken: string | null;
  ipAddress: string | null;
  userAgent: string | null;
} {
  if (!request?.headers) {
    return {
      accessToken: null,
      refreshToken: null,
      ipAddress: null,
      userAgent: null,
    };
  }

  const authHeader = request.headers.get("authorization");
  let accessToken: string | null = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token) accessToken = token;
  }

  const cookies = parseCookies(request.headers.get("cookie"));
  if (!accessToken && cookies[ACCESS_TOKEN_COOKIE]) {
    accessToken = cookies[ACCESS_TOKEN_COOKIE];
  }

  const refreshToken = cookies[REFRESH_TOKEN_COOKIE] ?? null;

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress =
    (forwardedFor ? forwardedFor.split(",")[0]?.trim() : null) ||
    request.headers.get("x-real-ip") ||
    null;

  const userAgent = request.headers.get("user-agent") || null;

  return {
    accessToken,
    refreshToken,
    ipAddress,
    userAgent,
  };
}

export function setAuthSessionCookies(params: {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
}): void {
  try {
    const request = getRequest();
    const isSecure =
      process.env.NODE_ENV === "production" ||
      (request?.url ? request.url.startsWith("https://") : false);

    const secureAttr = isSecure ? "; Secure" : "";
    const nowSec = Math.floor(Date.now() / 1000);
    const maxAgeAccess =
      params.expiresAt && params.expiresAt > nowSec ? params.expiresAt - nowSec : 3600;
    const maxAgeRefresh = 60 * 60 * 24 * 30; // 30 dias

    const cookies: string[] = [
      `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(params.accessToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeAccess}${secureAttr}`,
    ];

    if (params.refreshToken) {
      cookies.push(
        `${REFRESH_TOKEN_COOKIE}=${encodeURIComponent(params.refreshToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeRefresh}${secureAttr}`,
      );
    }

    setResponseHeader("Set-Cookie", cookies);
  } catch {
    // Contexto fora de request HTTP direta
  }
}

export function clearAuthSessionCookies(): void {
  try {
    const cookies: string[] = [
      `${ACCESS_TOKEN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
      `${REFRESH_TOKEN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    ];
    setResponseHeader("Set-Cookie", cookies);
  } catch {
    // Contexto fora de request HTTP direta
  }
}

export function createEmptyAuthContext(meta?: {
  ipAddress?: string | null;
  userAgent?: string | null;
}): AuthContext {
  return {
    userId: null,
    providerSubject: null,
    email: null,
    name: null,
    status: null,
    isAuthenticated: false,
    isActive: false,
    roles: [],
    permissions: [],
    ipAddress: meta?.ipAddress ?? null,
    userAgent: meta?.userAgent ?? null,
  };
}
