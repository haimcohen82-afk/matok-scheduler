(() => {
  'use strict';
  const VERSION='20260817-published-editor-1';
  const SLOT_ORDER=['sun-am','sun-pm','mon-am','mon-pm','tue-am','tue-pm','wed-am','wed-pm','thu-am','thu-pm','fri'];
  const DAY_GROUPS=[
    ['ראשון',['sun-am','sun-pm']],
    ['שני',['mon-am','mon-pm']],
    ['שלישי',['tue-am','tue-pm']],
    ['רביעי',['wed-am','wed-pm']],
    ['חמישי',['thu-am','thu-pm']],
    ['שישי',['fri']]
  ];
  let editorData=null;
  let activeSlot='';
  let busy=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const isAdmin=()=>{try{return appSession?.type==='admin'}catch(_){return false}};
  const shiftLabel=slot=>slot==='fri'?'שישי 09:00–14:00':slot.endsWith('-am')?'בוקר':'ערב';
  const fmtWeek=iso=>{try{const d=new Date(iso+'T12:00:00');const e=new Date(d);e.setDate(d.getDate()+5);return `${d.toLocaleDateString('he-IL',{day:'numeric',month:'numeric'})}–${e.toLocaleDateString('he-IL',{day:'numeric',month:'numeric'})}`}catch(_){return iso}};

  function addStyles(){
    if(document.getElementById('publishedEditorStyles'))return;
    const s=document.createElement('style');s.id='publishedEditorStyles';s.textContent=`
      .publishedEditBanner{display:flex;justify-content:space-between;align-items:center;gap:10px;background:#eef9f6;border:1px solid #9fd1c6;border-right:6px solid var(--teal);border-radius:12px;padding:12px 13px;margin-bottom:10px}.publishedEditBanner b{display:block}.publishedEditBanner small{color:var(--muted)}
      .publishedEditorGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:12px}.publishedEditorDay{border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden}.publishedEditorDay>header{background:var(--ink);color:#fff;padding:10px 12px;display:flex;justify-content:space-between;align-items:center}.publishedEditorShift{padding:10px;border-bottom:1px solid var(--line)}.publishedEditorShift:last-child{border-bottom:0}.publishedEditorShiftHead{display:flex;justify-content:space-between;align-items:center;gap:8px}.publishedEditorNames{display:grid;gap:6px;margin:8px 0}.publishedEditorPerson{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px;border:1px solid #b9d9bd;background:#eef8ef;border-radius:9px}.publishedEditorPerson b{font-size:13px}.publishedEditorPerson button{min-width:38px}.publishedEditorEmpty{color:var(--muted);font-size:12px;padding:7px 0}.publishedPickerList{display:grid;gap:7px;margin-top:10px}.publishedPickerRow{display:grid;grid-template-columns:1fr auto;gap:9px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:9px;background:#fff}.publishedPickerRow.assigned{background:#eef8ef;border-color:#9bc8a0}.publishedPickerRow small{display:block;color:var(--muted);line-height:1.45}.publishedPickerRow.warning small{color:#8f4a2c}.publishedOverride{display:inline-flex;margin-top:4px;padding:3px 7px;border-radius:999px;background:#fff0e8;color:#9a4b28;font-size:9px;font-weight:900}.publishedEditorTop{display:flex;justify-content:space-between;gap:9px;align-items:flex-start}.publishedEditorTop p{margin:3px 0;color:var(--muted)}
      @media(max-width:900px){.publishedEditorGrid{grid-template-columns:1fr 1fr}}
      @media(max-width:600px){.publishedEditorGrid{grid-template-columns:1fr}.publishedEditBanner{align-items:flex-start;flex-direction:column}.publishedEditBanner .btn{width:100%}.publishedEditorTop{display:block}.publishedEditorTop .btn{width:100%;margin-top:7px}}
    `;document.head.appendChild(s);
  }

  function ensureModal(){
    let m=document.getElementById('publishedScheduleEditorModal');
    if(m)return m;
    m=document.createElement('div');m.id='publishedScheduleEditorModal';m.className='modal';
    m.innerHTML=`<section class="wideModal" style="width:min(1100px,100%);max-height:94vh"><button class="close" id="publishedEditorClose">×</button><div class="publishedEditorTop"><div><h2 style="margin:0">עריכת הסידור שכבר פורסם</h2><p id="publishedEditorSubtitle">טוען…</p></div><button type="button" class="btn secondary" id="publishedEditorRefresh">רענון</button></div><div class="truth" style="margin-top:10px"><b>הרשאת מנהל בלבד.</b><br>אפשר להוסיף או להסיר עובד גם אם הוא סימן שאינו זמין, וגם אם המשמרת אינה ביום הקבוע שלו. השינוי נשמר מיד ומופיע לעובד בסידור המפורסם.</div><div id="publishedEditorBody"></div></section>`;
    document.body.appendChild(m);
    document.getElementById('publishedEditorClose').onclick=()=>closeModal?.('publishedScheduleEditorModal');
    document.getElementById('publishedEditorRefresh').onclick=()=>loadEditor(true);
    m.addEventListener('click',e=>{if(e.target===m)closeModal?.('publishedScheduleEditorModal')});
    return m;
  }

  function ensurePicker(){
    let m=document.getElementById('publishedEmployeePickerModal');
    if(m)return m;
    m=document.createElement('div');m.id='publishedEmployeePickerModal';m.className='modal';
    m.innerHTML=`<section style="width:min(620px,100%);max-height:92vh"><button class="close" id="publishedPickerClose">×</button><h2 id="publishedPickerTitle">בחירת עובדים</h2><p>כל העובדים הפעילים מוצגים. זמינות וימים קבועים הם מידע בלבד ואינם חוסמים מנהל.</p><div id="publishedPickerList" class="publishedPickerList"></div><button type="button" class="btn secondary" id="publishedPickerDone" style="width:100%;margin-top:10px">חזרה לסידור</button></section>`;
    document.body.appendChild(m);
    document.getElementById('publishedPickerClose').onclick=()=>closeModal?.('publishedEmployeePickerModal');
    document.getElementById('publishedPickerDone').onclick=()=>closeModal?.('publishedEmployeePickerModal');
    return m;
  }

  async function fetchEditor(){
    const {data,error}=await supabaseClient.rpc('admin_get_current_published_schedule_editor');
    if(error)throw error;
    const x=Array.isArray(data)?data[0]:data;
    return x||{published:false};
  }

  async function loadEditor(showToast=false){
    if(!isAdmin())return;
    const body=document.getElementById('publishedEditorBody');if(body)body.innerHTML='<div class="availabilityEmpty">טוען את הסידור המפורסם…</div>';
    try{
      editorData=await fetchEditor();
      if(!editorData?.published){
        document.getElementById('publishedEditorSubtitle').textContent='לא נמצא סידור מפורסם לשבוע הנוכחי.';
        if(body)body.innerHTML='<div class="availabilityEmpty">אין כרגע סידור מפורסם שניתן לערוך.</div>';
        return;
      }
      document.getElementById('publishedEditorSubtitle').textContent=`שבוע ${fmtWeek(editorData.week_start)} · נשאר מפורסם לצוות בזמן העריכה`;
      renderEditor();
      if(showToast)toast?.('הסידור המפורסם נטען מחדש');
    }catch(e){console.error('published editor load',e);if(body)body.innerHTML='<div class="availabilityEmpty">טעינת הסידור נכשלה.</div>';toast?.('טעינת הסידור המפורסם נכשלה')}
  }

  function assignedFor(slot){return (editorData?.assignments||[]).filter(a=>a.slot_key===slot&&a.status==='approved')}
  function staffById(id){return (editorData?.staff||[]).find(s=>String(s.id)===String(id))}
  function availability(slot,id){return (editorData?.availability||[]).find(a=>a.slot_key===slot&&String(a.staff_id)===String(id))?.status||''}
  function configuredFor(staff,slot){
    const st=staff?.settings||{};
    if(slot==='fri')return (st.friday||'none')!=='none';
    const [day,kind]=slot.split('-');const idx={sun:0,mon:1,tue:2,wed:3,thu:4}[day];
    if(idx==null)return true;
    if(kind==='am')return st.morning!==false&&(!Array.isArray(st.weekdayMorning)||st.weekdayMorning[idx]!==0);
    return st.evening!==false&&(!Array.isArray(st.weekdayEvening)||st.weekdayEvening[idx]!==0);
  }

  function renderEditor(){
    const body=document.getElementById('publishedEditorBody');if(!body||!editorData)return;
    body.innerHTML=`<div class="publishedEditorGrid">${DAY_GROUPS.map(([day,slots])=>`<article class="publishedEditorDay"><header><b>${day}</b><span>${slots.length===2?'בוקר · ערב':'שישי'}</span></header>${slots.map(slot=>{
      const rows=assignedFor(slot);
      return `<section class="publishedEditorShift"><div class="publishedEditorShiftHead"><b>${shiftLabel(slot)}</b><span class="badge ${rows.length?'ok':'wait'}">${rows.length} משובצים</span></div><div class="publishedEditorNames">${rows.length?rows.map(a=>{const s=staffById(a.staff_id);return `<div class="publishedEditorPerson"><div><b>${esc(s?.full_name||'עובד')}</b><small>${esc(a.role_name||s?.role_name||'מכירה')}</small></div><button type="button" class="btn danger" data-pub-remove="${esc(a.staff_id)}" data-pub-slot="${esc(slot)}">−</button></div>`}).join(''):'<div class="publishedEditorEmpty">אין עובדים במשמרת</div>'}</div><button type="button" class="btn primary" style="width:100%" data-pub-add-slot="${esc(slot)}">+ הוספת / שינוי עובדים</button></section>`
    }).join('')}</article>`).join('')}</div>`;
    body.querySelectorAll('[data-pub-add-slot]').forEach(b=>b.onclick=()=>openPicker(b.dataset.pubAddSlot));
    body.querySelectorAll('[data-pub-remove]').forEach(b=>b.onclick=()=>changeAssignment(b.dataset.pubSlot,b.dataset.pubRemove,false,b));
  }

  function pickerStatus(staff,slot){
    const av=availability(slot,staff.id),configured=configuredFor(staff,slot);
    if(av==='unavailable')return {text:'סימנה שאינה יכולה במשמרת הזו — מנהל רשאי לשבץ בכל זאת',warn:true,override:true};
    if(!configured)return {text:'המשמרת אינה ביום/סוג המשמרת הקבוע שלה — מנהל רשאי לשבץ בכל זאת',warn:true,override:true};
    if(av==='preferred')return {text:'מעדיפה משמרת זו',warn:false};
    if(av==='available')return {text:'זמינה',warn:false};
    return {text:'לא הוגשה זמינות למשמרת זו — עדיין ניתן לשבץ כמנהל',warn:true,override:true};
  }

  function openPicker(slot){
    activeSlot=slot;ensurePicker();
    document.getElementById('publishedPickerTitle').textContent=`${shiftLabel(slot)} · בחירת עובדים`;
    renderPicker();openModal?.('publishedEmployeePickerModal');
  }

  function renderPicker(){
    const list=document.getElementById('publishedPickerList');if(!list||!editorData)return;
    const assigned=new Set(assignedFor(activeSlot).map(a=>String(a.staff_id)));
    list.innerHTML=(editorData.staff||[]).map(s=>{
      const on=assigned.has(String(s.id)),st=pickerStatus(s,activeSlot);
      return `<div class="publishedPickerRow ${on?'assigned':''} ${st.warn?'warning':''}"><div><b>${esc(s.full_name)}</b><small>${esc(s.role_name||'מכירה')} · ${esc(st.text)}</small>${st.override?'<span class="publishedOverride">הרשאת מנהל עוקפת את ההגבלה</span>':''}</div><button type="button" class="btn ${on?'danger':'primary'}" data-pick-staff="${esc(s.id)}" data-pick-action="${on?'remove':'add'}">${on?'הסרה':'שיבוץ'}</button></div>`;
    }).join('');
    list.querySelectorAll('[data-pick-staff]').forEach(b=>b.onclick=()=>changeAssignment(activeSlot,b.dataset.pickStaff,b.dataset.pickAction==='add',b,true));
  }

  async function changeAssignment(slot,staffId,assigned,btn,fromPicker=false){
    if(busy)return;busy=true;if(btn)btn.disabled=true;
    try{
      const staff=staffById(staffId);
      const {error}=await supabaseClient.rpc('admin_set_published_assignment',{p_week_start:editorData.week_start,p_slot_key:slot,p_staff_id:staffId,p_assigned:!!assigned,p_role_name:staff?.role_name||'מכירה'});
      if(error)throw error;
      const arr=editorData.assignments=Array.isArray(editorData.assignments)?editorData.assignments:[];
      const i=arr.findIndex(a=>a.slot_key===slot&&String(a.staff_id)===String(staffId));
      if(assigned){const row={slot_key:slot,staff_id:staffId,role_name:staff?.role_name||'מכירה',status:'approved'};if(i>=0)arr[i]=row;else arr.push(row)}else if(i>=0)arr.splice(i,1);
      renderEditor();if(fromPicker)renderPicker();
      toast?.(`${staff?.full_name||'העובד'} ${assigned?'נוסף לסידור':'הוסר מהסידור'} · נשמר מיד`);
      try{
        if(typeof adminWeekStart!=='undefined'&&String(adminWeekStart)===String(editorData.week_start)&&typeof loadScheduleFromDb==='function')setTimeout(()=>loadScheduleFromDb(),0);
      }catch(_){ }
    }catch(e){console.error('published assignment change',e);toast?.('השינוי לא נשמר: '+(e?.message||'שגיאה'))}
    finally{busy=false;if(btn)btn.disabled=false}
  }

  async function openEditor(){
    if(!isAdmin()){toast?.('עריכת סידור מפורסם זמינה למנהל בלבד');return}
    ensureModal();openModal?.('publishedScheduleEditorModal');await loadEditor(false);
  }

  function injectEntry(){
    if(!isAdmin())return;
    const panel=document.getElementById('adminSchedule');if(!panel)return;
    if(!document.getElementById('publishedEditBanner')){
      const banner=document.createElement('div');banner.id='publishedEditBanner';banner.className='publishedEditBanner';banner.innerHTML='<div><b>צריך לשנות את הסידור שכבר פורסם?</b><small>אפשר לערוך את המשך השבוע בכל רגע. רק למנהל מותר לעקוף זמינות וימים קבועים.</small></div><button type="button" class="btn primary" id="openPublishedEditorBtn">עריכת הסידור המפורסם</button>';
      panel.prepend(banner);document.getElementById('openPublishedEditorBtn').onclick=openEditor;
    }
  }

  function install(){addStyles();injectEntry()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,500));else setTimeout(install,500);
  new MutationObserver(()=>injectEntry()).observe(document.documentElement,{childList:true,subtree:true});
  window.openPublishedScheduleEditor=openEditor;
})();