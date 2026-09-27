# MATOK Meta Connector

Remote MCP connector for MATOK BASIC. The first target client is Claude web/mobile; the same MCP endpoint can later be used by other compatible clients.

## MCP tools

- `connection_status` — verifies the authenticated MCP session and the selected Meta Page/Instagram account without publishing.
- `stage_asset_from_url` — copies an approved public HTTPS image/video into private R2 staging and returns a stable Meta-readable Worker URL.
- `delete_staged_asset` — removes a staged asset.
- `publish_now` — publishes an approved Facebook/Instagram post.
- `schedule_post` — queues an approved post for automatic publication.
- `list_scheduled_posts` — reads the queue and results.
- `cancel_scheduled_post` — cancels an unpublished queued post.
- `retry_failed_post` — retries a reviewed failed item.

Write/destructive tools require explicit confirmation literals: `STAGE`, `DELETE_ASSET`, `PUBLISH`, `SCHEDULE`, `CANCEL`, or `RETRY`.

## Security model

- `/mcp` is protected by OAuth 2.1 using `@cloudflare/workers-oauth-provider`.
- Plain PKCE is disabled; S256 is required for public clients.
- OAuth consent grants only the `matok:meta` application scope when requested.
- The MATOK authorization state is HMAC-signed before being sent through the browser form.
- The owner login is rate-limited per IP through KV and requires an `ADMIN_PASSWORD` of at least 20 characters.
- `ADMIN_PASSWORD` and `META_PAGE_ACCESS_TOKEN` are Cloudflare Secrets and are never committed to Git.
- Meta tokens must never be stored in Google Drive, ACTION QUEUE, GitHub, or chat.
- Media is staged in a private R2 bucket. Objects are exposed only through unguessable Worker URLs under `/assets/<uuid>.<ext>` so Meta can fetch them.
- Use an R2 lifecycle rule after deployment to delete old staging objects automatically.

## Cloudflare resources

1. Worker: `matok-meta-connector`
2. KV namespace bound as `OAUTH_KV`
3. D1 database `matok-meta-queue` bound as `DB`
4. Private R2 bucket `matok-social-assets` bound as `ASSETS`
5. Cron trigger every minute
6. Secrets: `ADMIN_PASSWORD`, `META_PAGE_ACCESS_TOKEN`
7. Variables: `META_GRAPH_VERSION`, `META_PAGE_ID`, `META_IG_USER_ID`, `PUBLIC_BASE_URL`

Run `schema.sql` against the production D1 database before using scheduling. Set `PUBLIC_BASE_URL` to the deployed Worker origin, without `/mcp`.

## Meta prerequisites

Use a Meta app connected to the relevant Facebook Page and professional Instagram account. For Instagram API with Facebook Login, Meta's official collection lists `pages_show_list`, `instagram_basic`, `instagram_content_publish`, and `pages_read_engagement` as core permissions for the publishing workflow. Add `instagram_manage_comments` only if comment management is later enabled.

Use the official managed-pages request to identify the correct Page ID, Page access token and linked `instagram_business_account`. Verify that the selected Page token has the content-creation task required for the Page before enabling Facebook publishing.

Do not hard-code a Graph API version from memory; use the current version configured in the Meta app at connection time.

## Media pipeline

Meta fetches Instagram image/video media from the URL supplied to its API, so that URL must be internet-accessible. The production path is:

`Canva/approved asset -> stage_asset_from_url -> private R2 -> Worker /assets URL -> Meta -> publish`

The R2 bucket itself does not need to be public.

## Claude connection

After deployment, add a custom connector in Claude from the web interface:

- Name: `MATOK Meta Connector`
- URL: `https://<worker-origin>/mcp`

Complete the MATOK OAuth screen. Once the remote connector is added on claude.ai, Claude mobile can use that already-configured remote MCP connection on supported plans.

Before operational work, Claude must read these Drive files:

1. `MATOK AI HUB - CLAUDE START HERE`
2. `MATOK AI HUB - MASTER CONTEXT`
3. `MATOK AI HUB - ACTION QUEUE`

## Deployment order

1. Connect the Cloudflare account.
2. Create KV, D1 and R2 resources.
3. Replace Cloudflare IDs/placeholders in `wrangler.jsonc`.
4. Deploy the Worker once to obtain its origin.
5. Set `PUBLIC_BASE_URL` to that origin and redeploy.
6. Set a strong `ADMIN_PASSWORD` Cloudflare Secret.
7. Complete the Meta app connection and set `META_GRAPH_VERSION`, `META_PAGE_ID`, `META_IG_USER_ID`.
8. Store the Page access token only as the `META_PAGE_ACCESS_TOKEN` Cloudflare Secret.
9. Apply `schema.sql` to D1.
10. Configure an R2 lifecycle rule for temporary assets.
11. Add `/mcp` as a custom Claude connector.
12. Run `connection_status`.
13. Test one controlled approved post per channel.
14. Test staging, queue, cancellation and failure handling before enabling live campaign scheduling.

## Current Git safety and QA

Development is isolated on branch `matok-meta-connector`. The existing scheduler application files are not modified. The branch contains the new `meta-connector/` implementation plus a dedicated GitHub Actions typecheck workflow. Node 24 dependency installation and strict TypeScript typecheck must remain green before deployment or merge. Do not merge the branch into `main` until Cloudflare deployment and end-to-end acceptance testing are complete.
