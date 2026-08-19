(() => {
  'use strict';
  const VERSION='20260819-final-core-1';
  const SAFE_SESSION_KEY='matokEmployeeSafeV1';
  let carriedEmployeeSession=null;
  try{
    carriedEmployeeSession=JSON.parse(sessionStorage.getItem(SAFE_SESSION_KEY)||sessionStorage.getItem('matokEmployee')||'null');
    sessionStorage.removeItem('matokEmployee');
  }catch(_){ sessionStorage.removeItem('matokEmployee'); }

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));
  const SLOT_ORDER=['sun-am','sun-pm','mon-am','mon-pm','tue-am','tue-pm','wed-am','wed-pm','thu-am','thu-pm','fri'];
  const DAYS=[['ראשון',['sun-am','sun-pm']],['שני',['mon-am','mon-pm']],['שלישי',['tue-am','tue-pm']],['רביעי',['wed-am','wed-pm']],['חמישי',['thu-am','thu-pm']],['שישי',['fri']]];
  const slotName=s=>s==='fri'?'שישי':s.endsWith('-am')?'בוקר':'ערב';
  const dayName=s=>({sun:'ראשון',mon:'שני',tue:'שלישי',wed:'רביעי',thu:'חמישי',fri:'שישי'}[String(s).split('-')[0]]||s);
  const labelSlot=s=>s==='fri'?'שישי 09:00–14:00':`${dayName(s)} · ${slotName(s)}`;
  const fmtDate=iso=>{try{return new Date(iso+'T12:00:00').toLocaleDateString('he-IL',{day:'numeric',month:'numeric'})}catch(_){return iso}};
  const fmtWeek=iso=>{try{const d=new Date(iso+'T12:00:00'),e=new Date(d);e.setDate(d.getDate()+5);return `${fmtDate(iso)}–${e.toLocaleDateString('he-IL',{day:'numeric',month:'numeric'})}`}catch(_){return iso}};
  const isEmployee=()=>{try{return appSession?.type==='employee'}catch(_){return false}};
  const isAdmin=()=>{try{return appSession?.type==='admin'}catch(_){return false}};
  const phone972=v=>{let d=String(v||'').replace(/\D/g,'');if(d.startsWith('972'))return d;if(d.startsWith('0'))return '972'+d.slice(1);return d};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function addStyles(){
    if(document.getElementById('matokFinalStyles'))return;
    const s=document.createElement('style');s.id='matokFinalStyles';s.textContent=`
      body.matokEmployeeFinal .notice{display:none!important}body.matokEmployeeFinal .top .switch{display:none!important}body.matokEmployeeFinal .workerTabs{display:none!important}body.matokEmployeeFinal #worker>.hero,body.matokEmployeeFinal #worker>.metricRow,body.matokEmployeeFinal #employeeEngagementBanner{display:none!important}
      .mfHome{display:none}.mfHome.active{display:block}.mfWelcome{background:linear-gradient(145deg,#1a1a2e,#292b4a);color:#fff;border-radius:24px;padding:24px 20px;box-shadow:0 15px 35px #1a1a2e26;margin-bottom:17px;position:relative;overflow:hidden}.mfWelcome:after{content:"";position:absolute;width:180px;height:180px;border-radius:50%;background:#ffffff0c;left:-70px;top:-80px}.mfWelcome small{opacity:.72;font-weight:800}.mfWelcome h1{margin:4px 0 5px;font-size:29px}.mfWelcome p{margin:0;color:#ffffffc9}.mfQuestion{font-size:19px;font-weight:900;margin:16px 2px 11px}.mfActionGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.mfAction{border:1px solid var(--line);background:#fff;border-radius:50%;aspect-ratio:1/1;min-height:150px;padding:14px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 9px 24px #1a1a2e0c;color:var(--ink)}.mfAction:active{transform:scale(.985)}.mfActionIcon{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;background:var(--soft);font-size:26px;margin-bottom:8px}.mfAction b{font-size:15px}.mfAction small{font-size:10px;color:var(--muted);line-height:1.35;margin-top:3px}.mfAction.schedule{background:#eef9f6;border-color:#9fd6cb}.mfAction.availability{background:#fff6f1;border-color:#e7b4a8}.mfAction.docs{background:#eef4fb;border-color:#b5cee5}.mfAction.hours{background:#fff8df;border-color:#ead18b}.mfAction.report{background:#f8eeeb;border-color:#deb8ae}.mfAction.messages{background:#f3eff9;border-color:#c9b9df}.mfTip{background:#f0faf8;border:1px solid #b6ddd5;border-radius:15px;padding:12px 13px;margin-top:14px;font-size:12px;line-height:1.55}.mfSectionHeader{display:none;position:sticky;top:70px;z-index:20;background:rgba(245,240,232,.96);backdrop-filter:blur(8px);padding:9px 0;border-bottom:1px solid #ded9d177;margin-bottom:10px}.mfSectionHeader.active{display:flex;gap:10px;align-items:center}.mfBack{border:1px solid var(--line);background:#fff;border-radius:13px;padding:11px 14px;font-weight:900}.mfSectionHeader h2{margin:0;font-size:20px}.mfSectionHeader p{margin:2px 0 0;color:var(--muted);font-size:11px}.mfPanelClean{display:none!important}.mfPanelClean.active{display:block!important}.mfCurrentSchedule .item{background:#edf8ee;border-color:#9bc99f}.mfEmpty{border:1px dashed var(--line);border-radius:12px;padding:14px;color:var(--muted);background:#fff}.mfReportGrid{display:grid;grid-template-columns:1fr 1fr;gap:11px}.mfMessages{display:grid;gap:8px}.mfMessage{border:1px solid var(--line);border-radius:12px;padding:11px;background:#fff}.mfMessage.unread{border-right:5px solid var(--coral)}.mfMessage.archived{opacity:.75;background:var(--soft)}.mfMessageHead{display:flex;justify-content:space-between;gap:8px}.mfReply{margin-top:8px;background:#eef9f6;border-right:4px solid var(--teal);padding:9px;border-radius:8px}.mfStatus{font-size:10px;font-weight:900;border-radius:999px;padding:4px 7px;background:#eee;white-space:nowrap}.mfStatus.ok{background:#def1e0;color:#2d6933}.mfStatus.wait{background:#fff0c8;color:#7b611a}
      .mfAdminRequests .mfAdminMessage{border:1px solid var(--line);border-radius:12px;padding:12px;background:#fff;margin-top:8px}.mfAdminActions{display:grid;grid-template-columns:auto 1fr auto;gap:8px;margin-top:9px;align-items:end}.mfAdminActions textarea{min-height:64px}.mfArchive{margin-top:12px;border-top:1px solid var(--line);padding-top:10px}
      .mfScheduleToolbar{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin:10px 0}.mfScheduleState{background:#eef9f6;border:1px solid #abd8cf;border-radius:11px;padding:10px 12px;margin:9px 0}.mfScheduleGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.mfDay{border:1px solid var(--line);border-radius:13px;background:#fff;overflow:hidden}.mfDay>header{background:var(--ink);color:#fff;padding:11px 12px;display:flex;justify-content:space-between}.mfShift{padding:11px;border-bottom:1px solid var(--line)}.mfShift:last-child{border-bottom:0}.mfShiftHead{display:flex;justify-content:space-between;gap:8px;align-items:center}.mfAssigned{display:grid;gap:6px;margin:8px 0}.mfPerson{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#edf8ee;border:1px solid #a7cca9;border-radius:9px;padding:8px}.mfPerson button{min-width:39px}.mfAvailability{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.mfAvailChip{font-size:9px;border-radius:999px;padding:4px 7px;background:#eee}.mfAvailChip.available{background:#e5f4e6;color:#356b39}.mfAvailChip.preferred{background:#fff0c7;color:#745b17}.mfAvailChip.unavailable{background:#ffe9e5;color:#8e3b31}.mfCandidateList{display:grid;gap:7px}.mfCandidate{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:9px;background:#fff}.mfCandidate.warning{background:#fff8f1;border-color:#e9c0a6}.mfCandidate small{display:block;color:var(--muted)}.mfOverride{display:inline-block;font-size:9px;font-weight:900;color:#914d2e;background:#ffe9da;border-radius:999px;padding:3px 6px;margin-top:3px}.mfSummary{overflow:auto}.mfSummary table{width:100%;border-collapse:collapse;font-size:12px}.mfSummary th,.mfSummary td{padding:9px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}.mfWaRow{display:flex;justify-content:space-between;gap:8px;align-items:center;border:1px solid var(--line);border-radius:9px;padding:8px;margin-top:6px}
      .mfLoginNote{margin-top:8px;font-size:11px;color:var(--muted);line-height:1.4}.mfLoginWarn{background:#fff4e6;border:1px solid #ecc894;border-radius:9px;padding:8px;margin-top:8px;color:#79572a}
      @media(max-width:950px){.mfScheduleGrid{grid-template-columns:1fr 1fr}}@media(max-width:650px){.mfScheduleGrid,.mfReportGrid{grid-template-columns:1fr}.mfAdminActions{grid-template-columns:1fr}.mfScheduleToolbar .btn{flex:1}.mfDay{min-width:0}.mfWaRow{align-items:flex-start;flex-wrap:wrap}.mfWaRow .btn{width:100%}}@media(max-width:430px){body.matokEmployeeFinal .wrap{padding:10px 10px 85px}.mfWelcome{border-radius:20px;padding:20px 16px}.mfWelcome h1{font-size:25px}.mfActionGrid{gap:9px}.mfAction{min-height:0;padding:10px}.mfActionIcon{width:50px;height:50px;font-size:23px}.mfAction b{font-size:14px}.mfSectionHeader{top:64px}}
    `;document.head.appendChild(s);
  }

  function saveEmployeeSession(){
    if(!isEmployee())return;
    const payload={user:{id:appSession.user.id,name:appSession.user.name,role:appSession.user.role},username:appSession.username,code:appSession.code};
    try{sessionStorage.setItem(SAFE_SESSION_KEY,JSON.stringify(payload));}catch(_){}
  }

  const originalFinishLogin=typeof finishLogin==='function'?finishLogin:null;
  if(originalFinishLogin){
    finishLogin=function(name,type){
      originalFinishLogin(name,type);
      if(type==='employee'){document.body.classList.add('matokEmployeeFinal');setTimeout(initEmployeeUi,20)}
      else document.body.classList.remove('matokEmployeeFinal');
      if(type==='admin')setTimeout(initAdminFinal,60);
    };
  }

  window.loginEmployee=async function(){
    const username=(document.getElementById('employeeLoginUsername')?.value||'').trim().toLowerCase();
    const code=(document.getElementById('employeeLoginCode')?.value||'').trim();
    const errorBox=document.getElementById('authError');
    if(errorBox)errorBox.textContent='';
    if(!username||!/^\d{4}$/.test(code)){if(errorBox)errorBox.textContent='יש להזין שם משתמש וקוד PIN בן 4 ספרות';return}
    const btn=document.querySelector('#employeeAuthPane .btn');if(btn){btn.disabled=true;btn.textContent='נכנסת…'}
    try{
      const {data,error}=await supabaseClient.rpc('employee_login',{p_username:username,p_code:code});
      if(error||!data?.length)throw error||new Error('login_failed');
      const u=data[0];
      if(u.login_status==='locked'){
        const until=u.locked_until?new Date(u.locked_until).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'}):'בעוד מספר דקות';
        if(errorBox)errorBox.innerHTML=`<div class="mfLoginWarn">הכניסה נעולה זמנית לאחר מספר ניסיונות שגויים. ניתן לנסות שוב ב־${esc(until)}.</div>`;return;
      }
      if(u.login_status!=='ok'){if(errorBox)errorBox.textContent='שם המשתמש או קוד ה-PIN אינם נכונים';return}
      appSession={type:'employee',user:{id:u.id,name:u.full_name,role:u.role_name,username:u.username},username:u.username||username,code};
      saveEmployeeSession();
      finishLogin(u.full_name,'employee');
      await loadEmployeePortalFinal();
    }catch(e){console.error('employee login',e);if(errorBox)errorBox.textContent='לא ניתן להיכנס כרגע. נסי שוב בעוד רגע.'}
    finally{if(btn){btn.disabled=false;btn.textContent='כניסה'}}
  };

  const originalLogout=typeof logoutSystem==='function'?logoutSystem:null;
  window.logoutSystem=async function(){
    try{sessionStorage.removeItem(SAFE_SESSION_KEY);sessionStorage.removeItem('matokEmployee')}catch(_){}
    if(originalLogout)return originalLogout();
    location.reload();
  };

  async function restoreEmployeeSafely(){
    const saved=carriedEmployeeSession||(()=>{try{return JSON.parse(sessionStorage.getItem(SAFE_SESSION_KEY)||'null')}catch(_){return null}})();
    if(!saved?.code||!saved?.username)return false;
    try{
      const id=saved.user?.id||saved.id;
      if(!id)return false;
      const {data,error}=await supabaseClient.rpc('employee_validate_session',{p_staff_id:id,p_username:saved.username,p_code:saved.code});
      if(error||data?.[0]?.login_status!=='ok'){sessionStorage.removeItem(SAFE_SESSION_KEY);return false}
      const u=data[0];appSession={type:'employee',user:{id:u.id,name:u.full_name,role:u.role_name,username:u.username},username:u.username,code:saved.code};
      saveEmployeeSession();finishLogin(u.full_name,'employee');await loadEmployeePortalFinal();return true;
    }catch(e){console.error('safe restore',e);return false}
  }

  async function loadEmployeePortalFinal(){
    if(!isEmployee())return;
    const {data,error}=await supabaseClient.rpc('employee_get_portal_context',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code});
    if(error||!data?.length){console.error(error);toast?.('טעינת האזור האישי נכשלה');return}
    workerContext=data[0];workerTargetWeek=workerContext.target_week_start;
    if(typeof resetWorkerStates==='function')resetWorkerStates();
    if(typeof renderWorkerWeek==='function')renderWorkerWeek();
    if(typeof renderFridayWorker==='function')renderFridayWorker();
    if(typeof updateWorkerMetrics==='function')updateWorkerMetrics();
    if(typeof loadEmployeeAvailability==='function')await loadEmployeeAvailability();
    initEmployeeUi();updateEmployeeHomeMeta();
  }

  function employeeGreeting(){const h=new Date().getHours();return h<12?'בוקר טוב':h<18?'צהריים טובים':'ערב טוב'}
  function buildEmployeeHome(){
    const root=document.getElementById('worker');if(!root||document.getElementById('mfHome'))return;
    const home=document.createElement('section');home.id='mfHome';home.className='mfHome';home.innerHTML=`
      <div class="mfWelcome"><small>MATOK BASIC · אזור אישי</small><h1 id="mfGreeting">${esc(employeeGreeting())}</h1><p id="mfWelcomeName">מה תרצי לעשות עכשיו?</p></div>
      <div class="mfQuestion">בחרי פעולה</div>
      <div class="mfActionGrid">
        <button class="mfAction schedule" data-mf-section="scheduleWorker"><span class="mfActionIcon">▣</span><b>צפייה בסידור עבודה</b><small id="mfScheduleMeta">הסידור שפורסם לשבוע הנוכחי</small></button>
        <button class="mfAction availability" data-mf-section="availability"><span class="mfActionIcon">✓</span><b>הגשת משמרות</b><small id="mfAvailabilityMeta">זמינות לשבוע הבא</small></button>
        <button class="mfAction report" data-mf-section="contact" data-mf-focus="shortage"><span class="mfActionIcon">!</span><b>דיווח / חוסר בחנות</b><small>חוסר, תקלה, שינוי או בקשה</small></button>
        <button class="mfAction docs" data-mf-section="hours" data-mf-focus="documents"><span class="mfActionIcon">▤</span><b>תלושים ודוחות</b><small>תלושי שכר ודוחות שעות</small></button>
        <button class="mfAction hours" data-mf-section="hours" data-mf-focus="payroll"><span class="mfActionIcon">◷</span><b>שעות ובונוסים</b><small>נתוני שעות ובונוסים אישיים</small></button>
        <button class="mfAction messages" data-mf-section="contact" data-mf-focus="messages"><span class="mfActionIcon">✉</span><b>הפניות שלי</b><small>צפייה בטיפול ובתגובות מנהל</small></button>
      </div>
      <div class="mfTip"><b>חשוב לנו שתעדכני אותנו.</b>ראית חוסר בחנות, שינוי שצריך לבצע, תקלה או רעיון לשיפור? שלחי דרך „דיווח / חוסר בחנות”.</div>`;
    const hero=root.querySelector(':scope>.hero');if(hero)hero.after(home);else root.prepend(home);
    home.querySelectorAll('[data-mf-section]').forEach(b=>b.onclick=()=>openEmployeeSection(b.dataset.mfSection,b.dataset.mfFocus||''));
    const hdr=document.createElement('div');hdr.id='mfSectionHeader';hdr.className='mfSectionHeader';hdr.innerHTML='<button class="mfBack" id="mfBackHome">חזרה</button><div><h2 id="mfSectionTitle">האזור שלי</h2><p id="mfSectionSub"></p></div>';
    const tabs=root.querySelector(':scope>.workerTabs');if(tabs)tabs.after(hdr);else root.prepend(hdr);
    document.getElementById('mfBackHome').onclick=showEmployeeHome;
  }

  function cleanEmployeePanels(){
    buildEmployeeContactPanel();buildEmployeeHoursPanel();
    const schedule=document.getElementById('scheduleWorker');if(schedule&&!document.getElementById('mfPublishedSchedule'))schedule.innerHTML='<article class="card mfCurrentSchedule" id="mfPublishedSchedule"><h2>הסידור שלי</h2><div id="mfPublishedScheduleBody"><small>טוען…</small></div></article>';
  }

  function buildEmployeeContactPanel(){
    const p=document.getElementById('contact');if(!p)return;
    if(document.getElementById('mfContactPanel'))return;
    p.innerHTML=`<div id="mfContactPanel"><div class="mfReportGrid"><article class="card" id="mfShortageCard"><h2>דיווח חוסר / תקלה</h2><div class="form"><label>מה קרה?<select id="mfReportType"><option value="shortage">חוסר בחנות</option><option value="contact">הערה / בקשה / רעיון</option></select></label><label>נושא<input id="mfReportTitle" placeholder="לדוגמה: שקיות בינוניות"></label><label>פירוט<textarea id="mfReportBody" rows="4" placeholder="מה חסר, איפה ומה חשוב לדעת?"></textarea></label><button class="btn primary" id="mfSendReport">שליחה למנהל</button></div></article><article class="card"><h2>הפניות שלי</h2><p>כאן רואים אם המנהל צפה, ענה או סיים טיפול.</p><button class="btn secondary" id="mfRefreshReports">רענון</button><div id="mfMyReports" class="mfMessages"><small>טוען…</small></div></article></div></div>`;
    document.getElementById('mfSendReport').onclick=submitEmployeeReportFinal;document.getElementById('mfRefreshReports').onclick=loadEmployeeReportsFinal;
  }

  function buildEmployeeHoursPanel(){
    const p=document.getElementById('hours');if(!p)return;
    if(document.getElementById('mfHoursPanel'))return;
    p.innerHTML=`<div id="mfHoursPanel"><article class="card" id="mfEmployeeDocumentsCard"><h2>תלושים ודוחות</h2><div class="truth"><b>פרטי ומאובטח.</b><br>רק המסמכים ששויכו אלייך מופיעים כאן.</div><div id="mfEmployeeDocuments"><small>טוען…</small></div></article><article class="card" id="mfEmployeePayrollCard"><h2>שעות ובונוסים</h2><p>נתונים שנשמרו עבורך במערכת. התלוש הרשמי הוא הקובע.</p><div id="mfEmployeePayroll"><small>טוען…</small></div></article><article class="card"><h2>תיקון / בירור שעות</h2><p>יש בעיה בדוח הנוכחות? שלחי פירוט למנהל לבדיקה.</p><div class="form"><label>נושא<input id="mfHoursIssueTitle" placeholder="לדוגמה: חסרה יציאה ביום שני"></label><label>פירוט<textarea id="mfHoursIssueBody" rows="3" placeholder="תאריך, שעות וכל מידע שיעזור לבדיקה"></textarea></label><button class="btn secondary" id="mfSendHoursIssue">שליחת בירור שעות</button></div></article></div>`;
    document.getElementById('mfSendHoursIssue').onclick=submitHoursIssue;
  }

  async function submitEmployeeReportFinal(){
    if(!isEmployee())return;const type=document.getElementById('mfReportType').value,title=document.getElementById('mfReportTitle').value.trim(),body=document.getElementById('mfReportBody').value.trim();if(!title&&!body){toast?.('יש לרשום נושא או פירוט');return}
    const {error}=await supabaseClient.rpc('employee_submit_report',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code,p_report_type:type,p_title:title,p_body:body,p_payload:{source:'employee_portal_final'}});if(error){console.error(error);toast?.('שליחת הדיווח נכשלה');return}document.getElementById('mfReportTitle').value='';document.getElementById('mfReportBody').value='';toast?.('הדיווח נשלח למנהל');await loadEmployeeReportsFinal();
  }
  async function submitHoursIssue(){
    const title=document.getElementById('mfHoursIssueTitle').value.trim(),body=document.getElementById('mfHoursIssueBody').value.trim();if(!title&&!body){toast?.('יש לפרט את הבעיה');return}
    const {error}=await supabaseClient.rpc('employee_submit_report',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code,p_report_type:'hours',p_title:title||'בירור שעות',p_body:body,p_payload:{source:'employee_portal_final'}});if(error){toast?.('שליחת הבירור נכשלה');return}document.getElementById('mfHoursIssueTitle').value='';document.getElementById('mfHoursIssueBody').value='';toast?.('הבירור נשלח למנהל');
  }
  const reportStatus=r=>r.archived_at?'טופל':r.manager_reply_at?'נענתה':r.viewed_at?'נצפתה':'נשלחה';
  async function loadEmployeeReportsFinal(){
    const box=document.getElementById('mfMyReports');if(!box||!isEmployee())return;box.innerHTML='<small>טוען…</small>';const {data,error}=await supabaseClient.rpc('employee_get_reports_v2',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code});if(error){box.innerHTML='<small>טעינת הפניות נכשלה.</small>';return}const rows=data||[];box.innerHTML=rows.length?rows.map(r=>`<div class="mfMessage ${r.archived_at?'archived':''}"><div class="mfMessageHead"><div><b>${esc(r.title||'פנייה')}</b><small>${new Date(r.created_at).toLocaleString('he-IL')}</small></div><span class="mfStatus ${r.manager_reply_at||r.archived_at?'ok':'wait'}">${esc(reportStatus(r))}</span></div><p>${esc(r.body||'').replace(/\n/g,'<br>')}</p>${r.manager_note?`<div class="mfReply"><b>תגובת המנהל</b><br>${esc(r.manager_note).replace(/\n/g,'<br>')}</div>`:''}</div>`).join(''):'<div class="mfEmpty">עדיין לא נשלחו פניות.</div>';
  }

  async function loadCurrentPublishedSchedule(){
    const box=document.getElementById('mfPublishedScheduleBody');if(!box||!isEmployee())return;box.innerHTML='<small>טוען את הסידור…</small>';
    const {data,error}=await supabaseClient.rpc('employee_get_current_schedule_v2',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code});if(error){console.error(error);box.innerHTML='<div class="mfEmpty">לא הצלחנו לטעון את הסידור כרגע.</div>';return}const x=Array.isArray(data)?data[0]:data;if(!x?.published){box.innerHTML='<div class="mfEmpty">עדיין לא פורסם סידור עבודה לשבוע הנוכחי.</div>';return}const rows=x.assignments||[];box.innerHTML=`<p><b>שבוע ${esc(fmtWeek(x.week_start))}</b></p>${rows.length?rows.map(r=>`<div class="item"><div class="meta"><b>${esc(labelSlot(r.slot_key))}</b><small>${esc(r.role_name||'מכירה')}</small></div><span class="badge ok">משובצת</span></div>`).join(''):'<div class="mfEmpty">הסידור פורסם, אך אין לך משמרות משובצות בשבוע הזה.</div>'}${x.manager_note?`<div class="truth" style="margin-top:10px"><b>הודעת מנהל</b><br>${esc(x.manager_note)}</div>`:''}`;
    const meta=document.getElementById('mfScheduleMeta');if(meta)meta.textContent=`פורסם לשבוע ${fmtWeek(x.week_start)}`;
  }

  function openEmployeeSection(id,focus=''){
    const root=document.getElementById('worker');if(!root)return;document.getElementById('mfHome')?.classList.remove('active');document.getElementById('mfSectionHeader')?.classList.add('active');root.querySelectorAll(':scope>.panel').forEach(p=>{p.classList.add('mfPanelClean');p.classList.toggle('active',p.id===id)});
    const title=document.getElementById('mfSectionTitle'),sub=document.getElementById('mfSectionSub');
    const map={scheduleWorker:['צפייה בסידור עבודה','המשמרות שפורסמו עבורך לשבוע הנוכחי'],availability:['הגשת משמרות',`לשבוע ${workerTargetWeek?fmtWeek(workerTargetWeek):'הבא'}`],contact:['דיווחים ופניות','חוסרים, תקלות, בקשות ותגובות מנהל'],hours:['הנתונים שלי','תלושים, דוחות שעות, שעות ובונוסים']};if(title)title.textContent=map[id]?.[0]||'האזור שלי';if(sub)sub.textContent=map[id]?.[1]||'';
    if(id==='scheduleWorker')loadCurrentPublishedSchedule();if(id==='contact')loadEmployeeReportsFinal();if(id==='hours'){window.loadEmployeePayrollFinal?.();window.loadEmployeeDocumentsFinal?.()}
    if(focus)setTimeout(()=>{const el=focus==='shortage'?document.getElementById('mfShortageCard'):focus==='messages'?document.getElementById('mfMyReports'):focus==='documents'?document.getElementById('mfEmployeeDocumentsCard'):focus==='payroll'?document.getElementById('mfEmployeePayrollCard'):null;el?.scrollIntoView({behavior:'smooth',block:'start'})},80);
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function showEmployeeHome(){
    const root=document.getElementById('worker');if(!root)return;root.querySelectorAll(':scope>.panel').forEach(p=>{p.classList.add('mfPanelClean');p.classList.remove('active')});document.getElementById('mfSectionHeader')?.classList.remove('active');document.getElementById('mfHome')?.classList.add('active');updateEmployeeHomeMeta();window.scrollTo({top:0,behavior:'smooth'});
  }
  function updateEmployeeHomeMeta(){
    const n=employeeGreeting()+(appSession?.user?.name?`, ${appSession.user.name}`:'');const g=document.getElementById('mfGreeting');if(g)g.textContent=n;const a=document.getElementById('mfAvailabilityMeta');if(a&&workerTargetWeek)a.textContent=`לשבוע ${fmtWeek(workerTargetWeek)}`;loadCurrentPublishedSchedule();
  }
  function initEmployeeUi(){
    if(!isEmployee())return;addStyles();document.body.classList.add('matokEmployeeFinal');buildEmployeeHome();cleanEmployeePanels();showEmployeeHome();loadEmployeeReportsFinal();window.loadEmployeePayrollFinal?.();window.loadEmployeeDocumentsFinal?.();
  }

  let adminState={weekStart:null,week:null,staff:[],assignments:[],availability:[],settings:{}};
  let activeCandidateSlot='';
  function sundayOf(d=new Date()){const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-x.getDay());return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`}
  async function loadAdminFinalData(weekStart){
    if(!isAdmin())return;adminState.weekStart=weekStart||adminState.weekStart||adminWeekStart||sundayOf();adminWeekStart=adminState.weekStart;
    const [{data:staff,error:se},{data:week,error:we},{data:av,error:ae},{data:set,error:xe}]=await Promise.all([
      supabaseClient.from('staff').select('id,full_name,phone,username,role_name,settings,is_active,failed_attempts,locked_until').eq('is_active',true).order('full_name'),
      supabaseClient.from('work_weeks').select('*').eq('week_start',adminState.weekStart).maybeSingle(),
      supabaseClient.rpc('admin_get_week_availability',{p_week_start:adminState.weekStart}),
      supabaseClient.rpc('admin_get_schedule_slot_settings',{p_week_start:adminState.weekStart})
    ]);if(se||we)throw se||we;adminState.staff=staff||[];adminState.week=week||null;adminState.availability=ae?[]:(av||[]);adminState.settings={};(xe?[]:(set||[])).forEach(r=>adminState.settings[r.slot_key]=r);
    if(week){const {data:a,error}=await supabaseClient.from('work_assignments').select('slot_key,staff_id,role_name,status').eq('week_id',week.id);if(error)throw error;adminState.assignments=a||[]}else adminState.assignments=[];
    currentWeekRecord=adminState.week;published=adminState.week?.status==='published';renderAdminScheduleFinal();renderAdminOverviewFinal();renderAdminAvailabilityFinal();
  }
  function assFor(slot){return adminState.assignments.filter(a=>a.slot_key===slot&&a.status==='approved')}
  function staffById(id){return adminState.staff.find(s=>String(s.id)===String(id))}
  function avFor(slot,id){return adminState.availability.find(a=>a.slot_key===slot&&String(a.staff_id)===String(id))?.status||''}
  function cfg(slot){const x=adminState.settings[slot];const base=typeof slotById==='function'?slotById(slot):null;return {required_count:Number(x?.required_count||Math.max(2,assFor(slot).length)),start_time:String(x?.start_time||base?.[2]||(slot.endsWith('-am')?'10:00':slot==='fri'?'09:00':'15:00')).slice(0,5),end_time:String(x?.end_time||base?.[3]||(slot.endsWith('-am')?'15:00':slot==='fri'?'14:00':'20:30')).slice(0,5)}}
  function renderAdminScheduleFinal(){
    const box=document.getElementById('mfAdminScheduleBody');if(!box)return;const status=adminState.week?.status||'availability_open';document.getElementById('mfAdminWeekLabel').textContent=`שבוע ${fmtWeek(adminState.weekStart)}`;document.getElementById('mfAdminScheduleStatus').innerHTML=status==='published'?'<b>הסידור מפורסם ופתוח לעריכת מנהל.</b><br>אפשר להוסיף ולהסיר עובדים בכל רגע; השינוי מתעדכן לעובדים בלי לפרסם מחדש.':'<b>טיוטה פתוחה לעריכה.</b><br>כל הוספה והסרה נשמרת מיד.';
    const pub=document.getElementById('mfPublishBtn');if(pub){pub.disabled=status==='published';pub.textContent=status==='published'?'פורסם במערכת':'פרסום במערכת'}
    box.innerHTML=`<div class="mfScheduleGrid">${DAYS.map(([day,slots])=>`<article class="mfDay"><header><b>${day}</b><span>${slots.length===2?'בוקר · ערב':'שישי'}</span></header>${slots.map(slot=>{const c=cfg(slot),rows=assFor(slot),missing=Math.max(0,c.required_count-rows.length);return `<section class="mfShift"><div class="mfShiftHead"><div><b>${slotName(slot)}</b><small>${esc(c.start_time)}–${esc(c.end_time)}</small></div><span class="badge ${missing?'bad':'ok'}">${rows.length}/${c.required_count}</span></div><div class="mfAvailability">${adminState.availability.filter(a=>a.slot_key===slot&&a.status!=='unavailable').slice(0,8).map(a=>`<span class="mfAvailChip ${a.status}">${esc(a.full_name)}${a.status==='preferred'?' ★':''}</span>`).join('')}</div><div class="mfAssigned">${rows.length?rows.map(a=>{const s=staffById(a.staff_id);return `<div class="mfPerson"><div><b>${esc(s?.full_name||'עובד')}</b><small>${esc(a.role_name||s?.role_name||'מכירה')}</small></div><button class="btn danger" data-mf-remove="${esc(a.staff_id)}" data-mf-slot="${esc(slot)}">−</button></div>`}).join(''):'<div class="mfEmpty">אין עובדים במשמרת</div>'}</div><button class="btn primary" style="width:100%" data-mf-add="${esc(slot)}">+ הוספת עובד</button></section>`}).join('')}</article>`).join('')}</div>`;
    box.querySelectorAll('[data-mf-add]').forEach(b=>b.onclick=()=>openCandidateFinal(b.dataset.mfAdd));box.querySelectorAll('[data-mf-remove]').forEach(b=>b.onclick=()=>setAssignmentFinal(b.dataset.mfSlot,b.dataset.mfRemove,false,b));
  }
  function ensureCandidateModal(){
    let m=document.getElementById('mfCandidateModal');if(m)return m;m=document.createElement('div');m.id='mfCandidateModal';m.className='modal';m.innerHTML='<section style="width:min(650px,100%);max-height:92vh"><button class="close" id="mfCandidateClose">×</button><h2 id="mfCandidateTitle">בחירת עובד</h2><p>זמינות והגדרת יום מוצגות כמידע בלבד. למנהל יש הרשאה לשבץ כל עובד פעיל.</p><div id="mfCandidateList" class="mfCandidateList"></div><button class="btn secondary" id="mfCandidateDone" style="width:100%;margin-top:9px">חזרה לסידור</button></section>';document.body.appendChild(m);document.getElementById('mfCandidateClose').onclick=document.getElementById('mfCandidateDone').onclick=()=>closeModal?.('mfCandidateModal');return m;
  }
  function configuredFor(s,slot){const st=s?.settings||{};if(slot==='fri')return (st.friday||'none')!=='none';const [d,k]=slot.split('-'),idx={sun:0,mon:1,tue:2,wed:3,thu:4}[d];if(k==='am')return st.morning!==false&&(!Array.isArray(st.weekdayMorning)||st.weekdayMorning[idx]!==0);return st.evening!==false&&(!Array.isArray(st.weekdayEvening)||st.weekdayEvening[idx]!==0)}
  function openCandidateFinal(slot){activeCandidateSlot=slot;ensureCandidateModal();document.getElementById('mfCandidateTitle').textContent=`${labelSlot(slot)} · בחירת עובד`;renderCandidateFinal();openModal?.('mfCandidateModal')}
  function renderCandidateFinal(){const list=document.getElementById('mfCandidateList');if(!list)return;const on=new Set(assFor(activeCandidateSlot).map(a=>String(a.staff_id)));list.innerHTML=adminState.staff.map(s=>{const assigned=on.has(String(s.id)),av=avFor(activeCandidateSlot,s.id),configured=configuredFor(s,activeCandidateSlot);let text=av==='unavailable'?'סימנה שלא יכולה — אפשר לשבץ בכל זאת':av==='preferred'?'מעדיפה משמרת זו':av==='available'?'זמינה':!configured?'לא ביום/סוג המשמרת הקבוע — אפשר לשבץ בכל זאת':'לא הוגשה זמינות — אפשר לשבץ';const warn=av==='unavailable'||!configured||!av;return `<div class="mfCandidate ${warn?'warning':''}"><div><b>${esc(s.full_name)}</b><small>${esc(s.role_name||'מכירה')} · ${esc(text)}</small>${warn&&!assigned?'<span class="mfOverride">הרשאת מנהל עוקפת את ההגבלה</span>':''}</div><button class="btn ${assigned?'danger':'primary'}" data-mf-cand="${esc(s.id)}" data-mf-act="${assigned?'remove':'add'}">${assigned?'הסרה':'שיבוץ'}</button></div>`}).join('');list.querySelectorAll('[data-mf-cand]').forEach(b=>b.onclick=()=>setAssignmentFinal(activeCandidateSlot,b.dataset.mfCand,b.dataset.mfAct==='add',b,true))}
  async function setAssignmentFinal(slot,staffId,assigned,btn,fromPicker=false){if(btn)btn.disabled=true;try{const s=staffById(staffId),fn=adminState.week?.status==='published'?'admin_set_published_assignment':'admin_set_assignment_v4',args=fn==='admin_set_published_assignment'?{p_week_start:adminState.weekStart,p_slot_key:slot,p_staff_id:staffId,p_assigned:assigned,p_role_name:s?.role_name||'מכירה'}:{p_week_start:adminState.weekStart,p_slot_key:slot,p_staff_id:staffId,p_role_name:s?.role_name||'מכירה',p_assigned:assigned};const {error}=await supabaseClient.rpc(fn,args);if(error)throw error;await loadAdminFinalData(adminState.weekStart);if(fromPicker)renderCandidateFinal();toast?.(`${s?.full_name||'העובד'} ${assigned?'נוסף':'הוסר'} מהסידור`)}catch(e){console.error(e);toast?.('השינוי לא נשמר: '+(e?.message||'שגיאה'))}finally{if(btn)btn.disabled=false}}
  async function publishFinal(){if(adminState.week?.status==='published')return;if(!adminState.assignments.length){toast?.('אי אפשר לפרסם סידור ריק');return}if(!confirm(`לפרסם את הסידור לשבוע ${fmtWeek(adminState.weekStart)}?`))return;const note=document.getElementById('mfManagerNote')?.value||'';const payload=adminState.assignments.map(a=>({slot_key:a.slot_key,staff_id:a.staff_id,role_name:a.role_name||'מכירה',status:a.status||'approved'}));const {error}=await supabaseClient.rpc('admin_publish_schedule_v2',{p_week_start:adminState.weekStart,p_manager_note:note,p_assignments:payload});if(error){console.error(error);toast?.('הפרסום נכשל: '+error.message);return}await loadAdminFinalData(adminState.weekStart);toast?.('הסידור פורסם');openTeamWhatsAppFinal()}
  async function openSummaryFinal(){let m=document.getElementById('mfSummaryModal');if(!m){m=document.createElement('div');m.id='mfSummaryModal';m.className='modal';m.innerHTML='<section style="width:min(850px,100%)"><button class="close" onclick="closeModal(\'mfSummaryModal\')">×</button><h2>סיכום עובדים לשבוע</h2><div id="mfSummaryBody" class="mfSummary"><small>טוען…</small></div></section>';document.body.appendChild(m)}openModal?.('mfSummaryModal');const box=document.getElementById('mfSummaryBody');const {data,error}=await supabaseClient.rpc('admin_get_week_staff_summary_v2',{p_week_start:adminState.weekStart});if(error){box.innerHTML='<div class="mfEmpty">טעינת הסיכום נכשלה.</div>';return}box.innerHTML=`<table><thead><tr><th>עובד/ת</th><th>יכלה לתת</th><th>נתנה</th><th>העדיפה</th><th>קיבלה</th><th>חובה</th></tr></thead><tbody>${(data||[]).map(r=>`<tr><td><b>${esc(r.full_name)}</b>${r.submitted_at?'':' · לא הגישה'}</td><td>${r.allowed_count}</td><td>${r.offered_count}</td><td>${r.preferred_count}</td><td>${r.assigned_count}</td><td>${r.weekly_required}</td></tr>`).join('')}</tbody></table>`}
  function ensureWaModal(){let m=document.getElementById('mfWaModal');if(m)return m;m=document.createElement('div');m.id='mfWaModal';m.className='modal';m.innerHTML='<section><button class="close" onclick="closeModal(\'mfWaModal\')">×</button><h2>הודעה לצוות ב-WhatsApp</h2><p>ההודעות מוכנות מראש. WhatsApp דורש לחיצה על שליחה בכל שיחה.</p><div id="mfWaList"></div></section>';document.body.appendChild(m);return m}
  function openTeamWhatsAppFinal(){if(adminState.week?.status!=='published'){toast?.('יש לפרסם קודם את הסידור');return}ensureWaModal();const list=document.getElementById('mfWaList');list.innerHTML=adminState.staff.filter(s=>s.phone).map(s=>`<div class="mfWaRow"><span>${esc(s.full_name)}</span><button class="btn secondary" data-mf-wa="${esc(s.id)}">פתח הודעה</button></div>`).join('');list.querySelectorAll('[data-mf-wa]').forEach(b=>b.onclick=()=>{const s=staffById(b.dataset.mfWa);const msg=`היי ${s.full_name},\nסידור העבודה לשבוע ${fmtWeek(adminState.weekStart)} פורסם/עודכן במערכת MATOK.\n\nלצפייה בסידור:\nhttps://voluble-marigold-95c410.netlify.app/?login=employee`;window.open(`https://wa.me/${phone972(s.phone)}?text=${encodeURIComponent(msg)}`,'_blank')});openModal?.('mfWaModal')}
  async function renderAdminAvailabilityFinal(){const box=document.getElementById('mfAvailabilityAdmin');if(!box)return;const rows=adminState.availability||[];const by=new Map();rows.forEach(r=>{if(!by.has(r.staff_id))by.set(r.staff_id,{name:r.full_name,note:r.general_note,submitted:r.submitted_at,items:[]});by.get(r.staff_id).items.push(r)});box.innerHTML=by.size?[...by.values()].map(x=>`<div class="mfMessage"><div class="mfMessageHead"><b>${esc(x.name)}</b><span class="mfStatus ok">הוגש</span></div><div class="mfAvailability">${x.items.map(a=>`<span class="mfAvailChip ${a.status}">${esc(labelSlot(a.slot_key))} · ${a.status==='preferred'?'מעדיפה':a.status==='available'?'זמינה':'לא יכולה'}</span>`).join('')}</div>${x.note?`<p>${esc(x.note)}</p>`:''}</div>`).join(''):'<div class="mfEmpty">אין הגשות זמינות לשבוע הזה.</div>'}
  async function saveSlotSettingsFinal(){const rows=[...document.querySelectorAll('[data-mf-setting]')];for(const row of rows){const slot=row.dataset.mfSetting,required=Number(row.querySelector('[data-f="required"]').value||0),start=row.querySelector('[data-f="start"]').value,end=row.querySelector('[data-f="end"]').value;const {error}=await supabaseClient.rpc('admin_save_schedule_slot_setting',{p_week_start:adminState.weekStart,p_slot_key:slot,p_required_count:required,p_start_time:start,p_end_time:end});if(error){toast?.('שמירת הגדרות נכשלה');return}}toast?.('הגדרות המשמרות נשמרו');await loadAdminFinalData(adminState.weekStart)}
  function openSettingsFinal(){let m=document.getElementById('mfSettingsModal');if(!m){m=document.createElement('div');m.id='mfSettingsModal';m.className='modal';m.innerHTML='<section style="width:min(800px,100%);max-height:92vh"><button class="close" onclick="closeModal(\'mfSettingsModal\')">×</button><h2>שעות וכוח אדם</h2><div id="mfSettingsList"></div><button class="btn primary" id="mfSaveSettings" style="width:100%;margin-top:10px">שמירה</button></section>';document.body.appendChild(m);document.getElementById('mfSaveSettings').onclick=saveSlotSettingsFinal}const box=document.getElementById('mfSettingsList');box.innerHTML=SLOT_ORDER.map(slot=>{const c=cfg(slot);return `<div class="settingRow" data-mf-setting="${slot}"><b>${esc(labelSlot(slot))}</b><div class="formgrid" style="margin-top:7px"><label>התחלה<input data-f="start" type="time" value="${esc(c.start_time)}"></label><label>סיום<input data-f="end" type="time" value="${esc(c.end_time)}"></label><label>נדרש<input data-f="required" type="number" min="0" value="${c.required_count}"></label></div></div>`}).join('');openModal?.('mfSettingsModal')}
  function changeAdminWeekFinal(days){const d=new Date(adminState.weekStart+'T12:00:00');d.setDate(d.getDate()+days);loadAdminFinalData(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)}

  function buildAdminSchedulePanel(){const panel=document.getElementById('adminSchedule');if(!panel)return;panel.innerHTML=`<article class="card"><div class="employeeHead"><div><h2>סידור עבודה</h2><small id="mfAdminWeekLabel">טוען…</small></div><div class="actions"><button class="btn secondary" id="mfPrevWeek">שבוע קודם</button><button class="btn secondary" id="mfNextWeek">שבוע הבא</button></div></div><div id="mfAdminScheduleStatus" class="mfScheduleState"></div><div class="mfScheduleToolbar"><button class="btn primary" id="mfPublishBtn">פרסום במערכת</button><button class="btn secondary" id="mfSummaryBtn">סיכום עובדים</button><button class="btn secondary" id="mfWhatsAppBtn">WhatsApp לצוות</button><button class="btn secondary" id="mfSettingsBtn">שעות וכוח אדם</button></div><label>הודעה לצוות<textarea id="mfManagerNote" rows="2" placeholder="הודעה שתופיע לעובדים"></textarea></label></article><article class="card"><div class="employeeHead"><div><h2>זמינות מהעובדים</h2><small>זמינות היא מידע למנהל ולא מגבלה על השיבוץ.</small></div></div><div id="mfAvailabilityAdmin"></div></article><div id="mfAdminScheduleBody"></div>`;document.getElementById('mfPrevWeek').onclick=()=>changeAdminWeekFinal(-7);document.getElementById('mfNextWeek').onclick=()=>changeAdminWeekFinal(7);document.getElementById('mfPublishBtn').onclick=publishFinal;document.getElementById('mfSummaryBtn').onclick=openSummaryFinal;document.getElementById('mfWhatsAppBtn').onclick=openTeamWhatsAppFinal;document.getElementById('mfSettingsBtn').onclick=openSettingsFinal}
  async function renderAdminOverviewFinal(){const sc=document.getElementById('overviewStaffCount'),sub=document.getElementById('overviewSubmittedCount'),mis=document.getElementById('overviewMissingCount'),wl=document.getElementById('overviewWeekLabel'),box=document.getElementById('overviewAssignments');if(sc)sc.textContent=adminState.staff.length;if(sub){const ids=new Set(adminState.availability.filter(x=>x.submitted_at).map(x=>x.staff_id));sub.textContent=adminState.week?.status==='published'?0:ids.size}if(wl)wl.textContent=fmtWeek(adminState.weekStart);if(mis)mis.textContent=SLOT_ORDER.filter(s=>assFor(s).length<cfg(s).required_count).length;if(box)box.innerHTML=DAYS.map(([day,slots])=>`<div class="card"><b>${day}</b>${slots.map(s=>`<small style="display:block;margin-top:5px">${slotName(s)}: ${assFor(s).map(a=>staffById(a.staff_id)?.full_name).filter(Boolean).join(', ')||'—'}</small>`).join('')}</div>`).join('')}

  function buildAdminRequestsFinal(){const p=document.getElementById('requests');if(!p)return;p.innerHTML='<article class="card mfAdminRequests"><div class="employeeHead"><div><h2>פניות, רעיונות וחוסרים מהצוות</h2><small>רק פניות אמיתיות מעובדים פעילים.</small></div><button class="btn secondary" id="mfRefreshAdminReports">רענון</button></div><div id="mfAdminReports"><small>טוען…</small></div><div class="mfArchive"><button class="btn secondary" id="mfToggleArchive">הצגת ארכיון</button><div id="mfAdminArchive" style="display:none"></div></div></article>';document.getElementById('mfRefreshAdminReports').onclick=loadAdminReportsFinal;document.getElementById('mfToggleArchive').onclick=async()=>{const b=document.getElementById('mfAdminArchive');b.style.display=b.style.display==='none'?'block':'none';if(b.style.display==='block')await loadAdminArchiveFinal()}}
  function adminReportHtml(r){return `<div class="mfAdminMessage ${!r.viewed_at?'unread':''}"><div class="mfMessageHead"><div><b>${esc(r.full_name)} · ${esc(r.title||r.report_type)}</b><small>${new Date(r.created_at).toLocaleString('he-IL')}</small></div><span class="mfStatus ${r.manager_reply_at?'ok':'wait'}">${esc(reportStatus(r))}</span></div><p>${esc(r.body||'').replace(/\n/g,'<br>')}</p>${r.manager_note?`<div class="mfReply"><b>תגובה שנשלחה</b><br>${esc(r.manager_note).replace(/\n/g,'<br>')}</div>`:''}<div class="mfAdminActions">${r.viewed_at?'':`<button class="btn secondary" data-mf-view="${r.id}">סמן שצפיתי</button>`}<textarea data-mf-reply="${r.id}" placeholder="תגובה לעובד…">${esc(r.manager_note||'')}</textarea><div class="actions"><button class="btn primary" data-mf-send="${r.id}">שליחת תגובה</button><button class="btn secondary" data-mf-archive="${r.id}">טופל → ארכיון</button></div></div></div>`}
  function bindAdminReportActions(root){root.querySelectorAll('[data-mf-view]').forEach(b=>b.onclick=async()=>{const {error}=await supabaseClient.rpc('admin_mark_staff_report_viewed',{p_report_id:b.dataset.mfView});if(!error)await loadAdminReportsFinal()});root.querySelectorAll('[data-mf-send]').forEach(b=>b.onclick=async()=>{const id=b.dataset.mfSend,reply=root.querySelector(`[data-mf-reply="${id}"]`)?.value.trim();if(!reply){toast?.('יש לכתוב תגובה');return}const {error}=await supabaseClient.rpc('admin_reply_staff_report',{p_report_id:id,p_reply:reply});if(error)toast?.('שליחת התגובה נכשלה');else{toast?.('התגובה נשמרה');await loadAdminReportsFinal()}});root.querySelectorAll('[data-mf-archive]').forEach(b=>b.onclick=async()=>{const id=b.dataset.mfArchive,reply=root.querySelector(`[data-mf-reply="${id}"]`)?.value.trim()||null;const {error}=await supabaseClient.rpc('admin_archive_staff_report',{p_report_id:id,p_final_reply:reply});if(error)toast?.('העברה לארכיון נכשלה');else await loadAdminReportsFinal()})}
  async function loadAdminReportsFinal(){const box=document.getElementById('mfAdminReports');if(!box||!isAdmin())return;const {data,error}=await supabaseClient.rpc('admin_get_staff_reports_v2',{p_include_archived:false});if(error){box.innerHTML='<div class="mfEmpty">טעינת הפניות נכשלה.</div>';return}box.innerHTML=(data||[]).length?(data||[]).map(adminReportHtml).join(''):'<div class="mfEmpty">אין כרגע פניות פתוחות.</div>';bindAdminReportActions(box)}
  async function loadAdminArchiveFinal(){const box=document.getElementById('mfAdminArchive');if(!box)return;const {data,error}=await supabaseClient.rpc('admin_get_staff_reports_v2',{p_include_archived:true});if(error){box.innerHTML='<div class="mfEmpty">טעינת הארכיון נכשלה.</div>';return}box.innerHTML=(data||[]).length?(data||[]).map(r=>`<div class="mfMessage archived"><b>${esc(r.full_name)} · ${esc(r.title||r.report_type)}</b><p>${esc(r.body||'')}</p>${r.manager_note?`<div class="mfReply">${esc(r.manager_note)}</div>`:''}</div>`).join(''):'<div class="mfEmpty">הארכיון ריק.</div>'}
  function buildAdminAttendanceFinal(){const p=document.getElementById('attendance');if(!p)return;p.innerHTML='<article class="card"><div class="employeeHead"><div><h2>בירורי ותיקוני שעות</h2><small>רק דיווחים אמיתיים שהעובדים שלחו.</small></div><button class="btn secondary" id="mfRefreshHoursReports">רענון</button></div><div id="mfHoursReports"><small>טוען…</small></div></article>';document.getElementById('mfRefreshHoursReports').onclick=loadHoursReportsFinal}
  async function loadHoursReportsFinal(){const box=document.getElementById('mfHoursReports');if(!box||!isAdmin())return;const {data,error}=await supabaseClient.rpc('admin_get_staff_reports_v2',{p_include_archived:false});if(error){box.innerHTML='<div class="mfEmpty">טעינת הדיווחים נכשלה.</div>';return}const rows=(data||[]).filter(r=>r.report_type==='hours');box.innerHTML=rows.length?rows.map(r=>`<div class="mfMessage ${!r.viewed_at?'unread':''}"><b>${esc(r.full_name)} · ${esc(r.title||'בירור שעות')}</b><p>${esc(r.body||'')}</p><button class="btn secondary" onclick="document.querySelector('.adminTabs [data-target=requests]')?.click()">טיפול בפנייה</button></div>`).join(''):'<div class="mfEmpty">אין כרגע בירורי שעות פתוחים.</div>'}

  function initAdminFinal(){if(!isAdmin())return;addStyles();buildAdminSchedulePanel();buildAdminRequestsFinal();buildAdminAttendanceFinal();const start=adminWeekStart||sundayOf();loadAdminFinalData(start).then(()=>{loadAdminReportsFinal();loadHoursReportsFinal();window.initPayrollAdminFinal?.()}).catch(e=>{console.error('admin final init',e);toast?.('טעינת נתוני המנהל נכשלה')});bindFinalAdminTabs()}
  function bindFinalAdminTabs(){document.querySelectorAll('.adminTabs button').forEach(btn=>{if(btn.dataset.mfBound)return;btn.dataset.mfBound='1';btn.addEventListener('click',()=>{setTimeout(()=>{if(btn.dataset.target==='adminSchedule'){loadAdminFinalData(adminState.weekStart||adminWeekStart||sundayOf())}if(btn.dataset.target==='requests')loadAdminReportsFinal();if(btn.dataset.target==='attendance')loadHoursReportsFinal();if(btn.dataset.target==='payrollFinal')window.initPayrollAdminFinal?.()},0)})})}
  const originalLoadAdmin=typeof loadAdminData==='function'?loadAdminData:null;
  if(originalLoadAdmin){loadAdminData=async function(...args){const out=await originalLoadAdmin.apply(this,args);initAdminFinal();return out}}

  window.submitAvailability=async function(){
    if(!isEmployee()||!workerTargetWeek){toast?.('יש להיכנס כעובד/ת');return}
    const allowed=typeof workerAllowedKeys==='function'?workerAllowedKeys():Object.keys(states||{});
    const missing=allowed.filter(k=>!states[k]);if(missing.length){toast?.('יש לבחור מצב לכל המשמרות המותרות');return}
    const payload={};allowed.forEach(k=>payload[k]=states[k]);
    const note=document.querySelector('#availability textarea')?.value.trim()||'';
    const btn=document.querySelector('.workerFinishBtn');if(btn){btn.disabled=true;btn.textContent='שומרת…'}
    try{
      const {error}=await supabaseClient.rpc('employee_save_availability',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code,p_week_start:workerTargetWeek,p_states:payload,p_note:note});
      if(error)throw error;toast?.('הזמינות נשלחה למנהל');showEmployeeHome();
    }catch(e){console.error('save availability',e);toast?.('שמירת הזמינות נכשלה. נסי שוב.')}
    finally{if(btn){btn.disabled=false;btn.innerHTML='סיימתי — שלחי למנהל<small>סיום ונעילת המשמרות שבחרת</small>'}}
  };

  addStyles();
  document.addEventListener('DOMContentLoaded',async()=>{
    await sleep(80);
    if(!appSession?.type)await restoreEmployeeSafely();
    if(isEmployee())initEmployeeUi();
    if(isAdmin())initAdminFinal();
  });
  setTimeout(()=>{if(isEmployee())initEmployeeUi();if(isAdmin())initAdminFinal()},1200);
  window.loadEmployeePortalFinal=loadEmployeePortalFinal;window.initEmployeeUi=initEmployeeUi;window.showEmployeeHome=showEmployeeHome;window.loadEmployeeReportsFinal=loadEmployeeReportsFinal;window.loadCurrentPublishedSchedule=loadCurrentPublishedSchedule;window.initAdminFinal=initAdminFinal;window.loadAdminFinalData=loadAdminFinalData;
})();