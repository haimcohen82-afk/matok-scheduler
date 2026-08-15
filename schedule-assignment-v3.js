(() => {
  const esc3 = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  let assignmentBusy = false;

  function employeeById(id){ return employees.find(e => String(e.id) === String(id)); }
  function employeeByName(name){ return employees.find(e => e.name === name); }
  function availabilityForEmployee(slot, name){ return (adminAvailabilityBySlot[slot] || []).find(x => x.name === name)?.status || ''; }

  async function setAssignmentById(slot, staffId, assigned=true){
    if (assignmentBusy) return false;
    if (published){ toast('הסידור כבר פורסם'); return false; }
    const emp = employeeById(staffId);
    if (!emp){ toast('העובד לא נמצא'); return false; }
    assignmentBusy = true;
    try {
      const { error } = await supabaseClient.rpc('admin_set_assignment_v3', {
        p_week_start: adminWeekStart,
        p_slot_key: slot,
        p_staff_id: emp.id,
        p_role_name: emp.role || 'מכירה',
        p_assigned: assigned
      });
      if (error) throw error;

      const list = previewAssignments[slot] = previewAssignments[slot] || [];
      const idx = list.findIndex(a => String(a.id || '') === String(emp.id) || a.name === emp.name);
      if (assigned){
        const row = { id: emp.id, name: emp.name, role: emp.role || 'מכירה', status: 'approved' };
        if (idx >= 0) list[idx] = { ...list[idx], ...row };
        else list.push(row);
      } else if (idx >= 0) {
        list.splice(idx, 1);
      }

      scheduleLocked = false;
      if (currentWeekRecord) currentWeekRecord.locked_at = null;
      if (typeof syncScheduleLockUi === 'function') syncScheduleLockUi();
      renderAdminSchedule();
      if (typeof renderAdminOverview === 'function') renderAdminOverview();
      if (typeof renderSchedulePreview === 'function') renderSchedulePreview();
      return true;
    } catch (e){
      console.error('admin_set_assignment_v3', e);
      toast('השיבוץ לא נשמר — נסה שוב');
      return false;
    } finally {
      assignmentBusy = false;
    }
  }

  function bindCandidateV3(){
    const list = document.getElementById('candidateList');
    if (list){
      list.querySelectorAll('[data-v3-staff]').forEach(btn => {
        btn.onclick = async () => {
          const slot = activeCandidateSlot;
          const staffId = btn.dataset.v3Staff;
          const assigned = btn.dataset.v3Action !== 'remove';
          btn.disabled = true;
          const ok = await setAssignmentById(slot, staffId, assigned);
          if (ok){
            toast(`${employeeById(staffId)?.name || 'העובד'} ${assigned ? 'שובץ' : 'הוסר'}`);
            openCandidate(slot);
          } else btn.disabled = false;
        };
      });
    }
    const pending = document.getElementById('candidatePending');
    if (pending){
      pending.querySelectorAll('[data-v3-pending]').forEach(btn => {
        btn.onclick = async () => {
          const emp = employeeById(btn.dataset.v3Pending);
          if (!emp) return;
          const assigned = btn.dataset.v3PendingAction === 'approve';
          btn.disabled = true;
          const ok = await setAssignmentById(activeCandidateSlot, emp.id, assigned);
          if (ok) openCandidate(activeCandidateSlot); else btn.disabled = false;
        };
      });
    }
  }

  openCandidate = function(slot){
    activeCandidateSlot = slot;
    const s = slotById(slot);
    const current = previewAssignments[slot] || [];
    const pendingRows = current.filter(a => a.status === 'pending');
    const title = document.getElementById('candidateTitle');
    if (title) title.textContent = s?.[1] || slot;

    const pendingBox = document.getElementById('candidatePending');
    if (pendingBox){
      pendingBox.innerHTML = pendingRows.length ? pendingRows.map(a => {
        const emp = employeeById(a.id) || employeeByName(a.name);
        if (!emp) return '';
        return `<div class="candidate pending"><div class="meta"><span class="assignmentTag pending">בקשת עובדת</span><b>${esc3(emp.name)}</b><small>${esc3(a.note || 'ללא הערה')}</small></div><div class="actions"><button class="btn primary" data-v3-pending="${esc3(emp.id)}" data-v3-pending-action="approve">אישור ושיבוץ</button><button class="btn danger" data-v3-pending="${esc3(emp.id)}" data-v3-pending-action="reject">דחייה</button></div></div>`;
      }).join('') : '<small>אין בקשות ממתינות במשמרת זו.</small>';
    }

    const list = document.getElementById('candidateList');
    if (list){
      list.innerHTML = employees.map(emp => {
        const existing = current.find(a => String(a.id || '') === String(emp.id) || a.name === emp.name);
        const av = availabilityForEmployee(slot, emp.name);
        const avText = av === 'unavailable' ? 'סימנה שלא יכולה — המנהל עדיין רשאי לשבץ' : av === 'preferred' ? 'מעדיפה משמרת זו' : av === 'available' ? 'זמינה' : 'לא הוגשה זמינות';
        const avCls = av === 'unavailable' ? 'candidateUnavailable' : av === 'preferred' ? 'candidatePreferred' : '';
        const isAssigned = existing?.status === 'approved';
        return `<div class="candidate ${isAssigned ? 'approved' : ''} ${avCls}"><div class="meta"><b>${esc3(emp.name)}</b><small>${esc3(employeeType(emp))} · ${esc3(emp.role || 'מכירה')}</small><small class="candidateAvailability">${esc3(avText)}</small></div><button class="btn ${isAssigned ? 'danger' : 'primary'}" data-v3-staff="${esc3(emp.id)}" data-v3-action="${isAssigned ? 'remove' : 'add'}">${isAssigned ? 'הסרה' : existing?.status === 'pending' ? 'אישור ושיבוץ' : 'שיבוץ'}</button></div>`;
      }).join('');
    }

    let bar = document.getElementById('candidateToolbar');
    if (!bar){
      bar = document.createElement('div');
      bar.id = 'candidateToolbar';
      bar.className = 'candidateToolbar';
      bar.innerHTML = '<b>בחר כמה עובדים שצריך — החלון נשאר פתוח</b><button class="btn secondary" id="candidateDoneBtn">חזרה לסידור</button>';
      title?.after(bar);
    }
    const done = document.getElementById('candidateDoneBtn');
    if (done) done.onclick = () => closeModal('candidateModal');
    bindCandidateV3();
    openModal('candidateModal');
  };

  choosePreviewEmployee = async function(name){
    const emp = employeeByName(name);
    if (!emp) return false;
    const ok = await setAssignmentById(activeCandidateSlot, emp.id, true);
    if (ok && document.getElementById('candidateModal')?.classList.contains('show')) openCandidate(activeCandidateSlot);
    return ok;
  };

  window.removeCandidateEmployee = async function(name){
    const emp = employeeByName(name);
    if (!emp) return false;
    const ok = await setAssignmentById(activeCandidateSlot, emp.id, false);
    if (ok && document.getElementById('candidateModal')?.classList.contains('show')) openCandidate(activeCandidateSlot);
    return ok;
  };

  approvePreview = async function(slot, name){
    const emp = employeeByName(name); if (!emp) return false;
    const ok = await setAssignmentById(slot, emp.id, true);
    if (ok && document.getElementById('candidateModal')?.classList.contains('show')) openCandidate(slot);
    return ok;
  };
  rejectPreview = async function(slot, name){
    const emp = employeeByName(name); if (!emp) return false;
    const ok = await setAssignmentById(slot, emp.id, false);
    if (ok && document.getElementById('candidateModal')?.classList.contains('show')) openCandidate(slot);
    return ok;
  };
  removePreview = async function(slot, name){
    const emp = employeeByName(name); if (!emp) return false;
    return setAssignmentById(slot, emp.id, false);
  };

  assignmentRow = function(a, slot){
    const emp = employeeById(a.id) || employeeByName(a.name);
    const staffId = emp?.id || a.id || '';
    const name = esc3(emp?.name || a.name);
    if (a.status === 'pending'){
      return `<div class="item pendingAssignment"><div class="meta"><span class="assignmentTag pending">בקשת עובדת</span><b>${name}</b><small>${esc3(a.note || 'בקשת שיבוץ עצמי')}</small></div><div class="actions"><button class="btn primary" data-v3-row="approve" data-v3-row-slot="${esc3(slot)}" data-v3-row-staff="${esc3(staffId)}">אישור</button><button class="btn danger" data-v3-row="remove" data-v3-row-slot="${esc3(slot)}" data-v3-row-staff="${esc3(staffId)}">דחייה</button></div></div>`;
    }
    return `<div class="item approvedAssignment"><div class="meta"><span class="assignmentTag approved">משובצת</span><b>${name}</b><small>${esc3(a.role || 'מכירה')}</small></div><button class="btn danger" ${published ? 'disabled' : ''} data-v3-row="remove" data-v3-row-slot="${esc3(slot)}" data-v3-row-staff="${esc3(staffId)}">×</button></div>`;
  };

  function bindScheduleRowsV3(){
    document.querySelectorAll('#scheduleCards [data-v3-row]').forEach(btn => {
      btn.onclick = async () => {
        const slot = btn.dataset.v3RowSlot;
        const staffId = btn.dataset.v3RowStaff;
        const assigned = btn.dataset.v3Row === 'approve';
        btn.disabled = true;
        const ok = await setAssignmentById(slot, staffId, assigned);
        if (!ok) btn.disabled = false;
      };
    });
  }

  const renderBeforeV3 = renderAdminSchedule;
  renderAdminSchedule = function(){
    renderBeforeV3();
    bindScheduleRowsV3();
  };

  window.setAssignmentById = setAssignmentById;
  setTimeout(() => { if (appSession?.type === 'admin') renderAdminSchedule(); }, 700);
})();