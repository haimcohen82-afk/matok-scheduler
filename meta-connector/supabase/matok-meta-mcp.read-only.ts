import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@^2.0.0";
import { pipeline } from "npm:@supabase/middleware@^0.5.0";
import { withOAuthProtectedResource, withSupabase } from "npm:@supabase/server@^1.6.0";
import { z } from "npm:zod@^4.3.6";

// Fail-closed MATOK MCP bridge. No publish, approve, schedule or destructive tool is exposed.
// Existing MATOK backend is accessed server-side only; secrets are never returned to Claude.
const allowedOwner = () => (Deno.env.get("MATOK_OWNER_USER_ID") || "").trim();
const backendBase = () => {
  const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  if (!base.startsWith("https://")) throw new Error("Server configuration incomplete");
  return base + "/functions/v1/matok-meta-backend";
};
async function invokeBackend(path: string, query = "") {
  const key = Deno.env.get("MATOK_API_KEY");
  if (!key) return { connected: false, blocker: "MATOK_API_KEY secret not configured" };
  const response = await fetch(backendBase() + path + query, {
    headers: { "x-matok-key": key, "cache-control": "no-store" }
  });
  if (!response.ok) return { connected: false, http_status: response.status, blocker: "MATOK backend authorization or configuration" };
  const result = await response.json();
  if (path === "/status") {
    const meta = result?.meta || {};
    return {
      connected: !!(result?.ok && meta.configured),
      meta: {
        configured: !!meta.configured,
        page: meta.page ? { id: meta.page.id, name: meta.page.name } : null,
        instagram_business_account: meta.page?.instagram_business_account?.id || null,
        configured_ig_user_id: meta.configured_ig_user_id || null
      }
    };
  }
  if (path === "/queue") {
    const posts = Array.isArray(result?.posts) ? result.posts : [];
    return { count: posts.length, posts: posts.map((p: Record<string, unknown>) => ({
      id: p.id, channel: p.channel, kind: p.kind, status: p.status,
      scheduled_at: p.scheduled_at, approved_at: p.approved_at,
      published_at: p.published_at, external_id: p.external_id
    })) };
  }
  return { connected: !!result?.ok };
}
Deno.serve(
  pipeline(
    [withOAuthProtectedResource(), withSupabase({ auth: "user" })],
    async (req, { supabase }) => {
      const owner = allowedOwner();
      const { data, error } = await supabase.auth.getUser();
      if (!owner || error || data.user?.id !== owner) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
        });
      }
      const handler = createMcpHandler(() => {
        const server = new McpServer({ name: "MATOK Meta Connector", version: "0.1.0" });
        server.registerTool(
          "connection_status",
          { description: "Read-only status of the existing MATOK Meta backend. Does not publish.", inputSchema: z.object({}), annotations: { readOnlyHint: true } },
          async () => ({ content: [{ type: "text", text: JSON.stringify(await invokeBackend("/status")) }] })
        );
        server.registerTool(
          "list_scheduled_posts",
          { description: "Read the MATOK publication queue statuses without credentials or publish access.", inputSchema: z.object({ limit: z.number().int().min(1).max(50).default(20) }), annotations: { readOnlyHint: true } },
          async ({ limit }) => ({ content: [{ type: "text", text: JSON.stringify(await invokeBackend("/queue", "?limit=" + limit)) }] })
        );
        return server;
      });
      return handler.fetch(req);
    }
  )
);
