import { createFileRoute } from "@tanstack/react-router";
import { encryptSocialToken } from "@/lib/social-connections";

export const Route = createFileRoute("/api/connect/linkedin/callback")({
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
            "linkedin",
            `/?connection_error=${encodeURIComponent(oauthError.slice(0, 200))}`,
          );
        const code = url.searchParams.get("code");
        if (!code) return plainError("linkedin", "Missing OAuth code", 400);

        const pending = await consumeOAuthState(request, "linkedin");
        if (!pending) return plainError("linkedin", "OAuth state is invalid or expired", 400);
        const { userId, supabaseAdmin } = pending;

        const clientId = process.env["LINKEDIN_CLIENT_ID"];
        const clientSecret = process.env["LINKEDIN_CLIENT_SECRET"];
        if (!clientId || !clientSecret)
          return plainError("linkedin", "LinkedIn OAuth is not configured", 500);
        const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri(request, "linkedin"),
            client_id: clientId,
            client_secret: clientSecret,
          }),
        });
        if (!tokenResponse.ok) return plainError("linkedin", "LinkedIn token exchange failed", 502);
        const token = (await tokenResponse.json()) as {
          access_token?: string;
          expires_in?: number;
        };
        if (!token.access_token)
          return plainError("linkedin", "LinkedIn did not return an access token", 502);

        const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
          headers: { Authorization: `Bearer ${token.access_token}` },
        });
        if (!profileResponse.ok)
          return plainError("linkedin", "LinkedIn profile lookup failed", 502);
        const profile = (await profileResponse.json()) as { sub?: string; name?: string };
        if (!profile.sub)
          return plainError("linkedin", "LinkedIn profile did not include an account id", 502);

        const { error: saveError } = await supabaseAdmin.from("social_connections").upsert(
          {
            user_id: userId,
            platform: "linkedin",
            account_id: profile.sub,
            account_name: profile.name ?? "LinkedIn member",
            access_token: encryptSocialToken(token.access_token),
            expires_at: new Date(Date.now() + (token.expires_in ?? 5_184_000) * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,platform,account_id" },
        );
        if (saveError) return plainError("linkedin", "Could not save LinkedIn connection", 500);
        return appRedirect(request, "linkedin", "/?connected=linkedin");
      },
    },
  },
});
