import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";

interface Env {
  OAUTH_PROVIDER: OAuthHelpers;
  ADMIN_PASSWORD: string;
  ASSETS: R2Bucket;
}

const app = new Hono<{ Bindings: Env }>();
const ALLOWED_SCOPES = new Set(["matok:meta"]);

function escapeHtml(value: string) {
  return value.replace(/[&<>'\"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '\"': "&quot;"
  })[c] ?? c);
}

app.get("/assets/:key", async (c) => {
  const key = c.req.param("key");
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp|mp4|mov)$/i.test(key)) {
    return c.text("Not found", 404);
  }
  const object = await c.env.ASSETS.get(key);
  if (!object) return c.text("Not found", 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=86400, immutable");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
});

app.get("/authorize", async (c) => {
  let oauthReqInfo: AuthRequest;
  try {
    oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  } catch {
    return c.text("Invalid authorization request", 400);
  }

  const clientInfo = await c.env.OAUTH_PROVIDER.lookupClient(oauthReqInfo.clientId);
  if (!clientInfo) return c.text("Invalid client", 400);

  const state = btoa(JSON.stringify(oauthReqInfo));
  const clientName = escapeHtml(clientInfo.clientName || "MCP Client");
  const requestedScopes = oauthReqInfo.scope.filter((scope) => ALLOWED_SCOPES.has(scope));
  const scopes = escapeHtml(requestedScopes.join(", ") || "MATOK Meta tools");

  return c.html(`<!doctype html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MATOK AI HUB</title>
<style>body{font-family:Arial,sans-serif;max-width:520px;margin:48px auto;padding:20px;background:#f7f5ef;color:#15233b}.card{background:#fff;border:1px solid #ddd;border-radius:16px;padding:28px;box-shadow:0 8px 30px #0001}input,button{box-sizing:border-box;width:100%;padding:13px;margin-top:12px;border-radius:9px;border:1px solid #bbb;font-size:16px}button{background:#15233b;color:#fff;border:0;font-weight:700;cursor:pointer}.muted{color:#666;font-size:14px}</style></head>
<body><div class="card"><h1>MATOK AI HUB</h1><p><strong>${clientName}</strong> מבקש להתחבר למחבר העסקי של MATOK.</p><p class="muted">הרשאות: ${scopes}</p><form method="POST" action="/authorize"><input type="hidden" name="state" value="${state}"><label>סיסמת מנהל MATOK</label><input type="password" name="password" autocomplete="current-password" required><button type="submit">אישור חיבור</button></form></div></body></html>`);
});

app.post("/authorize", async (c) => {
  const form = await c.req.formData();
  const state = form.get("state");
  const password = form.get("password");
  if (typeof state !== "string" || typeof password !== "string") return c.text("Missing authorization data", 400);
  if (!c.env.ADMIN_PASSWORD || password !== c.env.ADMIN_PASSWORD) return c.text("Unauthorized", 401);

  let request: AuthRequest;
  try {
    request = JSON.parse(atob(state));
  } catch {
    return c.text("Invalid authorization state", 400);
  }

  const client = await c.env.OAUTH_PROVIDER.lookupClient(request.clientId);
  if (!client) return c.text("Invalid client", 400);
  const grantedScopes = request.scope.filter((scope) => ALLOWED_SCOPES.has(scope));

  const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
    request,
    userId: "matok-owner",
    metadata: { label: "MATOK AI HUB", clientName: client.clientName || "Unknown client" },
    scope: grantedScopes,
    props: { role: "owner", business: "MATOK BASIC", userId: "matok-owner" }
  });
  return c.redirect(redirectTo, 302);
});

app.get("/", (c) => c.html(`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>MATOK Meta Connector</title><body style="font-family:Arial;max-width:720px;margin:50px auto;padding:20px"><h1>MATOK Meta Connector</h1><p>המחבר פעיל. נקודת MCP: <code>/mcp</code></p><p>הגישה לכלי MCP מוגנת ב-OAuth. קבצי מדיה זמניים זמינים רק דרך כתובות אקראיות תחת <code>/assets/</code>.</p></body></html>`));

export { app as AuthHandler };
