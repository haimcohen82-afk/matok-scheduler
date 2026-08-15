(() => {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));
  let scheduleSettings = {};
  let draftSaveTimer = null;
  let draftSaveRunning = false;
  let draftSavePending = false;

  function defaultSetting(slotKey){
    const s = slotById(slotKey);
    const approved = (previewAssignments[slotKey]||[]).filter(a=>a.status==='approved').length;
    return { required_count: Math.max(2, approved), start_time: s?.[2]||'10:00', end_time: s?.[3]||'15:00' };
  }
  function settingFor(slotKey){ return scheduleSettings[slotKey] || defaultSetting(slotKey); }
  function applySettingToSlot(slotKey){
    const s=slotById(slotKey), x=settingFor(slotKey); if(!s)return;
    s[2]=String(x.start_time||s[2]).slice(0,5); s[3]=String(x.end_time||s[3]).slice(0,5);
  }
  async function loadScheduleSettings(){
    if(appSession?.type!=='admin'||!adminWeekStart) return;
    const {data,error}=await supabaseClient.rpc('admin_get_schedule_slot_settings',{p_week_start:adminWeekStart});
    if(error){ console.error('loadScheduleSettings',error); return; }
    scheduleSettings={};
    (data||[]).forEach(r=>scheduleSettings[r.slot_key]={required_count:Number(r.required_count),start_time:String(r.start_time).slice(0,5),end_time:String(r.end_time).slice(0,5)});
    slots.forEach(s=>applySettingToSlot(s[0]));
    refreshSettingsRows();
  }

  function assignmentPayload(){
    const rows=[];
    Object.entries(previewAssignments).forEach(([slot,list])=>(list||[]).forEach(a=>{
      const emp=employees.find(e=>e.id===a.id||e.name===a.name);
      if(emp?.id) rows.push({slot_key:slot,staff_id:emp.id,role_name:a.role||emp.role||'מכירה',status:a.status==='pending'?'pending':'approved'});
    }));
    return rows;
  }

  saveScheduleToDb = async function(publishNow=false){
    if(appSession?.type!=='admin'||!adminWeekStart)return false;
    const payload=assignmentPayload();
    const fn=publishNow?'admin_publish_schedule_v2':'admin_save_schedule_draft_v2';
    const {data,error}=await supabaseClient.rpc(fn,{p_week_start:adminWeekStart,p_manager_note:document.getElementById('scheduleManagerNote')?.value||'',p_assignments:payload});
    if(error){ console.error(fn,error); toast(error.message?.includes('week_published')?'השבוע כבר פורסם ולכן אינו ניתן לעריכה':'שמירת הסידור נכשלה'); return false; }
    const {data:week}=await supabaseClient.from('work_weeks').select('*').eq('week_start',adminWeekStart).maybeSingle();
    currentWeekRecord=week||currentWeekRecord;
    published=!!publishNow || currentWeekRecord?.status==='published';
    scheduleLocked=published;
    syncScheduleLockUi();
    renderAdminOverview();
    return true;
  };

  async function doQueuedSave(){
    if(published||appSession?.type!=='admin')return;
    if(draftSaveRunning){ draftSavePending=true; return; }
    draftSaveRunning=true;
    const status=document.getElementById('draftSaveStatus'); if(status)status.textContent='שומר…';
    const ok=await saveScheduleToDb(false);
    if(status)status.textContent=ok?'נשמר אוטומטית':'שגיאה בשמירה';
    draftSaveRunning=false;
    if(draftSavePending){ draftSavePending=false; doQueuedSave(); }
  }
  function queueDraftSave(){
    if(published)return;
    clearTimeout(draftSaveTimer);
    const status=document.getElementById('draftSaveStatus'); if(status)status.textContent='יש שינויים…';
    draftSaveTimer=setTimeout(doQueuedSave,450);
  }

  const baseLoadScheduleFromDb = loadScheduleFromDb;
  loadScheduleFromDb = async function(){
    if(!adminWeekStart)return;
    const {data:week,error:weekError}=await supabaseClient.from('work_weeks').select('*').eq('week_start',adminWeekStart).maybeSingle();
    if(weekError){console.error(weekError);toast('טעינת השבוע נכשלה');return}
    currentWeekRecord=week||null;
    Object.keys(previewAssignments).forEach(k=>previewAssignments[k]=[]);
    if(!week){ published=false;scheduleLocked=false; await loadScheduleSettings(); syncScheduleLockUi();renderAdminSchedule();renderAdminOverview();return; }
    const {data:rows,error}=await supabaseClient.from('work_assignments').select('slot_key,status,role_name,staff:staff_id(id,full_name)').eq('week_id',week.id);
    if(error){console.error(error);toast('טעינת השיבוצים נכשלה');return}
    (rows||[]).filter(r=>r.staff).forEach(r=>{previewAssignments[r.slot_key]=previewAssignments[r.slot_key]||[];previewAssignments[r.slot_key].push({id:r.staff.id,name:r.staff.full_name,role:r.role_name||'מכירה',status:r.status})});
    published=week.status==='published';
    scheduleLocked=published;
    if(!published && week.locked_at){
      const {error:unlockError}=await supabaseClient.rpc('admin_unlock_schedule_week',{p_week_start:adminWeekStart});
      if(!unlockError){ currentWeekRecord.locked_at=null; }
    }
    await loadScheduleSettings();
    syncScheduleLockUi();renderAdminSchedule();renderAdminOverview();
  };

  syncScheduleLockUi = function(){
    const lockBtn=document.getElementById('lockScheduleBtn'),pub=document.getElementById('publishScheduleBtn'),state=document.getElementById('lockState'),buttons=document.getElementById('publishButtons');
    if(!lockBtn)return;
    if(published){
      scheduleLocked=true; lockBtn.disabled=true; lockBtn.textContent='הסידור פורסם'; lockBtn.classList.add('done');
      buttons?.classList.add('show'); if(pub){pub.disabled=true;pub.classList.add('done');pub.textContent='פורסם במערכת'}
      if(state){state.classList.add('locked');state.innerHTML='<b>הסידור פורסם</b><small>העובדים רואים את הסידור שפורסם.</small>'}
    } else {
      scheduleLocked=false; lockBtn.disabled=false; lockBtn.classList.remove('done'); lockBtn.textContent='שמירת טיוטה';
      buttons?.classList.add('show'); if(pub){pub.disabled=false;pub.classList.remove('done');pub.textContent='פרסום במערכת'}
      if(state){state.classList.remove('locked');state.innerHTML='<b>פתוח לעריכה</b><small>כל הוספה והסרה נשמרת אוטומטית. אין נעילה באמצע העבודה.</small>'}
      const unlockBtn=[...(buttons?.querySelectorAll('button')||[])].find(b=>(b.getAttribute('onclick')||'').includes('unlockPreviewSchedule')); if(unlockBtn)unlockBtn.style.display='none';
    }
  };
  lockPreviewSchedule = async function(){ scheduleLocked=false; const ok=await saveScheduleToDb(false); if(ok)toast('הטיוטה נשמרה. אפשר להמשיך לערוך'); };
  unlockPreviewSchedule = async function(){
    if(published){toast('שבוע שפורסם נשאר נעול');return}
    scheduleLocked=false; await supabaseClient.rpc('admin_unlock_schedule_week',{p_week_start:adminWeekStart}); syncScheduleLockUi();renderAdminSchedule();toast('הסידור פתוח לעריכה');
  };
  publishPreview = async function(){
    if(currentWeekRecord?.status==='published'||published){toast('השבוע כבר פורסם');return}
    if(!confirm('לפרסם את הסידור לשבוע '+weekLabel(adminWeekStart)+'?'))return;
    const ok=await saveScheduleToDb(true); if(!ok)return;
    published=true;scheduleLocked=true;syncScheduleLockUi();renderAdminSchedule();toast('הסידור פורסם לצוות');
  };

  function availabilityState(slot,name){ return (adminAvailabilityBySlot[slot]||[]).find(x=>x.name===name)?.status||''; }
  function candidateHtml(e,slot){
    const current=previewAssignments[slot]||[]; const existing=current.find(a=>a.id===e.id||a.name===e.name); const av=availabilityState(slot,e.name);
    const avText=av==='unavailable'?'לא יכולה לפי הדיווח — מנהל עדיין יכול לשבץ':av==='preferred'?'מעדיפה משמרת זו':av==='available'?'זמינה':'לא הוגשה זמינות';
    const avCls=av==='unavailable'?'candidateUnavailable':av==='preferred'?'candidatePreferred':'';
    let label='שיבוץ', cls='primary', action=`choosePreviewEmployee(${JSON.stringify(e.name)})`;
    if(existing?.status==='approved'){ label='הסרה';cls='danger';action=`removeCandidateEmployee(${JSON.stringify(e.name)})`; }
    else if(existing?.status==='pending'){ label='אישור ושיבוץ';cls='primary';action=`approvePreview(${JSON.stringify(slot)},${JSON.stringify(e.name)})`; }
    return `<div class="candidate ${existing?'approved':''} ${avCls}"><div class="meta"><b>${esc(e.name)}</b><small>${esc(employeeType(e))} · ${esc(e.role||'מכירה')}</small><small class="candidateAvailability">${esc(avText)}</small></div><button class="btn ${cls}" onclick='${action}'>${label}</button></div>`;
  }

  openCandidate = function(slot){
    activeCandidateSlot=slot; const s=slotById(slot); const current=previewAssignments[slot]||[]; const pending=current.filter(a=>a.status==='pending');
    document.getElementById('candidateTitle').textContent=s?.[1]||slot;
    document.getElementById('candidatePending').innerHTML=pending.length?pending.map(a=>`<div class="candidate pending"><div class="meta"><span class="assignmentTag pending">בקשת עובדת</span><b>${esc(a.name)}</b><small>${esc(a.note||'ללא הערה')}</small></div><div class="actions"><button class="btn primary" onclick='approvePreview(${JSON.stringify(slot)},${JSON.stringify(a.name)})'>אישור</button><button class="btn danger" onclick='rejectPreview(${JSON.stringify(slot)},${JSON.stringify(a.name)})'>דחייה</button></div></div>`).join(''):'<small>אין בקשות ממתינות במשמרת זו.</small>';
    const list=document.getElementById('candidateList'); list.innerHTML=employees.map(e=>candidateHtml(e,slot)).join('');
    let bar=document.getElementById('candidateToolbar');
    if(!bar){ bar=document.createElement('div');bar.id='candidateToolbar';bar.className='candidateToolbar';bar.innerHTML='<b>אפשר לבחור כמה עובדים ברצף</b><button class="btn secondary" onclick="closeCandidatePicker()">חזרה לסידור</button>'; document.getElementById('candidateTitle').after(bar); }
    openModal('candidateModal');
  };
  choosePreviewEmployee = function(name){
    if(published){toast('הסידור כבר פורסם');return}
    const emp=employees.find(e=>e.name===name); if(!emp)return;
    const list=previewAssignments[activeCandidateSlot]=previewAssignments[activeCandidateSlot]||[];
    const existing=list.find(a=>a.id===emp.id||a.name===name);
    if(existing){ if(existing.status==='pending')existing.status='approved'; else return; }
    else list.push({id:emp.id,name,role:emp.role||'מכירה',status:'approved'});
    renderAdminSchedule(); openCandidate(activeCandidateSlot); renderSchedulePreview(); queueDraftSave(); toast(`${name} נוספה`);
  };
  window.removeCandidateEmployee = function(name){
    if(published)return; const list=previewAssignments[activeCandidateSlot]||[]; previewAssignments[activeCandidateSlot]=list.filter(a=>a.name!==name); renderAdminSchedule();openCandidate(activeCandidateSlot);renderSchedulePreview();queueDraftSave();toast(`${name} הוסרה`);
  };
  window.closeCandidatePicker=function(){ closeModal('candidateModal'); };
  approvePreview = function(slot,name){ const a=(previewAssignments[slot]||[]).find(x=>x.name===name);if(a)a.status='approved';renderAdminSchedule();openCandidate(slot);renderSchedulePreview();queueDraftSave();toast(`${name} אושרה`); };
  rejectPreview = function(slot,name){ previewAssignments[slot]=(previewAssignments[slot]||[]).filter(x=>x.name!==name);renderAdminSchedule();openCandidate(slot);renderSchedulePreview();queueDraftSave();toast('הבקשה הוסרה'); };
  removePreview = function(slot,name){ if(published){toast('הסידור כבר פורסם');return} previewAssignments[slot]=(previewAssignments[slot]||[]).filter(x=>x.name!==name);renderAdminSchedule();renderSchedulePreview();queueDraftSave();toast('השיבוץ הוסר'); };

  assignmentRow = function(a,slot){
    if(a.status==='pending')return `<div class="item pendingAssignment"><div class="meta"><span class="assignmentTag pending">בקשת עובדת</span><b>${esc(a.name)}</b><small>${esc(a.note||'בקשת שיבוץ עצמי')}</small></div><div class="actions"><button class="btn primary" onclick='approvePreview(${JSON.stringify(slot)},${JSON.stringify(a.name)})'>אישור</button><button class="btn danger" onclick='rejectPreview(${JSON.stringify(slot)},${JSON.stringify(a.name)})'>דחייה</button></div></div>`;
    return `<div class="item approvedAssignment"><div class="meta"><span class="assignmentTag approved">משובצת</span><b>${esc(a.name)}</b><small>${esc(a.role||'מכירה')}</small></div><button class="btn danger" ${published?'disabled':''} onclick='removePreview(${JSON.stringify(slot)},${JSON.stringify(a.name)})'>×</button></div>`;
  };
  adminShiftCard = function(s){
    const key=s[0], shiftName=key==='fri'?'שישי':key.endsWith('-am')?'בוקר':'ערב', list=previewAssignments[key]||[], approved=list.filter(a=>a.status==='approved').length, cfg=settingFor(key), required=Number(cfg.required_count||0), missing=approved<required, over=approved>required;
    const badge=missing?`חסרים ${required-approved}`:over?`מעל היעד +${approved-required}`:'מלא';
    return `<section class="adminShiftBlock ${missing?'missing':''}"><div class="adminShiftHead"><div><h3>${shiftName}</h3><small>${esc(cfg.start_time)}–${esc(cfg.end_time)} · <b>${approved}/${required}</b> משובצים</small></div><span class="badge ${missing?'bad':'ok'}">${badge}</span></div>${availabilityForSlot(key)}${list.map(a=>assignmentRow(a,key)).join('')}<button class="btn primary chooseEmployee" ${published?'disabled':''} onclick='openCandidate(${JSON.stringify(key)})'>+ הוספת עובדים</button></section>`;
  };
  renderAdminSchedule = function(){
    const cards=document.getElementById('scheduleCards'); if(!cards)return; const oldScroll=cards.scrollLeft;
    const label=weekLabel(adminWeekStart); const pill=document.getElementById('adminWeekLabel');if(pill)pill.textContent='שבוע '+label;
    cards.innerHTML=adminDays.map((day,dayIndex)=>{const dt=adminWeekStart?parseIsoDate(addDaysIso(adminWeekStart,dayIndex)):new Date();return `<article class="adminDayCard"><header class="adminDayHeader"><div><b>${day[0]}</b><small>${dt.toLocaleDateString('he-IL',{day:'numeric',month:'numeric'})}</small></div><span>${day.length===3?'בוקר · ערב':'שישי'}</span></header><div>${day.slice(1).map(index=>adminShiftCard(slots[index])).join('')}${day[0]==='שישי'?'<div class="shabbatGreeting"><div><b>שבת שלום</b><small>אין משמרת ערב ביום שישי</small></div></div>':''}</div></article>`}).join('');
    requestAnimationFrame(()=>{cards.scrollLeft=oldScroll});
  };
  renderAdminOverview = function(){
    const sc=document.getElementById('overviewStaffCount'),sub=document.getElementById('overviewSubmittedCount'),mis=document.getElementById('overviewMissingCount'),wl=document.getElementById('overviewWeekLabel'),box=document.getElementById('overviewAssignments');if(!sc)return;
    sc.textContent=employees.length; wl.textContent=adminWeekStart?weekLabel(adminWeekStart):'—';
    const submitted=new Set(); Object.values(adminAvailabilityBySlot).flat().forEach(x=>submitted.add(x.staffId||x.name)); if(sub)sub.textContent=submitted.size;
    const missing=slots.filter(s=>(previewAssignments[s[0]]||[]).filter(a=>a.status==='approved').length<Number(settingFor(s[0]).required_count||0)).length; if(mis)mis.textContent=missing;
    const rows=[];slots.forEach(sl=>(previewAssignments[sl[0]]||[]).filter(a=>a.status==='approved').forEach(a=>rows.push(`<div class="item"><div class="meta"><b>${esc(a.name)} · ${esc(sl[1])}</b><small>${esc(a.role||'')}</small></div><span class="badge ok">מאושר</span></div>`))); if(box)box.innerHTML=rows.length?rows.join(''):'<small>עדיין אין שיבוצים לשבוע המוצג.</small>';
  };

  function settingsRowsHtml(prefix='cfg'){
    return slots.map(s=>{const x=settingFor(s[0]);return `<div class="settingRow" data-slot="${s[0]}"><div class="settingHead"><b>${esc(s[1])}</b><span class="badge">יעד ${Number(x.required_count)}</span></div><div class="settingFields"><label>התחלה<input data-${prefix}-start type="time" value="${esc(String(x.start_time).slice(0,5))}"></label><label>סיום<input data-${prefix}-end type="time" value="${esc(String(x.end_time).slice(0,5))}"></label><label>מספר עובדים נדרש<input data-${prefix}-required type="number" min="0" max="20" value="${Number(x.required_count)}"></label></div><small>זה יעד לכיסוי בלבד. כמנהל אפשר לשבץ גם יותר מהמספר הזה.</small></div>`}).join('');
  }
  function refreshSettingsRows(){
    const box=document.getElementById('settingsRows'); if(box){box.innerHTML=settingsRowsHtml('inline');}
    const modalBox=document.getElementById('scheduleSettingsRows'); if(modalBox){modalBox.innerHTML=settingsRowsHtml('modal');}
  }
  async function saveSettingsFrom(container,prefix){
    const rows=[...container.querySelectorAll('[data-slot]')];
    for(const row of rows){
      const slot=row.dataset.slot, required=Number(row.querySelector(`[data-${prefix}-required]`).value||0), start=row.querySelector(`[data-${prefix}-start]`).value, end=row.querySelector(`[data-${prefix}-end]`).value;
      const {error}=await supabaseClient.rpc('admin_save_schedule_slot_setting',{p_week_start:adminWeekStart,p_slot_key:slot,p_required_count:required,p_start_time:start,p_end_time:end});
      if(error){console.error(error);toast('שמירת הגדרות המשמרת נכשלה');return false;}
      scheduleSettings[slot]={required_count:required,start_time:start,end_time:end};applySettingToSlot(slot);
    }
    renderAdminSchedule();renderAdminOverview();renderSchedulePreview();return true;
  }
  window.openScheduleSettings=function(){
    let m=document.getElementById('scheduleSettingsModal');
    if(!m){m=document.createElement('div');m.id='scheduleSettingsModal';m.className='modal';m.innerHTML='<section><button class="close" onclick="closeModal(\'scheduleSettingsModal\')">×</button><h2>הגדרות הסידור</h2><p>שנה שעות ויעד עובדים לכל משמרת. היעד אינו מגביל אותך בשיבוץ.</p><div id="scheduleSettingsRows" class="settingsRows"></div><button id="saveScheduleSettingsBtn" class="btn primary" style="width:100%;margin-top:12px">שמירת ההגדרות</button></section>';document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m)closeModal('scheduleSettingsModal')});document.getElementById('saveScheduleSettingsBtn').onclick=async()=>{const ok=await saveSettingsFrom(document.getElementById('scheduleSettingsRows'),'modal');if(ok){closeModal('scheduleSettingsModal');toast('הגדרות הסידור נשמרו')}};}
    refreshSettingsRows();openModal('scheduleSettingsModal');
  };

  function renderSchedulePreview(){
    const box=document.getElementById('schedulePreviewBody');if(!box)return;
    let total=0,missing=0;
    const daysHtml=adminDays.map(day=>`<article class="previewDay"><h3>${day[0]}</h3>${day.slice(1).map(i=>{const s=slots[i],key=s[0],cfg=settingFor(key),list=(previewAssignments[key]||[]).filter(a=>a.status==='approved');total+=list.length;if(list.length<cfg.required_count)missing++;return `<section class="previewShift"><header><b>${key==='fri'?'שישי':key.endsWith('-am')?'בוקר':'ערב'}</b><span class="badge ${list.length<cfg.required_count?'bad':'ok'}">${list.length}/${cfg.required_count}</span></header><small>${esc(cfg.start_time)}–${esc(cfg.end_time)}</small><div class="previewNames">${list.length?list.map(a=>`<span>${esc(a.name)}${published?'':`<button onclick='removePreview(${JSON.stringify(key)},${JSON.stringify(a.name)})'>×</button>`}</span>`).join(''):'<em>טרם שובץ</em>'}</div>${published?'':`<button class="btn secondary" onclick='closeModal("schedulePreviewModal");openCandidate(${JSON.stringify(key)})'>+ הוספה</button>`}</section>`}).join('')}</article>`).join('');
    box.innerHTML=`<div class="previewSummary"><b>${total} שיבוצים</b><span>${missing} משמרות מתחת ליעד</span></div><div class="previewWeek">${daysHtml}</div>`;
  }
  window.openSchedulePreview=function(){
    let m=document.getElementById('schedulePreviewModal');
    if(!m){m=document.createElement('div');m.id='schedulePreviewModal';m.className='modal';m.innerHTML='<section class="wideModal"><button class="close" onclick="closeModal(\'schedulePreviewModal\')">×</button><h2>תצוגה שבועית מלאה</h2><p>כל השבוע מול העיניים. אפשר להסיר עובד או להוסיף עובד לכל משמרת.</p><div id="schedulePreviewBody"></div></section>';document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m)closeModal('schedulePreviewModal')});}
    renderSchedulePreview();openModal('schedulePreviewModal');
  };

  function installUi(){
    const style=document.createElement('style');style.id='scheduleProStyles';style.textContent=`
      .candidateToolbar{display:flex;justify-content:space-between;align-items:center;gap:8px;position:sticky;top:-19px;background:#fff;padding:10px 0;z-index:5;border-bottom:1px solid var(--line);margin-bottom:8px}.candidateAvailability{display:block;margin-top:3px}.candidateUnavailable{border-color:#d38a80!important;background:#fff7f5!important}.candidateUnavailable .candidateAvailability{color:#a43d35;font-weight:800}.candidatePreferred{border-color:#d0aa4e!important;background:#fffaf0!important}.draftSaveStatus{font-size:11px;color:var(--muted);font-weight:800;align-self:center}.wideModal{width:min(1180px,96vw)!important}.previewSummary{display:flex;gap:12px;flex-wrap:wrap;margin:8px 0 12px}.previewWeek{display:grid;grid-template-columns:repeat(6,minmax(150px,1fr));gap:8px;overflow:auto}.previewDay{border:1px solid var(--line);border-radius:11px;background:var(--soft);padding:8px;min-width:150px}.previewDay h3{margin:0 0 7px}.previewShift{background:#fff;border:1px solid var(--line);border-radius:9px;padding:8px;margin-bottom:7px}.previewShift header{display:flex;justify-content:space-between;gap:6px}.previewNames{display:grid;gap:4px;margin:7px 0}.previewNames>span{display:flex;justify-content:space-between;align-items:center;background:#edf8ee;border-radius:7px;padding:5px 7px;font-size:11px;font-weight:700}.previewNames button{border:0;background:transparent;color:var(--danger);font-weight:900}.previewNames em{font-size:11px;color:var(--muted)}
      @media(max-width:850px){.candidateToolbar{top:0}.previewWeek{grid-template-columns:repeat(6,82vw)}.wideModal{width:100%!important}.settingsRows .settingFields{grid-template-columns:1fr 1fr 1fr}}
    `; if(!document.getElementById(style.id))document.head.appendChild(style);

    const controls=document.querySelector('.scheduleControls');
    if(controls && !document.getElementById('schedulePreviewBtn')){
      const preview=document.createElement('button');preview.id='schedulePreviewBtn';preview.className='btn primary';preview.textContent='תצוגה שבועית';preview.onclick=openSchedulePreview;controls.appendChild(preview);
      const cfg=document.createElement('button');cfg.id='realScheduleSettingsBtn';cfg.className='btn secondary';cfg.textContent='הגדרות ימים, שעות וכמות עובדים';cfg.onclick=openScheduleSettings;controls.appendChild(cfg);
      const old=[...controls.querySelectorAll('button')].find(b=>(b.getAttribute('onclick')||'').includes("הגדרות המשמרת נפתחו"));if(old)old.style.display='none';
      const st=document.createElement('span');st.id='draftSaveStatus';st.className='draftSaveStatus';st.textContent='שמירה אוטומטית פעילה';controls.appendChild(st);
    }
    const settingsBtn=[...document.querySelectorAll('#settings button')].find(b=>b.textContent.includes('שמירת כל ההגדרות'));
    if(settingsBtn){settingsBtn.onclick=async()=>{const ok=await saveSettingsFrom(document.getElementById('settingsRows'),'inline');if(ok)toast('הגדרות השבוע נשמרו')}};
    refreshSettingsRows();syncScheduleLockUi();
  }

  const baseChangeAdminWeek=changeAdminWeek;
  changeAdminWeek=async function(days){ if(appSession?.type!=='admin')return; await doQueuedSave(); adminWeekStart=addDaysIso(adminWeekStart||upcomingSunday(),days);scheduleLocked=false;published=false;currentWeekRecord=null;scheduleSettings={};await loadAdminData();installUi(); };

  const wait=()=>{ if(typeof supabaseClient==='undefined'||typeof slots==='undefined')return setTimeout(wait,60); installUi(); setTimeout(async()=>{if(appSession?.type==='admin'){await loadScheduleSettings();renderAdminSchedule();renderAdminOverview();syncScheduleLockUi();}},700); };
  wait();
})();