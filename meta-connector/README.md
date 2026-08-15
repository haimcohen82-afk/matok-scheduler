# MATOK Meta Connector

Remote MCP connector for MATOK BASIC. It is designed for Claude web/mobile first, and can later be used by any MCP client that supports OAuth + Streamable HTTP.

## Tools

- `connection_status` — verifies Meta without publishing.
- `publish_now` — Facebook text/image and Instagram image/reel publishing.
- `schedule_post` — queues a Facebook/Instagram post for automatic publication.
- `list_scheduled_posts` — reads the publication queue.
- `cancel_scheduled_post` — cancels a queued post.
- `retry_failed_post` — retries a reviewed failure.

Write tools require MCP authorization plus an explicit confirmation literal (`PUBLISH`, `SCHEDULE`, `CANCEL`, `RETRY`).

## Security

- OAuth 2.1 protects the MCP endpoint using Cloudflare Workers OAuth Provider.
- Authorization requires the MATOK admin password stored as a Cloudflare secret.
- The Meta Page access token is stored only as a Cloudflare secret and is never committed to Git.
- `.dev.vars` and `.env*` are ignored by Git.

## Cloudflare resources

1. Worker: `matok-meta-connector`
2. KV namespace bound as `OAUTH_KV`
3. D1 database `matok-meta-queue` bound as `DB`
4. Cron trigger every minute
5. Secrets: `ADMIN_PASSWORD`, `META_PAGE_ACCESS_TOKEN`
6. Variables: `META_GRAPH_VERSION`, `META_PAGE_ID`, `META_IG_USER_ID`

Run `schema.sql` against the production D1 database before using scheduling.

## Meta prerequisites

Use a Meta Business app and connect the relevant Facebook Page and Instagram professional account. With Instagram API + Facebook Login, the official Meta collection lists permissions including `pages_show_list`, `instagram_basic`, `instagram_content_publish`, and `pages_read_engagement`. Facebook Page publishing also requires the Page/app to have the relevant content-management permission and task access.

The Instagram account must be professional. This connector v0.1 supports Instagram images and reels, not Stories.

## Claude connection

After deployment, add a custom connector in Claude from the web interface:

- Name: `MATOK Meta Connector`
- URL: `https://<worker>.<subdomain>.workers.dev/mcp`

Complete OAuth using the MATOK admin password. Once the remote connector is added on claude.ai, it can be used from Claude mobile on supported paid plans.

## Deployment order

1. Replace Cloudflare placeholder IDs in `wrangler.jsonc`.
2. Set the current `META_GRAPH_VERSION` shown in the Meta app dashboard.
3. Set `META_PAGE_ID` and `META_IG_USER_ID`.
4. Add Cloudflare secrets `ADMIN_PASSWORD` and `META_PAGE_ACCESS_TOKEN`.
5. Apply `schema.sql` to D1.
6. Deploy the Worker.
7. Add `/mcp` as a custom Claude connector.
8. Run `connection_status`.
9. Test one controlled approved post before scheduling live campaigns.
