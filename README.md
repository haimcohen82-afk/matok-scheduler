# MATOK Scheduler — production architecture

MATOK Scheduler is built as a small set of source modules and deployed as one verified production artifact. The old patch-on-patch runtime must not be reintroduced.

## Production build

`Index.html` is the source shell. Netlify does **not** publish it directly.

`build.mjs` performs the production build:

1. removes static demo panels from the source shell;
2. disables obsolete legacy schedule polling/render calls;
3. bundles the final modules into one `dist/index.html` file;
4. writes `dist/version.json` with the exact build identifier;
5. fails the build if old patch filenames, known demo records, or required capabilities are missing.

Netlify runs `node build.mjs` and publishes only `dist/`.

## Production modules

- `matok-core-final-v1.js` — employee login/session, employee home portal, availability submission, published schedule, manager schedule editor, reports and staff summary.
- `matok-payroll-final-v1.js` — payroll/hours admin portal, PDF split-and-store flow, employee private documents, payroll hours and bonuses.
- `matok-ui-final-v1.js` — responsive UI only: employee action menu, compact mobile manager schedule, current-week shortcut and clean published-week view.
- `matok-access-final-v1.js` — login routing and manager login diagnostics/unlock tools.
- `matok-whatsapp-final-v1.js` — guided WhatsApp queue after publishing/updating a schedule.
- `matok-health-final-v1.js` — manager health check for deployed version, database, current schedule, next week, employee logins and payroll.

All modules are bundled at build time. Production does not load them as a chain of runtime patch scripts.

## Data source

Supabase is the source of truth. Business data must not be stored in localStorage.

Important server-side areas:

- staff and employee credentials;
- work weeks / work assignments / availability;
- staff reports and manager replies/archive;
- payroll hours and bonuses;
- private employee documents in the `employee-documents` storage bucket;
- schedule edit audit log and schedule snapshots.

## Safety rules for future changes

1. Never delete/rebuild a whole published schedule just to add or remove one employee. Use the single-assignment RPC.
2. Never publish an empty schedule.
3. A manager may override employee availability or fixed-day settings; employees cannot.
4. Employee documents remain private and are opened through short-lived signed URLs after employee credential validation.
5. Old availability remains available for history/summary but is hidden from the active manager view once that week is published.
6. Admin RPCs are executable only by authenticated users and still verify `is_admin()` server-side.
7. Employee-session validation must never increment the failed-login counter.
8. Do not restore superseded scripts from Git history.

## Verification

`.github/workflows/verify.yml` checks JavaScript syntax, builds the production artifact and runs `tests/smoke.mjs` on every push to `main`.

The smoke test requires the critical login, scheduling, reporting, payroll, document and health capabilities and fails if old patch dependencies or demo data leak into the production artifact.

## Deployment

`netlify.toml` runs the production build and publishes `dist/`. Cache is disabled for the application and `version.json`, so a deployment can be identified precisely from the manager health check.
