(() => {
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  let previewSettings={};

  async function loadPreviewSettings(){
    previewSettings={};
    if(appSession?.type!=='admin'||!adminWeekStart)return;
    const {data}=await supabaseClient.rpc('admin_get_schedule_slot_settings',{p_week_start:adminWeekStart});
    (data||[]).forEach(r=>previewSettings[r.slot_key]={required_count:Number(r.required_count),start_time:String(r.start_time).slice(0,5),end_time:String(r.end_time).slice(0,5)});
  }
  function cfg(slot){
    const s=slotById(slot),count=(previewAssignments[slot]||[]).filter(a=>a.status==='approved').length;
    return previewSettings[slot]||{required_count:Math.max(2,count),start_time:s?.[2]||'',end_time:s?.[3]||''};
  }

  async function renderSafePreview(){
    const box=document.getElementById('schedulePreviewBody');if(!box)return;
    await loadPreviewSettings();
    let total=0,missing=0;
    const dayHtml=adminDays.map(day=>`<article class="previewDay"><h3>${esc(day[0])}</h3>${day.slice(1).map(i=>{
      const s=slots[i],key=s[0],c=cfg(key),list=(previewAssignments[key]||[]).filter(a=>a.status==='approved');
      total+=list.length;if(list.length<c.required_count)missing++;
      const names=list.length?list.map(a=>`<span><b>${esc(a.name)}</b>${published?'':`<button type="button" data-preview-remove="1" data-slot="${encodeURIComponent(key)}" data-name="${encodeURIComponent(a.name)}">×</button>`}</span>`).join(''):'<em>טרם שובץ</em>';
      return `<section class="previewShift"><header><b>${key==='fri'?'שישי':key.endsWith('-am')?'בוקר':'ערב'}</b><span class="badge ${list.length<c.required_count?'bad':'ok'}">${list.length}/${c.required_count}</span></header><small>${esc(c.start_time)}–${esc(c.end_time)}</small><div class="previewNames">${names}</div>${published?'':`<button type="button" class="btn secondary" data-preview-add="1" data-slot="${encodeURIComponent(key)}">+ הוספת עובד</button>`}</section>`;
    }).join('')}</article>`).join('');
    box.innerHTML=`<div class="previewSummary"><b>${total} שיבוצים</b><span>${missing} משמרות מתחת ליעד</span></div><div class="previewWeek">${dayHtml}</div>`;
    box.querySelectorAll('[data-preview-remove]').forEach(btn=>btn.onclick=()=>removePreview(decodeURIComponent(btn.dataset.slot||''),decodeURIComponent(btn.dataset.name||'')));
    box.querySelectorAll('[data-preview-add]').forEach(btn=>btn.onclick=()=>{const slot=decodeURIComponent(btn.dataset.slot||'');closeModal('schedulePreviewModal');openCandidate(slot);});
  }

  window.openSchedulePreview=async function(){
    let m=document.getElementById('schedulePreviewModal');
    if(!m){
      m=document.createElement('div');m.id='schedulePreviewModal';m.className='modal';
      m.innerHTML='<section class="wideModal"><button class="close" id="safePreviewClose">×</button><h2>תצוגה שבועית מלאה</h2><p>כל השבוע מול העיניים. אפשר להסיר או להוסיף עובדים בלי לצאת מהסידור.</p><div id="schedulePreviewBody"></div></section>';
      document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m)closeModal('schedulePreviewModal')});
      document.getElementById('safePreviewClose').onclick=()=>closeModal('schedulePreviewModal');
    }
    await renderSafePreview();openModal('schedulePreviewModal');
  };

  removePreview=async function(slot,name){
    if(published){toast('הסידור כבר פורסם');return;}
    previewAssignments[slot]=(previewAssignments[slot]||[]).filter(x=>x.name!==name);
    renderAdminSchedule();
    if(document.getElementById('schedulePreviewModal')?.classList.contains('show'))await renderSafePreview();
    const ok=await saveScheduleToDb(false);
    toast(ok?'השיבוץ הוסר ונשמר':'השיבוץ הוסר במסך אך השמירה נכשלה');
  };

  function bindPreviewButton(){
    const b=document.getElementById('schedulePreviewBtn');
    if(!b)return false;
    b.onclick=window.openSchedulePreview;
    return true;
  }
  let tries=0;const t=setInterval(()=>{tries++;if(bindPreviewButton()||tries>40)clearInterval(t)},100);
})();