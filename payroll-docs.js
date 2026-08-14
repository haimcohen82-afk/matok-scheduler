(() => {
  const VERSION = '20260814-1';
  let payrollFileBytes = null;
  let payrollAssignments = [];
  let payrollStaff = [];

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const norm = v => String(v ?? '').toLowerCase().replace(/[\u0591-\u05C7]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  const safePart = v => String(v || '').replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,40) || 'period';
  const loadScript = src => new Promise((resolve,reject)=>{ if(document.querySelector(`script[src="${src}"]`)) return resolve(); const s=document.createElement('script'); s.src=src; s.onload=resolve; s.onerror=reject; document.head.appendChild(s); });
  const setStatus = (text, bad=false) => { const el=document.getElementById('payrollStatus'); if(el){ el.textContent=text; el.style.color=bad?'#a43d35':'#706b65'; } };

  async function ensurePdfLibs(){
    if(!window.pdfjsLib) await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
    if(window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    if(!window.PDFLib) await loadScript('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js');
  }

  function addStyles(){
    if(document.getElementById('payrollDocsStyles')) return;
    const style=document.createElement('style'); style.id='payrollDocsStyles'; style.textContent=`
      .payrollDrop{border:2px dashed var(--line);border-radius:12px;padding:18px;background:var(--soft);text-align:center}
      .payrollDrop input{margin-top:8px}.payrollReview{display:grid;gap:7px;margin-top:10px}.payrollPage{display:grid;grid-template-columns:90px 1fr 220px;gap:8px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:9px;background:#fff}.payrollPage small{color:var(--muted)}
      .docRow{display:flex;gap:9px;align-items:center;justify-content:space-between;border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--soft);margin-top:7px}.docRow .meta{flex:1}.docRow .meta b{display:block}.docRow .meta small{color:var(--muted)}
      .docType{display:inline-flex;padding:4px 7px;border-radius:999px;font-size:10px;font-weight:900;background:#e8f3ff;color:#265d86}.docType.hours{background:#eef7e9;color:#356934}
      @media(max-width:850px){.payrollPage{grid-template-columns:1fr}.docRow{align-items:flex-start;flex-wrap:wrap}.docRow .actions{width:100%}}
    `; document.head.appendChild(style);
  }

  function injectAdmin(){
    const tabs=document.querySelector('.adminTabs'); const admin=document.getElementById('admin');
    if(!tabs||!admin||document.getElementById('payrollDocsAdmin')) return;
    const btn=document.createElement('button'); btn.dataset.target='payrollDocsAdmin'; btn.textContent='שכר ומסמכים'; tabs.appendChild(btn);
    const panel=document.createElement('section'); panel.id='payrollDocsAdmin'; panel.className='panel'; panel.innerHTML=`
      <article class="card">
        <div class="employeeHead"><div><h2>תלושי שכר ודוחות שעות</h2><small>העלאת PDF מרוכז, זיהוי עובדים, פירוק לקבצים פרטיים ושמירה זמנית.</small></div><span class="badge ok">פרטי ומאובטח</span></div>
        <div class="formgrid">
          <label>סוג מסמך<select id="payrollDocType"><option value="payslip">תלושי שכר</option><option value="hours">דוחות שעות עבודה</option></select></label>
          <label>תקופה<input id="payrollPeriod" placeholder="לדוגמה: 07/2026"></label>
          <label>זמינות לעובד<select id="payrollRetention"><option value="3">3 ימים</option><option value="7" selected>7 ימים</option><option value="14">14 ימים</option><option value="30">30 ימים</option></select></label>
          <label>קובץ PDF<input id="payrollFile" type="file" accept="application/pdf,.pdf"></label>
        </div>
        <div class="actions" style="margin-top:10px"><button id="analyzePayrollBtn" class="btn primary">ניתוח וזיהוי עובדים</button><button id="savePayrollBtn" class="btn secondary" disabled>פירוק ושמירה לעובדים</button></div>
        <p id="payrollStatus">לא נבחר קובץ.</p>
        <div id="payrollReview" class="payrollReview"></div>
      </article>
      <article class="card"><div class="employeeHead"><div><h2>מסמכים פעילים</h2><small>מסמכים פגים אוטומטית ולא יוצגו לעובד לאחר מועד התפוגה.</small></div><button id="refreshPayrollDocs" class="btn secondary">רענון</button></div><div id="adminPayrollDocs"><small>טוען…</small></div></article>`;
    admin.appendChild(panel);

    btn.addEventListener('click',()=>{
      tabs.querySelectorAll('button').forEach(x=>x.classList.remove('active')); btn.classList.add('active');
      admin.querySelectorAll(':scope > .panel').forEach(x=>x.classList.remove('active')); panel.classList.add('active');
      loadAdminDocuments();
    });
    document.getElementById('analyzePayrollBtn').addEventListener('click', analyzePayrollPdf);
    document.getElementById('savePayrollBtn').addEventListener('click', splitAndSavePayroll);
    document.getElementById('refreshPayrollDocs').addEventListener('click', loadAdminDocuments);
  }

  function injectWorker(){
    const hours=document.getElementById('hours'); if(!hours||document.getElementById('employeeDocumentsCard')) return;
    const card=document.createElement('article'); card.id='employeeDocumentsCard'; card.className='card'; card.innerHTML=`<h2>המסמכים שלי</h2><div class="truth"><b>פרטי ומאובטח.</b><br>תלושי שכר ודוחות שעות זמינים כאן לזמן מוגבל. ניתן לפתוח, להדפיס או לשמור במכשיר.</div><div id="employeeDocumentsList" style="margin-top:9px"><small>טוען מסמכים…</small></div>`;
    hours.prepend(card);
    document.querySelectorAll('.workerTabs button').forEach(b=>{ if(b.dataset.target==='hours') b.addEventListener('click',()=>setTimeout(loadEmployeeDocuments,0)); });
  }

  async function getActiveStaff(){
    const {data,error}=await supabaseClient.from('staff').select('id,full_name,phone,username').eq('is_active',true).order('full_name');
    if(error) throw error; payrollStaff=data||[]; return payrollStaff;
  }

  function matchPage(text, staff){
    const t=norm(text); const matches=[];
    staff.forEach(s=>{
      const name=norm(s.full_name), username=norm(s.username);
      let score=0;
      if(name && t.includes(name)) score+=100;
      if(username && t.includes(username)) score+=80;
      const parts=name.split(' ').filter(x=>x.length>1); const hit=parts.filter(p=>t.includes(p)).length;
      if(parts.length>=2 && hit===parts.length) score+=50;
      else if(hit>=2) score+=20;
      if(score>0) matches.push({s,score});
    });
    matches.sort((a,b)=>b.score-a.score);
    if(!matches.length) return {staffId:'',confidence:'none',candidates:[]};
    if(matches.length>1 && matches[0].score===matches[1].score) return {staffId:'',confidence:'ambiguous',candidates:matches.slice(0,3).map(x=>x.s.id)};
    return {staffId:matches[0].s.id,confidence:matches[0].score>=100?'high':'medium',candidates:matches.slice(0,3).map(x=>x.s.id)};
  }

  async function analyzePayrollPdf(){
    const file=document.getElementById('payrollFile').files?.[0]; const period=document.getElementById('payrollPeriod').value.trim();
    if(!file){ setStatus('יש לבחור קובץ PDF.',true); return; }
    if(!period){ setStatus('יש לרשום תקופה לפני הניתוח.',true); return; }
    document.getElementById('savePayrollBtn').disabled=true; setStatus('קורא את הקובץ ומזהה עובדים…');
    try{
      await ensurePdfLibs(); const staff=await getActiveStaff(); payrollFileBytes=await file.arrayBuffer();
      const pdf=await pdfjsLib.getDocument({data:payrollFileBytes.slice(0)}).promise; payrollAssignments=[];
      for(let n=1;n<=pdf.numPages;n++){
        const page=await pdf.getPage(n); const tc=await page.getTextContent(); const text=tc.items.map(i=>i.str||'').join(' '); const m=matchPage(text,staff);
        payrollAssignments.push({page:n,staffId:m.staffId,confidence:m.confidence,text:text.slice(0,240)});
      }
      renderPayrollReview(); document.getElementById('savePayrollBtn').disabled=false;
      const matched=payrollAssignments.filter(x=>x.staffId).length; setStatus(`נותחו ${payrollAssignments.length} עמודים. זוהו אוטומטית ${matched}. יש לבדוק את העמודים לפני שמירה.`);
    }catch(e){ console.error(e); setStatus('ניתוח ה-PDF נכשל. ייתכן שהקובץ סרוק כתמונה או בפורמט שאינו נתמך.',true); }
  }

  function renderPayrollReview(){
    const box=document.getElementById('payrollReview'); if(!box) return;
    const options=`<option value="">לא זוהה - לבחור ידנית</option>`+payrollStaff.map(s=>`<option value="${s.id}">${esc(s.full_name)}</option>`).join('');
    box.innerHTML=payrollAssignments.map((r,i)=>`<div class="payrollPage"><b>עמוד ${r.page}</b><small>${esc(r.confidence==='high'?'זיהוי ודאי':r.confidence==='medium'?'זיהוי סביר':r.confidence==='ambiguous'?'נמצאו כמה התאמות':'לא זוהה')}</small><select data-payroll-page="${i}">${options}</select></div>`).join('');
    box.querySelectorAll('select').forEach(sel=>{ const i=Number(sel.dataset.payrollPage); sel.value=payrollAssignments[i].staffId||''; sel.addEventListener('change',()=>payrollAssignments[i].staffId=sel.value); });
  }

  async function splitAndSavePayroll(){
    if(!payrollFileBytes||!payrollAssignments.length) return;
    const missing=payrollAssignments.filter(x=>!x.staffId); if(missing.length){ setStatus(`יש ${missing.length} עמודים שלא שויכו לעובד. יש לבחור עובד לכל עמוד.`,true); return; }
    const period=document.getElementById('payrollPeriod').value.trim(); const type=document.getElementById('payrollDocType').value; const retention=Number(document.getElementById('payrollRetention').value||7); const original=document.getElementById('payrollFile').files?.[0]?.name||'document.pdf';
    const btn=document.getElementById('savePayrollBtn'); btn.disabled=true; btn.textContent='שומר…'; setStatus('מפרק את הקובץ ושומר מסמך פרטי לכל עובד…');
    try{
      await ensurePdfLibs(); const src=await PDFLib.PDFDocument.load(payrollFileBytes); const grouped=new Map();
      payrollAssignments.forEach(r=>{ if(!grouped.has(r.staffId)) grouped.set(r.staffId,[]); grouped.get(r.staffId).push(r.page-1); });
      let done=0;
      for(const [staffId,pages] of grouped.entries()){
        const out=await PDFLib.PDFDocument.create(); const copied=await out.copyPages(src,pages); copied.forEach(p=>out.addPage(p)); const bytes=await out.save();
        const path=`${staffId}/${safePart(period)}/${type}-${crypto.randomUUID()}.pdf`;
        const {error:upErr}=await supabaseClient.storage.from('employee-documents').upload(path,new Blob([bytes],{type:'application/pdf'}),{contentType:'application/pdf',upsert:false}); if(upErr) throw upErr;
        const {error:regErr}=await supabaseClient.rpc('admin_register_employee_document',{p_staff_id:staffId,p_doc_type:type,p_period_label:period,p_storage_path:path,p_original_file_name:`${type==='payslip'?'תלוש שכר':'דוח שעות'} - ${period}.pdf`,p_page_from:Math.min(...pages)+1,p_page_to:Math.max(...pages)+1,p_retention_days:retention});
        if(regErr){ await supabaseClient.storage.from('employee-documents').remove([path]); throw regErr; }
        done++;
      }
      setStatus(`נשמרו ${done} מסמכים פרטיים. כעת ניתן לשלוח לכל עובד הודעת WhatsApp מתוך הרשימה.`); payrollAssignments=[]; payrollFileBytes=null; document.getElementById('payrollReview').innerHTML=''; document.getElementById('payrollFile').value=''; await loadAdminDocuments();
    }catch(e){ console.error(e); setStatus('השמירה נכשלה: '+(e?.message||'שגיאה לא ידועה'),true); }
    finally{ btn.disabled=false; btn.textContent='פירוק ושמירה לעובדים'; }
  }

  async function loadAdminDocuments(){
    const box=document.getElementById('adminPayrollDocs'); if(!box||appSession?.type!=='admin') return;
    const {data,error}=await supabaseClient.rpc('admin_list_employee_documents'); if(error){ box.innerHTML='<small>טעינת המסמכים נכשלה.</small>'; return; }
    const rows=data||[]; if(!rows.length){ box.innerHTML='<small>אין כרגע מסמכים שמורים.</small>'; return; }
    box.innerHTML=rows.map(r=>{ const active=new Date(r.expires_at)>new Date(); const typeLabel=r.doc_type==='payslip'?'תלוש שכר':'דוח שעות'; const days=Math.max(0,Math.ceil((new Date(r.expires_at)-new Date())/86400000)); return `<div class="docRow"><span class="docType ${r.doc_type==='hours'?'hours':''}">${typeLabel}</span><div class="meta"><b>${esc(r.full_name)} · ${esc(r.period_label)}</b><small>${active?`זמין עוד כ-${days} ימים`:'פג תוקף'}</small></div><div class="actions">${active?`<button class="btn primary" data-wa-staff="${r.staff_id}" data-wa-type="${r.doc_type}" data-wa-period="${esc(r.period_label)}">WhatsApp לעובד</button>`:''}</div></div>`; }).join('');
    box.querySelectorAll('[data-wa-staff]').forEach(btn=>btn.addEventListener('click',()=>sendEmployeeDocumentNotice(btn.dataset.waStaff,btn.dataset.waType,btn.dataset.waPeriod)));
  }

  async function sendEmployeeDocumentNotice(staffId,type,period){
    let staff=payrollStaff.find(x=>x.id===staffId); if(!staff){ const {data}=await supabaseClient.from('staff').select('id,full_name,phone').eq('id',staffId).single(); staff=data; }
    if(!staff?.phone){ toast('לעובד אין מספר טלפון שמור'); return; }
    const phone=typeof normalizeIsraeliPhone==='function'?normalizeIsraeliPhone(staff.phone):String(staff.phone).replace(/\D/g,'');
    const label=type==='payslip'?'תלוש השכר':'דוח השעות';
    const msg=`היי ${staff.full_name},\n${label} שלך לתקופה ${period} זמין כעת במערכת MATOK.\n\nכניסה למערכת:\nhttps://voluble-marigold-95c410.netlify.app/\n\nלאחר הכניסה יש לפתוח „שעות ושכר” ומשם ניתן לצפות, להדפיס או לשמור את המסמך.\nהמסמך זמין לזמן מוגבל מטעמי אבטחה ואחסון.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,'_blank');
  }

  async function loadEmployeeDocuments(){
    const box=document.getElementById('employeeDocumentsList'); if(!box||appSession?.type!=='employee') return;
    box.innerHTML='<small>טוען מסמכים…</small>';
    const {data,error}=await supabaseClient.rpc('employee_list_documents',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code});
    if(error){ box.innerHTML='<small>לא ניתן לטעון את המסמכים כרגע.</small>'; return; }
    const rows=data||[]; if(!rows.length){ box.innerHTML='<small>אין כרגע תלוש שכר או דוח שעות זמין.</small>'; return; }
    box.innerHTML=rows.map(r=>{ const typeLabel=r.doc_type==='payslip'?'תלוש שכר':'דוח שעות'; const days=Math.max(0,Math.ceil((new Date(r.expires_at)-new Date())/86400000)); return `<div class="docRow"><span class="docType ${r.doc_type==='hours'?'hours':''}">${typeLabel}</span><div class="meta"><b>${esc(r.period_label)}</b><small>זמין עוד כ-${days} ימים</small></div><div class="actions"><button class="btn primary" data-doc-open="${r.id}">פתיחה / הדפסה</button><button class="btn secondary" data-doc-save="${r.id}">שמירה</button></div></div>`; }).join('');
    box.querySelectorAll('[data-doc-open]').forEach(b=>b.addEventListener('click',()=>openEmployeeDocument(b.dataset.docOpen,false)));
    box.querySelectorAll('[data-doc-save]').forEach(b=>b.addEventListener('click',()=>openEmployeeDocument(b.dataset.docSave,true)));
  }

  async function openEmployeeDocument(id,download){
    const popup=download?null:window.open('about:blank','_blank');
    if(popup) popup.document.write('<p style="font-family:Arial;padding:20px">טוען מסמך…</p>');
    try{
      const res=await fetch(`${SUPABASE_URL}/functions/v1/employee-document-link`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({staff_id:appSession.user.id,username:appSession.username,code:appSession.code,document_id:id})});
      const data=await res.json(); if(!res.ok||!data.url) throw new Error(data.error||'document_error');
      if(download){ const rr=await fetch(data.url); const blob=await rr.blob(); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=data.file_name||'document.pdf'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),30000); }
      else if(popup) popup.location.href=data.url; else window.open(data.url,'_blank');
    }catch(e){ if(popup) popup.close(); toast('המסמך אינו זמין או שפג תוקפו'); }
  }

  function init(){ addStyles(); injectAdmin(); injectWorker(); setTimeout(()=>{ if(appSession?.type==='employee') loadEmployeeDocuments(); if(appSession?.type==='admin') loadAdminDocuments(); },700); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
  window.loadEmployeeDocuments=loadEmployeeDocuments;
  window.loadAdminDocuments=loadAdminDocuments;
})();
