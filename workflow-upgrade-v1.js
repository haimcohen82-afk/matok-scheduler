(() => {
  const VERSION='20260815-workflow-1';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const typeLabel=t=>({contact:'פנייה / הצעת ייעול',shortage:'חוסר בחנות',hours:'תיקון שעות',document:'בקשת מסמך',financial:'בירור כספי'}[t]||'פנייה');
  const statusLabel=r=>r.archived_at?'טופל ונכנס לארכיון':r.manager_reply_at?'נענתה':r.viewed_at?'נצפתה על ידי המנהל':'נשלחה';
  let waQueue=[];let waIndex=0;

  function addStyles(){
    if(document.getElementById('workflowUpgradeStyles'))return;
    const s=document.createElement('style');s.id='workflowUpgradeStyles';s.textContent=`
      .engagementBanner{background:linear-gradient(135deg,#eef9f6,#fff);border:1px solid #a8d9ce;border-right:6px solid var(--teal);border-radius:13px;padding:13px 14px;margin:11px 0;line-height:1.55}.engagementBanner b{display:block;font-size:15px}.engagementBanner small{color:var(--muted)}
      .messageCard{border:1px solid var(--line);border-radius:12px;padding:12px;background:#fff;margin-top:9px}.messageCard.unread{border-right:6px solid var(--coral);background:#fffaf7}.messageCard.archived{opacity:.82;background:var(--soft)}.messageHead{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.messageHead small{color:var(--muted)}.messageStatus{display:inline-flex;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:900;background:#ece8e1}.messageStatus.viewed{background:#e7f1ff;color:#295f8d}.messageStatus.replied{background:#e6f5e6;color:#356c38}.managerReply{margin-top:9px;padding:9px 11px;border-radius:9px;background:#eef9f6;border-right:4px solid var(--teal)}.managerReply b{display:block}.messageAdminActions{display:grid;grid-template-columns:auto 1fr auto;gap:7px;align-items:end;margin-top:10px}.messageAdminActions textarea{min-height:62px}.archiveBox{margin-top:14px;border-top:1px solid var(--line);padding-top:12px}.workerMessagesList{margin-top:12px}.summaryTable{display:grid;gap:7px}.summaryRow{display:grid;grid-template-columns:1.4fr repeat(4,.8fr);gap:6px;align-items:center;border:1px solid var(--line);border-radius:9px;padding:9px;background:#fff}.summaryRow.head{font-size:10px;font-weight:900;background:var(--soft)}.summaryRow b{font-size:12px}.waRow{display:flex;justify-content:space-between;align-items:center;gap:8px;border:1px solid var(--line);border-radius:9px;padding:9px;margin-top:7px}.waProgress{margin:10px 0;padding:9px;border-radius:9px;background:var(--soft)}
      .dayCompactSummary{display:none}.dayNavControls{display:none}
      @media(max-width:850px){
        .adminSwipeHint{display:none!important}.adminScheduleDays{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;overflow:visible!important;margin:0!important;padding:0!important;direction:rtl!important}.adminDayCard{flex:auto!important;min-width:0!important;width:auto!important;scroll-snap-align:none!important}.adminDayCard:not(.dayExpanded)>.adminDayHeader+div{display:none!important}.adminDayCard.dayExpanded{grid-column:1/-1}.dayCompactSummary{display:block;padding:9px;font-size:10px;background:#fff}.dayCompactSummary span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.adminDayCard.dayExpanded .dayCompactSummary{display:none}.adminDayHeader{cursor:pointer;min-height:68px}.adminDayHeader b{font-size:17px!important}.adminDayHeader span{font-size:9px!important}.dayNavControls{display:flex;gap:7px;padding:9px;background:var(--soft);border-top:1px solid var(--line)}.dayNavControls .btn{flex:1}.messageAdminActions{grid-template-columns:1fr}.summaryRow{grid-template-columns:1.3fr repeat(2,.75fr)}.summaryRow .hideMobile{display:none}.waRow{align-items:flex-start;flex-wrap:wrap}.waRow .btn{width:100%}
      }
    `;document.head.appendChild(s);
  }

  function injectEngagementBanner(){
    const worker=document.getElementById('worker');const hero=worker?.querySelector('.hero');if(!hero||document.getElementById('employeeEngagementBanner'))return;
    const b=document.createElement('div');b.id='employeeEngagementBanner';b.className='engagementBanner';b.innerHTML='<b>חשוב לנו שתהיי פעילה ותעדכני אותנו</b><small>ראית חוסר בחנות, שינוי שצריך לבצע, תקלה או רעיון לשיפור? שלחי דרך „פניות וחוסרים”. כך אנחנו נשארים תמיד בעניינים ויכולים לטפל מהר.</small>';
    hero.after(b);
  }

  function buildWorkerContactPanel(){
    const panel=document.getElementById('contact');if(!panel)return;
    panel.innerHTML=`
      <div class="engagementBanner"><b>העיניים של הצוות חשובות לנו</b><small>חוסר, שינוי, בקשה או רעיון לשיפור — שולחים כאן. אחרי שהמנהל צפה, תראי סימון ברור; אם נשלחה תשובה היא תופיע אצלך במערכת.</small></div>
      <div class="grid2">
        <article class="card"><h2>פנייה / הצעת ייעול</h2><div class="form"><label>סוג<select id="teamMessageKind"><option>הצעת ייעול</option><option>בקשה</option><option>הערה</option><option>שינוי בחנות</option></select></label><label>נושא<input id="teamMessageTitle" placeholder="נושא קצר וברור"></label><label>פירוט<textarea id="teamMessageBody" rows="4" placeholder="מה חשוב שנדע?"></textarea></label><button class="btn primary" id="sendTeamMessageBtn">שליחה למנהל</button></div></article>
        <article class="card"><h2>דיווח חוסר בחנות</h2><div class="form"><label>מה חסר?<input id="shortageItem" placeholder="לדוגמה: שקיות בינוניות"></label><label>כמות / פירוט<input id="shortageQty" placeholder="לדוגמה: נשארו 2 בלבד"></label><label>הערה<textarea id="shortageNote" rows="4" placeholder="איפה חסר ומה דחוף?"></textarea></label><button class="btn primary" id="sendShortageBtn">שליחת החוסר</button></div></article>
      </div>
      <article class="card"><div class="employeeHead"><div><h2>הפניות שלי</h2><small>כאן רואים אם המנהל צפה, ענה או סיים טיפול.</small></div><button class="btn secondary" id="refreshMyMessages">רענון</button></div><div id="myMessagesList" class="workerMessagesList"><small>טוען…</small></div></article>`;
    document.getElementById('sendTeamMessageBtn').onclick=submitTeamMessage;
    document.getElementById('sendShortageBtn').onclick=submitShortage;
    document.getElementById('refreshMyMessages').onclick=loadWorkerMessages;
  }

  async function submitTeamMessage(){
    if(appSession?.type!=='employee')return;
    const kind=document.getElementById('teamMessageKind')?.value||'פנייה';
    const title=document.getElementById('teamMessageTitle')?.value.trim()||'';
    const body=document.getElementById('teamMessageBody')?.value.trim()||'';
    if(!body){toast('יש לכתוב את תוכן הפנייה');return}
    const {error}=await supabaseClient.rpc('employee_submit_report',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code,p_report_type:'contact',p_title:title?`${kind} · ${title}`:kind,p_body:body,p_payload:{kind}});
    if(error){console.error(error);toast('שליחת הפנייה נכשלה');return}
    document.getElementById('teamMessageTitle').value='';document.getElementById('teamMessageBody').value='';toast('הפנייה נשלחה למנהל');await loadWorkerMessages();
  }
  async function submitShortage(){
    if(appSession?.type!=='employee')return;
    const item=document.getElementById('shortageItem')?.value.trim()||'',qty=document.getElementById('shortageQty')?.value.trim()||'',note=document.getElementById('shortageNote')?.value.trim()||'';
    if(!item){toast('יש לרשום מה חסר');return}
    const body=[qty&&`כמות/מצב: ${qty}`,note].filter(Boolean).join('\n');
    const {error}=await supabaseClient.rpc('employee_submit_report',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code,p_report_type:'shortage',p_title:item,p_body:body,p_payload:{item,qty,note}});
    if(error){console.error(error);toast('שליחת החוסר נכשלה');return}
    ['shortageItem','shortageQty','shortageNote'].forEach(id=>document.getElementById(id).value='');toast('החוסר נשלח למנהל');await loadWorkerMessages();
  }

  async function loadWorkerMessages(){
    const box=document.getElementById('myMessagesList');if(!box||appSession?.type!=='employee')return;
    box.innerHTML='<small>טוען…</small>';
    const {data,error}=await supabaseClient.rpc('employee_get_reports_v2',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code});
    if(error){console.error(error);box.innerHTML='<small>לא ניתן לטעון את הפניות כרגע.</small>';return}
    const rows=(data||[]).filter(r=>['contact','shortage','financial','document','hours'].includes(r.report_type));
    if(!rows.length){box.innerHTML='<small>עדיין לא שלחת פניות.</small>';return}
    box.innerHTML=rows.map(r=>`<div class="messageCard ${r.archived_at?'archived':''}"><div class="messageHead"><div><b>${esc(typeLabel(r.report_type))} · ${esc(r.title||'ללא כותרת')}</b><small>${new Date(r.created_at).toLocaleString('he-IL')}</small></div><span class="messageStatus ${r.manager_reply_at?'replied':r.viewed_at?'viewed':''}">${esc(statusLabel(r))}</span></div><p>${esc(r.body||'').replace(/\n/g,'<br>')}</p>${r.manager_note?`<div class="managerReply"><b>תגובת המנהל</b>${esc(r.manager_note).replace(/\n/g,'<br>')}</div>`:''}</div>`).join('');
  }

  function buildAdminRequestsPanel(){
    const panel=document.getElementById('requests');if(!panel)return;
    panel.innerHTML=`<article class="card"><div class="employeeHead"><div><h2>פניות, רעיונות וחוסרים מהצוות</h2><small>מוצגים רק עובדים אמיתיים ופעילים מהמערכת.</small></div><button class="btn secondary" id="refreshManagerMessages">רענון</button></div><div id="managerMessagesList"><small>טוען…</small></div><div class="archiveBox"><button class="btn secondary" id="toggleMessageArchive">הצגת ארכיון שטופל</button><div id="managerMessagesArchive" style="display:none;margin-top:9px"></div></div></article>`;
    document.getElementById('refreshManagerMessages').onclick=loadManagerMessages;
    document.getElementById('toggleMessageArchive').onclick=async()=>{const b=document.getElementById('managerMessagesArchive');const show=b.style.display==='none';b.style.display=show?'block':'none';document.getElementById('toggleMessageArchive').textContent=show?'הסתרת הארכיון':'הצגת ארכיון שטופל';if(show)await loadManagerArchive();};
  }

  function renderAdminMessage(r){
    return `<div class="messageCard ${!r.viewed_at?'unread':''}"><div class="messageHead"><div><b>${esc(r.full_name)} · ${esc(typeLabel(r.report_type))}</b><small>${esc(r.title||'ללא כותרת')} · ${new Date(r.created_at).toLocaleString('he-IL')}</small></div><span class="messageStatus ${r.manager_reply_at?'replied':r.viewed_at?'viewed':''}">${esc(statusLabel(r))}</span></div><p>${esc(r.body||'').replace(/\n/g,'<br>')}</p>${r.manager_note?`<div class="managerReply"><b>תגובה שנשלחה לעובד</b>${esc(r.manager_note).replace(/\n/g,'<br>')}</div>`:''}<div class="messageAdminActions">${r.viewed_at?'':`<button class="btn secondary" data-msg-viewed="${r.id}">סמן שצפיתי</button>`}<textarea data-msg-reply="${r.id}" placeholder="תגובה לעובד…">${esc(r.manager_note||'')}</textarea><div class="actions"><button class="btn primary" data-msg-send="${r.id}">שליחת תגובה</button><button class="btn secondary" data-msg-archive="${r.id}">טופל סופית → ארכיון</button></div></div></div>`;
  }

  function bindManagerMessageActions(root){
    root.querySelectorAll('[data-msg-viewed]').forEach(b=>b.onclick=async()=>{const {error}=await supabaseClient.rpc('admin_mark_staff_report_viewed',{p_report_id:b.dataset.msgViewed});if(error){toast('העדכון נכשל');return}toast('סומן: צפיתי בהודעה');await loadManagerMessages();});
    root.querySelectorAll('[data-msg-send]').forEach(b=>b.onclick=async()=>{const id=b.dataset.msgSend;const txt=root.querySelector(`[data-msg-reply="${id}"]`)?.value.trim()||'';if(!txt){toast('יש לכתוב תגובה');return}const {error}=await supabaseClient.rpc('admin_reply_staff_report',{p_report_id:id,p_reply:txt});if(error){console.error(error);toast('שליחת התגובה נכשלה');return}toast('התגובה נשמרה ותופיע לעובד במערכת');await loadManagerMessages();});
    root.querySelectorAll('[data-msg-archive]').forEach(b=>b.onclick=async()=>{const id=b.dataset.msgArchive;const txt=root.querySelector(`[data-msg-reply="${id}"]`)?.value.trim()||'';if(!confirm('לסמן שטופל סופית ולהעביר לארכיון?'))return;const {error}=await supabaseClient.rpc('admin_archive_staff_report',{p_report_id:id,p_final_reply:txt||null});if(error){console.error(error);toast('העברה לארכיון נכשלה');return}toast('הפנייה טופלה והועברה לארכיון');await loadManagerMessages();});
  }

  async function loadManagerMessages(){
    const box=document.getElementById('managerMessagesList');if(!box||appSession?.type!=='admin')return;box.innerHTML='<small>טוען…</small>';
    const {data,error}=await supabaseClient.rpc('admin_get_staff_reports_v2',{p_include_archived:false});if(error){console.error(error);box.innerHTML='<small>טעינת הפניות נכשלה.</small>';return}
    const rows=(data||[]).filter(r=>r.report_type!=='hours');box.innerHTML=rows.length?rows.map(renderAdminMessage).join(''):'<small>אין פניות פתוחות כרגע.</small>';bindManagerMessageActions(box);
  }
  async function loadManagerArchive(){
    const box=document.getElementById('managerMessagesArchive');if(!box||appSession?.type!=='admin')return;box.innerHTML='<small>טוען ארכיון…</small>';
    const {data,error}=await supabaseClient.rpc('admin_get_staff_reports_v2',{p_include_archived:true});if(error){box.innerHTML='<small>טעינת הארכיון נכשלה.</small>';return}
    box.innerHTML=(data||[]).length?(data||[]).map(r=>`<div class="messageCard archived"><div class="messageHead"><div><b>${esc(r.full_name)} · ${esc(typeLabel(r.report_type))}</b><small>${esc(r.title)} · ${new Date(r.created_at).toLocaleString('he-IL')}</small></div><span class="messageStatus replied">טופל</span></div><p>${esc(r.body||'').replace(/\n/g,'<br>')}</p>${r.manager_note?`<div class="managerReply"><b>תגובה סופית</b>${esc(r.manager_note).replace(/\n/g,'<br>')}</div>`:''}</div>`).join(''):'<small>הארכיון ריק.</small>';
  }

  async function buildRealAttendancePanel(){
    const panel=document.getElementById('attendance');if(!panel)return;
    panel.innerHTML='<article class="card"><div class="employeeHead"><div><h2>תיקוני שעות שהעובדים שלחו</h2><small>אין כאן נתוני דמו. רק פניות אמיתיות מהעובדים הפעילים.</small></div><button class="btn secondary" id="refreshRealHours">רענון</button></div><div id="realHoursReports"><small>טוען…</small></div></article>';
    document.getElementById('refreshRealHours').onclick=loadRealHoursReports;
  }
  async function loadRealHoursReports(){
    const box=document.getElementById('realHoursReports');if(!box||appSession?.type!=='admin')return;const {data,error}=await supabaseClient.rpc('admin_get_staff_reports_v2',{p_include_archived:false});if(error){box.innerHTML='<small>טעינת הדיווחים נכשלה.</small>';return}const rows=(data||[]).filter(r=>r.report_type==='hours');box.innerHTML=rows.length?rows.map(renderAdminMessage).join(''):'<small>אין כרגע תיקוני שעות פתוחים.</small>';bindManagerMessageActions(box);
  }

  function injectScheduleButtons(){
    const controls=document.querySelector('#adminSchedule .scheduleControls');if(!controls)return;
    if(!document.getElementById('staffWeekSummaryBtn')){const b=document.createElement('button');b.id='staffWeekSummaryBtn';b.className='btn secondary';b.textContent='סיכום עובדים';b.onclick=openWeekStaffSummary;controls.appendChild(b)}
    if(!document.getElementById('schedulePreviewBtn')&&typeof window.openSchedulePreview==='function'){const b=document.createElement('button');b.id='schedulePreviewBtn';b.className='btn secondary';b.textContent='תצוגה שבועית';b.onclick=window.openSchedulePreview;controls.appendChild(b)}
  }

  async function openWeekStaffSummary(){
    if(appSession?.type!=='admin')return;
    let m=document.getElementById('staffWeekSummaryModal');if(!m){m=document.createElement('div');m.id='staffWeekSummaryModal';m.className='modal';m.innerHTML='<section class="wideModal"><button class="close" id="closeStaffSummary">×</button><h2>סיכום צוות לשבוע</h2><p id="staffSummaryWeek"></p><div id="staffSummaryBody"><small>טוען…</small></div></section>';document.body.appendChild(m);document.getElementById('closeStaffSummary').onclick=()=>closeModal('staffWeekSummaryModal');m.addEventListener('click',e=>{if(e.target===m)closeModal('staffWeekSummaryModal')});}
    document.getElementById('staffSummaryWeek').textContent='שבוע '+weekLabel(adminWeekStart);document.getElementById('staffSummaryBody').innerHTML='<small>טוען…</small>';openModal('staffWeekSummaryModal');
    const {data,error}=await supabaseClient.rpc('admin_get_week_staff_summary',{p_week_start:adminWeekStart});if(error){console.error(error);document.getElementById('staffSummaryBody').innerHTML='<small>טעינת הסיכום נכשלה.</small>';return}
    const rows=data||[];document.getElementById('staffSummaryBody').innerHTML=`<div class="summaryTable"><div class="summaryRow head"><span>עובד/ת</span><span>נתנה</span><span>יכלה</span><span class="hideMobile">שובצה</span><span class="hideMobile">חובה</span></div>${rows.map(r=>`<div class="summaryRow"><b>${esc(r.full_name)}</b><span>${r.submitted_at?`${r.offered_count}`:'לא הגישה'}</span><span>${r.submitted_at?`${r.possible_count}`:'—'}</span><span class="hideMobile">${r.assigned_count}</span><span class="hideMobile">${r.weekly_required}</span></div>`).join('')}</div><p><small>„נתנה” = משמרות שסימנה זמינה/מועדפת. „יכלה” = כל המשמרות שהמערכת הציגה לה באותה הגשה. „שובצה” = שיבוצים שאושרו בפועל.</small></p>`;
  }

  function resetAvailabilityAfterPublish(){
    adminAvailabilityBySlot={};adminAvailabilityNotes=[];
    const box=document.getElementById('adminAvailabilitySummary');if(box)box.innerHTML='<div class="availabilityEmpty"><b>סבב הזמינות של השבוע הזה נסגר.</b><br>ההגשות הישנות הועברו להיסטוריה ולא מוצגות כאן יותר. לשבוע הבא מתחילים מ־0.</div>';
    try{renderAdminSchedule();renderAdminOverview(new Map())}catch(e){}
  }

  function buildWhatsAppModal(){
    let m=document.getElementById('scheduleWhatsappModal');if(m)return m;
    m=document.createElement('div');m.id='scheduleWhatsappModal';m.className='modal';m.innerHTML='<section><button class="close" id="closeWaQueue">×</button><h2>הודעה לצוות: הסידור פורסם</h2><p>כל העובדים הפעילים מוכנים לשליחה. לחיצה על „פתח הבא” פותחת את WhatsApp עם הודעה מוכנה לעובד הבא.</p><div id="waQueueProgress" class="waProgress"></div><button class="btn primary" id="waOpenNext">פתח הבא ב־WhatsApp</button><div id="waQueueList"></div></section>';document.body.appendChild(m);document.getElementById('closeWaQueue').onclick=()=>closeModal('scheduleWhatsappModal');document.getElementById('waOpenNext').onclick=openNextWhatsapp;return m;
  }
  function openPublishWhatsAppQueue(){
    waQueue=(employees||[]).filter(e=>e.phone);waIndex=0;const m=buildWhatsAppModal();renderWaQueue();openModal('scheduleWhatsappModal');
  }
  function renderWaQueue(){
    const p=document.getElementById('waQueueProgress'),list=document.getElementById('waQueueList'),btn=document.getElementById('waOpenNext');if(!p||!list)return;p.textContent=`${waIndex} מתוך ${waQueue.length} הודעות נפתחו`;list.innerHTML=waQueue.map((e,i)=>`<div class="waRow"><span>${i<waIndex?'✓ ':''}${esc(e.name)}</span><button class="btn secondary" data-wa-one="${i}">פתח הודעה</button></div>`).join('');list.querySelectorAll('[data-wa-one]').forEach(b=>b.onclick=()=>openWhatsappForEmployee(waQueue[Number(b.dataset.waOne)]));if(btn){btn.disabled=waIndex>=waQueue.length;btn.textContent=waIndex>=waQueue.length?'כל ההודעות נפתחו':'פתח הבא ב־WhatsApp'}}
  function publishMessage(e){return `היי ${e.name},\nסידור העבודה לשבוע ${weekLabel(adminWeekStart)} פורסם במערכת MATOK.\n\nאפשר להיכנס עכשיו ולראות את המשמרות שלך:\nhttps://voluble-marigold-95c410.netlify.app/?login=employee\n\nתודה ובהצלחה לכולנו.`}
  function openWhatsappForEmployee(e){if(!e)return;const phone=typeof normalizeIsraeliPhone==='function'?normalizeIsraeliPhone(e.phone):String(e.phone||'').replace(/\D/g,'');window.open(`https://wa.me/${phone}?text=${encodeURIComponent(publishMessage(e))}`,'_blank')}
  function openNextWhatsapp(){if(waIndex>=waQueue.length)return;openWhatsappForEmployee(waQueue[waIndex]);waIndex++;renderWaQueue()}

  function decorateScheduleDays(){
    const cards=[...document.querySelectorAll('#scheduleCards .adminDayCard')];if(!cards.length)return;
    cards.forEach((card,i)=>{
      const day=adminDays[i];if(!day)return;const head=card.querySelector('.adminDayHeader');if(!head)return;
      let summary=card.querySelector('.dayCompactSummary');if(!summary){summary=document.createElement('div');summary.className='dayCompactSummary';head.after(summary)}
      const bits=day.slice(1).map(idx=>{const s=slots[idx],list=(previewAssignments[s[0]]||[]).filter(a=>a.status==='approved');const label=s[0]==='fri'?'שישי':s[0].endsWith('-am')?'בוקר':'ערב';return `<span><b>${label} ${list.length}</b>${list.length?' · '+esc(list.map(a=>a.name).join(', ')):''}</span>`});summary.innerHTML=bits.join('');
      head.onclick=e=>{if(e.target.closest('button'))return;cards.forEach((c,j)=>{if(j!==i)c.classList.remove('dayExpanded')});card.classList.toggle('dayExpanded');if(card.classList.contains('dayExpanded'))setTimeout(()=>card.scrollIntoView({behavior:'smooth',block:'start'}),50)};
      let nav=card.querySelector('.dayNavControls');if(!nav){nav=document.createElement('div');nav.className='dayNavControls';nav.innerHTML='<button class="btn secondary" data-day-prev>יום קודם</button><button class="btn secondary" data-day-next>יום הבא</button>';card.appendChild(nav)}
      const go=delta=>{const target=cards[(i+delta+cards.length)%cards.length];card.classList.remove('dayExpanded');target.classList.add('dayExpanded');setTimeout(()=>target.scrollIntoView({behavior:'smooth',block:'start'}),30)};nav.querySelector('[data-day-prev]').onclick=()=>go(-1);nav.querySelector('[data-day-next]').onclick=()=>go(1);
    });
  }

  function patchScheduleWorkflow(){
    injectScheduleButtons();
    if(typeof renderAdminSchedule==='function'&&!renderAdminSchedule.__workflowPatched){const old=renderAdminSchedule;const wrapped=function(...args){const r=old.apply(this,args);setTimeout(decorateScheduleDays,0);setTimeout(injectScheduleButtons,0);return r};wrapped.__workflowPatched=true;renderAdminSchedule=wrapped;setTimeout(decorateScheduleDays,0)}
    if(typeof loadAdminAvailability==='function'&&!loadAdminAvailability.__workflowPatched){const oldLoad=loadAdminAvailability;const wrapped=async function(...args){const r=await oldLoad.apply(this,args);if(currentWeekRecord?.status==='published'||published)resetAvailabilityAfterPublish();return r};wrapped.__workflowPatched=true;loadAdminAvailability=wrapped}
    if(typeof publishPreview==='function'&&!publishPreview.__workflowPatched){const oldPublish=publishPreview;const wrapped=async function(...args){const was=published;const r=await oldPublish.apply(this,args);if(!was&&published){try{await supabaseClient.rpc('admin_ensure_week',{p_week_start:addDaysIso(adminWeekStart,7)})}catch(e){}resetAvailabilityAfterPublish();openPublishWhatsAppQueue()}return r};wrapped.__workflowPatched=true;publishPreview=wrapped}
  }

  function bindTabRefreshes(){
    document.querySelectorAll('.workerTabs button').forEach(b=>{if(b.dataset.target==='contact')b.addEventListener('click',()=>setTimeout(loadWorkerMessages,0))});
    document.querySelectorAll('.adminTabs button').forEach(b=>{if(b.dataset.target==='requests')b.addEventListener('click',()=>setTimeout(loadManagerMessages,0));if(b.dataset.target==='attendance')b.addEventListener('click',()=>setTimeout(loadRealHoursReports,0))});
  }

  function init(){
    addStyles();injectEngagementBanner();buildWorkerContactPanel();buildAdminRequestsPanel();buildRealAttendancePanel();patchScheduleWorkflow();bindTabRefreshes();
    setTimeout(()=>{patchScheduleWorkflow();decorateScheduleDays();if(appSession?.type==='employee')loadWorkerMessages();if(appSession?.type==='admin'){loadManagerMessages();loadRealHoursReports()}},900);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.loadWorkerMessages=loadWorkerMessages;window.loadManagerMessages=loadManagerMessages;window.openWeekStaffSummary=openWeekStaffSummary;
})();