(() => {
  'use strict';
  const VERSION='20260902-final-payroll-3';
  let profiles=[],hoursRows=[],docRows=[],pdfBytes=null,pdfPages=[],staff=[];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const norm=v=>String(v??'').toLowerCase().replace(/[\u0591-\u05C7]/g,'').replace(/[״”]/g,'"').replace(/[׳’]/g,"'").replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  const tokens=v=>norm(v).split(' ').filter(Boolean);
  const num=v=>{const s=String(v??'').replace(/\s/g,'').replace(/,/g,'.').replace(/[^0-9.+-]/g,'');const n=Number(s);return Number.isFinite(n)?n:0};
  function levenshtein(a,b){a=String(a||'');b=String(b||'');if(a===b)return 0;if(!a.length)return b.length;if(!b.length)return a.length;const prev=Array.from({length:b.length+1},(_,i)=>i),cur=new Array(b.length+1);for(let i=1;i<=a.length;i++){cur[0]=i;for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));for(let j=0;j<=b.length;j++)prev[j]=cur[j]}return prev[b.length]}
  function tokenHit(term,pageTokens){if(!term)return {hit:false,fuzzy:false};if(pageTokens.includes(term))return {hit:true,fuzzy:false};if(term.length>=4){const near=pageTokens.find(t=>t.length>=4&&Math.abs(t.length-term.length)<=1&&levenshtein(term,t)<=1);if(near)return {hit:true,fuzzy:true}}return {hit:false,fuzzy:false}}
  function normalizePeriod(v,fallback){if(v instanceof Date&&!Number.isNaN(v.getTime()))return v.toISOString().slice(0,7);const s=String(v??'').trim();let m=s.match(/^(20\d{2})[-/.](\d{1,2})$/);if(m)return m[1]+'-'+String(Math.min(12,Math.max(1,Number(m[2])))).padStart(2,'0');m=s.match(/^(\d{1,2})[-/.](20\d{2})$/);if(m)return m[2]+'-'+String(Math.min(12,Math.max(1,Number(m[1])))).padStart(2,'0');return fallback||''}
  function rowValue(row,aliases){const entries=Object.entries(row||{}).map(([k,v])=>[norm(k),v]);for(const a of aliases){const na=norm(a),exact=entries.find(([k])=>k===na);if(exact)return exact[1]}for(const a of aliases){const na=norm(a),partial=entries.find(([k])=>k.includes(na)||na.includes(k));if(partial)return partial[1]}return ''}
  const safe=v=>String(v||'period').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,50)||'period';
  const periodNow=()=>new Date().toISOString().slice(0,7);
  const phone972=v=>{let d=String(v||'').replace(/\D/g,'');if(d.startsWith('972'))return d;if(d.startsWith('0'))return '972'+d.slice(1);return d};
  const isAdmin=()=>{try{return appSession?.type==='admin'}catch(_){return false}};const isEmployee=()=>{try{return appSession?.type==='employee'}catch(_){return false}};
  const loadScript=src=>new Promise((resolve,reject)=>{const old=[...document.scripts].find(s=>s.src===src);if(old)return resolve();const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
  async function ensurePdf(){if(!window.pdfjsLib)await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');if(window.pdfjsLib)window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';if(!window.PDFLib)await loadScript('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js')}
  async function ensureOcr(){if(!window.Tesseract)await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js')}
  async function ensureXlsx(){if(!window.XLSX)await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js')}
  function addStyles(){if(document.getElementById('mfPayrollStyles'))return;const s=document.createElement('style');s.id='mfPayrollStyles';s.textContent=`.mpNav{display:flex;gap:6px;overflow:auto;margin-bottom:10px}.mpNav button{white-space:nowrap}.mpSub{display:none}.mpSub.active{display:block}.mpGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.mpMetric{border:1px solid var(--line);border-radius:12px;background:#fff;padding:12px}.mpMetric span{font-size:10px;color:var(--muted);display:block}.mpMetric b{font-size:24px}.mpTable{overflow:auto}.mpTable table{width:100%;border-collapse:collapse;font-size:12px}.mpTable th,.mpTable td{padding:9px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}.mpTable th{background:var(--soft)}.mpPdfRow{display:grid;grid-template-columns:85px 1fr 220px;gap:8px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:9px;background:#fff;margin-top:6px}.mpStatus{padding:10px;border-radius:9px;background:var(--soft);margin-top:9px}.mpStatus.good{background:#e9f6e9;color:#2e6833}.mpStatus.bad{background:#fff0ed;color:#8d372f}.mpWorkerRow{border:1px solid var(--line);border-radius:10px;padding:10px;background:#fff;margin-top:7px}.mpWorkerFacts{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}.mpWorkerFacts span{font-size:10px;padding:4px 7px;border-radius:999px;background:var(--soft)}.mpConfidence{display:inline-flex;padding:3px 7px;border-radius:999px;font-size:9px;font-weight:900;margin-top:4px}.mpConfidence.high{background:#dff2e2;color:#286333}.mpConfidence.medium{background:#fff0c7;color:#765a15}.mpConfidence.low{background:#f7deda;color:#8b342d}.mpPdfRow small{display:block;line-height:1.4}.mpPdfRow .mpPreview{font-size:9px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}.mpOcrNote{margin-top:8px;padding:9px 10px;border-radius:9px;background:#eef7ff;color:#345d80;font-size:11px;line-height:1.5}.mpUploadChoice{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:10px 0 13px}.mpUploadChoice button{border:1px solid var(--line);background:#fff;border-radius:14px;padding:13px 10px;font-weight:900}.mpUploadChoice button.active{background:#eef9f6;border-color:#89c9bd;color:#285f57;box-shadow:0 6px 18px #1a1a2e0b}.mpUploadSteps{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:10px 0}.mpUploadSteps span{border:1px solid var(--line);background:var(--soft);border-radius:10px;padding:8px;font-size:10px;font-weight:800;text-align:center}@media(max-width:850px){.mpGrid{grid-template-columns:1fr 1fr}.mpPdfRow{grid-template-columns:1fr}}@media(max-width:480px){.mpGrid{grid-template-columns:1fr}}`;document.head.appendChild(s)}

  function ensureAdminTab(){const tabs=document.querySelector('.adminTabs'),admin=document.getElementById('admin');if(!tabs||!admin)return false;let btn=tabs.querySelector('[data-target="payrollFinal"]');if(!btn){btn=document.createElement('button');btn.dataset.target='payrollFinal';btn.textContent='שכר ומסמכים';tabs.appendChild(btn);btn.onclick=()=>{tabs.querySelectorAll('button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');admin.querySelectorAll(':scope>.panel').forEach(x=>x.classList.remove('active'));document.getElementById('payrollFinal').classList.add('active');initPayrollAdminFinal()}}
    let p=document.getElementById('payrollFinal');if(!p){p=document.createElement('section');p.id='payrollFinal';p.className='panel';admin.appendChild(p)}return true}
  function syncUploadChoice(){const type=document.getElementById('mpPdfType')?.value||'payslip';document.querySelectorAll('#mp-pdf [data-mp-doc-choice]').forEach(b=>b.classList.toggle('active',b.dataset.mpDocChoice===type))}
  function adminHtml(){const p=document.getElementById('payrollFinal');if(!p||p.dataset.built==='1')return;p.dataset.built='1';p.innerHTML=`<div class="mpNav"><button class="btn primary" data-mp="dash">לוח בקרה</button><button class="btn secondary" data-mp="pdf">העלאת תלושים ודוחות</button><button class="btn secondary" data-mp="hours">שעות ובונוסים</button><button class="btn secondary" data-mp="profiles">נתוני שכר</button><button class="btn secondary" data-mp="delivery">מסירה לעובדים</button></div>
    <section class="mpSub active" id="mp-dash"><div class="mpGrid"><article class="mpMetric"><span>עובדים פעילים</span><b id="mpStaff">—</b></article><article class="mpMetric"><span>תלושים בחודש</span><b id="mpPayslips">—</b></article><article class="mpMetric"><span>נמסרו</span><b id="mpDelivered">—</b></article><article class="mpMetric"><span>רשומות שעות</span><b id="mpHours">—</b></article></div><article class="card" style="margin-top:10px"><h2>מרכז שכר ונוכחות</h2><p>מעלים קובץ מרוכז של רואה החשבון או דוח שעות, בודקים את הזיהוי, והמערכת מפרקת אותו לקובץ פרטי לכל עובד.</p><label>חודש להצגה<input id="mpDashPeriod" type="month" value="${periodNow()}"></label><button class="btn secondary" id="mpRefreshDash" style="margin-top:8px">רענון</button></article></section>
    <section class="mpSub" id="mp-pdf"><article class="card"><h2>העלאת תלושי שכר / דוחות שעות</h2><p><b>בחר מה אתה מעלה:</b></p><div class="mpUploadChoice"><button type="button" class="active" data-mp-doc-choice="payslip">תלושי שכר</button><button type="button" data-mp-doc-choice="hours">דוחות נוכחות / שעות</button></div><div class="mpUploadSteps"><span>1. בוחרים סוג וחודש</span><span>2. מעלים PDF ובודקים זיהוי</span><span>3. שומרים לעובדים</span></div><div class="truth" style="margin-bottom:10px"><b>איפה העובדים רואים?</b><br>אחרי השמירה, כל עובד רואה רק את המסמכים שלו באזור האישי תחת „הנתונים שלי”.</div><p>מעלים PDF מרוכז. המערכת מזהה שם מלא, שם מקוצר ושם משפחה, ובמידת הצורך מפעילה OCR גם על PDF סרוק כתמונה. לפני שמירה תמיד רואים את השיוך של כל עמוד.</p><div class="mpGrid"><label>סוג מסמך<select id="mpPdfType"><option value="payslip">תלוש שכר</option><option value="hours">דוח שעות עבודה</option></select></label><label>חודש<input id="mpPdfPeriod" type="month" value="${periodNow()}"></label><label style="grid-column:span 2">PDF<input id="mpPdfFile" type="file" accept="application/pdf,.pdf"></label></div><label style="display:flex;gap:8px;align-items:center;margin-top:8px;font-size:12px;font-weight:800"><input id="mpUseOcr" type="checkbox" checked style="width:auto">להפעיל זיהוי OCR אוטומטי כאשר הטקסט ב-PDF אינו מספיק</label><div class="mpOcrNote">המערכת לא שומרת מסמך עד שכל העמודים משויכים לעובד. זיהוי ברמת ביטחון נמוכה נשאר לבחירה ידנית.</div><div class="actions" style="margin-top:9px"><button class="btn primary" id="mpAnalyzePdf">ניתוח וזיהוי</button><button class="btn secondary" id="mpSavePdf" disabled>פירוק ושמירה לעובדים</button></div><div id="mpPdfStatus" class="mpStatus">טרם נבחר קובץ.</div><div id="mpPdfReview"></div></article></section>
    <section class="mpSub" id="mp-hours"><article class="card"><h2>שעות ובונוסים</h2><div class="mpGrid"><label>עובד<select id="mpHoursStaff"></select></label><label>חודש<input id="mpHoursPeriod" type="month" value="${periodNow()}"></label><label>שעות רגילות<input id="mpRegular" type="number" step="0.01" min="0"></label><label>שעות נוספות<input id="mpOvertime" type="number" step="0.01" min="0"></label><label>שבת/חג<input id="mpHoliday" type="number" step="0.01" min="0"></label><label>בונוס ₪<input id="mpBonus" type="number" step="0.01"></label><label style="grid-column:span 2">הערת מנהל<input id="mpHoursNote"></label></div><div class="actions" style="margin-top:9px"><button class="btn primary" id="mpSaveHours">שמירה</button><label class="btn secondary">ייבוא Excel/CSV<input id="mpImportHours" type="file" accept=".xlsx,.xls,.csv,.tsv" style="display:none"></label><button class="btn secondary" id="mpExportHours">ייצוא Excel</button></div><div id="mpImportStatus" class="mpStatus">אין ייבוא פעיל.</div></article><article class="card"><div class="employeeHead"><h2>נתוני החודש</h2><div><input id="mpHoursFilter" type="month" value="${periodNow()}"><button class="btn secondary" id="mpRefreshHours">רענון</button></div></div><div id="mpHoursTable" class="mpTable"></div></article></section>
    <section class="mpSub" id="mp-profiles"><article class="card"><h2>נתוני שכר משלימים</h2><p>תעריף שעתי ותאריך תחילת עבודה לצורך בקרה פנימית בלבד.</p><div id="mpProfiles" class="mpTable"></div></article></section>
    <section class="mpSub" id="mp-delivery"><article class="card"><div class="employeeHead"><div><h2>מסירה לעובדים</h2><small>הקובץ נשאר פרטי בפורטל. WhatsApp שולח קישור כניסה בלבד.</small></div><div><input id="mpDeliveryPeriod" type="month" value="${periodNow()}"><button class="btn secondary" id="mpRefreshDelivery">רענון</button></div></div><div id="mpDelivery" class="mpTable"></div></article></section>`;
    p.querySelectorAll('[data-mp]').forEach(b=>b.onclick=()=>{p.querySelectorAll('[data-mp]').forEach(x=>{x.classList.toggle('primary',x===b);x.classList.toggle('secondary',x!==b)});p.querySelectorAll('.mpSub').forEach(x=>x.classList.toggle('active',x.id==='mp-'+b.dataset.mp));if(b.dataset.mp==='dash')loadDash();if(b.dataset.mp==='hours')loadHoursAdmin();if(b.dataset.mp==='profiles')loadProfiles();if(b.dataset.mp==='delivery')loadDelivery()});
    p.querySelectorAll('[data-mp-doc-choice]').forEach(b=>b.onclick=()=>{const s=document.getElementById('mpPdfType');if(s){s.value=b.dataset.mpDocChoice;syncUploadChoice()}});const typeSelect=document.getElementById('mpPdfType');if(typeSelect)typeSelect.onchange=syncUploadChoice;syncUploadChoice();document.getElementById('mpRefreshDash').onclick=loadDash;document.getElementById('mpAnalyzePdf').onclick=analyzePdf;document.getElementById('mpSavePdf').onclick=savePdf;document.getElementById('mpSaveHours').onclick=saveHours;document.getElementById('mpImportHours').onchange=importHours;document.getElementById('mpExportHours').onclick=exportHours;document.getElementById('mpRefreshHours').onclick=loadHoursAdmin;document.getElementById('mpRefreshDelivery').onclick=loadDelivery;
  }
  async function getStaff(){if(staff.length)return staff;const {data,error}=await supabaseClient.from('staff').select('id,full_name,phone,username,role_name').eq('is_active',true).order('full_name');if(error)throw error;staff=data||[];return staff}
  async function loadDash(){if(!isAdmin())return;const period=document.getElementById('mpDashPeriod')?.value||periodNow();const {data,error}=await supabaseClient.rpc('admin_payroll_dashboard',{p_period:period});if(error)return;const x=data?.[0]||{};document.getElementById('mpStaff').textContent=x.active_staff??0;document.getElementById('mpPayslips').textContent=x.payslips??0;document.getElementById('mpDelivered').textContent=x.delivered??0;document.getElementById('mpHours').textContent=x.hours_rows??0}
  function setPdfStatus(t,kind=''){const x=document.getElementById('mpPdfStatus');if(x){x.className='mpStatus '+kind;x.textContent=t}}
  function matchPage(text){
    const t=norm(text),pageTokens=tokens(t),arr=[];
    if(!t)return {staffId:'',confidence:'low',score:0,reason:'אין טקסט קריא'};
    staff.forEach(s=>{
      const n=norm(s.full_name),u=norm(s.username),parts=tokens(n),first=parts[0]||'',last=parts[parts.length-1]||'';
      let score=0,reasons=[];
      if(n&&t.includes(n)){score+=220;reasons.push('שם מלא')}
      if(u&&t.includes(u)){score+=140;reasons.push('שם משתמש')}
      const exactParts=parts.filter(p=>p.length>1&&pageTokens.includes(p));
      if(parts.filter(p=>p.length>1).length>=2&&exactParts.length===parts.filter(p=>p.length>1).length){score+=130;reasons.push('כל חלקי השם')}
      const firstHit=tokenHit(first,pageTokens);
      if(firstHit.hit){
        const sameFirst=staff.filter(x=>tokenHit(tokens(x.full_name)[0]||'',pageTokens).hit&&norm(x.full_name).split(' ')[0]===first).length;
        score+=sameFirst<=1?90:45;
        reasons.push(firstHit.fuzzy?'שם פרטי דומה':'שם פרטי')
      }
      if(last&&last!==first){
        if(last.length>1){
          const lh=tokenHit(last,pageTokens);if(lh.hit){score+=lh.fuzzy?55:85;reasons.push(lh.fuzzy?'שם משפחה דומה':'שם משפחה')}
        }else if(firstHit.hit&&pageTokens.some(tok=>tok.length>1&&tok.startsWith(last))){score+=55;reasons.push('אות משפחה תואמת')}
      }
      if(score)arr.push({id:s.id,score,reasons});
    });
    arr.sort((a,b)=>b.score-a.score);
    if(!arr.length)return {staffId:'',confidence:'low',score:0,reason:'לא נמצא שם תואם'};
    const top=arr[0],second=arr[1],margin=top.score-(second?.score||0);
    let confidence='low';
    if(top.score>=170&&margin>=30)confidence='high';
    else if(top.score>=85&&margin>=35)confidence='medium';
    const staffId=confidence==='low'?'':top.id;
    return {staffId,confidence,score:top.score,reason:top.reasons.join(' + ')||'התאמה',candidates:arr.slice(0,3)};
  }
  async function ocrPage(page,pageNo){
    await ensureOcr();
    const viewport=page.getViewport({scale:1.7}),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
    canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    await page.render({canvasContext:ctx,viewport}).promise;
    setPdfStatus(`עמוד ${pageNo}: מפעיל OCR לזיהוי סריקה…`);
    const result=await Tesseract.recognize(canvas,'heb+eng',{logger:m=>{if(m.status==='recognizing text'&&Number.isFinite(m.progress))setPdfStatus(`עמוד ${pageNo}: OCR ${Math.round(m.progress*100)}%`)}});
    return result?.data?.text||'';
  }
  async function analyzePdf(){
    const file=document.getElementById('mpPdfFile').files?.[0],period=document.getElementById('mpPdfPeriod').value,useOcr=document.getElementById('mpUseOcr')?.checked!==false;
    if(!file){setPdfStatus('יש לבחור קובץ PDF.','bad');return}
    if(!period){setPdfStatus('יש לבחור חודש.','bad');return}
    setPdfStatus('קורא את ה-PDF ומזהה עובדים…');document.getElementById('mpSavePdf').disabled=true;
    try{
      await ensurePdf();await getStaff();pdfBytes=await file.arrayBuffer();const pdf=await pdfjsLib.getDocument({data:pdfBytes.slice(0)}).promise;pdfPages=[];
      let ocrCount=0;
      for(let n=1;n<=pdf.numPages;n++){
        const page=await pdf.getPage(n),tc=await page.getTextContent(),raw=tc.items.map(i=>i.str||'').join(' ');
        let text=raw,match=matchPage(text),source='text';
        const readable=norm(raw).replace(/\s/g,'').length;
        if(useOcr&&(readable<35||match.confidence==='low')){
          try{
            const ocr=await ocrPage(page,n);
            if(norm(ocr).length>norm(text).length||match.confidence==='low'){
              const ocrMatch=matchPage(ocr);
              if(ocrMatch.confidence!=='low'||match.confidence==='low'){text=ocr;match=ocrMatch;source='ocr';ocrCount++}
            }
          }catch(ocrError){console.warn('OCR failed on page',n,ocrError)}
        }
        pdfPages.push({page:n,staffId:match.staffId||'',confidence:match.confidence||'low',reason:match.reason||'',source,textPreview:norm(text).slice(0,90)});
      }
      renderPdfReview();
      const matched=pdfPages.filter(x=>x.staffId).length,manual=pdfPages.length-matched;
      document.getElementById('mpSavePdf').disabled=manual>0;
      setPdfStatus(`נותחו ${pdfPages.length} עמודים · זוהו ${matched} · OCR הופעל ב-${ocrCount}${manual?` · ${manual} דורשים שיוך ידני`:''}.`,manual?'':'good');
    }catch(e){console.error(e);setPdfStatus('לא ניתן לנתח את הקובץ. נסה שוב; אם עמוד לא מזוהה, ניתן לבחור את העובד ידנית לפני השמירה.','bad')}
  }
  function renderPdfReview(){
    const box=document.getElementById('mpPdfReview'),opts='<option value="">לא זוהה — לבחור ידנית</option>'+staff.map(s=>`<option value="${s.id}">${esc(s.full_name)}</option>`).join('');
    box.innerHTML=pdfPages.map((r,i)=>`<div class="mpPdfRow"><div><b>עמוד ${r.page}</b><span class="mpConfidence ${r.confidence}">${r.confidence==='high'?'זיהוי גבוה':r.confidence==='medium'?'זיהוי בינוני':'בדיקה ידנית'}</span></div><div><small>${esc(r.reason||'לא זוהה')}${r.source==='ocr'?' · OCR':''}</small><div class="mpPreview">${esc(r.textPreview||'')}</div></div><select data-mp-page="${i}">${opts}</select></div>`).join('');
    box.querySelectorAll('select').forEach(sel=>{const i=Number(sel.dataset.mpPage);sel.value=pdfPages[i].staffId||'';sel.onchange=()=>{pdfPages[i].staffId=sel.value;pdfPages[i].confidence=sel.value?'high':'low';pdfPages[i].reason=sel.value?'שויך ידנית על ידי מנהל':'לא שויך';renderPdfReview();document.getElementById('mpSavePdf').disabled=pdfPages.some(x=>!x.staffId);if(!pdfPages.some(x=>!x.staffId))setPdfStatus('כל העמודים משויכים. ניתן לשמור לעובדים.','good')}})
  }
  async function savePdf(){if(!pdfBytes||!pdfPages.length)return;const missing=pdfPages.filter(x=>!x.staffId);if(missing.length){setPdfStatus(`יש ${missing.length} עמודים שלא שויכו לעובד.`, 'bad');return}const type=document.getElementById('mpPdfType').value,period=document.getElementById('mpPdfPeriod').value,btn=document.getElementById('mpSavePdf');btn.disabled=true;btn.textContent='שומר…';try{await ensurePdf();const src=await PDFLib.PDFDocument.load(pdfBytes),grouped=new Map();pdfPages.forEach(r=>{if(!grouped.has(r.staffId))grouped.set(r.staffId,[]);grouped.get(r.staffId).push(r.page-1)});let done=0;for(const [staffId,pages] of grouped){const out=await PDFLib.PDFDocument.create(),copies=await out.copyPages(src,pages);copies.forEach(p=>out.addPage(p));const bytes=await out.save(),path=`${staffId}/${safe(period)}/${type}-${crypto.randomUUID()}.pdf`;const {error:up}=await supabaseClient.storage.from('employee-documents').upload(path,new Blob([bytes],{type:'application/pdf'}),{contentType:'application/pdf'});if(up)throw up;const fname=`${type==='payslip'?'תלוש שכר':'דוח שעות'} - ${period}.pdf`;const {error:reg}=await supabaseClient.rpc('admin_register_employee_document',{p_staff_id:staffId,p_doc_type:type,p_period_label:period,p_storage_path:path,p_original_file_name:fname,p_page_from:Math.min(...pages)+1,p_page_to:Math.max(...pages)+1,p_retention_days:3650});if(reg){await supabaseClient.storage.from('employee-documents').remove([path]);throw reg}done++}setPdfStatus(`נשמרו ${done} מסמכים פרטיים לעובדים.`, 'good');pdfBytes=null;pdfPages=[];document.getElementById('mpPdfFile').value='';document.getElementById('mpPdfReview').innerHTML='';await loadDash()}catch(e){console.error(e);setPdfStatus('השמירה נכשלה: '+(e?.message||'שגיאה'), 'bad')}finally{btn.disabled=false;btn.textContent='פירוק ושמירה לעובדים'}}
  async function loadProfiles(){const box=document.getElementById('mpProfiles');if(!box)return;const {data,error}=await supabaseClient.rpc('admin_list_payroll_profiles');if(error){box.innerHTML='טעינת הנתונים נכשלה';return}profiles=data||[];box.innerHTML=`<table><thead><tr><th>עובד</th><th>₪ לשעה</th><th>תחילת עבודה</th><th>הערה</th><th></th></tr></thead><tbody>${profiles.map(r=>`<tr><td><b>${esc(r.full_name)}</b></td><td><input type="number" step="0.01" value="${Number(r.hourly_rate||0)}" data-rate="${r.staff_id}"></td><td><input type="date" value="${r.employment_start||''}" data-start="${r.staff_id}"></td><td><input value="${esc(r.notes||'')}" data-note="${r.staff_id}"></td><td><button class="btn secondary" data-save-profile="${r.staff_id}">שמירה</button></td></tr>`).join('')}</tbody></table>`;box.querySelectorAll('[data-save-profile]').forEach(b=>b.onclick=async()=>{const id=b.dataset.saveProfile,rate=Number(box.querySelector(`[data-rate="${id}"]`).value||0),start=box.querySelector(`[data-start="${id}"]`).value||null,note=box.querySelector(`[data-note="${id}"]`).value||'';const {error}=await supabaseClient.rpc('admin_save_payroll_profile',{p_staff_id:id,p_hourly_rate:rate,p_employment_start:start,p_notes:note});toast?.(error?'השמירה נכשלה':'נתוני השכר נשמרו')})}
  async function fillStaffSelect(){await getStaff();const s=document.getElementById('mpHoursStaff');if(s)s.innerHTML=staff.map(x=>`<option value="${x.id}">${esc(x.full_name)}</option>`).join('')}
  async function saveHours(){const id=document.getElementById('mpHoursStaff').value,period=document.getElementById('mpHoursPeriod').value;if(!id||!period){toast?.('יש לבחור עובד וחודש');return}const {error}=await supabaseClient.rpc('admin_upsert_payroll_hours',{p_staff_id:id,p_period_label:period,p_regular_hours:Number(document.getElementById('mpRegular').value||0),p_overtime_hours:Number(document.getElementById('mpOvertime').value||0),p_holiday_hours:Number(document.getElementById('mpHoliday').value||0),p_bonus_amount:Number(document.getElementById('mpBonus').value||0),p_manager_note:document.getElementById('mpHoursNote').value||'',p_source_file:null});if(error){console.error(error);toast?.('שמירת השעות נכשלה')}else{toast?.('נתוני השעות נשמרו');loadHoursAdmin()}}
  async function loadHoursAdmin(){await fillStaffSelect();const box=document.getElementById('mpHoursTable');if(!box)return;const period=document.getElementById('mpHoursFilter')?.value||periodNow(),{data,error}=await supabaseClient.rpc('admin_list_payroll_hours',{p_period:period});if(error){box.innerHTML='טעינת הנתונים נכשלה';return}hoursRows=data||[];box.innerHTML=`<table><thead><tr><th>עובד</th><th>רגילות</th><th>נוספות</th><th>שבת/חג</th><th>בונוס</th><th>תעריף</th><th>אומדן בסיס</th></tr></thead><tbody>${hoursRows.map(r=>`<tr><td><b>${esc(r.full_name)}</b></td><td>${r.regular_hours}</td><td>${r.overtime_hours}</td><td>${r.holiday_hours}</td><td>₪${Number(r.bonus_amount||0).toFixed(2)}</td><td>₪${Number(r.hourly_rate||0).toFixed(2)}</td><td>₪${Number(r.estimated_base||0).toFixed(2)}</td></tr>`).join('')}</tbody></table>`}
  async function importHours(ev){
    const file=ev.target.files?.[0],status=document.getElementById('mpImportStatus');if(!file)return;
    status.textContent='קורא קובץ ומזהה עובדים…';
    try{
      await ensureXlsx();await getStaff();
      const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
      let ok=0,skip=0;const unresolved=[];
      for(const row of rows){
        const name=String(rowValue(row,['שם עובד','שם העובד','עובד','שם','employee','employee name','name'])||'').trim();
        const match=matchPage(name),s=staff.find(x=>String(x.id)===String(match.staffId));
        if(!s){skip++;if(name)unresolved.push(name);continue}
        const fallback=document.getElementById('mpHoursPeriod').value||periodNow();
        const period=normalizePeriod(rowValue(row,['חודש','תקופה','חודש עבודה','period','month']),fallback);
        if(!period){skip++;continue}
        const regular=num(rowValue(row,['שעות רגילות','רגילות','שעות עבודה','סהכ שעות','סה כ שעות','סהכ שעות עבודה','total hours','regular hours','hours']));
        const overtime=num(rowValue(row,['שעות נוספות','נוספות','שעות נוספות 125','overtime','overtime hours']));
        const holiday=num(rowValue(row,['שבת חג','שבת/חג','שעות שבת','שעות חג','holiday hours','weekend hours']));
        const bonus=num(rowValue(row,['בונוס','בונוסים','bonus']));
        const note=String(rowValue(row,['הערה','הערות','note','notes'])||'');
        const {error}=await supabaseClient.rpc('admin_upsert_payroll_hours',{p_staff_id:s.id,p_period_label:period,p_regular_hours:regular,p_overtime_hours:overtime,p_holiday_hours:holiday,p_bonus_amount:bonus,p_manager_note:note,p_source_file:file.name});
        if(error){console.error('hours import row',error);skip++}else ok++;
      }
      const sample=[...new Set(unresolved)].slice(0,4).join(', ');
      status.textContent=`הייבוא הסתיים: ${ok} נשמרו, ${skip} דולגו.${sample?' לא זוהו: '+sample:''}`;
      loadHoursAdmin();
    }catch(e){console.error(e);status.textContent='הייבוא נכשל. ודא שיש עמודה עם שם עובד ושעות.'}
    finally{ev.target.value=''}
  }
  async function exportHours(){await ensureXlsx();if(!hoursRows.length)await loadHoursAdmin();const data=hoursRows.map(r=>({'עובד':r.full_name,'חודש':r.period_label,'שעות רגילות':r.regular_hours,'שעות נוספות':r.overtime_hours,'שבת/חג':r.holiday_hours,'בונוס':r.bonus_amount,'תעריף':r.hourly_rate,'אומדן בסיס':r.estimated_base})),ws=XLSX.utils.json_to_sheet(data),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'שעות');XLSX.writeFile(wb,`MATOK-hours-${document.getElementById('mpHoursFilter')?.value||periodNow()}.xlsx`)}
  async function loadDelivery(){const box=document.getElementById('mpDelivery');if(!box)return;const period=document.getElementById('mpDeliveryPeriod')?.value||periodNow(),{data,error}=await supabaseClient.rpc('admin_list_employee_documents_v2',{p_period:period});if(error){box.innerHTML='טעינת המסמכים נכשלה';return}docRows=data||[];box.innerHTML=`<table><thead><tr><th>עובד</th><th>מסמך</th><th>חודש</th><th>סטטוס</th><th>פעולות</th></tr></thead><tbody>${docRows.map(r=>`<tr><td><b>${esc(r.full_name)}</b></td><td>${r.doc_type==='payslip'?'תלוש שכר':'דוח שעות'}</td><td>${esc(r.period_label)}</td><td>${r.delivered_at?'נמסר':r.reviewed_at?'נבדק':'חדש'}</td><td><div class="actions"><button class="btn secondary" data-view-doc="${r.id}">פתיחה</button><button class="btn secondary" data-review-doc="${r.id}">נבדק</button><button class="btn primary" data-wa-doc="${r.id}">WhatsApp</button></div></td></tr>`).join('')}</tbody></table>`;box.querySelectorAll('[data-view-doc]').forEach(b=>b.onclick=()=>openAdminDoc(b.dataset.viewDoc));box.querySelectorAll('[data-review-doc]').forEach(b=>b.onclick=async()=>{await supabaseClient.rpc('admin_mark_employee_document',{p_document_id:b.dataset.reviewDoc,p_action:'reviewed'});loadDelivery()});box.querySelectorAll('[data-wa-doc]').forEach(b=>b.onclick=async()=>{const r=docRows.find(x=>x.id===b.dataset.waDoc);if(!r)return;await supabaseClient.rpc('admin_mark_employee_document',{p_document_id:r.id,p_action:'delivered'});const msg=`היי ${r.full_name},\n${r.doc_type==='payslip'?'תלוש השכר':'דוח השעות'} שלך לחודש ${r.period_label} זמין באזור האישי במערכת MATOK.\n\nכניסה:\nhttps://voluble-marigold-95c410.netlify.app/?login=employee\n\nלאחר הכניסה: תלושים ודוחות.`;window.open(`https://wa.me/${phone972(r.phone)}?text=${encodeURIComponent(msg)}`,'_blank');loadDelivery()})}
  async function openAdminDoc(id){const r=docRows.find(x=>x.id===id);if(!r)return;const {data,error}=await supabaseClient.storage.from('employee-documents').createSignedUrl(r.storage_path,600);if(error||!data?.signedUrl){toast?.('פתיחת המסמך נכשלה');return}window.open(data.signedUrl,'_blank')}

  async function loadEmployeeDocumentsFinal(){const box=document.getElementById('mfEmployeeDocuments');if(!box||!isEmployee())return;box.innerHTML='<small>טוען…</small>';const {data,error}=await supabaseClient.rpc('employee_list_documents',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code});if(error){box.innerHTML='<div class="mfEmpty">טעינת המסמכים נכשלה.</div>';return}const rows=data||[];box.innerHTML=rows.length?rows.map(r=>`<div class="mpWorkerRow"><b>${r.doc_type==='payslip'?'תלוש שכר':'דוח שעות'} · ${esc(r.period_label)}</b><small>${esc(r.original_file_name||'')}</small><div class="actions" style="margin-top:7px"><button class="btn primary" data-emp-doc="${r.id}" data-download="0">פתיחה</button><button class="btn secondary" data-emp-doc="${r.id}" data-download="1">שמירה במכשיר</button></div></div>`).join(''):'<div class="mfEmpty">אין עדיין מסמכים בארכיון שלך.</div>';box.querySelectorAll('[data-emp-doc]').forEach(b=>b.onclick=()=>openEmployeeDoc(b.dataset.empDoc,b.dataset.download==='1'))}
  async function openEmployeeDoc(id,download){const popup=download?null:window.open('about:blank','_blank');try{const res=await fetch(`${SUPABASE_URL}/functions/v1/employee-document-link`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({staff_id:appSession.user.id,username:appSession.username,code:appSession.code,document_id:id})}),data=await res.json();if(!res.ok||!data.url)throw new Error(data.error||'open_failed');if(download){const rr=await fetch(data.url),blob=await rr.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=data.file_name||'document.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}else if(popup)popup.location.href=data.url;else window.open(data.url,'_blank')}catch(e){if(popup)popup.close();toast?.('פתיחת המסמך נכשלה')}}
  async function loadEmployeePayrollFinal(){const box=document.getElementById('mfEmployeePayroll');if(!box||!isEmployee())return;box.innerHTML='<small>טוען…</small>';const {data,error}=await supabaseClient.rpc('employee_list_payroll_hours',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code});if(error){box.innerHTML='<div class="mfEmpty">טעינת נתוני השעות נכשלה.</div>';return}const rows=data||[];box.innerHTML=rows.length?rows.map(r=>`<div class="mpWorkerRow"><b>${esc(r.period_label)}</b><div class="mpWorkerFacts"><span>רגילות: ${r.regular_hours}</span><span>נוספות: ${r.overtime_hours}</span><span>שבת/חג: ${r.holiday_hours}</span><span>בונוס: ₪${Number(r.bonus_amount||0).toFixed(2)}</span></div>${r.manager_note?`<small>${esc(r.manager_note)}</small>`:''}</div>`).join(''):'<div class="mfEmpty">אין עדיין נתוני שעות ובונוסים בארכיון שלך.</div>'}
  function initPayrollAdminFinal(){if(!isAdmin())return;addStyles();if(!ensureAdminTab())return;adminHtml();getStaff().then(fillStaffSelect);loadDash()}
  let payrollBootKey='';
  function bootPayrollFinal(){
    addStyles();
    if(isAdmin()){initPayrollAdminFinal();return true;}
    if(isEmployee()){
      const key=String(appSession?.user?.id||'')+'|'+String(appSession?.username||'');
      if(key&&payrollBootKey!==key){
        payrollBootKey=key;
        loadEmployeeDocumentsFinal();
        loadEmployeePayrollFinal();
      }
      return true;
    }
    return false;
  }
  let bootTries=0;
  const bootTimer=setInterval(()=>{bootTries++;if(bootPayrollFinal()||bootTries>40)clearInterval(bootTimer)},250);
  window.addEventListener('focus',()=>{
    if(!isEmployee())return;
    const hours=document.getElementById('hours');
    if(hours?.classList.contains('active')){
      loadEmployeeDocumentsFinal();
      loadEmployeePayrollFinal();
    }
  });
  window.initPayrollAdminFinal=initPayrollAdminFinal;window.loadEmployeeDocumentsFinal=loadEmployeeDocumentsFinal;window.loadEmployeePayrollFinal=loadEmployeePayrollFinal;

  // MATOK_BONUS_FORMULA_V1
  const mcBonusLabel=m=>({manual:'הזנה ידנית',hourly:'לפי שעות × תעריף',sales_above_target_pct:'אחוז מהמכירות מעל היעד',target_fixed:'סכום קבוע בעמידה ביעד'}[m]||'הזנה ידנית');
  function mcBonusFormula(m,d){
    d=d||{};
    if(m==='hourly')return Number(d.qualifying_hours||0)+' שעות × ₪'+Number(d.rate_per_hour||0).toFixed(2);
    if(m==='sales_above_target_pct')return '('+Number(d.actual_sales||0).toLocaleString('he-IL')+' − יעד '+Number(d.target_sales||0).toLocaleString('he-IL')+') × '+Number(d.percent||0)+'%';
    if(m==='target_fixed')return 'בפועל '+Number(d.actual_sales||0).toLocaleString('he-IL')+' מול יעד '+Number(d.target_sales||0).toLocaleString('he-IL')+' · בונוס קבוע ₪'+Number(d.fixed_amount||0).toFixed(2);
    return 'הוזן ידנית: ₪'+Number(d.manual_amount||0).toFixed(2);
  }
  function mcBonusPreview(){
    const m=document.getElementById('mcBonusMethod')?.value||'manual',manual=Number(document.getElementById('mcBonusManual')?.value||0),rate=Number(document.getElementById('mcBonusRate')?.value||0),base=Number(document.getElementById('mcBonusBase')?.value||document.getElementById('mpRegular')?.value||0),target=Number(document.getElementById('mcBonusTarget')?.value||0),actual=Number(document.getElementById('mcBonusActual')?.value||0),fixed=Number(document.getElementById('mcBonusFixed')?.value||0);
    let amount=manual,formula='הוזן ידנית';
    if(m==='hourly'){amount=base*rate;formula=base+' שעות × ₪'+rate.toFixed(2)}
    if(m==='sales_above_target_pct'){amount=Math.max(actual-target,0)*rate/100;formula='('+actual.toLocaleString('he-IL')+' − '+target.toLocaleString('he-IL')+') × '+rate+'%'}
    if(m==='target_fixed'){amount=actual>=target?fixed:0;formula=actual.toLocaleString('he-IL')+' מול יעד '+target.toLocaleString('he-IL')+' → '+(actual>=target?'עמד ביעד':'לא עמד ביעד')}
    const box=document.getElementById('mcBonusFormula');if(box)box.innerHTML='<b>בונוס מחושב: ₪'+amount.toFixed(2)+'</b><div class="mcFormulaLine">'+esc(formula)+'</div>';
    const legacy=document.getElementById('mpBonus');if(legacy)legacy.value=amount.toFixed(2);
  }
  function mcEnsureBonusUi(){
    if(appSession?.type!=='admin')return;
    const section=document.getElementById('mp-hours');if(!section||document.getElementById('mcBonusCalc'))return;
    if(!document.getElementById('mcBonusStyles')){const s=document.createElement('style');s.id='mcBonusStyles';s.textContent='.mcBonusCalc{border:1px solid #d8c48b;background:#fff9e9;border-radius:12px;padding:11px;margin-top:10px}.mcBonusGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.mcBonusGrid label{font-size:10px;font-weight:800}.mcBonusFormula{margin-top:8px;padding:9px;border-radius:9px;background:#fff;border:1px solid #e5d7ab}.mcFormulaLine{font-size:10px;color:var(--muted);margin-top:3px}@media(max-width:650px){.mcBonusGrid{grid-template-columns:1fr 1fr}}@media(max-width:430px){.mcBonusGrid{grid-template-columns:1fr}}';document.head.appendChild(s)}
    const grid=section.querySelector('.mpGrid');if(!grid)return;const old=document.getElementById('mpBonus');if(old)old.closest('label').style.display='none';
    const box=document.createElement('div');box.id='mcBonusCalc';box.className='mcBonusCalc';
    box.innerHTML='<b>אופן חישוב הבונוס</b><div class="mcBonusGrid" style="margin-top:8px"><label>שיטה<select id="mcBonusMethod"><option value="manual">הזנה ידנית</option><option value="hourly">לפי שעות × תעריף</option><option value="sales_above_target_pct">אחוז מהמכירות מעל היעד</option><option value="target_fixed">סכום קבוע בעמידה ביעד</option></select></label><label>סכום ידני ₪<input id="mcBonusManual" type="number" step="0.01" min="0"></label><label>תעריף / אחוז<input id="mcBonusRate" type="number" step="0.01" min="0"></label><label>בסיס שעות<input id="mcBonusBase" type="number" step="0.01" min="0" placeholder="ברירת מחדל: שעות רגילות"></label><label>יעד מכירות ₪<input id="mcBonusTarget" type="number" step="0.01" min="0"></label><label>מכירות בפועל ₪<input id="mcBonusActual" type="number" step="0.01" min="0"></label><label>בונוס קבוע ₪<input id="mcBonusFixed" type="number" step="0.01" min="0"></label></div><div id="mcBonusFormula" class="mcBonusFormula"><b>בונוס מחושב: ₪0.00</b><div class="mcFormulaLine">בחר שיטה והזן נתונים.</div></div>';
    grid.after(box);box.querySelectorAll('input,select').forEach(x=>x.addEventListener('input',mcBonusPreview));mcReplaceSaveHours();mcBonusPreview();
  }
  function mcReplaceSaveHours(){
    const b=document.getElementById('mpSaveHours');if(!b||b.dataset.mcFormulaBound==='1')return;
    const n=b.cloneNode(true);n.dataset.mcFormulaBound='1';b.replaceWith(n);n.onclick=mcSaveHoursV2;
  }
  async function mcSaveHoursV2(){
    const id=document.getElementById('mpHoursStaff')?.value,period=document.getElementById('mpHoursPeriod')?.value;if(!id||!period){toast?.('יש לבחור עובד וחודש');return}
    const b=document.getElementById('mpSaveHours');b.disabled=true;b.textContent='שומר…';
    const args={p_staff_id:id,p_period_label:period,p_regular_hours:Number(document.getElementById('mpRegular')?.value||0),p_overtime_hours:Number(document.getElementById('mpOvertime')?.value||0),p_holiday_hours:Number(document.getElementById('mpHoliday')?.value||0),p_bonus_method:document.getElementById('mcBonusMethod')?.value||'manual',p_bonus_manual:Number(document.getElementById('mcBonusManual')?.value||0),p_bonus_rate:Number(document.getElementById('mcBonusRate')?.value||0),p_bonus_base:Number(document.getElementById('mcBonusBase')?.value||document.getElementById('mpRegular')?.value||0),p_bonus_target:Number(document.getElementById('mcBonusTarget')?.value||0),p_bonus_actual:Number(document.getElementById('mcBonusActual')?.value||0),p_bonus_fixed:Number(document.getElementById('mcBonusFixed')?.value||0),p_manager_note:document.getElementById('mpHoursNote')?.value||'',p_source_file:null};
    try{const r=await supabaseClient.rpc('admin_upsert_payroll_hours_v2',args);if(r.error)throw r.error;toast?.('השעות והבונוס נשמרו עם אופן החישוב');await mcLoadHoursV2()}catch(e){console.error(e);toast?.('שמירת השעות והבונוס נכשלה')}finally{b.disabled=false;b.textContent='שמירה'}
  }
  async function mcLoadHoursV2(){
    if(appSession?.type!=='admin')return;const box=document.getElementById('mpHoursTable');if(!box)return;const period=document.getElementById('mpHoursFilter')?.value||'';
    const r=await supabaseClient.rpc('admin_list_payroll_hours_v2',{p_period:period});if(r.error)return;
    const rows=r.data||[];box.innerHTML='<table><thead><tr><th>עובד</th><th>רגילות</th><th>נוספות</th><th>שבת/חג</th><th>בונוס</th><th>אופן חישוב</th><th>אומדן בסיס</th></tr></thead><tbody>'+rows.map(x=>'<tr><td><b>'+esc(x.full_name)+'</b></td><td>'+x.regular_hours+'</td><td>'+x.overtime_hours+'</td><td>'+x.holiday_hours+'</td><td>₪'+Number(x.bonus_amount||0).toFixed(2)+'</td><td>'+esc(mcBonusLabel(x.bonus_method))+'<div class="mcFormulaLine">'+esc(mcBonusFormula(x.bonus_method,x.bonus_details||{}))+'</div></td><td>₪'+Number(x.estimated_base||0).toFixed(2)+'</td></tr>').join('')+'</tbody></table>';
  }
  async function mcLoadEmployeePayrollV2(){
    const box=document.getElementById('mfEmployeePayroll');if(!box||appSession?.type!=='employee')return;box.innerHTML='<small>טוען…</small>';
    const r=await supabaseClient.rpc('employee_list_payroll_hours_v2',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code});
    if(r.error){box.innerHTML='<div class="mfEmpty">טעינת הנתונים נכשלה.</div>';return}
    const rows=r.data||[];box.innerHTML=rows.length?rows.map(x=>'<div class="mpWorkerRow"><b>'+esc(x.period_label)+'</b>'+(x.attendance_enabled?'<div class="mpWorkerFacts"><span>רגילות: '+(x.regular_hours??'—')+'</span><span>נוספות: '+(x.overtime_hours??'—')+'</span><span>שבת/חג: '+(x.holiday_hours??'—')+'</span></div>':'<div class="mfEmpty">הצפייה בשעות הנוכחות סגורה כרגע על ידי המנהל.</div>')+(x.bonuses_enabled?'<div class="mcBonusFormula"><b>בונוס: ₪'+Number(x.bonus_amount||0).toFixed(2)+'</b><div>'+esc(mcBonusLabel(x.bonus_method))+'</div><div class="mcFormulaLine">'+esc(mcBonusFormula(x.bonus_method,x.bonus_details||{}))+'</div></div>':'<div class="mfEmpty">הצפייה בבונוסים סגורה כרגע על ידי המנהל.</div>')+(x.manager_note?'<small>'+esc(x.manager_note)+'</small>':'')+'</div>').join(''):'<div class="mfEmpty">אין כרגע נתונים זמינים לצפייה.</div>';
  }
  function mcPayrollEnforce(){
    if(appSession?.type==='admin'){
      mcEnsureBonusUi();
      const refresh=document.getElementById('mpRefreshHours');if(refresh&&!refresh.dataset.mcFormulaRefresh){refresh.dataset.mcFormulaRefresh='1';refresh.addEventListener('click',()=>setTimeout(mcLoadHoursV2,80))}
      const nav=document.querySelector('#payrollFinal [data-mp="hours"]');if(nav&&!nav.dataset.mcFormulaRefresh){nav.dataset.mcFormulaRefresh='1';nav.addEventListener('click',()=>setTimeout(()=>{mcEnsureBonusUi();mcLoadHoursV2()},120))}
    }
    if(appSession?.type==='employee')window.loadEmployeePayrollFinal=mcLoadEmployeePayrollV2;
  }
  window.loadEmployeePayrollControl=mcLoadEmployeePayrollV2;
})();