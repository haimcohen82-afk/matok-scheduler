import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { basename } from 'node:path';

const SOURCE_SHELL='app-shell.html';
const MODULES=[
  'matok-core-final-v1.js',
  'matok-payroll-final-v1.js',
  'matok-ui-final-v1.js',
  'matok-notifications-final-v1.js',
  'matok-access-final-v1.js',
  'matok-whatsapp-final-v1.js',
  'matok-health-final-v1.js',
  'matok-realtime-final-v1.js',
  'matok-admin-tools-final-v1.js',
  'matok-manager-home-final-v1.js',
  'matok-availability-roster-final-v1.js'
];

const commit=(process.env.COMMIT_REF||process.env.HEAD||'local').slice(0,12);
const buildId=`20260829-stable-rebuild-${commit}`;

function findBalancedEnd(source,braceStart){
  let depth=0,quote='',escaped=false;
  for(let i=braceStart;i<source.length;i++){
    const ch=source[i];
    if(quote){
      if(escaped){escaped=false;continue}
      if(ch==='\\'){escaped=true;continue}
      if(ch===quote)quote='';
      continue;
    }
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue}
    if(ch==='{')depth++;
    if(ch==='}'){
      depth--;
      if(depth===0)return i;
    }
  }
  return -1;
}

function replaceSectionById(html,id,replacement){
  const needle=`<section id="${id}"`;
  const start=html.indexOf(needle);
  if(start<0) throw new Error(`missing section #${id}`);
  const tagEnd=html.indexOf('>',start);
  if(tagEnd<0) throw new Error(`invalid section #${id}`);
  const re=/<\/?section\b[^>]*>/gi;
  re.lastIndex=tagEnd+1;
  let depth=1,m;
  while((m=re.exec(html))){
    if(/^<section\b/i.test(m[0])) depth++;
    else depth--;
    if(depth===0) return html.slice(0,start)+replacement+html.slice(re.lastIndex);
  }
  throw new Error(`unclosed section #${id}`);
}

function clearObjectDeclaration(source,name){
  const re=new RegExp(`\\b(?:let|const|var)\\s+${name}\\s*=\\s*\\{`,'m');
  const match=re.exec(source);
  if(!match)return source;
  const braceStart=match.index+match[0].lastIndexOf('{');
  const end=findBalancedEnd(source,braceStart);
  if(end<0)throw new Error(`could not clear object declaration: ${name}`);
  return source.slice(0,braceStart)+'{}'+source.slice(end+1);
}

