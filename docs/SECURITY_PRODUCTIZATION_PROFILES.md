# SIDIR — Security and productization profiles

## Internal profile — current

Designed for MATOK's own controlled use.

- single tenant;
- Supabase backend;
- manager-admin guarded RPCs;
- private employee documents;
- employee PIN flow;
- internal brand;
- draft-preview release gate.

This profile is not a statement that the product is enterprise-security certified.

## Hardened business profile — future

Required before offering SIDIR broadly to external businesses.

### Identity
- server-issued employee sessions;
- no reusable PIN stored in browser session payload;
- MFA-ready manager authentication;
- optional SSO;
- forced credential rotation/recovery policies.

### Authorization
- explicit permissions/scopes;
- tenant boundaries at database and API level;
- least-privilege service accounts;
- audited admin elevation.

### Data
- classification for identity, payroll, bank and document data;
- encryption/key-management review;
- retention/deletion rules;
- export and subject-access workflows;
- malware/content checking for uploads.

### Operations
- security audit log;
- rate limiting;
- anomaly/lockout monitoring;
- deployment approvals;
- environment separation;
- backup/restore testing.

## Distribution profiles

### internal
Current MATOK-only use.

### pilot-business
A controlled external business with dedicated tenant and support.

### business-saas
Multi-tenant commercial cloud product.

### white-label
Same product engine with tenant-controlled branding/configuration.

### self-hosted
Possible future enterprise distribution. Not currently implemented.

## Architecture rule

Security and branding profiles change configuration, adapters and entitlements.
They must not create separate code forks per customer.
