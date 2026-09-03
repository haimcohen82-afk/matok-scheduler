(() => {
  'use strict';
  const VERSION='20260902-final-access-4';
  const EMPLOYEE_LINK='https://voluble-marigold-95c410.netlify.app/?login=employee';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const isAdmin=()=>{try{return appSession?.type==='admin'}catch(_){return false}};
  let handledOpenIntent='';

  function phone972(v){
    let d=String(v||'').replace(/\D/g,'');
    if(d.startsWith('972'))return d;
    if(d.startsWith('0'))return '972'+d.slice(1);
    return d;
  }

  function keepAuthenticatedGateClosed(){
    try{
      if(!appSession?.type) return;
      const gate=document.getElementById('authGate');if(gate)gate.classList.add('hidden');
      const bar=document.getElementById('sessionBar');if(bar)bar.style.display='block';
      const name=document.getElementById('sessionName');if(name&&!name.textContent)name.textContent=appSession.user?.name||'';
    }catch(_){ }
  }

  function params(){
    try{return new URLSearchParams(location.search)}catch(_){return new URLSearchParams()}
  }

  function routeLoginPane(){
    try{
      if(appSession?.type) return;
      const q=params().get('login');
      if(q==='admin') window.showAuthPane?.('admin');
      if(q==='employee') window.showAuthPane?.('employee');
    }catch(_){ }
  }

  function openAdminPanel(target,sub=''){
    const tab=document.querySelector(`.adminTabs [data-target="${target}"]`);
    if(!tab)return false;
    tab.click();
    if(target==='payrollFinal'&&sub){
      setTimeout(()=>{
        const btn=document.querySelector(`#payrollFinal [data-mp="${sub}"]`);
        btn?.click();
        document.getElementById('payrollFinal')?.scrollIntoView({behavior:'smooth',block:'start'});
      },120);
    }else{
      setTimeout(()=>document.getElementById(target)?.scrollIntoView({behavior:'smooth',block:'start'}),80);
    }
    return true;
  }

  function openAdminIntent(){
    if(!isAdmin())return;
    const intent=params().get('open')||'';
    if(!intent||handledOpenIntent===intent)return;
    const actions={
      payroll:()=>openAdminPanel('payrollFinal','pdf'),
      'payroll-hours':()=>openAdminPanel('payrollFinal','hours'),
      schedule:()=>openAdminPanel('adminSchedule'),
      employees:()=>openAdminPanel('employees'),
      requests:()=>openAdminPanel('requests')
    };
    const fn=actions[intent];
    if(!fn)return;
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(fn()||tries>30){
        clearInterval(timer);
        if(tries<=30)handledOpenIntent=intent;
      }
    },120);
  }

  function ensureModal(){
    let m=document.getElementById('mfLoginStatusModal');
    if(m)return m;
    m=document.createElement('div');m.id='mfLoginStatusModal';m.className='modal';
    m.innerHTML='<section style="width:min(820px,100%);max-height:92vh"><button class="close" id="mfLoginStatusClose">×</button><div class="employeeHead"><div><h2>מצב כניסות עובדים</h2><small>בדיקת נעילות ושמות משתמש. אפשר לנקות ניסיונות שגויים או להפיק קוד חדש ולשלוח לעובד ב-WhatsApp.</small></div><button class="btn secondary" id="mfRefreshLoginStatus">רענון</button></div><div id="mfLoginStatusBody"><small>טוען…</small></div></section>';
    document.body.appendChild(m);
    document.getElementById('mfLoginStatusClose').onclick=()=>closeModal?.('mfLoginStatusModal');
    document.getElementById('mfRefreshLoginStatus').onclick=loadStatuses;
    return m;
  }

  async function clearLogin(staffId){
    const {error}=await supabaseClient.rpc('admin_clear_staff_login_lock',{p_staff_id:staffId});
    if(error){toast?.('ניקוי הנעילה נכשל');return false}
    toast?.('ניסיונות הכניסה נוקו');
    return true;
  }

  async function resetAndShare(staffId){
    if(!confirm('ליצור לעובד קוד PIN חדש? הקוד הקודם יפסיק לעבוד מיד.'))return;
    const popup=window.open('about:blank','_blank');
    try{
      const {data,error}=await supabaseClient.rpc('admin_issue_staff_credentials_v2',{p_staff_id:staffId});
      if(error||!data?.length)throw error||new Error('credentials_failed');
      const c=data[0];
      const text=`שם משתמש: ${c.username}\nקוד PIN: ${c.pin}`;
      const msg=`היי ${c.full_name},\n\nאלו פרטי הכניסה המעודכנים שלך למערכת MATOK:\n\nשם משתמש: ${c.username}\nקוד PIN: ${c.pin}\n\nכניסה למערכת:\n${EMPLOYEE_LINK}\n\nהקוד אישי ואין להעביר אותו לאחרים.`;
      const phone=phone972(c.phone);
      if(phone&&popup){
        popup.location.href=`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
        toast?.('נוצר קוד חדש ונפתחה הודעת WhatsApp');
      }else{
        if(popup)popup.close();
        try{await navigator.clipboard.writeText(text)}catch(_){}
        alert(`פרטי כניסה חדשים ל${c.full_name}\n\n${text}\n\nהפרטים הועתקו ללוח.`);
      }
      await loadStatuses();
    }catch(e){
      if(popup)popup.close();
      console.error('reset credentials',e);
      toast?.('יצירת קוד חדש נכשלה');
    }
  }

  async function loadStatuses(){
    const box=document.getElementById('mfLoginStatusBody');if(!box||!isAdmin())return;
    box.innerHTML='<small>טוען…</small>';
    const {data,error}=await supabaseClient.rpc('admin_get_staff_login_status');
    if(error){console.error(error);box.innerHTML='<div class="mfEmpty">טעינת מצב הכניסות נכשלה.</div>';return}
    const rows=data||[];
    box.innerHTML=rows.length?rows.map(r=>{
      const locked=r.locked_until&&new Date(r.locked_until)>new Date();
      const bad=Number(r.failed_attempts||0);
      const state=locked?'נעול זמנית':bad>0?`${bad} ניסיונות שגויים`:'תקין';
      return `<div class="item"><div class="meta"><b>${esc(r.full_name)}</b><small>שם משתמש: ${esc(r.username||'—')} · ${esc(state)}</small></div><div class="actions">${locked||bad>0?`<button class="btn secondary" data-clear-login="${esc(r.staff_id)}">ניקוי ניסיונות</button>`:''}<button class="btn primary" data-reset-login="${esc(r.staff_id)}">קוד חדש + WhatsApp</button></div></div>`;
    }).join(''):'<div class="mfEmpty">אין עובדים פעילים.</div>';
    box.querySelectorAll('[data-clear-login]').forEach(b=>b.onclick=async()=>{
      b.disabled=true;
      if(await clearLogin(b.dataset.clearLogin))await loadStatuses();else b.disabled=false;
    });
    box.querySelectorAll('[data-reset-login]').forEach(b=>b.onclick=()=>resetAndShare(b.dataset.resetLogin));
  }

  function addAdminEntry(){
    if(!isAdmin())return;
    const panel=document.getElementById('employees');
    const head=panel?.querySelector('.employeeHead');
    if(!head||document.getElementById('mfLoginStatusBtn'))return;
    const current=head.querySelector('.btn.primary');
    const wrap=document.createElement('div');wrap.className='actions';
    const b=document.createElement('button');b.id='mfLoginStatusBtn';b.type='button';b.className='btn secondary';b.textContent='מצב כניסות';b.onclick=()=>{ensureModal();openModal?.('mfLoginStatusModal');loadStatuses()};
    if(current){current.before(wrap);wrap.appendChild(b);wrap.appendChild(current)}else{wrap.appendChild(b);head.appendChild(wrap)}
  }

  function enforce(){
    routeLoginPane();
    keepAuthenticatedGateClosed();
    addAdminEntry();
    openAdminIntent();
    mcAccessEnforce();
  }

  let timer=null;
  const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enforce,45)});
  observer.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(enforce,100),{once:true});else setTimeout(enforce,80);

  window.openAdminIntent=openAdminIntent;

  // MATOK_ACCESS_ANALYTICS_V1
  let mcPortalSessionId='',mcHeartbeatTimer=null,mcAccessCache=null;
  const mcFmtDT=v=>{try{return v?new Date(v).toLocaleString('he-IL',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'—'}catch(_){return '—'}};
  const mcFmtDur=v=>{const s=Math.max(0,Number(v||0)),h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h?h+' ש׳ '+m+' דק׳':m+' דק׳'};
  async function mcStartPortalSession(){
    if(appSession?.type!=='employee'||mcPortalSessionId)return;
    try{
      const r=await supabaseClient.rpc('employee_start_portal_session',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code});
      if(r.error)throw r.error;mcPortalSessionId=String(r.data||'');
      clearInterval(mcHeartbeatTimer);mcHeartbeatTimer=setInterval(mcHeartbeat,60000);
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)mcHeartbeat()});
      window.addEventListener('pagehide',mcEndPortalSession,{once:true});
    }catch(e){console.error('portal analytics start',e)}
  }
  async function mcHeartbeat(){
    if(!mcPortalSessionId||appSession?.type!=='employee')return;
    try{await supabaseClient.rpc('employee_portal_heartbeat',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code,p_session_id:mcPortalSessionId})}catch(_){}
  }
  function mcEndPortalSession(){
    if(!mcPortalSessionId||appSession?.type!=='employee')return;
    try{fetch(SUPABASE_URL+'/rest/v1/rpc/employee_end_portal_session',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code,p_session_id:mcPortalSessionId})})}catch(_){}
  }
  async function mcLoadEmployeeAccess(){
    if(appSession?.type!=='employee')return null;
    try{
      const r=await supabaseClient.rpc('employee_get_portal_access',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code});
      if(r.error)throw r.error;mcAccessCache=(r.data||[])[0]||{payslips_enabled:true,attendance_enabled:true,bonuses_enabled:true};mcApplyAccess();return mcAccessCache;
    }catch(e){console.error('portal access',e);return null}
  }
  function mcApplyAccess(){
    if(appSession?.type!=='employee'||!mcAccessCache)return;
    const home=document.getElementById('mfHome');if(!home)return;
    const set=(el,blocked)=>{if(!el)return;el.classList.toggle('mcAccessBlocked',blocked);el.dataset.mcAccessBlocked=blocked?'1':'0'};
    set(home.querySelector('.mfAction.docs'),!mcAccessCache.payslips_enabled&&!mcAccessCache.attendance_enabled);
    set(home.querySelector('.mfAction.hours'),!mcAccessCache.attendance_enabled);
    set(home.querySelector('[data-mf-bonus]'),!mcAccessCache.bonuses_enabled);
    if(!document.getElementById('mcAccessStyle')){
      const s=document.createElement('style');s.id='mcAccessStyle';s.textContent='.mcAccessBlocked{opacity:.52!important;filter:grayscale(.25)}.mcAccessBlocked small:after{content:" · הגישה סגורה";color:#8b342d;font-weight:900}.mcControlCards{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:11px 0}.mcControlCard{background:#fff;border:1px solid var(--line);border-radius:15px;padding:13px}.mcAccessRows{display:grid;gap:8px}.mcAccessRow{display:grid;grid-template-columns:minmax(130px,1.4fr) repeat(3,minmax(85px,.7fr)) auto;gap:7px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:9px}.mcAccessRow label{display:flex;gap:5px;align-items:center;font-size:11px;font-weight:800}.mcAccessRow input{width:auto}.mcUsageTable{overflow:auto}.mcUsageTable table{width:100%;border-collapse:collapse;font-size:12px}.mcUsageTable th,.mcUsageTable td{padding:9px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}@media(max-width:720px){.mcControlCards{grid-template-columns:1fr}.mcAccessRow{grid-template-columns:1fr 1fr}.mcAccessRow button{grid-column:1/-1}}';document.head.appendChild(s);
    }
  }
  function mcEnsureAccessModal(){
    let m=document.getElementById('mcAccessModal');if(m)return m;
    m=document.createElement('div');m.id='mcAccessModal';m.className='modal';
    m.innerHTML='<section style="width:min(980px,100%);max-height:94vh"><button class="close" id="mcAccessClose">×</button><div class="employeeHead"><div><h2>הרשאות צפייה בשכר ונוכחות</h2><small>אפשר לעצור או לפתוח גישה לעובד מסוים או לכל העובדים.</small></div><button class="btn secondary" id="mcAccessRefresh">רענון</button></div><div id="mcAccessBody"><small>טוען…</small></div></section>';
    document.body.appendChild(m);document.getElementById('mcAccessClose').onclick=()=>closeModal?.('mcAccessModal');document.getElementById('mcAccessRefresh').onclick=mcLoadAdminAccess;return m;
  }
  async function mcLoadAdminAccess(){
    const box=document.getElementById('mcAccessBody');if(!box||appSession?.type!=='admin')return;box.innerHTML='<small>טוען…</small>';
    const r=await supabaseClient.rpc('admin_get_portal_access_controls');if(r.error){box.innerHTML='<div class="mfEmpty">טעינת ההרשאות נכשלה.</div>';return}
    const rows=r.data||[];if(!rows.length){box.innerHTML='<div class="mfEmpty">אין עובדים פעילים.</div>';return}
    const g=rows[0];
    let html='<div class="mcAccessRows"><div class="mcAccessRow" style="background:#eef9f6;border-right:6px solid var(--teal)"><b>כל העובדים</b><label><input id="mcGP" type="checkbox" '+(g.global_payslips_enabled?'checked':'')+'> תלושים</label><label><input id="mcGA" type="checkbox" '+(g.global_attendance_enabled?'checked':'')+'> נוכחות</label><label><input id="mcGB" type="checkbox" '+(g.global_bonuses_enabled?'checked':'')+'> בונוסים</label><button class="btn primary" id="mcSaveGlobal">שמירה לכולם</button></div>';
    html+=rows.map(x=>'<div class="mcAccessRow"><b>'+esc(x.full_name)+'</b><label><input data-p="'+x.staff_id+'" type="checkbox" '+(x.payslips_enabled?'checked':'')+'> תלושים</label><label><input data-a="'+x.staff_id+'" type="checkbox" '+(x.attendance_enabled?'checked':'')+'> נוכחות</label><label><input data-b="'+x.staff_id+'" type="checkbox" '+(x.bonuses_enabled?'checked':'')+'> בונוסים</label><button class="btn secondary" data-save="'+x.staff_id+'">שמירה</button></div>').join('')+'</div>';
    box.innerHTML=html;
    document.getElementById('mcSaveGlobal').onclick=async()=>{const z=await supabaseClient.rpc('admin_set_global_portal_access',{p_payslips_enabled:document.getElementById('mcGP').checked,p_attendance_enabled:document.getElementById('mcGA').checked,p_bonuses_enabled:document.getElementById('mcGB').checked});toast?.(z.error?'השמירה נכשלה':'הרשאת כל העובדים נשמרה');if(!z.error)mcLoadAdminAccess()};
    box.querySelectorAll('[data-save]').forEach(b=>b.onclick=async()=>{const id=b.dataset.save,z=await supabaseClient.rpc('admin_set_staff_portal_access',{p_staff_id:id,p_payslips_enabled:box.querySelector('[data-p="'+id+'"]').checked,p_attendance_enabled:box.querySelector('[data-a="'+id+'"]').checked,p_bonuses_enabled:box.querySelector('[data-b="'+id+'"]').checked});toast?.(z.error?'השמירה נכשלה':'הרשאת העובד נשמרה')});
  }
  function mcOpenAccess(){mcEnsureAccessModal();openModal?.('mcAccessModal');mcLoadAdminAccess()}
  function mcEnsureUsageModal(){
    let m=document.getElementById('mcUsageModal');if(m)return m;
    m=document.createElement('div');m.id='mcUsageModal';m.className='modal';
    m.innerHTML='<section style="width:min(1000px,100%);max-height:94vh"><button class="close" id="mcUsageClose">×</button><div class="employeeHead"><div><h2>בקרת פעילות עובדים</h2><small>כניסות, זמן שהיה ועדכונים. המדידה מתחילה מהגרסה הזו והלאה.</small></div><div><select id="mcUsageDays" style="width:auto"><option value="7">7 ימים</option><option value="30" selected>30 ימים</option><option value="90">90 ימים</option></select><button class="btn secondary" id="mcUsageRefresh">רענון</button></div></div><div id="mcUsageBody"><small>טוען…</small></div></section>';
    document.body.appendChild(m);document.getElementById('mcUsageClose').onclick=()=>closeModal?.('mcUsageModal');document.getElementById('mcUsageRefresh').onclick=mcLoadUsage;return m;
  }
  async function mcLoadUsage(){
    const box=document.getElementById('mcUsageBody');if(!box||appSession?.type!=='admin')return;const days=Number(document.getElementById('mcUsageDays')?.value||30);box.innerHTML='<small>טוען…</small>';
    const r=await supabaseClient.rpc('admin_employee_usage_summary',{p_days:days});if(r.error){box.innerHTML='<div class="mfEmpty">טעינת הבקרה נכשלה.</div>';return}
    const rows=r.data||[];box.innerHTML='<div class="mcUsageTable"><table><thead><tr><th>עובד</th><th>כניסות</th><th>כניסה אחרונה</th><th>זמן כולל</th><th>ממוצע</th><th>עדכונים</th><th></th></tr></thead><tbody>'+rows.map(x=>'<tr><td><b>'+esc(x.full_name)+'</b></td><td>'+x.sessions_count+'</td><td>'+mcFmtDT(x.last_login)+'</td><td>'+mcFmtDur(x.total_seconds)+'</td><td>'+mcFmtDur(x.average_seconds)+'</td><td>'+x.update_events+'</td><td><button class="btn secondary" data-detail="'+x.staff_id+'">פירוט</button></td></tr>').join('')+'</tbody></table></div>';
    box.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>mcUsageDetail(b.dataset.detail,days));
  }
  async function mcUsageDetail(staffId,days){
    const r=await supabaseClient.rpc('admin_employee_usage_details',{p_staff_id:staffId,p_days:days});if(r.error){toast?.('טעינת הפירוט נכשלה');return}
    let m=document.getElementById('mcUsageDetail');if(!m){m=document.createElement('div');m.id='mcUsageDetail';m.className='modal';m.innerHTML='<section style="width:min(760px,100%);max-height:92vh"><button class="close" id="mcUsageDetailClose">×</button><h2>פירוט פעילות</h2><div id="mcUsageDetailBody"></div></section>';document.body.appendChild(m);document.getElementById('mcUsageDetailClose').onclick=()=>closeModal?.('mcUsageDetail')}
    const x=r.data||{},sessions=x.sessions||[],events=x.events||[],names={session_start:'כניסה למערכת',login_success:'אימות כניסה',availability_submit:'הגשת משמרות',report_submit:'שליחת דיווח',message_reply:'תגובה להודעה',schedule_view:'צפייה בסידור'};
    document.getElementById('mcUsageDetailBody').innerHTML='<h3>כניסות</h3>'+(sessions.length?sessions.map(s=>'<div class="item"><div class="meta"><b>'+mcFmtDT(s.started_at)+'</b><small>שהיה '+mcFmtDur(s.duration_seconds)+' · נראה לאחרונה '+mcFmtDT(s.last_seen_at)+'</small></div></div>').join(''):'<div class="mfEmpty">אין כניסות בתקופה.</div>')+'<h3 style="margin-top:12px">פעולות ועדכונים</h3>'+(events.length?events.map(e=>'<div class="item"><div class="meta"><b>'+esc(names[e.event_type]||e.event_type)+'</b><small>'+mcFmtDT(e.created_at)+'</small></div></div>').join(''):'<div class="mfEmpty">אין פעולות בתקופה.</div>');
    openModal?.('mcUsageDetail');
  }
  function mcOpenUsage(){mcEnsureUsageModal();openModal?.('mcUsageModal');mcLoadUsage()}
  function mcAddAdminControls(){
    if(appSession?.type!=='admin')return;const overview=document.getElementById('overview');if(!overview||document.getElementById('mcControlCards'))return;
    const root=document.createElement('section');root.id='mcControlCards';root.className='mcControlCards';root.innerHTML='<article class="mcControlCard"><h3>גישה לשכר ונוכחות</h3><p>פתיחה או חסימה לעובד מסוים או לכל הצוות.</p><button class="btn primary" id="mcOpenAccess">ניהול הרשאות</button></article><article class="mcControlCard"><h3>בקרת פעילות עובדים</h3><p>כמה פעמים נכנסו, מתי, כמה זמן שהו ומה עדכנו.</p><button class="btn primary" id="mcOpenUsage">פתיחת בקרה</button></article>';
    overview.prepend(root);document.getElementById('mcOpenAccess').onclick=mcOpenAccess;document.getElementById('mcOpenUsage').onclick=mcOpenUsage;
  }
  function mcAccessEnforce(){
    if(appSession?.type==='employee'){mcStartPortalSession();if(!mcAccessCache)mcLoadEmployeeAccess();else mcApplyAccess();const home=document.getElementById('mfHome');home?.querySelectorAll('.mfAction').forEach(a=>{if(a.dataset.mcBlockBound)return;a.dataset.mcBlockBound='1';a.addEventListener('click',e=>{if(a.dataset.mcAccessBlocked==='1'){e.preventDefault();e.stopImmediatePropagation();toast?.('הגישה לאזור הזה סגורה כרגע על ידי המנהל')}},true)})}
    if(appSession?.type==='admin')mcAddAdminControls();
  }
  window.openMatokAccessControl=mcOpenAccess;window.openMatokUsageControl=mcOpenUsage;
})();