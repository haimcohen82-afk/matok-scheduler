(() => {
  const VERSION='20260816-payroll-suite-2';
  let staffProfiles=[];
  let hoursRows=[];
  let docRows=[];
  let pdfBytes=null;
  let pdfPages=[];
  let pdfStaff=[];

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const norm=v=>String(v??'').toLowerCase().replace(/[\u0591-\u05C7]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  const safePart=v=>String(v||'').replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,50)||'period';
  const num=v=>Number(String(v??'').replace(',','.'))||0;
  const currentMonth=()=>new Date().toISOString().slice(0,7);
  const phone972=v=>{let d=String(v||'').replace(/\D/g,'');if(d.startsWith('972'))return d;if(d.startsWith('0'))return '972'+d.slice(1);return d;};
  const loadScript=src=>new Promise((resolve,reject)=>{const found=[...document.scripts].find(s=>s.src===src);if(found)return resolve();const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});

  async function ensurePdf(){
    if(!window.pdfjsLib) await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
    if(window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    if(!window.PDFLib) await loadScript('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js');
  }
  async function ensureXlsx(){if(!window.XLSX)await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');}

  function style(){
    if(document.getElementById('payrollSuiteStyles'))return;
    const s=document.createElement('style');s.id='payrollSuiteStyles';s.textContent=`
      .payrollSuiteNav{display:flex;gap:6px;overflow:auto;margin:0 0 11px;padding-bottom:3px}.payrollSuiteNav button{white-space:nowrap}.payrollSub{display:none}.payrollSub.active{display:block}
      .payrollMetrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.payrollMetric{background:#fff;border:1px solid var(--line);border-radius:12px;padding:13px}.payrollMetric span{display:block;color:var(--muted);font-size:11px}.payrollMetric b{display:block;font-size:25px;margin-top:4px}
      .payrollToolbar{display:flex;gap:7px;align-items:end;flex-wrap:wrap}.payrollToolbar label{min-width:150px;flex:1}.payrollGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.payrollGrid label{font-size:11px;font-weight:800}.payrollGrid label span{display:block;margin-bottom:4px}
      .payrollTable{overflow:auto}.payrollTable table{width:100%;border-collapse:collapse;font-size:12px}.payrollTable th,.payrollTable td{padding:9px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}.payrollTable th{background:var(--soft)}
      .payrollPdfRow{display:grid;grid-template-columns:85px 1fr 230px;gap:8px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:9px;background:#fff;margin-top:7px}.payrollPdfRow small{color:var(--muted)}
      .payrollStatus{padding:10px;border-radius:9px;background:var(--soft);margin-top:9px}.payrollStatus.bad{background:#fff0ed;color:var(--danger)}.payrollStatus.good{background:#eaf6ea;color:#2f6732}
      .payrollDocStatus{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:10px;font-weight:900;background:#eee}.payrollDocStatus.reviewed{background:#fff1c9;color:#795e12}.payrollDocStatus.delivered{background:#dcf1df;color:#2c6731}
      .policyPreview{background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px;line-height:1.7}.policyPreview h2{text-align:center}.policyPreview .signs{display:flex;justify-content:space-between;gap:30px;margin-top:35px}.policyPreview .signs div{flex:1;border-top:1px solid #777;padding-top:7px;text-align:center}
      .workerPayrollRow{border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--soft);margin-top:7px}.workerPayrollRow b{display:block}.workerPayrollFacts{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.workerPayrollFacts span{font-size:10px;padding:5px 7px;border-radius:999px;background:#fff;border:1px solid var(--line)}
      @media(max-width:850px){.payrollMetrics{grid-template-columns:1fr 1fr}.payrollGrid{grid-template-columns:1fr 1fr}.payrollPdfRow{grid-template-columns:1fr}.payrollTable table{font-size:11px}}
      @media(max-width:470px){.payrollGrid{grid-template-columns:1fr}.payrollMetrics{grid-template-columns:1fr 1fr}.policyPreview{padding:13px}}
    `;document.head.appendChild(s);
  }

  function panelHtml(){
    return `
      <div class="payrollSuiteNav">
        <button class="btn primary" data-payroll-sub="dashboard">לוח בקרה</button>
        <button class="btn secondary" data-payroll-sub="profiles">עובדים ושכר שעתי</button>
        <button class="btn secondary" data-payroll-sub="pdf">קליטת PDF</button>
        <button class="btn secondary" data-payroll-sub="hours">שעות ובונוסים</button>
        <button class="btn secondary" data-payroll-sub="delivery">מסירה ו-WhatsApp</button>
        <button class="btn secondary" data-payroll-sub="policy">מסמך רשמי</button>
      </div>

      <section id="payrollSub-dashboard" class="payrollSub active">
        <div class="payrollMetrics">
          <article class="payrollMetric"><span>עובדים פעילים</span><b id="psMetricStaff">—</b></article>
          <article class="payrollMetric"><span>תלושים בתקופה</span><b id="psMetricPayslips">—</b></article>
          <article class="payrollMetric"><span>נמסרו בתקופה</span><b id="psMetricDelivered">—</b></article>
          <article class="payrollMetric"><span>דוחות שעות</span><b id="psMetricHours">—</b></article>
        </div>
        <article class="card" style="margin-top:10px"><div class="employeeHead"><div><h2>שכר, שעות, בונוסים ותלושים</h2><small>המערכת המשולבת משתמשת בעובדים האמיתיים שכבר קיימים במערכת. אין מאגר עובדים כפול ואין שמירה מקומית בדפדפן.</small></div><span class="badge ok">Supabase פרטי</span></div><div class="payrollToolbar"><label>תקופה להצגה<input id="psDashboardPeriod" type="month" value="${currentMonth()}"></label><button class="btn secondary" id="psRefreshDashboard">רענון</button></div><div class="truth" style="margin-top:10px">תלושי שכר ודוחות PDF נשמרים באחסון פרטי. השעות והבונוסים נשמרים בענן. אומדן שכר בסיס הוא כלי בקרה בלבד; התלוש של רואה החשבון הוא הקובע.</div></article>
      </section>

      <section id="payrollSub-profiles" class="payrollSub">
        <article class="card"><div class="employeeHead"><div><h2>עובדים ונתוני שכר</h2><small>הרשימה מגיעה אוטומטית מניהול העובדים של MATOK. כאן מגדירים רק נתוני שכר משלימים.</small></div><button class="btn secondary" id="psRefreshProfiles">רענון</button></div><div id="psProfilesTable" class="payrollTable"><small>טוען…</small></div></article>
      </section>

      <section id="payrollSub-pdf" class="payrollSub">
        <article class="card"><h2>קליטת פלט רואה חשבון / דוח שעות PDF</h2><p>מעלים PDF מרוכז. המערכת קוראת כל עמוד, מזהה עובד לפי השם, מאפשרת תיקון ידני, ומפרקת את הקובץ למסמך פרטי לכל עובד.</p><div class="payrollGrid"><label><span>סוג מסמך</span><select id="psPdfType"><option value="payslip">תלוש שכר</option><option value="hours">דוח שעות עבודה</option></select></label><label><span>תקופה</span><input id="psPdfPeriod" type="month" value="${currentMonth()}"></label><label style="grid-column:span 2"><span>קובץ PDF</span><input id="psPdfFile" type="file" accept="application/pdf,.pdf"></label></div><div class="actions"><button class="btn primary" id="psAnalyzePdf">ניתוח וזיהוי</button><button class="btn secondary" id="psSavePdf" disabled>פירוק ושמירה לעובדים</button></div><div id="psPdfStatus" class="payrollStatus">טרם הועלה קובץ.</div><div id="psPdfReview"></div></article>
      </section>

      <section id="payrollSub-hours" class="payrollSub">
        <article class="card"><h2>שעות עבודה ובונוסים</h2><p>אפשר להזין ידנית או לייבא Excel/CSV. שורה קיימת לאותו עובד ולאותה תקופה מתעדכנת במקום ליצור כפילות.</p><div class="payrollGrid"><label><span>עובד/ת</span><select id="psHoursStaff"></select></label><label><span>חודש</span><input id="psHoursPeriod" type="month" value="${currentMonth()}"></label><label><span>שעות רגילות</span><input id="psHoursRegular" type="number" step="0.01" min="0"></label><label><span>שעות נוספות</span><input id="psHoursOvertime" type="number" step="0.01" min="0"></label><label><span>שבת / חג</span><input id="psHoursHoliday" type="number" step="0.01" min="0"></label><label><span>בונוס ₪</span><input id="psHoursBonus" type="number" step="0.01"></label><label style="grid-column:span 2"><span>הערת מנהל</span><input id="psHoursNote" placeholder="לדוגמה: בונוס מכירות"></label></div><div class="actions"><button class="btn primary" id="psSaveHours">שמירת נתוני שעות</button><label class="btn secondary" style="display:inline-flex;align-items:center;gap:6px">ייבוא Excel<input id="psHoursImport" type="file" accept=".xlsx,.xls,.csv,.tsv" style="display:none"></label><button class="btn secondary" id="psExportHours">ייצוא Excel</button></div><div id="psHoursImportStatus" class="payrollStatus">אין ייבוא פעיל.</div></article><article class="card"><div class="employeeHead"><div><h2>נתוני התקופה</h2><small>אומדן שכר בסיס = שעות רגילות × תעריף שעתי שהוגדר בכרטיס השכר.</small></div><div class="payrollToolbar"><label>סינון חודש<input id="psHoursFilter" type="month" value="${currentMonth()}"></label><button class="btn secondary" id="psRefreshHours">רענון</button></div></div><div id="psHoursTable" class="payrollTable"><small>טוען…</small></div></article>
      </section>

      <section id="payrollSub-delivery" class="payrollSub">
        <article class="card"><div class="employeeHead"><div><h2>מסירת תלושים ודוחות</h2><small>WhatsApp פותח הודעה אישית לעובד עם קישור לפורטל. הקובץ עצמו נשאר פרטי בתוך המערכת.</small></div><div class="payrollToolbar"><label>תקופה<input id="psDeliveryPeriod" type="month" value="${currentMonth()}"></label><button class="btn secondary" id="psRefreshDelivery">רענון</button></div></div><div class="actions"><button class="btn secondary" id="psReviewAll">סימון כל המוצגים כנבדקו</button><button class="btn secondary" id="psExportDelivery">דוח מסירה Excel</button></div><div id="psDeliveryTable" class="payrollTable"><small>טוען…</small></div></article>
      </section>

      <section id="payrollSub-policy" class="payrollSub">
        <article class="card"><h2>נוהל מסירת תלושי שכר, דיווח שעות ובונוסים</h2><p>מסמך פנימי להדפסה או שמירה כ-PDF.</p><div class="payrollGrid"><label><span>שם העסק</span><input id="psPolicyBusiness" value="MATOK BASIC"></label><label><span>כתובת העסק</span><input id="psPolicyAddress" value="שד׳ דב הוז 86, חולון"></label><label><span>תאריך עדכון</span><input id="psPolicyDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label><span>אחראי/ת שכר</span><input id="psPolicyContact" value="הנהלת MATOK BASIC"></label></div><div class="actions"><button class="btn primary" id="psPrintPolicy">הדפסה / שמירה ל-PDF</button></div></article><article id="psPolicyPreview" class="policyPreview"></article>
      </section>`;
  }

  function setupPanel(){
    const panel=document.getElementById('payrollDocsAdmin');
    const tab=document.querySelector('.adminTabs button[data-target="payrollDocsAdmin"]');
    if(!panel||!tab)return false;
    if(panel.dataset.payrollSuite==='2')return true;
    panel.dataset.payrollSuite='2';
    tab.textContent='שכר, שעות ובונוסים';
    panel.innerHTML=panelHtml();
    bindPanel();
    renderPolicy();
    return true;
  }

  function bindPanel(){
    document.querySelectorAll('.payrollSuiteNav [data-payroll-sub]').forEach(b=>b.onclick=()=>openSub(b.dataset.payrollSub));
    document.getElementById('psRefreshDashboard').onclick=loadDashboard;
    document.getElementById('psDashboardPeriod').onchange=loadDashboard;
    document.getElementById('psRefreshProfiles').onclick=loadProfiles;
    document.getElementById('psAnalyzePdf').onclick=analyzePdf;
    document.getElementById('psSavePdf').onclick=savePdf;
    document.getElementById('psSaveHours').onclick=saveManualHours;
    document.getElementById('psHoursImport').onchange=e=>importHoursFile(e.target.files?.[0]);
    document.getElementById('psExportHours').onclick=exportHours;
    document.getElementById('psRefreshHours').onclick=loadHours;
    document.getElementById('psHoursFilter').onchange=loadHours;
    document.getElementById('psRefreshDelivery').onclick=loadDelivery;
    document.getElementById('psDeliveryPeriod').onchange=loadDelivery;
    document.getElementById('psReviewAll').onclick=reviewAllShown;
    document.getElementById('psExportDelivery').onclick=exportDelivery;
    ['psPolicyBusiness','psPolicyAddress','psPolicyDate','psPolicyContact'].forEach(id=>document.getElementById(id).oninput=renderPolicy);
    document.getElementById('psPrintPolicy').onclick=printPolicy;
  }

  async function openSub(name){
    document.querySelectorAll('.payrollSuiteNav button').forEach(b=>{const on=b.dataset.payrollSub===name;b.classList.toggle('primary',on);b.classList.toggle('secondary',!on)});
    document.querySelectorAll('#payrollDocsAdmin .payrollSub').forEach(x=>x.classList.toggle('active',x.id===`payrollSub-${name}`));
    if(name==='dashboard')await loadDashboard();
    if(name==='profiles')await loadProfiles();
    if(name==='pdf')await loadProfiles();
    if(name==='hours'){await loadProfiles();await loadHours();}
    if(name==='delivery')await loadDelivery();
  }

  async function loadDashboard(){
    if(appSession?.type!=='admin')return;
    const period=document.getElementById('psDashboardPeriod')?.value||'';
    const {data,error}=await supabaseClient.rpc('admin_payroll_dashboard',{p_period:period});
    if(error){console.error(error);toast('טעינת נתוני השכר נכשלה');return}
    const r=data?.[0]||{};
    document.getElementById('psMetricStaff').textContent=r.active_staff??0;
    document.getElementById('psMetricPayslips').textContent=r.payslips??0;
    document.getElementById('psMetricDelivered').textContent=r.delivered??0;
    document.getElementById('psMetricHours').textContent=r.hours_rows??0;
  }

  async function loadProfiles(){
    if(appSession?.type!=='admin')return;
    const {data,error}=await supabaseClient.rpc('admin_list_payroll_profiles');
    if(error){console.error(error);toast('טעינת עובדי השכר נכשלה');return}
    staffProfiles=data||[];pdfStaff=staffProfiles;
    const select=document.getElementById('psHoursStaff');if(select)select.innerHTML='<option value="">בחירת עובד/ת</option>'+staffProfiles.map(x=>`<option value="${x.staff_id}">${esc(x.full_name)}</option>`).join('');
    const box=document.getElementById('psProfilesTable');if(!box)return;
    box.innerHTML=`<table><thead><tr><th>עובד/ת</th><th>טלפון</th><th>תעריף שעתי ₪</th><th>תחילת עבודה</th><th>הערה</th><th>שמירה</th></tr></thead><tbody>${staffProfiles.map(r=>`<tr><td><b>${esc(r.full_name)}</b></td><td>${esc(r.phone||'—')}</td><td><input data-prof-rate="${r.staff_id}" type="number" step="0.01" min="0" value="${Number(r.hourly_rate||0)}"></td><td><input data-prof-start="${r.staff_id}" type="date" value="${r.employment_start||''}"></td><td><input data-prof-note="${r.staff_id}" value="${esc(r.notes||'')}"></td><td><button class="btn primary" data-prof-save="${r.staff_id}">שמירה</button></td></tr>`).join('')}</tbody></table>`;
    box.querySelectorAll('[data-prof-save]').forEach(b=>b.onclick=()=>saveProfile(b.dataset.profSave));
  }

  async function saveProfile(staffId){
    const rate=document.querySelector(`[data-prof-rate="${staffId}"]`)?.value||0;
    const start=document.querySelector(`[data-prof-start="${staffId}"]`)?.value||null;
    const notes=document.querySelector(`[data-prof-note="${staffId}"]`)?.value||'';
    const {error}=await supabaseClient.rpc('admin_save_payroll_profile',{p_staff_id:staffId,p_hourly_rate:num(rate),p_employment_start:start||null,p_notes:notes});
    if(error){console.error(error);toast('שמירת נתוני השכר נכשלה');return}toast('נתוני השכר נשמרו');await loadProfiles();
  }

  function matchStaff(text){
    const t=norm(text),matches=[];
    pdfStaff.forEach(s=>{const n=norm(s.full_name);if(!n)return;let score=t.includes(n)?100:0;const parts=n.split(' ').filter(x=>x.length>1);const hits=parts.filter(p=>t.includes(p)).length;if(parts.length>1&&hits===parts.length)score=Math.max(score,70);else if(hits>=2)score=Math.max(score,35);if(score)matches.push({id:s.staff_id,score});});
    matches.sort((a,b)=>b.score-a.score);if(!matches.length)return {staffId:'',confidence:'none'};if(matches[1]&&matches[0].score===matches[1].score)return {staffId:'',confidence:'ambiguous'};return {staffId:matches[0].id,confidence:matches[0].score>=100?'high':'medium'};
  }

  async function analyzePdf(){
    const file=document.getElementById('psPdfFile')?.files?.[0],period=document.getElementById('psPdfPeriod')?.value;
    const status=document.getElementById('psPdfStatus');
    if(!file){status.className='payrollStatus bad';status.textContent='יש לבחור קובץ PDF.';return}
    if(!period){status.className='payrollStatus bad';status.textContent='יש לבחור תקופה.';return}
    try{
      await ensurePdf();await loadProfiles();status.className='payrollStatus';status.textContent='קורא את הקובץ ומזהה עובדים…';pdfBytes=await file.arrayBuffer();const pdf=await pdfjsLib.getDocument({data:pdfBytes.slice(0)}).promise;pdfPages=[];
      for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),tc=await page.getTextContent(),text=tc.items.map(x=>x.str||'').join(' '),m=matchStaff(text);pdfPages.push({page:i,staffId:m.staffId,confidence:m.confidence,text:text.slice(0,240)});}
      renderPdfReview();document.getElementById('psSavePdf').disabled=false;const matched=pdfPages.filter(x=>x.staffId).length;status.className='payrollStatus good';status.textContent=`נותחו ${pdfPages.length} עמודים. זוהו אוטומטית ${matched}. יש לבדוק את כל השיוכים לפני שמירה.`;
    }catch(e){console.error(e);status.className='payrollStatus bad';status.textContent='ניתוח ה-PDF נכשל. ייתכן שמדובר בקובץ סרוק כתמונה ללא שכבת טקסט.';}
  }

  function renderPdfReview(){
    const box=document.getElementById('psPdfReview');const options='<option value="">— לא זוהה —</option>'+pdfStaff.map(s=>`<option value="${s.staff_id}">${esc(s.full_name)}</option>`).join('');
    box.innerHTML=pdfPages.map((p,i)=>`<div class="payrollPdfRow"><b>עמוד ${p.page}</b><small>${p.confidence==='high'?'זיהוי ודאי':p.confidence==='medium'?'זיהוי סביר':p.confidence==='ambiguous'?'כמה התאמות אפשריות':'לא זוהה'}</small><select data-pdf-index="${i}">${options}</select></div>`).join('');
    box.querySelectorAll('select').forEach(s=>{const i=Number(s.dataset.pdfIndex);s.value=pdfPages[i].staffId||'';s.onchange=()=>pdfPages[i].staffId=s.value;});
  }

  async function savePdf(){
    const missing=pdfPages.filter(x=>!x.staffId),status=document.getElementById('psPdfStatus');if(!pdfBytes||!pdfPages.length)return;if(missing.length){status.className='payrollStatus bad';status.textContent=`יש ${missing.length} עמודים שלא שויכו לעובד.`;return}
    const period=document.getElementById('psPdfPeriod').value,type=document.getElementById('psPdfType').value,btn=document.getElementById('psSavePdf');btn.disabled=true;btn.textContent='שומר…';
    try{
      await ensurePdf();const src=await PDFLib.PDFDocument.load(pdfBytes),grouped=new Map();pdfPages.forEach(p=>{if(!grouped.has(p.staffId))grouped.set(p.staffId,[]);grouped.get(p.staffId).push(p.page-1)});let done=0;
      for(const [staffId,pages] of grouped){const out=await PDFLib.PDFDocument.create(),copies=await out.copyPages(src,pages);copies.forEach(p=>out.addPage(p));const bytes=await out.save(),path=`${staffId}/${safePart(period)}/${type}-${crypto.randomUUID()}.pdf`;const {error:up}=await supabaseClient.storage.from('employee-documents').upload(path,new Blob([bytes],{type:'application/pdf'}),{contentType:'application/pdf',upsert:false});if(up)throw up;const {error:reg}=await supabaseClient.rpc('admin_register_employee_document',{p_staff_id:staffId,p_doc_type:type,p_period_label:period,p_storage_path:path,p_original_file_name:`${type==='payslip'?'תלוש שכר':'דוח שעות'} - ${period}.pdf`,p_page_from:Math.min(...pages)+1,p_page_to:Math.max(...pages)+1,p_retention_days:3650});if(reg){await supabaseClient.storage.from('employee-documents').remove([path]);throw reg}done++;}
      status.className='payrollStatus good';status.textContent=`נשמרו ${done} מסמכים פרטיים. העובדים יכולים לראות אותם באזור „שעות ושכר”.`;pdfBytes=null;pdfPages=[];document.getElementById('psPdfReview').innerHTML='';document.getElementById('psPdfFile').value='';document.getElementById('psSavePdf').disabled=true;await loadDashboard();
    }catch(e){console.error(e);status.className='payrollStatus bad';status.textContent='שמירת המסמכים נכשלה: '+(e?.message||'שגיאה לא ידועה');}
    finally{btn.disabled=!pdfPages.length;btn.textContent='פירוק ושמירה לעובדים';}
  }

  async function saveManualHours(){
    const staffId=document.getElementById('psHoursStaff').value,period=document.getElementById('psHoursPeriod').value;if(!staffId||!period){toast('יש לבחור עובד וחודש');return}
    const args={p_staff_id:staffId,p_period_label:period,p_regular_hours:num(document.getElementById('psHoursRegular').value),p_overtime_hours:num(document.getElementById('psHoursOvertime').value),p_holiday_hours:num(document.getElementById('psHoursHoliday').value),p_bonus_amount:num(document.getElementById('psHoursBonus').value),p_manager_note:document.getElementById('psHoursNote').value.trim(),p_source_file:null};
    const {error}=await supabaseClient.rpc('admin_upsert_payroll_hours',args);if(error){console.error(error);toast('שמירת השעות נכשלה');return}toast('נתוני השעות נשמרו');['psHoursRegular','psHoursOvertime','psHoursHoliday','psHoursBonus','psHoursNote'].forEach(id=>document.getElementById(id).value='');document.getElementById('psHoursFilter').value=period;await loadHours();await loadDashboard();
  }

  function rowValue(row,names){const keys=Object.keys(row),key=keys.find(k=>names.some(n=>norm(k)===norm(n)||norm(k).includes(norm(n))));return key===undefined?'':row[key];}
  function matchProfileName(name){const n=norm(name);return staffProfiles.find(s=>norm(s.full_name)===n)||staffProfiles.find(s=>n&&norm(s.full_name).includes(n))||null;}

  async function importHoursFile(file){
    if(!file)return;const box=document.getElementById('psHoursImportStatus');box.className='payrollStatus';box.textContent='קורא את הקובץ…';
    try{
      await ensureXlsx();await loadProfiles();const arr=await file.arrayBuffer(),wb=XLSX.read(arr,{type:'array'}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});let ok=0,miss=[];
      for(const r of rows){const rawName=rowValue(r,['שם עובד','עובד','שם מלא','שם','name']),staff=matchProfileName(rawName),period=String(rowValue(r,['חודש','תקופה','month','period'])||'').trim()||document.getElementById('psHoursPeriod').value;if(!staff||!period){miss.push(String(rawName||'ללא שם'));continue}const {error}=await supabaseClient.rpc('admin_upsert_payroll_hours',{p_staff_id:staff.staff_id,p_period_label:period,p_regular_hours:num(rowValue(r,['שעות רגילות','רגילות','שעות','regular'])),p_overtime_hours:num(rowValue(r,['שעות נוספות','נוספות','overtime'])),p_holiday_hours:num(rowValue(r,['שבת','חג','שבת/חג','holiday'])),p_bonus_amount:num(rowValue(r,['בונוס','bonus'])),p_manager_note:String(rowValue(r,['הערה','הערת מנהל','notes'])||''),p_source_file:file.name});if(error)throw error;ok++;}
      box.className='payrollStatus '+(miss.length?'':'good');box.textContent=`נקלטו ${ok} עובדים.${miss.length?' לא זוהו: '+miss.join(', '):''}`;await loadHours();await loadDashboard();
    }catch(e){console.error(e);box.className='payrollStatus bad';box.textContent='ייבוא השעות נכשל: '+(e?.message||'שגיאה');}
    finally{document.getElementById('psHoursImport').value='';}
  }

  async function loadHours(){
    if(appSession?.type!=='admin')return;const period=document.getElementById('psHoursFilter')?.value||'';const {data,error}=await supabaseClient.rpc('admin_list_payroll_hours',{p_period:period});if(error){console.error(error);toast('טעינת השעות נכשלה');return}hoursRows=data||[];const box=document.getElementById('psHoursTable');if(!box)return;box.innerHTML=hoursRows.length?`<table><thead><tr><th>עובד/ת</th><th>תקופה</th><th>רגילות</th><th>נוספות</th><th>שבת/חג</th><th>בונוס</th><th>תעריף</th><th>אומדן בסיס</th><th>הערה</th></tr></thead><tbody>${hoursRows.map(r=>`<tr><td><b>${esc(r.full_name)}</b></td><td>${esc(r.period_label)}</td><td>${r.regular_hours}</td><td>${r.overtime_hours}</td><td>${r.holiday_hours}</td><td>₪${Number(r.bonus_amount||0).toFixed(2)}</td><td>₪${Number(r.hourly_rate||0).toFixed(2)}</td><td>₪${Number(r.estimated_base||0).toFixed(2)}</td><td>${esc(r.manager_note||'')}</td></tr>`).join('')}</tbody></table>`:'<div class="availabilityEmpty">אין נתוני שעות בתקופה זו.</div>';
  }

  async function exportHours(){
    if(!hoursRows.length)await loadHours();if(!hoursRows.length){toast('אין נתונים לייצוא');return}await ensureXlsx();const rows=hoursRows.map(r=>({'שם עובד':r.full_name,'חודש':r.period_label,'שעות רגילות':r.regular_hours,'שעות נוספות':r.overtime_hours,'שעות שבת/חג':r.holiday_hours,'בונוס':r.bonus_amount,'תעריף שעתי':r.hourly_rate,'אומדן שכר בסיס':r.estimated_base,'הערה':r.manager_note}));const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'שעות ובונוסים');XLSX.writeFile(wb,`MATOK_שעות_ובונוסים_${document.getElementById('psHoursFilter').value||'כללי'}.xlsx`);
  }

  async function loadDelivery(){
    if(appSession?.type!=='admin')return;const period=document.getElementById('psDeliveryPeriod')?.value||'';const {data,error}=await supabaseClient.rpc('admin_list_employee_documents_v2',{p_period:period});if(error){console.error(error);toast('טעינת המסמכים נכשלה');return}docRows=data||[];const box=document.getElementById('psDeliveryTable');if(!box)return;box.innerHTML=docRows.length?`<table><thead><tr><th>עובד/ת</th><th>מסמך</th><th>תקופה</th><th>סטטוס</th><th>פעולות</th></tr></thead><tbody>${docRows.map(r=>`<tr><td><b>${esc(r.full_name)}</b><br><small>${esc(r.phone||'ללא טלפון')}</small></td><td>${r.doc_type==='payslip'?'תלוש שכר':'דוח שעות'}</td><td>${esc(r.period_label)}</td><td><span class="payrollDocStatus ${r.delivered_at?'delivered':r.reviewed_at?'reviewed':''}">${r.delivered_at?'נמסר':r.reviewed_at?'נבדק':'ממתין לבדיקה'}</span></td><td><div class="actions"><button class="btn secondary" data-doc-open="${r.id}">פתיחה</button>${r.reviewed_at?'':`<button class="btn secondary" data-doc-review="${r.id}">סומן כנבדק</button>`}<button class="btn primary" data-doc-wa="${r.id}" ${r.phone?'':'disabled'}>WhatsApp</button><button class="btn secondary" data-doc-delivered="${r.id}">סימון נמסר</button></div></td></tr>`).join('')}</tbody></table>`:'<div class="availabilityEmpty">אין מסמכים בתקופה זו.</div>';
    box.querySelectorAll('[data-doc-open]').forEach(b=>b.onclick=()=>openAdminDocument(b.dataset.docOpen));
    box.querySelectorAll('[data-doc-review]').forEach(b=>b.onclick=()=>markDoc(b.dataset.docReview,'reviewed'));
    box.querySelectorAll('[data-doc-delivered]').forEach(b=>b.onclick=()=>markDoc(b.dataset.docDelivered,'delivered'));
    box.querySelectorAll('[data-doc-wa]').forEach(b=>b.onclick=()=>sendDocWhatsapp(b.dataset.docWa));
    await loadDashboard();
  }

  async function openAdminDocument(id){const r=docRows.find(x=>x.id===id);if(!r)return;const {data,error}=await supabaseClient.storage.from('employee-documents').createSignedUrl(r.storage_path,600);if(error||!data?.signedUrl){toast('פתיחת המסמך נכשלה');return}window.open(data.signedUrl,'_blank');}
  async function markDoc(id,action){const {error}=await supabaseClient.rpc('admin_mark_employee_document',{p_document_id:id,p_action:action});if(error){console.error(error);toast('עדכון הסטטוס נכשל');return}toast(action==='delivered'?'סומן כנמסר':'סומן כנבדק');await loadDelivery();}
  function sendDocWhatsapp(id){const r=docRows.find(x=>x.id===id);if(!r?.phone)return;const label=r.doc_type==='payslip'?'תלוש השכר':'דוח השעות',msg=`היי ${r.full_name},\n${label} שלך לתקופה ${r.period_label} זמין במערכת MATOK.\n\nכניסה לעובדים:\nhttps://voluble-marigold-95c410.netlify.app/?login=employee\n\nלאחר הכניסה פותחים „שעות ושכר”. משם אפשר לצפות, להדפיס או לשמור את המסמך.`;window.open(`https://wa.me/${phone972(r.phone)}?text=${encodeURIComponent(msg)}`,'_blank');}
  async function reviewAllShown(){for(const r of docRows.filter(x=>!x.reviewed_at)){const {error}=await supabaseClient.rpc('admin_mark_employee_document',{p_document_id:r.id,p_action:'reviewed'});if(error){console.error(error);toast('חלק מהמסמכים לא סומנו');break}}await loadDelivery();}

  async function exportDelivery(){if(!docRows.length)await loadDelivery();if(!docRows.length){toast('אין מסמכים לייצוא');return}await ensureXlsx();const rows=docRows.map(r=>({'שם עובד':r.full_name,'טלפון':r.phone,'סוג מסמך':r.doc_type==='payslip'?'תלוש שכר':'דוח שעות','תקופה':r.period_label,'נבדק':r.reviewed_at?'כן':'לא','נמסר':r.delivered_at?'כן':'לא','תאריך מסירה':r.delivered_at?new Date(r.delivered_at).toLocaleString('he-IL'):''}));const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'מסירה');XLSX.writeFile(wb,`MATOK_דוח_מסירת_מסמכים_${document.getElementById('psDeliveryPeriod').value||'כללי'}.xlsx`);}

  function renderPolicy(){const box=document.getElementById('psPolicyPreview');if(!box)return;const business=document.getElementById('psPolicyBusiness')?.value||'MATOK BASIC',address=document.getElementById('psPolicyAddress')?.value||'',date=document.getElementById('psPolicyDate')?.value||'',contact=document.getElementById('psPolicyContact')?.value||'';box.innerHTML=`<h2>${esc(business)}</h2><h3 style="text-align:center">נוהל מסירת תלושי שכר, דיווח שעות ובונוסים</h3><p><b>תוקף הנוהל:</b> ${esc(date.split('-').reverse().join('.'))} &nbsp; | &nbsp; <b>אחראי:</b> ${esc(contact)}</p><p>מטרת נוהל זה היא להבטיח דיווח מדויק, שקוף ומסודר של שעות עבודה, רכיבי שכר ובונוסים, תוך שמירה על פרטיות העובד/ת.</p><ol><li><b>דיווח שעות:</b> כל עובד/ת אחראי/ת לוודא שהנוכחות והשעות המדווחות משקפות את העבודה בפועל. אי־התאמה יש להעביר לאחראי השכר בהקדם.</li><li><b>בדיקת תלוש:</b> תלוש השכר נמסר באופן אישי ומאובטח. העובד/ת מתבקש/ת לבדוק את פרטיו, תקופת השכר ורכיבי השכר עם קבלתו.</li><li><b>בירור ותיקון:</b> בקשה לבירור בנוגע לשעות, נסיעות, בונוס או רכיב אחר תישלח בכתב בצירוף פירוט ברור.</li><li><b>בונוסים:</b> בונוס, ככל שאושר, מתועד בנפרד ונבדק מול נתוני התקופה. אומדן פנימי אינו מחליף את תלוש רואה החשבון.</li><li><b>פרטיות:</b> תלוש השכר ומידע השכר הם אישיים וחסויים. אין להעבירם לאחרים ללא צורך והרשאה.</li></ol><p><b>כתובת העסק:</b> ${esc(address)}</p><div class="signs"><div>חתימת הנהלה</div><div>חתימת עובד/ת – קראתי והבנתי</div></div>`;}
  function printPolicy(){renderPolicy();const html=document.getElementById('psPolicyPreview').innerHTML,w=window.open('','_blank');if(!w){toast('הדפדפן חסם את חלון ההדפסה');return}w.document.write(`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>MATOK - נוהל שכר</title><style>body{font-family:Arial,sans-serif;line-height:1.8;padding:35px;color:#18243b}h2,h3{text-align:center}.signs{display:flex;justify-content:space-between;gap:40px;margin-top:55px}.signs div{flex:1;border-top:1px solid #555;text-align:center;padding-top:7px}</style><body>${html}</body></html>`);w.document.close();setTimeout(()=>w.print(),250);}

  function injectWorkerHours(){
    const panel=document.getElementById('hours');if(!panel||document.getElementById('workerPayrollSummary'))return;
    const card=document.createElement('article');card.id='workerPayrollSummary';card.className='card';card.innerHTML='<h2>שעות ובונוסים</h2><p>הנתונים שהנהלת MATOK שמרה עבורך. השכר הקובע הוא התלוש הרשמי.</p><div id="workerPayrollRows"><small>טוען…</small></div>';const docs=document.getElementById('employeeDocumentsCard');if(docs)docs.after(card);else panel.prepend(card);
  }
  async function loadWorkerHours(){const box=document.getElementById('workerPayrollRows');if(!box||appSession?.type!=='employee')return;const {data,error}=await supabaseClient.rpc('employee_list_payroll_hours',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code});if(error){console.error(error);box.innerHTML='<small>טעינת נתוני השעות נכשלה.</small>';return}const rows=data||[];box.innerHTML=rows.length?rows.map(r=>`<div class="workerPayrollRow"><b>${esc(r.period_label)}</b><div class="workerPayrollFacts"><span>רגילות: ${r.regular_hours}</span><span>נוספות: ${r.overtime_hours}</span><span>שבת/חג: ${r.holiday_hours}</span><span>בונוס: ₪${Number(r.bonus_amount||0).toFixed(2)}</span></div>${r.manager_note?`<small>${esc(r.manager_note)}</small>`:''}</div>`).join(''):'<small>אין עדיין נתוני שעות ובונוסים בארכיון שלך.</small>';}

  function workerBindings(){injectWorkerHours();document.querySelectorAll('.workerTabs button').forEach(b=>{if(b.dataset.target==='hours'&&!b.dataset.payrollSuiteBound){b.dataset.payrollSuiteBound='1';b.addEventListener('click',()=>setTimeout(loadWorkerHours,0));}});}

  style();
  let attempts=0;const timer=setInterval(()=>{attempts++;const ok=setupPanel();workerBindings();if(ok&&attempts>10)clearInterval(timer);if(attempts>100)clearInterval(timer);},100);

  try{
    const oldLoadEmployeePortal=loadEmployeePortal;
    loadEmployeePortal=async function(){const r=await oldLoadEmployeePortal.apply(this,arguments);workerBindings();await loadWorkerHours();return r;};
  }catch(_){ }

  document.addEventListener('click',e=>{const tab=e.target.closest?.('.adminTabs button[data-target="payrollDocsAdmin"]');if(tab)setTimeout(()=>{setupPanel();loadDashboard();},0);});
})();
