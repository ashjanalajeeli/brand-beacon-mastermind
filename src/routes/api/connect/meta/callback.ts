import { createFileRoute } from "@tanstack/react-router";
import { encryptSocialToken } from "@/lib/social-connections";

type MetaTokenResponse = { access_token?: string; expires_in?: number };
type MetaPage = {
  id: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id: string };
};

const graphVersion = () => process.env["META_GRAPH_VERSION"] ?? "v26.0";
const graphUrl = (path: string) => `https://graph.facebook.com/${graphVersion()}${path}`;

async function graphGet<T>(path: string, accessToken: string): Promise<T> {
  const url = new URL(graphUrl(path));
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Meta API request failed (${response.status})`);
  const body = (await response.json()) as T & { error?: { message?: string } };
  if (body.error) throw new Error("Meta API request failed");
  return body;
}

export const Route = createFileRoute("/api/connect/meta/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { appRedirect, consumeOAuthState, plainError, redirectUri } =
          await import("@/lib/oauth.server");
        const url = new URL(request.url);
        const oauthError =
          url.searchParams.get("error_description") ?? url.searchParams.get("error");
        if (oauthError)
          return appRedirect(
            request,
            "meta",
            `/?connection_error=${encodeURIComponent(oauthError.slice(0, 200))}`,
          );
        const code = url.searchParams.get("code");
        if (!code) return plainError("meta", "Missing OAuth code", 400);

        const pending = await consumeOAuthState(request, "meta");
        if (!pending) return plainError("meta", "OAuth state is invalid or expired", 400);
        const { userId, supabaseAdmin } = pending;

        const appId = process.env["META_APP_ID"];
        const appSecret = process.env["META_APP_SECRET"];
        if (!appId || !appSecret) return plainError("meta", "Meta OAuth is not configured", 500);
        const tokenUrl = new URL(graphUrl("/oauth/access_token"));
        tokenUrl.searchParams.set("client_id", appId);
        tokenUrl.searchParams.set("client_secret", appSecret);
        tokenUrl.searchParams.set("redirect_uri", redirectUri(request, "meta"));
        tokenUrl.searchParams.set("code", code);
        const tokenResponse = await fetch(tokenUrl);
        if (!tokenResponse.ok) return plainError("meta", "Meta token exchange failed", 502);
        const token = (await tokenResponse.json()) as MetaTokenResponse;
        if (!token.access_token)
          return plainError("meta", "Meta did not return an access token", 502);

        let pages: MetaPage[];
        try {
          const result = await graphGet<{ data: MetaPage[] }>(
            "/me/accounts?fields=id,name,access_token,instagram_business_account",
            token.access_token,
          );
          pages = result.data ?? [];
        } catch {
          return plainError("meta", "Meta account lookup failed", 502);
        }
        if (!pages.length)
          return appRedirect(
            request,
            "meta",
            "/?connection_error=No%20Facebook%20Pages%20available",
          );

        const pageExpiresAt = new Date(
          Date.now() + (token.expires_in ?? 5_184_000) * 1000,
        ).toISOString();
        const rows = pages.flatMap((page) => {
          if (!page.access_token) return [];
          const encrypted = encryptSocialToken(page.access_token);
          const base = {
            user_id: userId,
            access_token: encrypted,
            expires_at: pageExpiresAt,
            updated_at: new Date().toISOString(),
          };
          const facebook = {
            ...base,
            platform: "facebook",
            account_id: page.id,
            account_name: page.name ?? "Facebook Page",
          };
          const igId = page.instagram_business_account?.id;
          return igId
            ? [
                facebook,
                {
                  ...base,
                  platform: "instagram",
                  account_id: igId,
                  account_name: `${page.name ?? "Instagram"} Instagram`,
                },
              ]
            : [facebook];
        });
        if (!rows.length)
          return appRedirect(request, "meta", "/?connection_error=No%20Page%20access%20granted");

        const { error: saveError } = await supabaseAdmin
          .from("social_connections")
          .upsert(rows, { onConflict: "user_id,platform,account_id" });
        if (saveError) return plainError("meta", "Could not save Meta connection", 500);
        return appRedirect(request, "meta", "/?connected=meta");
      },
    },
  },
});