function replaceFunctionBody(source,name,body='return;'){
  const re=new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`,'m');
  const match=re.exec(source);
  if(!match)throw new Error(`missing function expected by compiler: ${name}`);
  const braceStart=match.index+match[0].lastIndexOf('{');
  const end=findBalancedEnd(source,braceStart);
  if(end<0)throw new Error(`unclosed function: ${name}`);
  return source.slice(0,braceStart+1)+body+source.slice(end);
}

function removeLegacyAdminRuntime(html){
  const obsolete=[
    'renderAdminSchedule','renderAdminOverview','loadScheduleFromDb','loadAdminAvailability','startAdminAvailabilityLive','syncScheduleLockUi',
    'saveScheduleToDb','lockPreviewSchedule','unlockPreviewSchedule','publishPreview','changeAdminWeek','saveManagerNote'
  ];
  for(const name of obsolete)html=replaceFunctionBody(html,name,'return;');
  return html;
}

function stabilizeCore(code){
  code=replaceFunctionBody(code,'initEmployeeUi',`
    if(!isEmployee())return;
    addStyles();
    const root=document.getElementById('worker');
    const first=!root?.dataset.mfFinalEmployeeInit;
    if(root)root.dataset.mfFinalEmployeeInit='1';
    document.body.classList.add('matokEmployeeFinal');
    if(first){buildEmployeeHome();cleanEmployeePanels();}
    showEmployeeHome();
    if(first){loadEmployeeReportsFinal();window.loadEmployeePayrollFinal?.();window.loadEmployeeDocumentsFinal?.();}
  `);
  code=replaceFunctionBody(code,'initAdminFinal',`
    if(!isAdmin())return;
    addStyles();
    const root=document.getElementById('admin');
    if(root?.dataset.mfFinalAdminInit==='1'){bindFinalAdminTabs();return;}
    if(root)root.dataset.mfFinalAdminInit='1';
    buildAdminSchedulePanel();
    buildAdminRequestsFinal();
    buildAdminAttendanceFinal();
    const start=sundayOf();
    adminWeekStart=start;
    loadAdminFinalData(start).then(()=>{loadAdminReportsFinal();loadHoursReportsFinal();window.initPayrollAdminFinal?.()}).catch(e=>{console.error('admin final init',e);toast?.('טעינת נתוני המנהל נכשלה')});
    bindFinalAdminTabs();
  `);
  code=replaceFunctionBody(code,'setAssignmentFinal',`
    const batchAssignVersion='MATOK_BATCH_ASSIGN_V1';
    if(btn)btn.disabled=true;
    try{
      const s=staffById(staffId);
      const fn=adminState.week?.status==='published'?'admin_set_published_assignment':'admin_set_assignment_v4';
      const args=fn==='admin_set_published_assignment'
        ?{p_week_start:adminState.weekStart,p_slot_key:slot,p_staff_id:staffId,p_assigned:assigned,p_role_name:s?.role_name||'מכירה'}
        :{p_week_start:adminState.weekStart,p_slot_key:slot,p_staff_id:staffId,p_role_name:s?.role_name||'מכירה',p_assigned:assigned};
      const {error}=await supabaseClient.rpc(fn,args);
      if(error)throw error;

      const rows=adminState.assignments=Array.isArray(adminState.assignments)?adminState.assignments:[];
      const idx=rows.findIndex(a=>a.slot_key===slot&&String(a.staff_id)===String(staffId));
      if(assigned){
        const row={slot_key:slot,staff_id:staffId,role_name:s?.role_name||'מכירה',status:'approved'};
        if(idx>=0)rows[idx]={...rows[idx],...row};
        else rows.push(row);
      }else if(idx>=0){
        rows.splice(idx,1);
      }

      renderAdminScheduleFinal();
      if(fromPicker){
        renderCandidateFinal();
        const modal=document.getElementById('mfCandidateModal');
        if(modal&&!modal.classList.contains('show'))openModal?.('mfCandidateModal');
      }
      window.refreshAdminAvailabilityRoster?.();
      toast?.((s?.full_name||'העובד')+' '+(assigned?'נוסף':'הוסר')+' מהסידור');
      void batchAssignVersion;
    }catch(e){
      console.error(e);
      toast?.('השינוי לא נשמר: '+(e?.message||'שגיאה'));
    }finally{
      if(btn)btn.disabled=false;
    }
  `);
  code=code.replace('זמינות והגדרת יום מוצגות כמידע בלבד. למנהל יש הרשאה לשבץ כל עובד פעיל.','אפשר לשבץ כמה עובדים ברצף. אחרי שיבוץ העובד יורד מהרשימה ואתה נשאר במסך הזה. זמינות ויום קבוע הם מידע בלבד.');
  code=code.replace("setTimeout(()=>{if(isEmployee())initEmployeeUi();if(isAdmin())initAdminFinal()},1200);",'');
  return code;
}

function stripKnownDemoText(html){
  const phrases=[
    'שירה · 20.7','רוני ישראלי','נועה לוי','שירה כהן',
    'רוני · הצעת ייעול — להוסיף מדף ליד הקופה','להוסיף מדף ליד הקופה',
    'רוני · טושים שחורים','טושים שחורים',
    'נועה · שקיות מותג בינוניות','שקיות מותג בינוניות'
  ];
  for(const p of phrases)html=html.split(p).join('');
  return html;
}

await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});

let html=await readFile(SOURCE_SHELL,'utf8');
for(const id of ['attendance','requests']){
  html=replaceSectionById(html,id,`<section id="${id}" class="panel"></section>`);
}
html=clearObjectDeclaration(html,'previewAssignments');
html=removeLegacyAdminRuntime(html);
html=stripKnownDemoText(html);

const parts=[];
for(const file of MODULES){
  let code=await readFile(file,'utf8');
  if(file==='matok-core-final-v1.js')code=stabilizeCore(code);
  parts.push(`\n/* ===== ${basename(file)} ===== */\n${code}\n`);
}

const boot=`<meta name="matok-live-version" content="${buildId}">\n<meta name="matok-architecture" content="single-production-build">`; 
html=html.replace('</head>',`${boot}\n</head>`);
const finalBodyClose=html.lastIndexOf('</body>');
if(finalBodyClose<0)throw new Error('missing final </body> in app shell');
const productionScripts=`<script>window.__MATOK_BUILD__=${JSON.stringify({buildId,commit,modules:MODULES})};<\/script>\n<script>\n${parts.join('\n')}\n<\/script>\n`;
html=html.slice(0,finalBodyClose)+productionScripts+html.slice(finalBodyClose);

const forbidden=[
  'schedule-pro.js','schedule-pro-v2.js','schedule-pro-v3.js','schedule-assignment-v3.js',
  'workflow-upgrade-v1.js','workflow-upgrade-v2.js','runtime-stable-v1.js',
  'employee-simple-ui-v1.js','employee-portal-stable-v2.js','payroll-suite-v2.js',
  'matok-legacy-guard-v1.js','fetch(\'/Index.html',
  "setTimeout(()=>{if(isEmployee())initEmployeeUi();if(isAdmin())initAdminFinal()},1200);"
];
for(const token of forbidden)if(html.includes(token))throw new Error(`production build contains forbidden legacy token: ${token}`);
for(const demo of ['רוני ישראלי','נועה לוי','שירה כהן','שירה · 20.7','להוסיף מדף ליד הקופה','טושים שחורים','שקיות מותג בינוניות'])if(html.includes(demo))throw new Error(`production build contains demo data: ${demo}`);
for(const required of [
  'employee_validate_session','employee_get_current_schedule_v2','admin_set_published_assignment','admin_get_week_staff_summary_v2',
  'admin_get_staff_login_status','admin_register_employee_document','employee_list_documents','mfHealthModal','matok-final-live-',
  'mfPrintScheduleBtn','mfEditHistoryModal','mfManagerWeeks','mfOpenCurrentWeek','settingsRows','supplies',
  'mfFinalEmployeeInit','mfFinalAdminInit','employee_get_schedule_notice','employee_mark_schedule_viewed','mfScheduleNotice',
  'admin_get_week_availability_roster','mfRosterEmployee','MATOK_BATCH_ASSIGN_V1'
])if(!html.includes(required))throw new Error(`production build missing required capability or shell dependency: ${required}`);

await writeFile('dist/index.html',html,'utf8');
await writeFile('dist/version.json',JSON.stringify({buildId,commit,modules:MODULES,generatedAt:new Date().toISOString()},null,2,'utf8'));
console.log(`MATOK build complete: ${buildId}`);
console.log(`Output: dist/index.html (${Buffer.byteLength(html)} bytes)`);