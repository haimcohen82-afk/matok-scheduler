(() => {
  'use strict';
  const VERSION='20260819-final-admin-tools-2';
  const isAdmin=()=>{try{return appSession?.type==='admin'}catch(_){return false}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const SLOT_ORDER=['sun-am','sun-pm','mon-am','mon-pm','tue-am','tue-pm','wed-am','wed-pm','thu-am','thu-pm','fri'];
  const DAYS=[['ראשון',['sun-am','sun-pm']],['שני',['mon-am','mon-pm']],['שלישי',['tue-am','tue-pm']],['רביעי',['wed-am','wed-pm']],['חמישי',['thu-am','thu-pm']],['שישי',['fri']]];
  const DAY_NAMES={sun:'ראשון',mon:'שני',tue:'שלישי',wed:'רביעי',thu:'חמישי',fri:'שישי'};
  const slotTitle=s=>s==='fri'?'שישי':s.endsWith('-am')?'בוקר':'ערב';
  const humanSlot=s=>s==='fri'?'יום שישי':`יום ${DAY_NAMES[String(s).split('-')[0]]||s} · ${s.endsWith('-am')?'בוקר':'ערב'}`;
  const currentWeek=()=>{try{return adminWeekStart||''}catch(_){return ''}};
  const weekLabel=iso=>{if(!iso)return '—';const d=new Date(iso+'T12:00:00'),e=new Date(d);e.setDate(d.getDate()+5);return `${d.toLocaleDateString('he-IL',{day:'numeric',month:'numeric'})}–${e.toLocaleDateString('he-IL',{day:'numeric',month:'numeric',year:'numeric'})}`};

  async function scheduleData(){
    const weekStart=currentWeek();if(!weekStart)throw new Error('week_not_selected');
    const {data:week,error:we}=await supabaseClient.from('work_weeks').select('id,week_start,status,manager_note,published_at').eq('week_start',weekStart).maybeSingle();
    if(we)throw we;
    if(!week)return {weekStart,week:null,assignments:[],settings:[]};
    const [{data:assignments,error:ae},{data:settings,error:se}]=await Promise.all([
      supabaseClient.from('work_assignments').select('slot_key,role_name,status,staff:staff_id(full_name)').eq('week_id',week.id).eq('status','approved'),
      supabaseClient.rpc('admin_get_schedule_slot_settings',{p_week_start:weekStart})
    ]);
    if(ae||se)throw ae||se;
    return {weekStart,week,assignments:assignments||[],settings:settings||[]};
  }

  async function saveNote(){
    if(!isAdmin())return;
    const weekStart=currentWeek(),note=document.getElementById('mfManagerNote')?.value?.trim()||'';
    if(!weekStart){toast?.('לא נבחר שבוע');return}
    const {error}=await supabaseClient.from('work_weeks').update({manager_note:note,updated_at:new Date().toISOString()}).eq('week_start',weekStart);
    if(error){console.error(error);toast?.('שמירת ההודעה נכשלה');return}
    toast?.('הודעת הצוות נשמרה');await window.loadAdminFinalData?.(weekStart);
  }

  async function printSchedule(){
    if(!isAdmin())return;
    try{
      const {weekStart,week,assignments,settings}=await scheduleData();
      if(!week){toast?.('אין שבוע שמור להדפסה');return}
      if(!assignments.length){toast?.('אין שיבוצים שמורים — ההדפסה נעצרה כדי לא להפיק דף ריק');return}
      const map=new Map(SLOT_ORDER.map(s=>[s,[]]));
      assignments.forEach(a=>map.get(a.slot_key)?.push({name:a.staff?.full_name||'עובד',role:a.role_name||'מכירה'}));
      const cfg=new Map(settings.map(s=>[s.slot_key,s]));
      const days=DAYS.map(([day,slots])=>`<article class="day"><header><b>${day}</b></header>${slots.map(slot=>{const c=cfg.get(slot),start=String(c?.start_time||'').slice(0,5),end=String(c?.end_time||'').slice(0,5),rows=map.get(slot)||[];return `<section><div class="shift"><b>${slotTitle(slot)}</b><small>${esc(start)}${start&&end?'–':''}${esc(end)}</small></div><ul>${rows.length?rows.map(x=>`<li><b>${esc(x.name)}</b><span>${esc(x.role)}</span></li>`).join(''):'<li class="empty">אין שיבוץ</li>'}</ul></section>`}).join('')}</article>`).join('');
      const w=window.open('','_blank');if(!w){toast?.('הדפדפן חסם את חלון ההדפסה');return}
      w.document.write(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>MATOK סידור עבודה ${esc(weekLabel(weekStart))}</title><style>@page{size:A4 landscape;margin:7mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:Arial,sans-serif;margin:0;color:#1a1a2e}.head{display:flex;justify-content:space-between;align-items:end;border-bottom:4px solid #1a1a2e;padding-bottom:8px;margin-bottom:9px}.brand b{font-size:28px}.brand small{display:block;letter-spacing:4px}.head h1{margin:0;font-size:22px}.head p{margin:3px 0 0}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}.day{border:1px solid #d9d4cc;border-radius:10px;overflow:hidden;min-height:340px}.day>header{background:#1a1a2e;color:#fff;text-align:center;padding:8px;font-size:16px}.day section{min-height:135px;padding:8px;border-bottom:1px solid #e2ddd5}.shift{display:flex;justify-content:space-between}.shift small{font-size:9px;color:#666}.day ul{list-style:none;margin:7px 0 0;padding:0}.day li{display:flex;justify-content:space-between;gap:4px;padding:5px 0;border-bottom:1px dashed #ddd;font-size:10px}.day li span{color:#666}.empty{color:#999}.note{margin-top:8px;padding:9px 12px;background:#fff3ec;border-right:5px solid #e8826a;border-radius:8px;font-size:11px}.foot{margin-top:7px;border-top:1px solid #ddd;padding-top:5px;font-size:8px;color:#777;display:flex;justify-content:space-between}</style></head><body><div class="head"><div class="brand"><b>MATOK</b><small>BASIC</small></div><div><h1>סידור עבודה שבועי</h1><p>${esc(weekLabel(weekStart))} · ${week?.status==='published'?'פורסם':'טיוטה'}</p></div></div><main class="grid">${days}</main>${week?.manager_note?`<div class="note"><b>הודעת מנהל:</b> ${esc(week.manager_note)}</div>`:''}<div class="foot"><span>MATOK BASIC · מערכת סידור עבודה</span><span>הופק ${new Date().toLocaleString('he-IL')}</span></div><script>setTimeout(()=>window.print(),250)<\/script></body></html>`);
      w.document.close();
    }catch(e){console.error(e);toast?.('הפקת הסידור להדפסה נכשלה')}
  }

  function ensureHistoryModal(){
    let m=document.getElementById('mfEditHistoryModal');if(m)return m;
    m=document.createElement('div');m.id='mfEditHistoryModal';m.className='modal';
    m.innerHTML='<section style="width:min(760px,100%);max-height:92vh"><button class="close" id="mfHistoryClose">×</button><div class="employeeHead"><div><h2>היסטוריית שינויים בסידור</h2><small>הוספה והסרה שבוצעו לאחר פרסום נשמרות כאן.</small></div><button class="btn secondary" id="mfHistoryRefresh">רענון</button></div><div id="mfHistoryBody"><small>טוען…</small></div></section>';
    document.body.appendChild(m);document.getElementById('mfHistoryClose').onclick=()=>closeModal?.('mfEditHistoryModal');document.getElementById('mfHistoryRefresh').onclick=loadHistory;return m;
  }

  async function loadHistory(){
    const box=document.getElementById('mfHistoryBody');if(!box||!isAdmin())return;box.innerHTML='<small>טוען…</small>';
    const {data,error}=await supabaseClient.from('schedule_edit_log').select('action,slot_key,edited_at,staff:staff_id(full_name)').eq('week_start',currentWeek()).order('edited_at',{ascending:false}).limit(200);
    if(error){console.error(error);box.innerHTML='<div class="mfEmpty">טעינת היסטוריית השינויים נכשלה.</div>';return}
    const rows=data||[];box.innerHTML=rows.length?rows.map(r=>`<div class="item"><div class="meta"><b>${esc(r.staff?.full_name||'עובד')} · ${esc(r.action==='add'?'נוסף לסידור':'הוסר מהסידור')}</b><small>${esc(humanSlot(r.slot_key))} · ${new Date(r.edited_at).toLocaleString('he-IL')}</small></div><span class="badge ${r.action==='add'?'ok':'wait'}">${r.action==='add'?'+':'−'}</span></div>`).join(''):'<div class="mfEmpty">עדיין אין שינויים שנרשמו לשבוע הזה.</div>';
  }

  function addTools(){
    if(!isAdmin())return;
    const bar=document.querySelector('#adminSchedule .mfScheduleToolbar');if(!bar)return;
    if(!document.getElementById('mfPrintScheduleBtn')){const b=document.createElement('button');b.id='mfPrintScheduleBtn';b.className='btn secondary';b.type='button';b.textContent='PDF / הדפסה';b.onclick=printSchedule;bar.appendChild(b)}
    if(!document.getElementById('mfSaveNoteBtn')){const b=document.createElement('button');b.id='mfSaveNoteBtn';b.className='btn secondary';b.type='button';b.textContent='שמירת הודעה';b.onclick=saveNote;bar.appendChild(b)}
    if(!document.getElementById('mfHistoryBtn')){const b=document.createElement('button');b.id='mfHistoryBtn';b.className='btn secondary';b.type='button';b.textContent='היסטוריית שינויים';b.onclick=()=>{ensureHistoryModal();openModal?.('mfEditHistoryModal');loadHistory()};bar.appendChild(b)}
    if(!document.getElementById('mfRefreshScheduleBtn')){const b=document.createElement('button');b.id='mfRefreshScheduleBtn';b.className='btn secondary';b.type='button';b.textContent='רענון';b.onclick=()=>window.loadAdminFinalData?.(currentWeek());bar.appendChild(b)}
  }

  let timer=null;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(addTools,40)}).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(addTools,120),{once:true});else setTimeout(addTools,80);
})();
