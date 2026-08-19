(() => {
  'use strict';
  const VERSION='20260819-final-access-3';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const isAdmin=()=>{try{return appSession?.type==='admin'}catch(_){return false}};

  function keepAuthenticatedGateClosed(){
    try{
      if(!appSession?.type) return;
      const gate=document.getElementById('authGate');if(gate)gate.classList.add('hidden');
      const bar=document.getElementById('sessionBar');if(bar)bar.style.display='block';
      const name=document.getElementById('sessionName');if(name&&!name.textContent)name.textContent=appSession.user?.name||'';
    }catch(_){ }
  }

  function routeLoginPane(){
    try{
      if(appSession?.type) return;
      const q=new URLSearchParams(location.search).get('login');
      if(q==='admin') window.showAuthPane?.('admin');
      if(q==='employee') window.showAuthPane?.('employee');
    }catch(_){ }
  }

  function ensureModal(){
    let m=document.getElementById('mfLoginStatusModal');
    if(m)return m;
    m=document.createElement('div');m.id='mfLoginStatusModal';m.className='modal';
    m.innerHTML='<section style="width:min(760px,100%);max-height:92vh"><button class="close" id="mfLoginStatusClose">×</button><div class="employeeHead"><div><h2>מצב כניסות עובדים</h2><small>בדיקת נעילות ושמות משתמש. קודי PIN אינם מוצגים.</small></div><button class="btn secondary" id="mfRefreshLoginStatus">רענון</button></div><div id="mfLoginStatusBody"><small>טוען…</small></div></section>';
    document.body.appendChild(m);
    document.getElementById('mfLoginStatusClose').onclick=()=>closeModal?.('mfLoginStatusModal');
    document.getElementById('mfRefreshLoginStatus').onclick=loadStatuses;
    return m;
  }

  async function loadStatuses(){
    const box=document.getElementById('mfLoginStatusBody');if(!box||!isAdmin())return;
    box.innerHTML='<small>טוען…</small>';
    const {data,error}=await supabaseClient.rpc('admin_get_staff_login_status');
    if(error){console.error(error);box.innerHTML='<div class="mfEmpty">טעינת מצב הכניסות נכשלה.</div>';return}
    const rows=data||[];
    box.innerHTML=rows.length?rows.map(r=>{
      const locked=r.locked_until&&new Date(r.locked_until)>new Date();
      const state=locked?'נעול זמנית':Number(r.failed_attempts||0)>0?`${r.failed_attempts} ניסיונות שגויים`:'תקין';
      return `<div class="item"><div class="meta"><b>${esc(r.full_name)}</b><small>שם משתמש: ${esc(r.username||'—')} · ${esc(state)}</small></div>${locked||Number(r.failed_attempts||0)>0?`<button class="btn secondary" data-clear-login="${esc(r.staff_id)}">ניקוי נעילה</button>`:'<span class="badge ok">כניסה תקינה</span>'}</div>`;
    }).join(''):'<div class="mfEmpty">אין עובדים פעילים.</div>';
    box.querySelectorAll('[data-clear-login]').forEach(b=>b.onclick=async()=>{
      b.disabled=true;const {error}=await supabaseClient.rpc('admin_clear_staff_login_lock',{p_staff_id:b.dataset.clearLogin});
      if(error){toast?.('ניקוי הנעילה נכשל');b.disabled=false;return}
      toast?.('הנעילה נוקתה');await loadStatuses();
    });
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

  function enforce(){routeLoginPane();keepAuthenticatedGateClosed();addAdminEntry()}
  let timer=null;
  const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enforce,45)});
  observer.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(enforce,100),{once:true});else setTimeout(enforce,80);
})();