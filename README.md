# MATOK Scheduler — production architecture

MATOK Scheduler is built as a small set of source modules and deployed as one verified production artifact. The old patch-on-patch runtime must not be reintroduced.

## Production build

`app-shell.html` is a build-time source shell only. Netlify does **not** publish it directly.

`build.mjs` performs the production build:

1. removes the remaining static demo records and legacy preview assignments from the shell;
2. compiles obsolete legacy schedule renderers, polling and unsafe whole-schedule writers down to no-ops;
3. stabilizes employee/admin startup so final initialization runs once per session;
4. bundles the final modules into one `dist/index.html` file;
5. writes `dist/version.json` with the exact build identifier;
6. fails if old patch filenames, known demo records, unsafe legacy schedule deletion, polling, or required capabilities are present/missing incorrectly.

`verify.mjs` is the single verification command for both CI and Netlify. It performs JavaScript syntax checks, runs the production build, and runs the smoke suite. Netlify publishes `dist/` only when verification succeeds.

## Production modules

- `matok-core-final-v1.js` — employee login/session, employee home portal, availability submission, published schedule, manager schedule editor, reports and staff summary.
- `matok-payroll-final-v1.js` — payroll/hours admin portal, PDF split-and-store flow, employee private documents, payroll hours and bonuses.
- `matok-ui-final-v1.js` — responsive UI only: employee action menu, compact mobile manager schedule, current-week shortcut and clean published-week view.
- `matok-access-final-v1.js` — login routing and manager login diagnostics/unlock tools.
- `matok-whatsapp-final-v1.js` — guided WhatsApp queue after publishing/updating a schedule.
- `matok-health-final-v1.js` — manager health check for deployed version, database, current schedule, staffing shortages, next week, employee logins and payroll.
- `matok-realtime-final-v1.js` — authenticated manager Realtime synchronization for assignments and availability. Employee schedule data remains private and refreshes through credential-validated RPCs on opening/focus instead of exposing assignment rows to anonymous clients.
- `matok-admin-tools-final-v1.js` — schedule print/PDF, manager-note save, manual refresh and published-schedule edit history.
- `matok-manager-home-final-v1.js` — clear manager dashboard separating the active published week from next week's availability/planning, with direct buttons to each workflow.

All modules are bundled at build time. Production does not load them as a chain of runtime patch scripts.

## Data source

Supabase is the source of truth. Business data must not be stored in localStorage.

Important server-side areas:

- staff and hashed employee credentials;
- work weeks / work assignments / availability;
- canonical per-week shift settings;
- staff reports and manager replies/archive;
- payroll hours and bonuses;
- private employee documents in the `employee-documents` storage bucket;
- schedule edit audit log and schedule snapshots.

## Schedule defaults

Each new week automatically receives all 11 valid schedule slots and canonical hours. The default required staffing level is 4 employees per shift; the manager can change the required count and hours per shift from the schedule settings.

## Safety rules for future changes

1. Never delete/rebuild a whole published schedule just to add or remove one employee. Use the single-assignment RPC.
2. Never publish an empty schedule.
3. Publishing accepts only approved assignments for active staff and valid schedule slots.
4. A manager may override employee availability or fixed-day settings; employees cannot.
5. Employee documents remain private and are opened through short-lived signed URLs after employee credential validation.
6. Old availability remains available for history/summary but is hidden from the active manager view once that week is published.
7. Admin RPCs are executable only by authenticated users and still verify `is_admin()` server-side.
8. Every employee PIN validation path participates in the failed-attempt/temporary-lock protection; restored sessions are discarded after a failed validation so a stale browser cannot loop indefinitely.
9. Employee availability accepts only known slots and valid statuses.
10. Profile roles cannot be self-promoted; admin role changes are admin-only.
11. Do not restore superseded scripts from Git history.

## Verification

`.github/workflows/verify.yml` runs `node verify.mjs` on every push to `main`.

The smoke test requires critical login, scheduling, secure synchronization, reporting, payroll, documents, printing, edit history, current/next-week navigation and health diagnostics. It also fails if old patch dependencies, known demo data, unsafe legacy schedule writes or obsolete polling leak into the production artifact.

## Deployment

`netlify.toml` runs `node verify.mjs` and publishes `dist/`. Cache is disabled for the application and `version.json`, so a deployment can be identified precisely from the manager health check.
