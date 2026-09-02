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
  }

  let timer=null;
  const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enforce,45)});
  observer.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(enforce,100),{once:true});else setTimeout(enforce,80);

  window.openAdminIntent=openAdminIntent;
})();