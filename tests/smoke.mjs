import { readFile } from 'node:fs/promises';

const html=await readFile('dist/index.html','utf8');
const fail=msg=>{throw new Error(msg)};
const has=s=>html.includes(s);

const mustHave=[
  ['employee login','employee_login'],
  ['safe employee session','employee_validate_session'],
  ['current published schedule','employee_get_current_schedule_v2'],
  ['availability submit','employee_save_availability'],
  ['published schedule edit','admin_set_published_assignment'],
  ['staff summary','admin_get_week_staff_summary_v2'],
  ['login diagnostics','admin_get_staff_login_status'],
  ['staff reports','employee_submit_report'],
  ['manager report reply','admin_reply_staff_report'],
  ['document registration','admin_register_employee_document'],
  ['employee documents','employee_list_documents'],
  ['payroll hours','employee_list_payroll_hours'],
  ['private document bucket','employee-documents'],
  ['employee home','mfHome'],
  ['admin schedule','mfAdminScheduleBody'],
  ['payroll portal','payrollFinal'],
  ['system health','mfHealthModal'],
  ['realtime schedule synchronization','matok-final-live-'],
  ['schedule print','mfPrintScheduleBtn'],
  ['schedule edit history','mfEditHistoryModal']
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

for(const demo of ['רוני ישראלי','נועה לוי','שירה כהן','שירה · 20.7']) if(has(demo)) fail(`demo data leaked into production: ${demo}`);

const versionMatches=[...html.matchAll(/matok-live-version/g)].length;
if(versionMatches!==1) fail(`expected one build version marker, found ${versionMatches}`);

console.log('MATOK smoke checks passed');
