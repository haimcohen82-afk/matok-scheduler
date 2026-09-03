import { readFile } from 'node:fs/promises';

const html=await readFile('dist/index.html','utf8');
const fail=msg=>{throw new Error(msg)};
const has=s=>html.includes(s);

const mustHave=[
  ['employee login','employee_login'],
  ['safe employee session','employee_validate_session'],
  ['current published schedule','employee_get_current_schedule_v2'],
  ['published schedule notice','employee_get_schedule_notice'],
  ['published schedule viewed','employee_mark_schedule_viewed'],
  ['schedule notice UI','mfScheduleNotice'],
  ['schedule unread badge','mfScheduleNewBadge'],
  ['availability submit','employee_save_availability'],
  ['published schedule edit','admin_set_published_assignment'],
  ['staff summary','admin_get_week_staff_summary_v2'],
  ['login diagnostics','admin_get_staff_login_status'],
  ['login recovery credentials','admin_issue_staff_credentials_v2'],
  ['direct manager portal routing','openAdminIntent'],
  ['direct payroll route','payroll-hours'],
  ['staff reports','employee_submit_report'],
  ['manager report reply','admin_reply_staff_report'],
  ['document registration','admin_register_employee_document'],
  ['employee documents','employee_list_documents'],
  ['payroll hours','employee_list_payroll_hours'],
  ['private document bucket','employee-documents'],
  ['private employee document link','employee-document-link'],
  ['employee home','mfHome'],
  ['round employee actions','.mfAction{'],
  ['employee circular menu shape','border-radius:50%;aspect-ratio:1/1'],
  ['employee schedule action','צפייה בסידור עבודה'],
  ['employee availability action','הגשת משמרות'],
  ['employee shortage action','דיווח / חוסר בחנות'],
  ['employee personal data action','הנתונים שלי'],
  ['employee attendance action','שעות נוכחות'],
  ['employee bonus action','בונוסים'],
  ['employee messages action','הפניות שלי'],
  ['employee simple prompt','מה ברצונך לעשות?'],
  ['focused employee views','applyEmployeeSimpleMode'],
  ['admin schedule','mfAdminScheduleBody'],
  ['complete availability roster rpc','admin_get_week_availability_roster'],
  ['complete availability roster ui','mfRosterEmployee'],
  ['unsubmitted employee state','טרם הוגש'],
  ['payroll portal','payrollFinal'],
  ['payroll PDF analysis','mpAnalyzePdf'],
  ['payroll upload choice','mpUploadChoice'],
  ['employee payroll destination copy','איפה העובדים רואים?'],
  ['payroll PDF split and save','mpSavePdf'],
  ['payroll OCR fallback','Tesseract.recognize'],
  ['payroll confidence review','mpConfidence'],
  ['payroll fuzzy name recognition','levenshtein'],
  ['attendance flexible column import','rowValue(row'],
  ['payroll delivery','mpDelivery'],
  ['system health','mfHealthModal'],
  ['realtime schedule synchronization','matok-final-live-'],
  ['schedule print','mfPrintScheduleBtn'],
  ['assigned staff removed from availability chips','!assignedIds.has(String(a.staff_id))'],
  ['assigned staff removed from candidate picker','adminState.staff.filter(s=>!on.has(String(s.id)))'],
  ['blank print protection','ההדפסה נעצרה כדי לא להפיק דף ריק'],
  ['schedule edit history','mfEditHistoryModal'],
  ['manager current/next week dashboard','mfManagerWeeks'],
  ['current published week shortcut','mfOpenCurrentWeek'],
  ['manager payroll upload shortcut','mfOpenPayrollPdf'],
  ['manager payroll hours shortcut','mfOpenPayrollHours'],
  ['payroll access controls','admin_get_portal_access_controls'],
  ['employee payroll access enforcement','employee_get_portal_access'],
  ['manager public/private messages','admin_send_manager_message'],
  ['employee manager messages','employee_list_manager_messages'],
  ['employee message replies','employee_reply_manager_message'],
  ['employee usage analytics','admin_employee_usage_summary'],
  ['bonus calculation v2','admin_upsert_payroll_hours_v2'],
  ['access analytics runtime','MATOK_ACCESS_ANALYTICS_V1'],
  ['manager messages runtime','MATOK_MANAGER_MESSAGES_V1'],
  ['bonus formula runtime','MATOK_BONUS_FORMULA_V1']
];
for(const [name,token] of mustHave) if(!has(token)) fail(`missing ${name}: ${token}`);

const forbidden=[
  'schedule-pro.js','schedule-pro-v2.js','schedule-pro-v3.js','schedule-assignment-v3.js',
  'workflow-upgrade-v1.js','workflow-upgrade-v2.js','runtime-stable-v1.js',
  'employee-simple-ui-v1.js','employee-portal-stable-v2.js','payroll-suite-v2.js',
  'matok-legacy-guard-v1.js',"fetch('/Index.html",
  ".from('work_assignments').delete().eq('week_id'",
  'adminAvailabilityPoll=setInterval'
];
for(const token of forbidden) if(has(token)) fail(`unsafe or legacy production dependency found: ${token}`);

for(const demo of [
  'רוני ישראלי','נועה לוי','שירה כהן','שירה · 20.7',
  'להוסיף מדף ליד הקופה','טושים שחורים','שקיות מותג בינוניות'
]) if(has(demo)) fail(`demo data leaked into production: ${demo}`);

const versionMatches=[...html.matchAll(/matok-live-version/g)].length;
if(versionMatches!==1) fail(`expected one build version marker, found ${versionMatches}`);

const buildMarker=html.indexOf('window.__MATOK_BUILD__');
const shellTailMarker=html.indexOf("document.getElementById('settingsRows')");
if(buildMarker<0||shellTailMarker<0) fail('missing production build or shell tail marker');
if(buildMarker<shellTailMarker) fail('production modules were injected inside the shell script instead of before the final body close');

console.log('MATOK smoke checks passed');