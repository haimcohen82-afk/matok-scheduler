# MATOK SIDIR — Architecture v2

## Goal

Turn SIDIR from a working standalone scheduling/employee app into a stable module of a larger MATOK platform without forcing a rewrite later.

The v2 architecture is incremental. Existing production behavior stays intact while new boundaries are introduced around it.

## Product profiles

The runtime now has an explicit product profile. The current profile is:

- product: `matok-sidir`
- suite: `matok-suite`
- edition: `internal`
- distribution: `internal`
- security profile: `internal-standard`
- branding profile: `matok-basic`
- integration profile: `standalone`
- tenant mode: `single-tenant`

These are product settings, not secrets. They exist so a later build can become:

- part of MATOK Suite;
- hardened for stronger security/compliance;
- multi-tenant SaaS;
- white-label for another business;
- self-hosted or centrally hosted;
- connected through a supported integration API.

## Runtime platform layer

`matok-platform-final-v1.js` is loaded before business modules and exposes one immutable API:

`window.MATOK_PLATFORM`

It provides:

1. module registry;
2. capability registry;
3. lightweight event bus;
4. adapter registry;
5. immutable product/runtime profile.

Business modules should gradually register themselves and publish only explicit capabilities.

## Target module boundaries

### Platform
Configuration, module registry, events, adapters, build metadata.

### Identity & access
Manager authentication, employee authentication, sessions, lockouts, roles and future SSO/MFA hooks.

### Workforce
Employee core record, private employee profile, active/inactive status and onboarding.

### Scheduling
Weeks, slots, availability, assignments, publishing, Friday rules and schedule history.

### Payroll & documents
Payroll profile, attendance/hour imports, bonus data, employee documents and private source files.

### Messaging
WhatsApp handoff, manager messages, reminders and future approved messaging-provider adapters.

### Reporting
Manager dashboard, operational health, audit views and exports.

### Integration
Future API/events for MATOK Suite, POS, payroll/accounting and external business systems.

## Dependency rule

UI may call a domain service.
A domain service may call an adapter.
An adapter may call Supabase or an external provider.

New code should avoid:

`UI -> raw Supabase calls scattered everywhere`

Target:

`UI -> domain service -> data adapter -> Supabase`

This allows replacing Supabase, adding an API gateway, introducing audit controls, or embedding SIDIR inside a larger platform without rewriting every screen.

## Security evolution

Security is treated as a selectable product profile.

Current: `internal-standard`.

Future profile `hardened-business` should add:

- server-owned sessions instead of employee PIN material retained in browser state;
- stronger manager authentication;
- MFA/SSO support;
- least-privilege API scopes;
- tenant isolation;
- centralized audit log;
- secret rotation;
- rate limiting;
- file malware/content checks;
- retention policy enforcement;
- export/delete workflows.

## Commercialization / white-label readiness

No commercial white-label behavior is enabled today. Architecture keeps room for:

- tenant-specific name/logo/domain;
- per-tenant colors and wording;
- feature packages;
- per-business roles and policies;
- tenant-specific WhatsApp/provider adapters;
- subscription/entitlement checks;
- separate data isolation;
- support/admin console;
- usage metering.

Branding must remain configuration, not duplicated source forks.

## Migration rule

Do not perform a large rewrite.

Every migration step must:

1. preserve current behavior;
2. add an automated regression;
3. move one clear responsibility behind a stable interface;
4. leave the old path in place only until the new path is verified;
5. remove the old path after verification.

That keeps the system usable while reducing technical debt.
