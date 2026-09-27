import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";

interface Env {
  OAUTH_PROVIDER: OAuthHelpers;
  OAUTH_KV: KVNamespace;
  ADMIN_PASSWORD: string;
  ASSETS: R2Bucket;
}

const app = new Hono<{ Bindings: Env }>();
const ALLOWED_SCOPES = new Set(["matok:meta"]);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function escapeHtml(value: string) {
  return value.replace(/[&<>'\"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '\"': "&quot;"
  })[c] ?? c);
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function sealState(request: AuthRequest, secret: string) {
  const payload = base64UrlEncode(encoder.encode(JSON.stringify(request)));
  const key = await importHmacKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return `${payload}.${base64UrlEncode(signature)}`;
}

async function openState(token: string, secret: string): Promise<AuthRequest> {
  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("Invalid state");
  const [payload, encodedSignature] = parts;
  const key = await importHmacKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecode(encodedSignature),
    encoder.encode(payload)
  );
  if (!valid) throw new Error("Invalid state signature");
  return JSON.parse(decoder.decode(base64UrlDecode(payload))) as AuthRequest;
}

function loginAttemptKey(c: any) {
  const ip = c.req.header("cf-connecting-ip") || "unknown";
  return `matok:login:${ip}`;
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
  if (!c.env.ADMIN_PASSWORD || c.env.ADMIN_PASSWORD.length < 20) {
    return c.text("MATOK admin authentication is not configured", 503);
  }

  let oauthReqInfo: AuthRequest;
  try {
    oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  } catch {
    return c.text("Invalid authorization request", 400);
  }

  const clientInfo = await c.env.OAUTH_PROVIDER.lookupClient(oauthReqInfo.clientId);
  if (!clientInfo) return c.text("Invalid client", 400);

  const state = await sealState(oauthReqInfo, c.env.ADMIN_PASSWORD);
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
  if (!c.env.ADMIN_PASSWORD || c.env.ADMIN_PASSWORD.length < 20) {
    return c.text("MATOK admin authentication is not configured", 503);
  }

  const form = await c.req.formData();
  const state = form.get("state");
  const password = form.get("password");
  if (typeof state !== "string" || typeof password !== "string") return c.text("Missing authorization data", 400);

  const attemptKey = loginAttemptKey(c);
  const attempts = Number(await c.env.OAUTH_KV.get(attemptKey) || "0");
  if (attempts >= 8) return c.text("Too many attempts. Try again later.", 429);

  if (password !== c.env.ADMIN_PASSWORD) {
    await c.env.OAUTH_KV.put(attemptKey, String(attempts + 1), { expirationTtl: 600 });
    return c.text("Unauthorized", 401);
  }
  await c.env.OAUTH_KV.delete(attemptKey);

  let request: AuthRequest;
  try {
    request = await openState(state, c.env.ADMIN_PASSWORD);
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
