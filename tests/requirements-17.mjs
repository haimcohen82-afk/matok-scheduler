import { readFile } from 'node:fs/promises';

const html=await readFile('dist/index.html','utf8');
const fail=msg=>{throw new Error(msg)};
const has=s=>html.includes(s);

const requirements=[
  [1,'פורטל העלאת תלושים ודוחות נוכחות',['mpUploadChoice','mpAnalyzePdf','mpSavePdf','admin_register_employee_document','employee-documents']],
  [2,'עובד רואה רק מסמכים ונתונים אישיים',['employee_list_documents','employee-document-link','mfEmployeeDocuments','employee_list_payroll_hours']],
  [3,'מעטפת עובד פשוטה עם תפריט עגול',['מה ברצונך לעשות?','border-radius:50%;aspect-ratio:1/1','הנתונים שלי','שעות נוכחות','בונוסים']],
  [4,'כניסת עובד יציבה ושחזור קוד',['employee_login','employee_validate_session','admin_get_staff_login_status','admin_issue_staff_credentials_v2','mfEmployeeLoginHelp','autocomplete="off" enterkeyhint="done"']],
  [5,'צפייה בסידור המפורסם של השבוע הנוכחי',['employee_get_current_schedule_v2','mfPublishedSchedule','employee_get_schedule_notice']],
  [6,'עריכת סידור שכבר פורסם',['admin_set_published_assignment','הסידור מפורסם ופתוח לעריכת מנהל']],
  [7,'עקיפת זמינות ויום קבוע למנהל בלבד',['למנהל יש הרשאה לשבץ כל עובד פעיל','admin_set_published_assignment']],
  [8,'פניות: צפיתי, תגובה וארכיון',['admin_mark_staff_report_viewed','admin_reply_staff_report','admin_archive_staff_report','employee_get_reports_v2']],
  [9,'ללא נתוני דמו במוצר',['single-production-build']],
  [10,'תזכורת לעובדים לדווח חוסר/תקלה/שיפור',['חשוב לנו שתעדכני אותנו.','דיווח / חוסר בחנות']],
  [11,'הגשות שבוע שפורסם עוברות מהתצוגה הפעילה',['mfPublishedAvailabilityHidden','הזמינות של השבוע שפורסם הועברה להיסטוריה','מעבר לשבוע הבא']],
  [12,'מסלול WhatsApp לצוות אחרי פרסום',['פתח הבא ב-WhatsApp','mfWaQueueProgress','סידור העבודה לשבוע']],
  [13,'סיכום עובדים לשבוע',['admin_get_week_staff_summary_v2','יכלה לתת','נתנה','קיבלה']],
  [14,'סידור מנהל נוח בנייד: 2 ימים, הגדלה ומעבר',['grid-template-columns:1fr 1fr!important','mfExpanded','יום קודם','יום הבא']],
  [15,'פריסה מזוהה וניתנת לבדיקה',['matok-live-version','window.__MATOK_BUILD__','mfHealthModal']],
  [16,'ארכיטקטורה מאוחדת ללא patch-on-patch ישן',['single-production-build','matok-core-final-v1.js','matok-payroll-final-v1.js']],
  [17,'שינוי מעטפת ללא שבירת הזרימות',['applyEmployeeSimpleMode','employee_save_availability','employee_submit_report','employee_list_documents','employee_get_current_schedule_v2']]
];

for(const [n,label,tokens] of requirements){
  for(const token of tokens) if(!has(token)) fail(`requirement ${n} failed (${label}): missing ${token}`);
}

for(const demo of ['רוני ישראלי','נועה לוי','שירה כהן','שירה · 20.7','להוסיף מדף ליד הקופה']){
  if(has(demo))fail(`requirement 9 failed: demo leaked: ${demo}`);
}

for(const legacy of ['schedule-pro-v3.js','workflow-upgrade-v1.js','runtime-stable-v1.js','employee-simple-ui-v1.js','payroll-suite-v2.js']){
  if(has(legacy))fail(`requirement 16 failed: legacy runtime leaked: ${legacy}`);
}

if(has('if(isEmployee()){loadEmployeeDocumentsFinal();loadEmployeePayrollFinal()}if(tries>80)')){
  fail('performance regression: employee payroll RPC flood loop returned');
}

console.log('MATOK 17-requirement verification passed');
