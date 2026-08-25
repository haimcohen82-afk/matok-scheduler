(() => {
  'use strict';
  const VERSION='20260825-availability-roster-1';
  let busy=false;
  let lastWeek='';
  let timer=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const isAdmin=()=>{try{return appSession?.type==='admin'}catch(_){return false}};
  const slotLabel=k=>{
    if(k==='fri')return 'שישי';
    const [d,s]=String(k||'').split('-');
    const day={sun:'ראשון',mon:'שני',tue:'שלישי',wed:'רביעי',thu:'חמישי'}[d]||d;
    return `${day} · ${s==='am'?'בוקר':'ערב'}`;
  };
  const statusLabel=s=>s==='preferred'?'מעדיפה':s==='available'?'זמינה':s==='unavailable'?'לא יכולה':s||'';
  const fmtWeek=iso=>{
    try{
      const d=new Date(iso+'T12:00:00'),e=new Date(d);e.setDate(d.getDate()+5);
      return `${d.toLocaleDateString('he-IL',{day:'numeric',month:'numeric'})}–${e.toLocaleDateString('he-IL',{day:'numeric',month:'numeric'})}`;
    }catch(_){return iso||''}
  };

  function addStyles(){
    if(document.getElementById('mfAvailabilityRosterStyle'))return;
    const s=document.createElement('style');s.id='mfAvailabilityRosterStyle';s.textContent=`
      .mfRosterSummary{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px}.mfRosterSummary span{background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:6px 9px;font-size:10px;font-weight:900}.mfRosterSummary .ok{background:#e5f4e6;color:#356b39}.mfRosterSummary .wait{background:#fff3d4;color:#765d1b}
      .mfRosterEmployee{border:1px solid var(--line);border-radius:12px;padding:11px;background:#fff;margin-top:8px}.mfRosterEmployee.missing{background:#fffaf2;border-color:#ead5a8}.mfRosterEmployeeHead{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.mfRosterEmployeeHead small{display:block;color:var(--muted);margin-top:2px}.mfRosterEmployee .mfAvailability{margin-top:8px}.mfRosterLast{font-size:10px;color:var(--muted);margin-top:6px}.mfRosterWeekTitle{font-size:11px;color:var(--muted);margin-bottom:7px}
    `;document.head.appendChild(s);
  }

  async function renderRoster(force=false){
    if(!isAdmin()||busy)return;
    const box=document.getElementById('mfAvailabilityAdmin');
    const week=typeof adminWeekStart!=='undefined'&&adminWeekStart?String(adminWeekStart):'';
    if(!box||!week)return;
    if(!force&&lastWeek===week&&box.querySelector('.mfRosterEmployee'))return;
    busy=true;
    try{
      const {data,error}=await supabaseClient.rpc('admin_get_week_availability_roster',{p_week_start:week});
      if(error)throw error;
      const groups=new Map();
      (data||[]).forEach(r=>{
        if(!groups.has(r.staff_id))groups.set(r.staff_id,{id:r.staff_id,name:r.full_name,submittedAt:r.submitted_at,note:r.general_note||'',lastWeek:r.last_submitted_week,items:[]});
        const g=groups.get(r.staff_id);
        if(r.slot_key)g.items.push({slot:r.slot_key,status:r.status});
      });
      const rows=[...groups.values()].sort((a,b)=>{
        const as=a.submittedAt?0:1,bs=b.submittedAt?0:1;
        return as-bs||String(a.name).localeCompare(String(b.name),'he');
      });
      const submitted=rows.filter(x=>x.submittedAt).length;
      box.innerHTML=`<div class="mfRosterWeekTitle"><b>זמינות לשבוע ${esc(fmtWeek(week))}</b> · כל העובדים הפעילים מוצגים כאן, גם מי שטרם הגיש.</div><div class="mfRosterSummary"><span>${rows.length} עובדים פעילים</span><span class="ok">${submitted} הגישו</span><span class="wait">${rows.length-submitted} טרם הגישו</span></div>${rows.map(x=>{
        const submittedNow=!!x.submittedAt;
        const chips=submittedNow&&x.items.length?`<div class="mfAvailability">${x.items.map(a=>`<span class="mfAvailChip ${esc(a.status)}">${esc(slotLabel(a.slot))} · ${esc(statusLabel(a.status))}</span>`).join('')}</div>`:'';
        const last=!submittedNow&&x.lastWeek?`<div class="mfRosterLast">הגשה אחרונה במערכת: שבוע ${esc(fmtWeek(x.lastWeek))}</div>`:'';
        return `<div class="mfRosterEmployee ${submittedNow?'':'missing'}" data-mf-roster-staff="${esc(x.id)}"><div class="mfRosterEmployeeHead"><div><b>${esc(x.name)}</b>${submittedNow?`<small>נשלח ${new Date(x.submittedAt).toLocaleString('he-IL')}</small>`:'<small>אין הגשה שמורה לשבוע הזה</small>'}</div><span class="mfStatus ${submittedNow?'ok':'wait'}">${submittedNow?'הוגש':'טרם הוגש'}</span></div>${chips}${x.note?`<p>${esc(x.note)}</p>`:''}${last}</div>`;
      }).join('')||'<div class="mfEmpty">לא נמצאו עובדים פעילים.</div>';
      box.dataset.mfRosterWeek=week;
      lastWeek=week;
    }catch(e){
      console.error('availability roster',e);
      box.innerHTML='<div class="mfEmpty">טעינת רשימת העובדים והזמינות נכשלה.</div>';
    }finally{busy=false}
  }

  function schedule(force=false){
    clearTimeout(timer);timer=setTimeout(()=>renderRoster(force),120);
  }

  function bind(){
    addStyles();
    document.querySelectorAll('.adminTabs [data-target="adminSchedule"]').forEach(b=>{
      if(b.dataset.mfRosterBound==='1')return;b.dataset.mfRosterBound='1';b.addEventListener('click',()=>schedule(true));
    });
    ['mfPrevWeek','mfNextWeek','mfOpenCurrentWeek','mfOpenNextWeek','mfManagerWeeksRefresh'].forEach(id=>{
      const b=document.getElementById(id);if(!b||b.dataset.mfRosterBound==='1')return;b.dataset.mfRosterBound='1';b.addEventListener('click',()=>setTimeout(()=>schedule(true),350));
    });
    const label=document.getElementById('mfAdminWeekLabel');
    if(label&&!label.dataset.mfRosterObserved){
      label.dataset.mfRosterObserved='1';
      new MutationObserver(()=>schedule(true)).observe(label,{childList:true,subtree:true,characterData:true});
    }
    if(isAdmin()&&document.getElementById('mfAvailabilityAdmin'))schedule();
  }

  let obsTimer=null;
  new MutationObserver(()=>{clearTimeout(obsTimer);obsTimer=setTimeout(bind,80)}).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,180),{once:true});else setTimeout(bind,120);
  window.refreshAdminAvailabilityRoster=()=>renderRoster(true);
})();