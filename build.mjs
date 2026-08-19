import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { basename } from 'node:path';

const SOURCE_SHELL='Index.html';
const MODULES=[
  'matok-core-final-v1.js',
  'matok-payroll-final-v1.js',
  'matok-ui-final-v1.js',
  'matok-access-final-v1.js',
  'matok-whatsapp-final-v1.js',
  'matok-health-final-v1.js',
  'matok-realtime-final-v1.js',
  'matok-admin-tools-final-v1.js'
];

const commit=(process.env.COMMIT_REF||process.env.HEAD||'local').slice(0,12);
const buildId=`20260819-stable-${commit}`;

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
  if(!match)throw new Error(`missing legacy function expected by compiler: ${name}`);
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

function stripKnownDemoText(html){
  const phrases=[
    'שירה · 20.7','רוני ישראלי','נועה לוי','שירה כהן',
    'רוני · הצעת ייעול — להוסיף מדף ליד הקופה','רוני · טושים שחורים','נועה · שקיות מותג בינוניות'
  ];
  for(const p of phrases)html=html.split(p).join('');
  return html;
}

await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});

let html=await readFile(SOURCE_SHELL,'utf8');
for(const id of ['attendance','requests','adminSchedule','settings','contact','hours','scheduleWorker']){
  html=replaceSectionById(html,id,`<section id="${id}" class="panel"></section>`);
}
html=clearObjectDeclaration(html,'previewAssignments');
html=removeLegacyAdminRuntime(html);
html=stripKnownDemoText(html);

const parts=[];
for(const file of MODULES){
  const code=await readFile(file,'utf8');
  parts.push(`\n/* ===== ${basename(file)} ===== */\n${code}\n`);
}

const boot=`<meta name="matok-live-version" content="${buildId}">`;
html=html.replace('</head>',`${boot}\n</head>`);
html=html.replace('</body>',`<script>window.__MATOK_BUILD__=${JSON.stringify({buildId,commit,modules:MODULES})};<\/script>\n<script>\n${parts.join('\n')}\n<\/script>\n</body>`);

const forbidden=[
  'schedule-pro.js','schedule-pro-v2.js','schedule-pro-v3.js','schedule-assignment-v3.js',
  'workflow-upgrade-v1.js','workflow-upgrade-v2.js','runtime-stable-v1.js',
  'employee-simple-ui-v1.js','employee-portal-stable-v2.js','payroll-suite-v2.js',
  'matok-legacy-guard-v1.js','fetch(\'/Index.html'
];
for(const token of forbidden)if(html.includes(token))throw new Error(`production build contains forbidden legacy token: ${token}`);
for(const demo of ['רוני ישראלי','נועה לוי','שירה כהן','שירה · 20.7'])if(html.includes(demo))throw new Error(`production build contains demo data: ${demo}`);
for(const required of [
  'employee_validate_session','employee_get_current_schedule_v2','admin_set_published_assignment','admin_get_week_staff_summary_v2',
  'admin_get_staff_login_status','admin_register_employee_document','employee_list_documents','mfHealthModal','matok-final-live-',
  'mfPrintScheduleBtn','mfEditHistoryModal'
])if(!html.includes(required))throw new Error(`production build missing required capability: ${required}`);

await writeFile('dist/index.html',html,'utf8');
await writeFile('dist/version.json',JSON.stringify({buildId,commit,modules:MODULES,generatedAt:new Date().toISOString()},null,2),'utf8');
console.log(`MATOK build complete: ${buildId}`);
console.log(`Output: dist/index.html (${Buffer.byteLength(html)} bytes)`);
