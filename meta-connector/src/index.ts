import { env as workerEnv } from "cloudflare:workers";
import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler, getMcpAuthContext } from "agents/mcp/server";
import { z } from "zod";
import { AuthHandler } from "./auth-handler";

type Env = {
  OAUTH_KV: KVNamespace;
  DB: D1Database;
  ADMIN_PASSWORD: string;
  META_GRAPH_VERSION: string;
  META_PAGE_ID: string;
  META_IG_USER_ID: string;
  META_PAGE_ACCESS_TOKEN: string;
};

type Channel = "facebook" | "instagram";
type Kind = "text" | "image" | "reel";

type QueueRow = {
  id: string;
  channel: Channel;
  kind: Kind;
  caption: string;
  asset_url: string | null;
  scheduled_at: string;
  status: "scheduled" | "processing" | "published" | "cancelled" | "failed";
  created_at: string;
  updated_at: string;
  published_id: string | null;
  error: string | null;
};

function cfg(): Env {
  return workerEnv as unknown as Env;
}

function jsonText(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function assertOwner() {
  const auth = getMcpAuthContext();
  if (auth?.props?.role !== "owner") throw new Error("MATOK owner authorization required");
}

function assertConfigured(e: Env) {
  const missing = [
    ["META_GRAPH_VERSION", e.META_GRAPH_VERSION],
    ["META_PAGE_ID", e.META_PAGE_ID],
    ["META_IG_USER_ID", e.META_IG_USER_ID],
    ["META_PAGE_ACCESS_TOKEN", e.META_PAGE_ACCESS_TOKEN]
  ].filter(([, v]) => !v || String(v).startsWith("SET_")).map(([k]) => k);
  if (missing.length) throw new Error(`Connector is not fully configured: ${missing.join(", ")}`);
}

function graphBase(e: Env) {
  if (!/^v\d+\.\d+$/.test(e.META_GRAPH_VERSION)) throw new Error("META_GRAPH_VERSION must look like vXX.X");
  return `https://graph.facebook.com/${e.META_GRAPH_VERSION}`;
}

async function graphCall(path: string, params: Record<string, string | undefined>, method = "GET") {
  const e = cfg();
  assertConfigured(e);
  const url = new URL(`${graphBase(e)}/${path.replace(/^\//, "")}`);
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, access_token: e.META_PAGE_ACCESS_TOKEN })) {
    if (v !== undefined) body.set(k, v);
  }
  let response: Response;
  if (method === "GET") {
    for (const [k, v] of body) url.searchParams.set(k, v);
    response = await fetch(url, { method: "GET" });
  } else {
    response = await fetch(url, { method, headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  }
  const data = await response.json().catch(() => ({ error: { message: `Non-JSON response (${response.status})` } }));
  if (!response.ok || (data as any)?.error) {
    const message = (data as any)?.error?.message || `Meta API error ${response.status}`;
    throw new Error(message);
  }
  return data as any;
}

async function verifyConnection() {
  const e = cfg();
  assertConfigured(e);
  const page = await graphCall(e.META_PAGE_ID, { fields: "id,name,instagram_business_account" });
  return {
    ok: true,
    page: { id: page.id, name: page.name },
    instagram_business_account: page.instagram_business_account?.id ?? null,
    configured_ig_user_id: e.META_IG_USER_ID
  };
}

async function publishFacebook(kind: Kind, caption: string, assetUrl?: string | null) {
  const e = cfg();
  if (kind === "text") {
    const out = await graphCall(`${e.META_PAGE_ID}/feed`, { message: caption }, "POST");
    return { channel: "facebook", kind, id: out.id };
  }
  if (kind === "image") {
    if (!assetUrl) throw new Error("asset_url is required for a Facebook image post");
    const out = await graphCall(`${e.META_PAGE_ID}/photos`, { url: assetUrl, caption }, "POST");
    return { channel: "facebook", kind, id: out.post_id ?? out.id };
  }
  throw new Error("Facebook reel publishing is not enabled in v1; use Instagram reel or add the Facebook Reels endpoint after Meta verification.");
}

async function waitForContainer(containerId: string) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const status = await graphCall(containerId, { fields: "status_code,status" });
    if (status.status_code === "FINISHED") return status;
    if (["ERROR", "EXPIRED"].includes(status.status_code)) throw new Error(`Instagram container failed: ${status.status || status.status_code}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("Instagram media is still processing; try publish_instagram_container later.");
}

async function createInstagramContainer(kind: Kind, caption: string, assetUrl?: string | null) {
  const e = cfg();
  if (kind === "text") throw new Error("Instagram does not support text-only feed posts; provide an image or reel.");
  if (!assetUrl) throw new Error("asset_url is required for Instagram publishing");
  const params: Record<string, string> = { caption };
  if (kind === "image") params.image_url = assetUrl;
  if (kind === "reel") { params.video_url = assetUrl; params.media_type = "REELS"; }
  const out = await graphCall(`${e.META_IG_USER_ID}/media`, params, "POST");
  return out.id as string;
}

async function publishInstagram(kind: Kind, caption: string, assetUrl?: string | null) {
  const e = cfg();
  const containerId = await createInstagramContainer(kind, caption, assetUrl);
  if (kind === "reel") await waitForContainer(containerId);
  const out = await graphCall(`${e.META_IG_USER_ID}/media_publish`, { creation_id: containerId }, "POST");
  return { channel: "instagram", kind, container_id: containerId, id: out.id };
}

async function publishRow(row: QueueRow) {
  if (row.channel === "facebook") return publishFacebook(row.kind, row.caption, row.asset_url);
  return publishInstagram(row.kind, row.caption, row.asset_url);
}

async function runDuePosts() {
  const e = cfg();
  const now = new Date().toISOString();
  const due = await e.DB.prepare(
    "SELECT * FROM scheduled_posts WHERE status='scheduled' AND scheduled_at <= ? ORDER BY scheduled_at ASC LIMIT 20"
  ).bind(now).all<QueueRow>();

  for (const row of due.results ?? []) {
    const lock = await e.DB.prepare(
      "UPDATE scheduled_posts SET status='processing',updated_at=? WHERE id=? AND status='scheduled'"
    ).bind(now, row.id).run();
    if (!lock.meta.changes) continue;
    try {
      const result = await publishRow(row);
      await e.DB.prepare(
        "UPDATE scheduled_posts SET status='published',published_id=?,error=NULL,updated_at=? WHERE id=?"
      ).bind(String((result as any).id ?? ""), new Date().toISOString(), row.id).run();
    } catch (error) {
      await e.DB.prepare(
        "UPDATE scheduled_posts SET status='failed',error=?,updated_at=? WHERE id=?"
      ).bind(error instanceof Error ? error.message : String(error), new Date().toISOString(), row.id).run();
    }
  }
}

function createServer() {
  const server = new McpServer({ name: "MATOK Meta Connector", version: "0.1.0" });

  server.registerTool("connection_status", {
    description: "Verify the authenticated MATOK MCP session and Meta Page/Instagram connection without publishing anything.",
    inputSchema: {}
  }, async () => {
    assertOwner();
    const auth = getMcpAuthContext();
    const meta = await verifyConnection();
    return jsonText({ mcp: { role: auth?.props?.role, business: auth?.props?.business }, meta });
  });

  server.registerTool("publish_now", {
    description: "Publish an approved MATOK post immediately to Facebook or Instagram. Requires explicit confirmation.",
    inputSchema: {
      channel: z.enum(["facebook", "instagram"]),
      kind: z.enum(["text", "image", "reel"]),
      caption: z.string().max(6000).default(""),
      asset_url: z.string().url().optional(),
      confirmation: z.literal("PUBLISH")
    }
  }, async ({ channel, kind, caption, asset_url }) => {
    assertOwner();
    const result = channel === "facebook"
      ? await publishFacebook(kind, caption, asset_url)
      : await publishInstagram(kind, caption, asset_url);
    return jsonText(result);
  });

  server.registerTool("schedule_post", {
    description: "Queue an approved MATOK post for automatic publication. Cloudflare Cron checks the queue every minute. Requires explicit confirmation.",
    inputSchema: {
      channel: z.enum(["facebook", "instagram"]),
      kind: z.enum(["text", "image", "reel"]),
      caption: z.string().max(6000).default(""),
      asset_url: z.string().url().optional(),
      scheduled_at: z.string().datetime({ offset: true }),
      confirmation: z.literal("SCHEDULE")
    }
  }, async ({ channel, kind, caption, asset_url, scheduled_at }) => {
    assertOwner();
    if (channel === "instagram" && kind === "text") throw new Error("Instagram scheduling requires image or reel media.");
    if ((kind === "image" || kind === "reel") && !asset_url) throw new Error("asset_url is required for image/reel scheduling.");
    const e = cfg();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await e.DB.prepare(
      "INSERT INTO scheduled_posts (id,channel,kind,caption,asset_url,scheduled_at,status,created_at,updated_at) VALUES (?,?,?,?,?,?,'scheduled',?,?)"
    ).bind(id, channel, kind, caption, asset_url ?? null, new Date(scheduled_at).toISOString(), now, now).run();
    return jsonText({ id, status: "scheduled", scheduled_at: new Date(scheduled_at).toISOString(), channel, kind });
  });

  server.registerTool("list_scheduled_posts", {
    description: "List MATOK scheduled, processing, failed, published or cancelled Meta posts.",
    inputSchema: { status: z.enum(["scheduled", "processing", "published", "cancelled", "failed", "all"]).default("scheduled"), limit: z.number().int().min(1).max(100).default(30) }
  }, async ({ status, limit }) => {
    assertOwner();
    const e = cfg();
    const query = status === "all"
      ? "SELECT * FROM scheduled_posts ORDER BY scheduled_at DESC LIMIT ?"
      : "SELECT * FROM scheduled_posts WHERE status=? ORDER BY scheduled_at ASC LIMIT ?";
    const result = status === "all"
      ? await e.DB.prepare(query).bind(limit).all<QueueRow>()
      : await e.DB.prepare(query).bind(status, limit).all<QueueRow>();
    return jsonText(result.results ?? []);
  });

  server.registerTool("cancel_scheduled_post", {
    description: "Cancel a MATOK post that has not yet been published. Requires explicit confirmation.",
    inputSchema: { id: z.string().uuid(), confirmation: z.literal("CANCEL") }
  }, async ({ id }) => {
    assertOwner();
    const e = cfg();
    const result = await e.DB.prepare(
      "UPDATE scheduled_posts SET status='cancelled',updated_at=? WHERE id=? AND status='scheduled'"
    ).bind(new Date().toISOString(), id).run();
    if (!result.meta.changes) throw new Error("Post not found or no longer cancellable.");
    return jsonText({ id, status: "cancelled" });
  });

  server.registerTool("retry_failed_post", {
    description: "Return a failed MATOK post to the automatic queue after the failure was reviewed. Requires explicit confirmation.",
    inputSchema: { id: z.string().uuid(), confirmation: z.literal("RETRY") }
  }, async ({ id }) => {
    assertOwner();
    const e = cfg();
    const result = await e.DB.prepare(
      "UPDATE scheduled_posts SET status='scheduled',error=NULL,updated_at=? WHERE id=? AND status='failed'"
    ).bind(new Date().toISOString(), id).run();
    if (!result.meta.changes) throw new Error("Failed post not found.");
    return jsonText({ id, status: "scheduled" });
  });

  return server;
}

const mcpHandler = createMcpHandler(createServer);
const oauthProvider = new OAuthProvider({
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/oauth/token",
  clientRegistrationEndpoint: "/oauth/register",
  apiRoute: "/mcp",
  apiHandler: mcpHandler,
  defaultHandler: {
    async fetch(request: Request, env: unknown, ctx: ExecutionContext) {
      return AuthHandler.fetch(request, env as Record<string, unknown>, ctx);
    }
  }
});

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return oauthProvider.fetch(request, env, ctx);
  },
  scheduled(_controller: ScheduledController, _env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runDuePosts());
  }
} satisfies ExportedHandler<Env>;
