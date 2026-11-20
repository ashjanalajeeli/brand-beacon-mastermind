import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { appRedirect, consumeOAuthState, redirectUri } from "./oauth.server";

const callback = (query: string, cookie?: string) =>
  new Request(`https://app.example/api/connect/linkedin/callback?${query}`, {
    headers: cookie ? { cookie } : {},
  });

describe("OAuth state binding", () => {
  afterEach(() => {
    delete process.env["APP_URL"];
  });

  it("rejects a callback from a browser that did not start the flow", async () => {
    assert.equal(await consumeOAuthState(callback("code=x&state=attacker"), "linkedin"), null);
  });

  it("rejects a callback whose cookie does not match the state", async () => {
    const request = callback("code=x&state=attacker", "oauth_state_linkedin=victim");
    assert.equal(await consumeOAuthState(request, "linkedin"), null);
  });

  it("does not accept another platform's cookie", async () => {
    const request = callback("code=x&state=s1", "oauth_state_meta=s1");
    assert.equal(await consumeOAuthState(request, "linkedin"), null);
  });

  it("builds the redirect URI from APP_URL instead of the Host header", () => {
    process.env["APP_URL"] = "https://brand.example";
    const spoofed = new Request("https://evil.example/whatever");
    assert.equal(redirectUri(spoofed, "meta"), "https://brand.example/api/connect/meta/callback");
  });

  it("clears the one-time state cookie on redirect", () => {
    const response = appRedirect(callback(""), "linkedin", "/?connected=linkedin");
    assert.equal(response.status, 302);
    assert.match(response.headers.get("set-cookie") ?? "", /oauth_state_linkedin=; .*Max-Age=0/);
  });
});
