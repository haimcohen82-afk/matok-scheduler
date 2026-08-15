import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";

interface Env {
  OAUTH_PROVIDER: OAuthHelpers;
  ADMIN_PASSWORD: string;
}

const app = new Hono<{ Bindings: Env }>();

function escapeHtml(value: string) {
  return value.replace(/[&<>'\"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '\"': "&quot;"
  })[c] ?? c);
}

app.get("/authorize", async (c) => {
  const oauthReqInfo: AuthRequest = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  const clientInfo = await c.env.OAUTH_PROVIDER.lookupClient(oauthReqInfo.clientId);
  if (!clientInfo) return c.text("Invalid client_id", 400);

  const state = btoa(JSON.stringify(oauthReqInfo));
  const clientName = escapeHtml(clientInfo.clientName || "MCP Client");
  const scopes = escapeHtml(oauthReqInfo.scope.join(", ") || "MCP tools");

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
  try { request = JSON.parse(atob(state)); }
  catch { return c.text("Invalid authorization state", 400); }

  const client = await c.env.OAUTH_PROVIDER.lookupClient(request.clientId);
  const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
    request,
    userId: "matok-owner",
    metadata: { label: "MATOK AI HUB", clientName: client?.clientName || "Unknown client" },
    scope: request.scope,
    props: { role: "owner", business: "MATOK BASIC" }
  });
  return c.redirect(redirectTo, 302);
});

app.get("/", (c) => c.html(`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>MATOK Meta Connector</title><body style="font-family:Arial;max-width:720px;margin:50px auto;padding:20px"><h1>MATOK Meta Connector</h1><p>המחבר פעיל. נקודת MCP: <code>/mcp</code></p><p>הגישה מוגנת ב-OAuth ובסיסמת מנהל.</p></body></html>`));

export { app as AuthHandler };
