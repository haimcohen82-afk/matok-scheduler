# SIDIR — Backend dependency inventory

Purpose: make direct backend dependencies explicit so they can be moved behind domain services/adapters without guessing.

## Core scheduling / employee portal

File: `matok-core-final-v1.js`

RPCs:
- admin_archive_staff_report
- admin_get_schedule_slot_settings
- admin_get_staff_reports_v2
- admin_get_week_availability
- admin_get_week_staff_summary_v2
- admin_mark_staff_report_viewed
- admin_publish_schedule_v2
- admin_reply_staff_report
- admin_save_schedule_slot_setting
- employee_get_availability
- employee_get_current_schedule_v2
- employee_get_portal_context
- employee_get_reports_v2
- employee_login
- employee_save_availability
- employee_submit_report
- employee_validate_session

Direct tables:
- staff
- work_assignments
- work_weeks

Target services:
- identityService
- scheduleService
- availabilityService
- staffReportService

## Payroll / attendance / employee documents

File: `matok-payroll-final-v1.js`

RPCs:
- admin_list_employee_documents_v2
- admin_list_payroll_hours
- admin_list_payroll_hours_v2
- admin_list_payroll_profiles_v2
- admin_mark_employee_document
- admin_payroll_dashboard
- admin_register_employee_document
- admin_save_payroll_profile
- admin_upsert_payroll_hours
- admin_upsert_payroll_hours_v2
- employee_list_documents
- employee_list_payroll_hours
- employee_list_payroll_hours_v2

Direct tables:
- staff

Storage:
- employee-documents

Target services:
- payrollService
- attendanceService
- employeeDocumentService

## Notifications / manager messages

File: `matok-notifications-final-v1.js`

RPCs:
- admin_archive_manager_message
- admin_get_manager_message_replies
- admin_get_portal_access_controls
- admin_list_manager_messages
- admin_send_manager_message
- employee_get_schedule_notice
- employee_list_manager_messages
- employee_mark_manager_message_read
- employee_mark_schedule_viewed
- employee_reply_manager_message

Target services:
- messagingService
- notificationService

## Identity / access

File: `matok-access-final-v1.js`

RPCs:
- admin_clear_staff_login_lock
- admin_employee_usage_details
- admin_employee_usage_summary
- admin_get_portal_access_controls
- admin_get_staff_login_status
- admin_issue_staff_credentials_v2
- admin_set_global_portal_access
- admin_set_staff_portal_access
- employee_get_portal_access
- employee_portal_heartbeat
- employee_start_portal_session
- employee_validate_session

Target services:
- identityService
- accessPolicyService
- usageService

## Operational health

File: `matok-health-final-v1.js`

RPCs:
- admin_get_schedule_slot_settings
- admin_get_staff_login_status
- admin_payroll_dashboard

Direct tables:
- staff
- work_assignments
- work_weeks

Target service:
- healthService

## Admin tools

File: `matok-admin-tools-final-v1.js`

RPCs:
- admin_get_schedule_slot_settings

Direct tables:
- schedule_edit_log
- work_assignments
- work_weeks

Target services:
- scheduleService
- auditService

## Manager home

File: `matok-manager-home-final-v1.js`

Direct tables:
- staff_week_submissions
- work_assignments
- work_weeks

Target services:
- scheduleService
- availabilityService

## Availability roster

File: `matok-availability-roster-final-v1.js`

RPCs:
- admin_get_week_availability_roster

Target service:
- availabilityService

## Employee onboarding

File: `matok-onboarding-final-v1.js`

RPCs:
- admin_approve_onboarding_new
- admin_create_onboarding_invite
- admin_get_onboarding_text
- admin_get_staff_private_profile
- admin_import_onboarding_batch
- admin_import_onboarding_file
- admin_link_onboarding_existing
- admin_list_onboarding_records
- admin_materialize_onboarding_employee
- admin_update_onboarding_record

Direct tables:
- staff

Private storage:
- staff-onboarding-originals

Target services:
- onboardingService
- staffService
- privateDocumentService

## Modules with no direct backend calls

- `matok-ui-final-v1.js`
- `matok-whatsapp-final-v1.js`
- `matok-navigation-final-v1.js`

`matok-realtime-final-v1.js` uses the Supabase realtime client and should later be hidden behind a realtime adapter.

## Refactor priority

1. onboardingService: newest module, isolated scope, easiest place to establish the service pattern.
2. availabilityService: small surface and useful to scheduling.
3. staffService: shared by onboarding/payroll/scheduling.
4. scheduleService: highest operational value but larger surface.
5. payrollService / employeeDocumentService.
6. identityService: last among normal refactors because it is security-sensitive and must be changed together with the hardened security profile.

## Rule for new code

No new screen should add raw `supabaseClient.rpc(...)`, `.from(...)`, or storage calls unless it is inside an adapter/service layer or there is a documented temporary exception.
