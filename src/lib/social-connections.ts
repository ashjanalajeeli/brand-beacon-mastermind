import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const socialPlatformSchema = z.literal("linkedin");
const tokenKeyEnv = "SOCIAL_TOKEN_ENCRYPTION_KEY";

function encryptionKey() {
  const raw = process.env[tokenKeyEnv];
  if (!raw) throw new Error(`Missing ${tokenKeyEnv}`);
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error(`${tokenKeyEnv} must be a base64-encoded 32-byte key`);
  return key;
}

export function encryptSocialToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSocialToken(value: string) {
  const [iv, tag, encrypted] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  if (!iv || !tag || !encrypted) throw new Error("Invalid encrypted social token");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export const getSocialConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("social_connections")
      .select("id, platform, account_id, account_name, expires_at, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const startSocialConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ platform: socialPlatformSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    if (!clientId) throw new Error("LinkedIn OAuth is not configured: missing LINKEDIN_CLIENT_ID");
    const request = getRequest();
    if (!request) throw new Error("Unable to determine the application URL");
    const state = randomBytes(32).toString("hex");
    const redirectUri = new URL("/api/connect/linkedin/callback", request.url).toString();
    const { error } = await context.supabase.from("oauth_states").insert({
      state,
      user_id: context.userId,
      platform: data.platform,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (error) throw new Error(error.message);
    const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", "openid profile email w_member_social");
    return { url: authUrl.toString() };
  });
