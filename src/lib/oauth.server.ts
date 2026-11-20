// Server-only helpers for the social OAuth flows. Never import from client code.
import { createHash, timingSafeEqual } from "node:crypto";

export type OAuthPlatform = "linkedin" | "meta";

export const oauthStateCookie = (platform: OAuthPlatform) => `oauth_state_${platform}`;

export const callbackPath = (platform: OAuthPlatform) =>
  platform === "linkedin" ? "/api/connect/linkedin/callback" : "/api/connect/meta/callback";

// Use a fixed public origin when configured so a spoofed Host header cannot
// change the redirect URI sent to the OAuth provider.
export function appOrigin(request: Request) {
  const configured = process.env["APP_URL"];
  return configured ? new URL(configured).origin : new URL(request.url).origin;
}

export const redirectUri = (request: Request, platform: OAuthPlatform) =>
  new URL(callbackPath(platform), appOrigin(request)).toString();

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

function sameSecret(a: string, b: string) {
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(a), digest(b));
}

const clearCookieHeader = (platform: OAuthPlatform) =>
  `${oauthStateCookie(platform)}=; Path=/api/connect; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

// Redirect within the app and always clear the one-time state cookie.
export function appRedirect(request: Request, platform: OAuthPlatform, pathAndQuery: string) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: new URL(pathAndQuery, appOrigin(request)).toString(),
      "Set-Cookie": clearCookieHeader(platform),
    },
  });
}

export function plainError(platform: OAuthPlatform, message: string, status: number) {
  return new Response(message, {
    status,
    headers: { "Set-Cookie": clearCookieHeader(platform), "content-type": "text/plain" },
  });
}

/**
 * Validates the OAuth callback state. The state must exist in the database,
 * be unexpired, belong to this platform AND match the HttpOnly cookie set in
 * the browser that started the flow. The cookie check stops an attacker from
 * sending their own authorization link to a victim and capturing the victim's
 * social account on the attacker's user.
 */
export async function consumeOAuthState(request: Request, platform: OAuthPlatform) {
  const state = new URL(request.url).searchParams.get("state");
  const cookieState = readCookie(request, oauthStateCookie(platform));
  if (!state || !cookieState || !sameSecret(state, cookieState)) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: pending, error } = await supabaseAdmin
    .from("oauth_states")
    .delete()
    .eq("state", state)
    .eq("platform", platform)
    .select("user_id, expires_at")
    .maybeSingle();
  if (error || !pending || new Date(pending.expires_at).getTime() < Date.now()) return null;
  return { userId: pending.user_id, supabaseAdmin };
}
