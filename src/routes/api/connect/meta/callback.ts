import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encryptSocialToken } from "@/lib/social-connections";

type MetaTokenResponse = { access_token?: string; expires_in?: number };
type MetaPage = {
  id: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id: string };
};

const graphVersion = () => process.env.META_GRAPH_VERSION ?? "v26.0";
const graphUrl = (path: string) => `https://graph.facebook.com/${graphVersion()}${path}`;

async function graphGet<T>(path: string, accessToken: string): Promise<T> {
  const url = new URL(graphUrl(path));
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Meta API request failed (${response.status})`);
  const body = (await response.json()) as T & { error?: { message?: string } };
  if (body.error) throw new Error(body.error.message ?? "Meta API request failed");
  return body;
}

export const Route = createFileRoute("/api/connect/meta/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const oauthError =
          url.searchParams.get("error_description") ?? url.searchParams.get("error");
        if (oauthError)
          return Response.redirect(
            new URL(`/?connection_error=${encodeURIComponent(oauthError)}`, url),
          );
        if (!code || !state) return new Response("Missing OAuth code or state", { status: 400 });

        const { data: pending, error: stateError } = await supabaseAdmin
          .from("oauth_states")
          .select("state, user_id, expires_at, platform")
          .eq("state", state)
          .eq("platform", "meta")
          .maybeSingle();
        if (stateError || !pending || new Date(pending.expires_at).getTime() < Date.now()) {
          return new Response("OAuth state is invalid or expired", { status: 400 });
        }
        await supabaseAdmin.from("oauth_states").delete().eq("state", state);

        const appId = process.env.META_APP_ID;
        const appSecret = process.env.META_APP_SECRET;
        if (!appId || !appSecret)
          return new Response("Meta OAuth is not configured", { status: 500 });
        const redirectUri = new URL("/api/connect/meta/callback", request.url).toString();
        const tokenUrl = new URL(graphUrl("/oauth/access_token"));
        tokenUrl.searchParams.set("client_id", appId);
        tokenUrl.searchParams.set("client_secret", appSecret);
        tokenUrl.searchParams.set("redirect_uri", redirectUri);
        tokenUrl.searchParams.set("code", code);
        const tokenResponse = await fetch(tokenUrl);
        if (!tokenResponse.ok) return new Response("Meta token exchange failed", { status: 502 });
        const token = (await tokenResponse.json()) as MetaTokenResponse;
        if (!token.access_token)
          return new Response("Meta did not return an access token", { status: 502 });

        let pages: MetaPage[];
        try {
          const result = await graphGet<{ data: MetaPage[] }>(
            "/me/accounts?fields=id,name,access_token,instagram_business_account",
            token.access_token,
          );
          pages = result.data ?? [];
        } catch (error) {
          return new Response(
            error instanceof Error ? error.message : "Meta account lookup failed",
            { status: 502 },
          );
        }
        if (!pages.length)
          return Response.redirect(
            new URL("/?connection_error=No%20Facebook%20Pages%20available", url),
          );

        for (const page of pages) {
          if (!page.access_token) continue;
          const pageExpiresAt = new Date(
            Date.now() + (token.expires_in ?? 5_184_000) * 1000,
          ).toISOString();
          await supabaseAdmin.from("social_connections").upsert(
            {
              user_id: pending.user_id,
              platform: "facebook",
              account_id: page.id,
              account_name: page.name ?? "Facebook Page",
              access_token: encryptSocialToken(page.access_token),
              expires_at: pageExpiresAt,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,platform,account_id" },
          );

          if (page.instagram_business_account?.id) {
            await supabaseAdmin.from("social_connections").upsert(
              {
                user_id: pending.user_id,
                platform: "instagram",
                account_id: page.instagram_business_account.id,
                account_name: `${page.name ?? "Instagram"} Instagram`,
                access_token: encryptSocialToken(page.access_token),
                expires_at: pageExpiresAt,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,platform,account_id" },
            );
          }
        }
        return Response.redirect(new URL("/?connected=meta", url));
      },
    },
  },
});
