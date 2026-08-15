(() => {
  const esc2=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const byEmp=(name)=>employees.find(e=>e.name===name);
  const avState=(slot,name)=>(adminAvailabilityBySlot[slot]||[]).find(x=>x.name===name)?.status||'';

  function bindCandidateButtons(){
    const list=document.getElementById('candidateList');
    if(!list)return;
    list.querySelectorAll('[data-candidate-action]').forEach(btn=>{
      btn.onclick=()=>{
        const id=btn.dataset.employeeId;
        const emp=employees.find(e=>String(e.id)===String(id));
        if(!emp)return;
        if(btn.dataset.candidateAction==='remove') window.removeCandidateEmployee(emp.name);
        else choosePreviewEmployee(emp.name);
      };
    });
    document.querySelectorAll('#candidatePending [data-pending-action]').forEach(btn=>{
      btn.onclick=()=>{
        const name=decodeURIComponent(btn.dataset.employeeName||'');
        if(btn.dataset.pendingAction==='approve')approvePreview(activeCandidateSlot,name);
        else rejectPreview(activeCandidateSlot,name);
      };
    });
  }

  openCandidate=function(slot){
    activeCandidateSlot=slot;
    const s=slotById(slot),current=previewAssignments[slot]||[],pending=current.filter(a=>a.status==='pending');
    const title=document.getElementById('candidateTitle');if(title)title.textContent=s?.[1]||slot;
    const pendingBox=document.getElementById('candidatePending');
    if(pendingBox)pendingBox.innerHTML=pending.length?pending.map(a=>`<div class="candidate pending"><div class="meta"><span class="assignmentTag pending">בקשת עובדת</span><b>${esc2(a.name)}</b><small>${esc2(a.note||'ללא הערה')}</small></div><div class="actions"><button class="btn primary" data-pending-action="approve" data-employee-name="${encodeURIComponent(a.name)}">אישור</button><button class="btn danger" data-pending-action="reject" data-employee-name="${encodeURIComponent(a.name)}">דחייה</button></div></div>`).join(''):'<small>אין בקשות ממתינות במשמרת זו.</small>';
    const list=document.getElementById('candidateList');
    if(list)list.innerHTML=employees.map(e=>{
      const existing=current.find(a=>a.id===e.id||a.name===e.name),av=avState(slot,e.name);
      const avText=av==='unavailable'?'לא יכולה לפי הדיווח — מנהל עדיין יכול לשבץ':av==='preferred'?'מעדיפה משמרת זו':av==='available'?'זמינה':'לא הוגשה זמינות';
      const avCls=av==='unavailable'?'candidateUnavailable':av==='preferred'?'candidatePreferred':'';
      const action=existing?.status==='approved'?'remove':'add';
      const label=existing?.status==='approved'?'הסרה':existing?.status==='pending'?'אישור ושיבוץ':'שיבוץ';
      const cls=action==='remove'?'danger':'primary';
      return `<div class="candidate ${existing?'approved':''} ${avCls}"><div class="meta"><b>${esc2(e.name)}</b><small>${esc2(employeeType(e))} · ${esc2(e.role||'מכירה')}</small><small class="candidateAvailability">${esc2(avText)}</small></div><button class="btn ${cls}" data-candidate-action="${action}" data-employee-id="${esc2(e.id)}">${label}</button></div>`;
    }).join('');
    let bar=document.getElementById('candidateToolbar');
    if(!bar){bar=document.createElement('div');bar.id='candidateToolbar';bar.className='candidateToolbar';bar.innerHTML='<b>אפשר לבחור כמה עובדים ברצף</b><button class="btn secondary" id="candidateDoneBtn">חזרה לסידור</button>';title?.after(bar);}
    const done=document.getElementById('candidateDoneBtn');if(done)done.onclick=()=>closeModal('candidateModal');
    bindCandidateButtons();
    openModal('candidateModal');
  };

  assignmentRow=function(a,slot){
    const name=esc2(a.name),slotEnc=encodeURIComponent(slot),nameEnc=encodeURIComponent(a.name);
    if(a.status==='pending')return `<div class="item pendingAssignment"><div class="meta"><span class="assignmentTag pending">בקשת עובדת</span><b>${name}</b><small>${esc2(a.note||'בקשת שיבוץ עצמי')}</small></div><div class="actions"><button class="btn primary" data-row-action="approve" data-slot="${slotEnc}" data-name="${nameEnc}">אישור</button><button class="btn danger" data-row-action="reject" data-slot="${slotEnc}" data-name="${nameEnc}">דחייה</button></div></div>`;
    return `<div class="item approvedAssignment"><div class="meta"><span class="assignmentTag approved">משובצת</span><b>${name}</b><small>${esc2(a.role||'מכירה')}</small></div><button class="btn danger" ${published?'disabled':''} data-row-action="remove" data-slot="${slotEnc}" data-name="${nameEnc}">×</button></div>`;
  };

  const oldRender=renderAdminSchedule;
  renderAdminSchedule=function(){
    oldRender();
    document.querySelectorAll('#scheduleCards [data-row-action]').forEach(btn=>{
      btn.onclick=()=>{
        const slot=decodeURIComponent(btn.dataset.slot||''),name=decodeURIComponent(btn.dataset.name||'');
        if(btn.dataset.rowAction==='approve')approvePreview(slot,name);
        else if(btn.dataset.rowAction==='reject')rejectPreview(slot,name);
        else removePreview(slot,name);
      };
    });
  };

  const oldOpenPreview=window.openSchedulePreview;
  if(typeof oldOpenPreview==='function'){
    window.openSchedulePreview=function(){oldOpenPreview();setTimeout(()=>{
      document.querySelectorAll('#schedulePreviewBody button').forEach(btn=>{
        if(btn.textContent.trim()==='×'){
          const wrap=btn.closest('.previewShift');
          const person=btn.parentElement?.firstChild?.textContent?.trim();
          if(!person||!wrap)return;
        }
      });
    },0)};
  }

  setTimeout(()=>{ if(appSession?.type==='admin'){renderAdminSchedule();} },900);
})();