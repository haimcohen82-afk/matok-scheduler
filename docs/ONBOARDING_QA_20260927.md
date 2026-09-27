# MATOK SIDIR — additional onboarding QA | 27 September 2026

Status: **Draft preview — programmatic checks passed; manual authenticated acceptance is still required before production release.**

## Scope completed

- Manager **Employees** tab gains a new, branded recruitment/onboarding hub.
- Manager enters **any international WhatsApp number** (or Israeli 05…) and creates a unique, one-use seven-day web questionnaire link. WhatsApp opens prefilled text; **the manager presses Send**. The link can also be copied.
- The public questionnaire is a standalone `join.html`, not the manager dashboard. It collects contact, role preference, shift preference, Friday availability, preferred start, experience and notes; explicit consent is required. No bank details, government ID or login PIN is requested in the public form.
- Single-use submissions appear automatically in the manager's pending intake list, with all submitted fields accessible. Only explicit **manager approval** creates an active staff login using the existing password-hashing staff RPC.
- Manager can alternatively **link an intake to an existing active or inactive employee** without overwriting the person's existing account, roster, permissions or payroll records.
- Admin can upload PDF, image, DOCX, XLSX/XLS, CSV or TXT employee files (maximum 12 MB). Browser-side text extraction identifies common Hebrew/English labeled fields, and image/scanned-PDF OCR is attempted where supported. An unreadable document is **still stored privately** rather than falsely marked as fully parsed. Very long documents and scanned PDFs may require manual review; PDF OCR currently checks the first three pages when text extraction fails.
- The manager's reviewer visually highlights fields needing verification and opens the **private original only on request**. Full extracted text can be requested separately through a manager-only RPC. Every employee card gains an **All onboarding details** control.
- Manager and candidate interfaces keep the MATOK visual style. Existing draft PR includes global Back controls, private inactive-employee archive uploads, Friday confirmation, verified Save, employee bonus loading and editable sales messages.

## Automated controls executed

| Control | Evidence | Result |
|---|---|---|
| Onboarding database and private bucket created | Supabase migration `sidir_private_employee_onboarding_20260927` | Passed |
| Anonymous permission boundary | Verified via `has_function_privilege`: only form-status and form-submit are anonymously callable; all manager onboarding RPCs require authentication and `public.is_admin()` | Passed |
| Tables and source documents private | Both new tables RLS-enabled with no direct public table grants; original bucket is private with admin-only SELECT/INSERT/DELETE | Passed |
| Form token and explicit consent | Nonpersistent SQL acceptance migration `sidir_onboarding_acceptance_selftest_20260927` created a synthetic invitation, rejected missing consent, accepted one submission and rejected reuse | Passed |
| No test staff or residual applicant data | Read-only post-test database inspection: staff = 9, onboarding invites = 0, onboarding records = 0 | Passed |
| Frontend build, public-page assets and parser tests | `node verify.mjs` includes `tests/onboarding.mjs`, `tests/navigation-inactive.mjs` and existing regressions | Verify PR deploy status before release |
| Private source text access | `sidir_admin_onboarding_fulltext_20260927` migration added manager-only extracted-text RPC; anonymous EXECUTE revoked | Applied |
| Security linter | Supabase advisors queried after additive migration | Reviewed; see notes |

## Security observations

1. New public functions `onboarding_form_status` and `onboarding_submit_form` intentionally use narrowly scoped SECURITY DEFINER with a cryptographically random one-time token. They return **no manager, employee or invitation metadata** to an anonymous caller. Expiration, consent and single-use behavior are enforced server-side.
2. No sensitive source document is uploaded via the anonymous candidate link; original-document uploads are manager-authenticated only. Documents remain in private Storage and source previews receive a 120-second signed URL.
3. Existing unrelated Supabase security-advisor warnings remain (legacy anonymous-executable SECURITY DEFINER functions and search-path warnings). These have not been modified in the onboarding change to avoid destabilizing working roster/payroll flows. They require a separate permission review. Private onboarding tables deliberately have RLS without direct read policies and are only exposed through guarded RPCs.
4. Referrer-Policy: no-referrer, no-store and anti-framing are explicitly configured for the public questionnaire. Only the already published Supabase **publishable** browser key is used.
5. Login credentials are not sent to a candidate or stored with an intake record; the manager chooses the new 4-digit PIN while approving an employee.

## Required manual acceptance (not claimed completed)

1. Sign in as a manager to the **draft deploy preview**. Open **Employees → Onboarding hub**; use a personally controlled test number. Verify that WhatsApp opens the intended recipient/message and a link that expires or rejects repeat use. Do not enter real applicant information for tests.
2. Open the fresh questionnaire in a separate browser. Confirm validation, consent requirement, successful submission and automatic appearance on the manager's pending list. Verify invalid/used tokens never reopen a completed form.
3. With a prepared synthetic PDF, DOCX, image, Excel and TXT file, verify extraction; check uncertain highlighting, full extracted text and **on-demand** original preview. Review how the system handles scanned/unreadable PDF.
4. Verify **link-to-existing** on a known safe test record. Verify *create-new* only after explicit manager approval, duplicate-phone rejection, presence on the staff dashboard and access to the linked source document. Avoid generating test staff in live production unless a cleanup plan is approved.
5. Verify that a normal employee session cannot list any candidate or read a manager-only original/document signed link.
6. Regression test the existing employee and manager roster, PDF/payroll uploads, inactive employee records, Friday confirmation, bonus view, global Back controls and message drafts.
7. Only then authorize merging the draft PR and switching the production site.

## Limits and acceptance gate

The current preview uses the real scheduler Supabase project. **No genuine candidate data or original employee documents have been used for the new feature in these tests.** Programmatic and SQL security checks cannot fully substitute for authenticated browser acceptance or WhatsApp delivery verification. Do not describe the feature as fully production-verified until the seven manual acceptance scenarios pass.
