import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encryptSocialToken } from "@/lib/social-connections";

export const Route = createFileRoute("/api/connect/linkedin/callback")({
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
          .eq("platform", "linkedin")
          .maybeSingle();
        if (stateError || !pending || new Date(pending.expires_at).getTime() < Date.now()) {
          return new Response("OAuth state is invalid or expired", { status: 400 });
        }
        await supabaseAdmin.from("oauth_states").delete().eq("state", state);

        const clientId = process.env.LINKEDIN_CLIENT_ID;
        const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
        if (!clientId || !clientSecret)
          return new Response("LinkedIn OAuth is not configured", { status: 500 });
        const redirectUri = new URL("/api/connect/linkedin/callback", request.url).toString();
        const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
            client_id: clientId,
            client_secret: clientSecret,
          }),
        });
        if (!tokenResponse.ok)
          return new Response("LinkedIn token exchange failed", { status: 502 });
        const token = (await tokenResponse.json()) as {
          access_token?: string;
          expires_in?: number;
        };
        if (!token.access_token)
          return new Response("LinkedIn did not return an access token", { status: 502 });

        const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
          headers: { Authorization: `Bearer ${token.access_token}` },
        });
        if (!profileResponse.ok)
          return new Response("LinkedIn profile lookup failed", { status: 502 });
        const profile = (await profileResponse.json()) as { sub?: string; name?: string };
        if (!profile.sub)
          return new Response("LinkedIn profile did not include an account id", { status: 502 });

        const { error: saveError } = await supabaseAdmin.from("social_connections").upsert(
          {
            user_id: pending.user_id,
            platform: "linkedin",
            account_id: profile.sub,
            account_name: profile.name ?? "LinkedIn member",
            access_token: encryptSocialToken(token.access_token),
            expires_at: new Date(Date.now() + (token.expires_in ?? 5_184_000) * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,platform,account_id" },
        );
        if (saveError) return new Response("Could not save LinkedIn connection", { status: 500 });
        return Response.redirect(new URL("/?connected=linkedin", url));
      },
    },
  },
});
