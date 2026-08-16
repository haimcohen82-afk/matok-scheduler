(() => {
  'use strict';
  const VERSION = '20260816-stable-1';
  const EDIT_KEY = 'matokAdminEditWeek';
  const busy = new Set();
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function ready(){
    try {
      return typeof supabaseClient !== 'undefined' && typeof employees !== 'undefined' && typeof previewAssignments !== 'undefined' && typeof adminWeekStart !== 'undefined';
    } catch (_) { return false; }
  }
  function employeeById(id){ return (employees || []).find(e => String(e.id) === String(id)); }
  function employeeByName(name){ return (employees || []).find(e => e.name === name); }
  function isAdmin(){ try { return appSession?.type === 'admin'; } catch (_) { return false; } }
  function editOpen(){
    if(!isAdmin()) return false;
    try { return !published || sessionStorage.getItem(EDIT_KEY) === String(adminWeekStart || ''); }
    catch (_) { return !published; }
  }
  function avFor(slot, name){
    try { return (adminAvailabilityBySlot?.[slot] || []).find(x => x.name === name)?.status || ''; }
    catch (_) { return ''; }
  }
  function slotTitle(slot){
    try { return slotById(slot)?.[1] || slot; } catch (_) { return slot; }
  }

  async function setAssignmentStable(slot, staffId, assigned=true){
    if(!isAdmin()) return false;
    if(typeof published !== 'undefined' && published && !editOpen()){
      toast?.('הסידור פורסם. לחץ „פתיחת עריכה” ואז ניתן לשנות אותו.');
      return false;
    }
    const emp = employeeById(staffId);
    if(!emp){ toast?.('העובד לא נמצא'); return false; }
    const key = `${slot}|${emp.id}`;
    if(busy.has(key)) return false;
    busy.add(key);
    try {
      const { error } = await supabaseClient.rpc('admin_set_assignment_v4', {
        p_week_start: adminWeekStart,
        p_slot_key: slot,
        p_staff_id: emp.id,
        p_role_name: emp.role || 'מכירה',
        p_assigned: !!assigned
      });
      if(error) throw error;

      const list = previewAssignments[slot] = Array.isArray(previewAssignments[slot]) ? previewAssignments[slot] : [];
      const idx = list.findIndex(a => String(a.id || '') === String(emp.id) || a.name === emp.name);
      if(assigned){
        const row = { id: emp.id, name: emp.name, role: emp.role || 'מכירה', status: 'approved' };
        if(idx >= 0) list[idx] = { ...list[idx], ...row };
        else list.push(row);
      } else if(idx >= 0) list.splice(idx, 1);

      if(typeof scheduleLocked !== 'undefined') scheduleLocked = false;
      if(typeof currentWeekRecord !== 'undefined' && currentWeekRecord) currentWeekRecord.locked_at = null;
      if(typeof dedupePreviewAssignments === 'function') dedupePreviewAssignments();
      renderAdminSchedule?.();
      renderAdminOverview?.();
      renderSchedulePreview?.();
      return true;
    } catch (e){
      console.error('admin_set_assignment_v4', e);
      toast?.('השינוי לא נשמר: ' + (e?.message || 'שגיאה'));
      return false;
    } finally { busy.delete(key); }
  }

  function buildCandidate(slot){
    activeCandidateSlot = slot;
    const current = previewAssignments[slot] || [];
    const title = document.getElementById('candidateTitle');
    if(title) title.textContent = slotTitle(slot);
    const pending = document.getElementById('candidatePending');
    if(pending) pending.innerHTML = '<small>אפשר לשבץ כל עובד גם אם סימן שאינו זמין. סימון הזמינות מוצג כהמלצה בלבד למנהל.</small>';
    const list = document.getElementById('candidateList');
    if(!list) return;
    list.innerHTML = (employees || []).map(emp => {
      const existing = current.find(a => String(a.id || '') === String(emp.id) || a.name === emp.name);
      const assigned = existing?.status === 'approved';
      const av = avFor(slot, emp.name);
      const avText = av === 'unavailable' ? 'סימנה שלא יכולה · ניתן לשבץ בכל זאת' : av === 'preferred' ? 'מעדיפה משמרת זו' : av === 'available' ? 'זמינה' : 'לא הוגשה זמינות';
      return `<div class="candidate ${assigned?'approved':''} ${av==='unavailable'?'candidateUnavailable':av==='preferred'?'candidatePreferred':''}">
        <div class="meta"><b>${esc(emp.name)}</b><small>${esc(emp.role || 'מכירה')}</small><small class="candidateAvailability">${esc(avText)}</small></div>
        <button type="button" class="btn ${assigned?'danger':'primary'}" data-stable-staff="${esc(emp.id)}" data-stable-action="${assigned?'remove':'add'}">${assigned?'הסרה':'שיבוץ'}</button>
      </div>`;
    }).join('');
    list.querySelectorAll('[data-stable-staff]').forEach(btn => {
      btn.onclick = async () => {
        const staffId = btn.dataset.stableStaff;
        const add = btn.dataset.stableAction === 'add';
        btn.disabled = true;
        const ok = await setAssignmentStable(slot, staffId, add);
        if(ok){ toast?.(`${employeeById(staffId)?.name || 'העובד'} ${add?'שובץ':'הוסר'}`); buildCandidate(slot); }
        else btn.disabled = false;
      };
    });
    let bar = document.getElementById('candidateToolbar');
    if(!bar){
      bar = document.createElement('div'); bar.id='candidateToolbar'; bar.className='candidateToolbar';
      title?.after(bar);
    }
    bar.innerHTML = '<b>אפשר להוסיף ולהסיר כמה עובדים ברצף</b><button type="button" class="btn secondary" id="stableCandidateDone">חזרה לסידור</button>';
    document.getElementById('stableCandidateDone').onclick = () => closeModal?.('candidateModal');
  }

  function openCandidateStable(slot){
    if(typeof published !== 'undefined' && published && !editOpen()){
      toast?.('הסידור פורסם. פתח אותו לעריכה קודם.');
      return;
    }
    buildCandidate(slot);
    openModal?.('candidateModal');
  }

  async function unlockStable(){
    if(!isAdmin()) return;
    try {
      const { error } = await supabaseClient.rpc('admin_set_schedule_edit_lock_v2', { p_week_start: adminWeekStart, p_locked: false });
      if(error) throw error;
      sessionStorage.setItem(EDIT_KEY, String(adminWeekStart));
      if(typeof scheduleLocked !== 'undefined') scheduleLocked = false;
      if(typeof currentWeekRecord !== 'undefined' && currentWeekRecord) currentWeekRecord.locked_at = null;
      syncStableLockUi();
      renderAdminSchedule?.();
      toast?.('הסידור פתוח לעריכת מנהל. אפשר להוסיף ולהסיר עובדים גם אחרי פרסום.');
    } catch(e){ console.error(e); toast?.('פתיחת הסידור לעריכה נכשלה'); }
  }

  async function finishEditingStable(){
    if(!isAdmin()) return;
    try {
      const { error } = await supabaseClient.rpc('admin_set_schedule_edit_lock_v2', { p_week_start: adminWeekStart, p_locked: true });
      if(error) throw error;
      sessionStorage.removeItem(EDIT_KEY);
      if(typeof scheduleLocked !== 'undefined') scheduleLocked = !!published;
      if(typeof currentWeekRecord !== 'undefined' && currentWeekRecord) currentWeekRecord.locked_at = new Date().toISOString();
      syncStableLockUi(); renderAdminSchedule?.(); toast?.('העריכה הסתיימה. הסידור נשאר מפורסם לעובדים.');
    } catch(e){ console.error(e); toast?.('סיום העריכה נכשל'); }
  }

  const originalLock = typeof lockPreviewSchedule === 'function' ? lockPreviewSchedule : null;
  function syncStableLockUi(){
    const lockBtn = document.getElementById('lockScheduleBtn');
    const pub = document.getElementById('publishScheduleBtn');
    const state = document.getElementById('lockState');
    const buttons = document.getElementById('publishButtons');
    if(!lockBtn) return;
    const isPub = !!published;
    const open = editOpen();
    buttons?.classList.add('show');
    if(isPub){
      if(pub){ pub.disabled=true; pub.classList.add('done'); pub.textContent='פורסם במערכת'; }
      lockBtn.disabled=false;
      lockBtn.classList.toggle('done', !open);
      lockBtn.textContent = open ? 'סיום עריכה' : 'פתיחת עריכה';
      lockBtn.onclick = open ? finishEditingStable : unlockStable;
      if(state){
        state.classList.toggle('locked', !open);
        state.innerHTML = open
          ? '<b>הסידור מפורסם ופתוח לעריכת מנהל</b><small>כל שינוי נשמר מיד ומופיע לעובדים בסידור המפורסם.</small>'
          : '<b>הסידור פורסם</b><small>העובדים רואים אותו. ניתן לפתוח לעריכה בכל רגע.</small>';
      }
      const unlockBtn=[...(buttons?.querySelectorAll('button')||[])].find(b=>(b.getAttribute('onclick')||'').includes('unlockPreviewSchedule'));
      if(unlockBtn){ unlockBtn.style.display=''; unlockBtn.textContent=open?'סיום עריכה':'פתיחת עריכה'; unlockBtn.onclick=open?finishEditingStable:unlockStable; }
    } else {
      lockBtn.disabled=false; lockBtn.classList.remove('done'); lockBtn.textContent='שמירת טיוטה';
      lockBtn.onclick = () => originalLock?.();
      if(pub){ pub.disabled=false; pub.classList.remove('done'); pub.textContent='פרסום במערכת'; }
      if(state){ state.classList.remove('locked'); state.innerHTML='<b>פתוח לעריכה</b><small>כל הוספה והסרה נשמרת. אין נעילה באמצע העבודה.</small>'; }
    }
  }

  function postProcessSchedule(){
    if(!isAdmin()) return;
    const open = editOpen();
    document.querySelectorAll('#scheduleCards .chooseEmployee').forEach(btn => {
      if(open) btn.disabled=false;
      if(!open && published) btn.disabled=true;
    });
    document.querySelectorAll('#scheduleCards [data-v3-row]').forEach(btn => {
      const slot=btn.dataset.v3RowSlot, staffId=btn.dataset.v3RowStaff;
      if(open) btn.disabled=false;
      btn.onclick = async () => {
        if(!open && published){ toast?.('פתח את הסידור לעריכה קודם'); return; }
        btn.disabled=true;
        const add=btn.dataset.v3Row === 'approve';
        const ok=await setAssignmentStable(slot,staffId,add);
        if(!ok) btn.disabled=false;
      };
    });
    syncStableLockUi();
  }

  function buildCleanRequestsPanel(){
    const panel=document.getElementById('requests'); if(!panel) return;
    const txt=panel.textContent || '';
    if(!document.getElementById('managerMessagesList') || /רוני|נועה|טושים שחורים|שקיות מותג/.test(txt)){
      panel.innerHTML=`<article class="card"><div class="employeeHead"><div><h2>פניות, רעיונות וחוסרים מהצוות</h2><small>רק הודעות אמיתיות של עובדים פעילים.</small></div><button type="button" class="btn secondary" id="stableRefreshMessages">רענון</button></div><div id="managerMessagesList"><small>טוען…</small></div><div class="archiveBox"><button type="button" class="btn secondary" id="toggleMessageArchive">הצגת ארכיון שטופל</button><div id="managerMessagesArchive" style="display:none;margin-top:9px"></div></div></article>`;
      document.getElementById('stableRefreshMessages').onclick=()=>window.loadManagerMessages?.();
      document.getElementById('toggleMessageArchive').onclick=()=>{
        const b=document.getElementById('managerMessagesArchive');
        b.style.display=b.style.display==='none'?'block':'none';
      };
    }
    if(isAdmin()) setTimeout(()=>window.loadManagerMessages?.(),0);
  }

  async function loadRealHoursStable(){
    const box=document.getElementById('realHoursReports'); if(!box || !isAdmin()) return;
    box.innerHTML='<small>טוען…</small>';
    const {data,error}=await supabaseClient.rpc('admin_get_staff_reports_v2',{p_include_archived:false});
    if(error){box.innerHTML='<small>טעינת הדיווחים נכשלה.</small>';return;}
    const rows=(data||[]).filter(r=>r.report_type==='hours');
    box.innerHTML=rows.length?rows.map(r=>`<div class="item"><div class="meta"><b>${esc(r.full_name)} · ${esc(r.title||'תיקון שעות')}</b><small>${esc(r.body||'')}</small></div><span class="badge ${r.viewed_at?'ok':'wait'}">${r.viewed_at?'נצפה':'חדש'}</span></div>`).join(''):'<div class="availabilityEmpty">אין כרגע תיקוני שעות פתוחים.</div>';
  }

  function buildCleanAttendancePanel(){
    const panel=document.getElementById('attendance'); if(!panel) return;
    const txt=panel.textContent || '';
    if(!document.getElementById('realHoursReports') || /20\.7|15:01|10:02/.test(txt)){
      panel.innerHTML='<article class="card"><div class="employeeHead"><div><h2>תיקוני שעות שהעובדים שלחו</h2><small>רק דיווחים אמיתיים מהמערכת. אין נתוני דמו.</small></div><button type="button" class="btn secondary" id="stableRefreshHours">רענון</button></div><div id="realHoursReports"><small>טוען…</small></div></article>';
      document.getElementById('stableRefreshHours').onclick=loadRealHoursStable;
    }
    if(isAdmin()) loadRealHoursStable();
  }

  function install(){
    if(!ready()) return setTimeout(install,80);
    if(window.__MATOK_STABLE_RUNTIME__===VERSION) return;
    window.__MATOK_STABLE_RUNTIME__=VERSION;
    window.MATOK_RUNTIME_VERSION=VERSION;

    const previousRender = typeof renderAdminSchedule === 'function' ? renderAdminSchedule : null;
    if(previousRender){
      renderAdminSchedule = function(...args){ const out=previousRender.apply(this,args); setTimeout(postProcessSchedule,0); return out; };
    }
    const previousLoad = typeof loadScheduleFromDb === 'function' ? loadScheduleFromDb : null;
    if(previousLoad){
      loadScheduleFromDb = async function(...args){ const out=await previousLoad.apply(this,args); if(published && sessionStorage.getItem(EDIT_KEY)===String(adminWeekStart)) scheduleLocked=false; postProcessSchedule(); return out; };
    }

    window.setAssignmentById=setAssignmentStable;
    openCandidate=openCandidateStable;
    choosePreviewEmployee=async name=>{const e=employeeByName(name);return e?setAssignmentStable(activeCandidateSlot,e.id,true):false;};
    window.removeCandidateEmployee=async name=>{const e=employeeByName(name);return e?setAssignmentStable(activeCandidateSlot,e.id,false):false;};
    approvePreview=async(slot,name)=>{const e=employeeByName(name);return e?setAssignmentStable(slot,e.id,true):false;};
    rejectPreview=async(slot,name)=>{const e=employeeByName(name);return e?setAssignmentStable(slot,e.id,false):false;};
    removePreview=async(slot,name)=>{const e=employeeByName(name);return e?setAssignmentStable(slot,e.id,false):false;};
    unlockPreviewSchedule=unlockStable;
    window.finishEditingPublishedSchedule=finishEditingStable;
    syncScheduleLockUi=syncStableLockUi;

    buildCleanRequestsPanel(); buildCleanAttendancePanel(); postProcessSchedule();
    document.querySelectorAll('.adminTabs button').forEach(b=>{
      if(b.dataset.target==='requests') b.addEventListener('click',()=>setTimeout(buildCleanRequestsPanel,0));
      if(b.dataset.target==='attendance') b.addEventListener('click',()=>setTimeout(buildCleanAttendancePanel,0));
      if(b.dataset.target==='adminSchedule') b.addEventListener('click',()=>setTimeout(postProcessSchedule,0));
    });
    console.info('MATOK stable runtime loaded', VERSION);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install); else install();
})();