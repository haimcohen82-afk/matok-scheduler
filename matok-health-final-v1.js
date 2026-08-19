(() => {
  'use strict';
  const VERSION='20260819-final-health-1';
  const isAdmin=()=>{try{return appSession?.type==='admin'}catch(_){return false}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const sunday=(offset=0)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-d.getDay()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};

  function ensureModal(){
    let m=document.getElementById('mfHealthModal');if(m)return m;
    m=document.createElement('div');m.id='mfHealthModal';m.className='modal';
    m.innerHTML='<section style="width:min(820px,100%);max-height:92vh"><button class="close" id="mfHealthClose">×</button><div class="employeeHead"><div><h2>בדיקת מערכת</h2><small>גרסה, בסיס נתונים, סידור, כניסות ושכר — בדיקה אחת.</small></div><button class="btn secondary" id="mfHealthRefresh">בדיקה מחדש</button></div><div id="mfHealthBody"><small>בודק…</small></div></section>';
    document.body.appendChild(m);
    document.getElementById('mfHealthClose').onclick=()=>closeModal?.('mfHealthModal');
    document.getElementById('mfHealthRefresh').onclick=runHealth;
    return m;
  }

  function row(label,value,ok=true,detail=''){
    return `<div class="item"><div class="meta"><b>${esc(label)}</b><small>${esc(detail||'')}</small></div><span class="badge ${ok?'ok':'bad'}">${esc(value)}</span></div>`;
  }

  async function runHealth(){
    const box=document.getElementById('mfHealthBody');if(!box||!isAdmin())return;
    box.innerHTML='<small>בודק את כל רכיבי המערכת…</small>';
    const current=sunday(0),next=sunday(7);
    const out=[];
    try{
      let deployed=null;
      try{const r=await fetch('/version.json?ts='+Date.now(),{cache:'no-store'});if(r.ok)deployed=await r.json()}catch(_){ }
      const local=window.__MATOK_BUILD__?.buildId||'לא ידוע';
      const match=!deployed?.buildId||deployed.buildId===local;
      out.push(row('גרסת מערכת',local,match,deployed?.buildId?`גרסה בשרת: ${deployed.buildId}`:'קובץ גרסה לא זמין'));

      const staffRes=await supabaseClient.from('staff').select('id',{count:'exact',head:true}).eq('is_active',true);
      out.push(row('חיבור לבסיס הנתונים',staffRes.error?'שגיאה':'תקין',!staffRes.error,staffRes.error?.message||`${staffRes.count||0} עובדים פעילים`));

      const weekRes=await supabaseClient.from('work_weeks').select('id,status,published_at,locked_at').eq('week_start',current).maybeSingle();
      let assignmentCount=0;
      if(weekRes.data?.id){const a=await supabaseClient.from('work_assignments').select('id',{count:'exact',head:true}).eq('week_id',weekRes.data.id).eq('status','approved');assignmentCount=a.count||0}
      const currentOk=!weekRes.error&&weekRes.data?.status==='published'&&assignmentCount>0;
      out.push(row('סידור השבוע הנוכחי',weekRes.data?.status||'לא נמצא',currentOk,`${current} · ${assignmentCount} שיבוצים מאושרים`));

      const nextRes=await supabaseClient.from('work_weeks').select('id,status').eq('week_start',next).maybeSingle();
      out.push(row('השבוע הבא',nextRes.data?.status||'לא נפתח',!nextRes.error&&!!nextRes.data,`${next} · הגשת זמינות`));

      const loginRes=await supabaseClient.rpc('admin_get_staff_login_status');
      const loginRows=loginRes.data||[];const locked=loginRows.filter(r=>r.locked_until&&new Date(r.locked_until)>new Date()).length;const failed=loginRows.filter(r=>Number(r.failed_attempts||0)>0).length;
      out.push(row('כניסות עובדים',loginRes.error?'שגיאה':locked?`${locked} נעולים`:failed?`${failed} עם שגיאות`:'תקין',!loginRes.error&&locked===0&&failed===0,loginRes.error?.message||`${loginRows.length} חשבונות נבדקו`));

      const payRes=await supabaseClient.rpc('admin_payroll_dashboard',{p_period:null});
      const pay=payRes.data?.[0];
      out.push(row('שכר ומסמכים',payRes.error?'שגיאה':'תקין',!payRes.error,pay?`${pay.payslips||0} תלושים · ${pay.hours_rows||0} רשומות שעות`:'אין עדיין נתוני שכר'));
    }catch(e){console.error('system health',e);out.push(row('בדיקה כללית','שגיאה',false,e?.message||'שגיאה לא ידועה'))}
    box.innerHTML=out.join('');
  }

  function addButton(){
    if(!isAdmin()||document.getElementById('mfHealthBtn'))return;
    const overview=document.getElementById('overview');if(!overview)return;
    const first=overview.querySelector(':scope>.stats')||overview.firstElementChild;
    const b=document.createElement('button');b.id='mfHealthBtn';b.type='button';b.className='btn secondary';b.textContent='בדיקת מערכת';b.style.margin='10px 0';b.onclick=()=>{ensureModal();openModal?.('mfHealthModal');runHealth()};
    first?.before(b);
  }

  let timer=null;
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(addButton,50)}).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(addButton,120),{once:true});else setTimeout(addButton,80);
})();