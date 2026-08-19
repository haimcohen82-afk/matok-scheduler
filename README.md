# MATOK Scheduler — production architecture

Production is intentionally kept small and modular. Do not reintroduce the old patch-on-patch runtime.

## Entry point

`index.html` loads `Index.html` and then only the final modules below, with a cache-busting version query.

## Final modules

- `matok-core-final-v1.js` — employee login/session, employee home portal, availability submission, published schedule, manager schedule editor, reports and staff summary.
- `matok-payroll-final-v1.js` — payroll/hours admin portal, PDF split-and-store flow, employee private documents, payroll hours and bonuses.
- `matok-ui-final-v1.js` — responsive UI only: round employee menu, compact mobile manager schedule, current-week shortcut, published-week availability cleanup.
- `matok-access-final-v1.js` — login routing and manager login diagnostics/unlock tools.
- `matok-legacy-guard-v1.js` — prevents the legacy functions still embedded in `Index.html` from repainting final screens or starting obsolete schedule polling.
- `matok-whatsapp-final-v1.js` — guided WhatsApp queue after publishing/updating a schedule.

## Data source

Supabase is the source of truth. Do not store business data in localStorage.

Important server-side areas:

- staff and employee credentials
- work weeks / work assignments / availability
- staff reports and manager replies/archive
- payroll hours and bonuses
- private employee documents in the `employee-documents` storage bucket

## Safety rules for future changes

1. Never delete/rebuild a whole published schedule just to add or remove one employee. Use the single-assignment RPC.
2. Never publish an empty schedule.
3. A manager may override employee availability or fixed-day settings; employees cannot.
4. Employee documents remain private and are opened through short-lived signed URLs after employee credential validation.
5. Old availability remains available for history/summary but is hidden from the active manager view once that week is published.
6. Do not restore superseded scripts that were removed from the repository. Git history is the archive.

## Deployment

Netlify publishes the repository root. `netlify.toml` disables caching for the app files. Every production loader change should bump the version string in `index.html`.
