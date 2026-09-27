import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: jsonHeaders });

function env(name: string) { return Deno.env.get(name) ?? ""; }
function configured(name: string) { const v = env(name); return Boolean(v && !v.startsWith("SET_")); }

function authorized(req: Request) {
  const expected = env("MATOK_API_KEY");
  if (!expected) return false;
  const got = req.headers.get("x-matok-key") ?? "";
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function db() {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase service environment is unavailable");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function graph(path: string, params: Record<string,string|undefined>, method = "GET") {
  const version = env("META_GRAPH_VERSION") || "v24.0";
  const token = env("META_PAGE_ACCESS_TOKEN");
  if (!token) throw new Error("META_PAGE_ACCESS_TOKEN is not configured");
  const url = new URL(`https://graph.facebook.com/${version}/${path.replace(/^\//, "")}`);
  const body = new URLSearchParams();
  for (const [k,v] of Object.entries({ ...params, access_token: token })) if (v !== undefined) body.set(k,v);
  let res: Response;
  if (method === "GET") {
    for (const [k,v] of body.entries()) url.searchParams.set(k,v);
    res = await fetch(url);
  } else {
    res = await fetch(url, { method, headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  }
  const out = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
  if (!res.ok || out?.error) throw new Error(out?.error?.message || `Meta HTTP ${res.status}`);
  return out;
}

async function metaStatus() {
  const pageId = env("META_PAGE_ID");
  if (!pageId || !configured("META_PAGE_ACCESS_TOKEN")) return { configured: false };
  const page = await graph(pageId, { fields: "id,name,instagram_business_account" });
  return { configured: true, page, configured_ig_user_id: env("META_IG_USER_ID") || null };
}

async function publish(channel: "facebook"|"instagram", kind: "text"|"image"|"reel", caption: string, assetUrl?: string) {
  const pageId = env("META_PAGE_ID");
  const igId = env("META_IG_USER_ID");
  if (!pageId) throw new Error("META_PAGE_ID is not configured");
  if (channel === "facebook") {
    if (kind === "text") return await graph(`${pageId}/feed`, { message: caption }, "POST");
    if (kind === "image") {
      if (!assetUrl) throw new Error("asset_url is required");
      return await graph(`${pageId}/photos`, { url: assetUrl, caption }, "POST");
    }
    throw new Error("Facebook Reel publishing is not enabled in this backend yet");
  }
  if (!igId) throw new Error("META_IG_USER_ID is not configured");
  if (kind === "text") throw new Error("Instagram requires image or reel media");
  if (!assetUrl) throw new Error("asset_url is required");
  const createParams: Record<string,string> = { caption };
  if (kind === "image") createParams.image_url = assetUrl;
  else { createParams.video_url = assetUrl; createParams.media_type = "REELS"; }
  const container = await graph(`${igId}/media`, createParams, "POST");
  if (kind === "reel") {
    for (let i=0;i<12;i++) {
      const s = await graph(container.id, { fields: "status_code,status" });
      if (s.status_code === "FINISHED") break;
      if (["ERROR","EXPIRED"].includes(s.status_code)) throw new Error(`Instagram container failed: ${s.status || s.status_code}`);
      if (i === 11) throw new Error("Instagram media is still processing");
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  return await graph(`${igId}/media_publish`, { creation_id: container.id }, "POST");
}

async function audit(action: string, actor: string, postId: string|null, details: unknown) {
  await db().from("matok_meta_audit_log").insert({ action, actor, post_id: postId, details });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return reply({ ok: true, service: "MATOK Meta Backend", meta_configured: configured("META_PAGE_ACCESS_TOKEN") && configured("META_PAGE_ID"), api_key_configured: configured("MATOK_API_KEY") });
  }

  if (!authorized(req)) return reply({ error: "Unauthorized or MATOK_API_KEY not configured" }, 401);

  try {
    if (req.method === "GET" && url.pathname.endsWith("/status")) {
      const meta = await metaStatus();
      return reply({ ok: true, meta });
    }

    if (req.method === "GET" && url.pathname.endsWith("/queue")) {
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 100);
      const status = url.searchParams.get("status");
      let q = db().from("matok_meta_posts").select("*").order("created_at", { ascending: false }).limit(limit);
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return reply({ posts: data });
    }

    if (req.method === "POST" && url.pathname.endsWith("/queue")) {
      const body = await req.json();
      const channel = body.channel;
      const kind = body.kind;
      if (!["facebook","instagram"].includes(channel)) throw new Error("Invalid channel");
      if (!["text","image","reel"].includes(kind)) throw new Error("Invalid kind");
      const row = {
        channel, kind,
        caption: String(body.caption || "").slice(0,6000),
        asset_url: body.asset_url || null,
        scheduled_at: body.scheduled_at || null,
        status: body.scheduled_at ? "scheduled" : "ready",
        source: String(body.source || "chatgpt").slice(0,50),
        approved_at: body.approved === true ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await db().from("matok_meta_posts").insert(row).select().single();
      if (error) throw error;
      await audit("queue_create", row.source, data.id, { channel, kind, scheduled_at: row.scheduled_at });
      return reply(data, 201);
    }

    if (req.method === "POST" && url.pathname.endsWith("/publish")) {
      const body = await req.json();
      if (body.confirmation !== "PUBLISH") return reply({ error: "Explicit confirmation required" }, 400);
      const id = String(body.id || "");
      const { data: post, error } = await db().from("matok_meta_posts").select("*").eq("id", id).single();
      if (error || !post) throw new Error("Post not found");
      if (!["ready","scheduled","failed"].includes(post.status)) throw new Error(`Post status ${post.status} is not publishable`);
      await db().from("matok_meta_posts").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", id);
      try {
        const result = await publish(post.channel, post.kind, post.caption, post.asset_url || undefined);
        await db().from("matok_meta_posts").update({ status: "published", external_id: result.id || result.post_id || null, error: null, published_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
        await audit("publish_success", String(body.actor || "mcp"), id, result);
        return reply({ ok: true, result });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await db().from("matok_meta_posts").update({ status: "failed", error: message, updated_at: new Date().toISOString() }).eq("id", id);
        await audit("publish_failed", String(body.actor || "mcp"), id, { error: message });
        throw e;
      }
    }

    return reply({ error: "Not found" }, 404);
  } catch (e) {
    return reply({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
