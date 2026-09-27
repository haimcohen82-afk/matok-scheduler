import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { McpServer } from "npm:@modelcontextprotocol/sdk@1.25.3/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "npm:@modelcontextprotocol/sdk@1.25.3/server/webStandardStreamableHttp.js";
import { z } from "npm:zod@^4.1.13";

// MATOK read-only MCP bridge v2. Uses documented MCP SDK imports and Supabase OAuth JWT validation.
// CRITICAL: No publishing, draft approval, schedule, secret disclosure, or access to invoice data.
const projectUrl = Deno.env.get("SUPABASE_URL") ?? "";
const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const ownerUid = Deno.env.get("MATOK_OWNER_USER_ID") ?? "";
const backendKey = Deno.env.get("MATOK_API_KEY") ?? "";
const authIssuer = projectUrl + "/auth/v1";
const security = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
};
const reply = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...security, "content-type": "application/json", ...headers } });

async function safeBackend(resource: "status" | "queue", limit = 20) {
  if (!backendKey || !projectUrl) return { connected: false, reason: "Backend configuration incomplete" };
  const url = projectUrl + "/functions/v1/matok-meta-backend/" +
    resource + (resource === "queue" ? "?limit=" + limit : "");
  try {
    const res = await fetch(url, { headers: { "x-matok-key": backendKey } });
    if (!res.ok) return { connected: false, status: res.status };
    const data = await res.json();
    if (resource === "status") {
      const meta = data.meta ?? {};
      return { connected: !!meta.configured,
        page: meta.page ? { id: meta.page.id, name: meta.page.name } : null,
        linked_ig_id: meta.page?.instagram_business_account?.id ?? null,
        configured_ig_id: meta.configured_ig_user_id ?? null };
    }
    const posts = Array.isArray(data.posts) ? data.posts : [];
    return { count: posts.length, posts: posts.map((p: Record<string, unknown>) => ({
      id: p.id, channel: p.channel, kind: p.kind, status: p.status,
      scheduled_at: p.scheduled_at, published_at: p.published_at,
      approved: !!p.approved_at
    })) };
  } catch (_) {
    return { connected: false, reason: "Backend unavailable" };
  }
}
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const resourceUrl = url.origin + url.pathname.replace(/\/+$/, "");
  if (url.pathname.endsWith("/.well-known/oauth-protected-resource")) {
    const original = resourceUrl.slice(0, -"/.well-known/oauth-protected-resource".length);
    return reply({ resource: original, authorization_servers: [authIssuer], bearer_methods_supported: ["header"] }, 200);
  }
  const challengeUrl = resourceUrl + "/.well-known/oauth-protected-resource";
  const challenge = { "WWW-Authenticate": 'Bearer resource_metadata="' + challengeUrl + '"' };
  if (!projectUrl || !publicKey || !ownerUid) return reply({ error: "MCP owner authentication not configured" }, 503);
  const match = /^Bearer (.+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!match) return reply({ error: "Authentication required" }, 401, challenge);
  try {
    const supabase = createClient(projectUrl, publicKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await supabase.auth.getUser(match[1]);
    if (error || !data.user) return reply({ error: "Invalid authentication" }, 401, challenge);
    if (data.user.id !== ownerUid) return reply({ error: "Forbidden" }, 403);
    const server = new McpServer({ name: "MATOK Meta Read-Only", version: "0.2.0" });
    server.registerTool("connection_status", {
      title: "Read-only Meta connection status",
      description: "Returns only verified page/Instagram ID and nonsecret status. Does not publish.",
      inputSchema: {},
      annotations: { readOnlyHint: true }
    }, async () => ({ content: [{ type: "text", text: JSON.stringify(await safeBackend("status")) }] }));
    server.registerTool("list_scheduled_posts", {
      title: "Read-only MATOK post statuses",
      description: "Lists metadata only without captions or secret tokens.",
      inputSchema: { limit: z.number().int().min(1).max(30).optional() },
      annotations: { readOnlyHint: true }
    }, async ({ limit }) => ({ content: [{ type: "text", text: JSON.stringify(await safeBackend("queue", limit ?? 20)) }] }));
    const transport = new WebStandardStreamableHTTPServerTransport();
    await server.connect(transport);
    return await transport.handleRequest(req);
  } catch (_) {
    return reply({ error: "Read-only MCP handler unavailable" }, 503);
  }
});