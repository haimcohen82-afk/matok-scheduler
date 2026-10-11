(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const isAdmin=()=>{try{return appSession?.type==='admin'}catch(_){return false}};
  const phone972=v=>{let d=String(v||'').replace(/\D/g,'');if(d.startsWith('972'))return d;if(d.startsWith('0'))return '972'+d.slice(1);return d};
  let forms=[],docs=[],intakes=[],staff=[],activeTab='home',busy=false;

  function style(){
    if($('hrPortalStyle'))return;
    const s=document.createElement('style');s.id='hrPortalStyle';
    s.textContent='.hrPortal section{width:min(1180px,98vw);max-height:95vh}.hrTabs{display:flex;gap:6px;overflow:auto;margin:10px 0 14px}.hrTabs button{white-space:nowrap}.hrView{display:none}.hrView.active{display:block}.hrGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.hrCard{border:1px solid var(--line);border-radius:13px;background:#fff;padding:13px}.hrCard h3{margin:0 0 5px}.hrCard small{color:var(--muted)}.hrForm{display:grid;grid-template-columns:1fr 1fr;gap:9px}.hrForm label{display:grid;gap:4px;font-size:12px;font-weight:800}.hrForm .wide{grid-column:1/-1}.hrForm textarea{min-height:86px}.hrStatus{padding:10px;border-radius:10px;background:#f4f7f6;margin:8px 0}.hrStatus.good{background:#e9f6e9;color:#2e6833}.hrStatus.bad{background:#fff0ed;color:#8d372f}.hrList{display:grid;gap:8px}.hrRow{border:1px solid var(--line);border-radius:11px;padding:10px;background:#fff}.hrRowHead{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.hrBadge{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:10px;font-weight:900;background:#eef3f7}.hrBadge.ok{background:#dff2e2;color:#286333}.hrBadge.wait{background:#fff0c7;color:#765a15}.hrAnswers{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px}.hrAnswers div{background:var(--soft);border-radius:7px;padding:7px;font-size:11px}.hrActions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.hrActions button{min-height:39px}.hrQuick{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}.hrQuick button{min-height:74px;text-align:right;padding:12px;border-radius:13px;border:1px solid var(--line);background:#fff;font-weight:900}.hrQuick button small{display:block;font-weight:400;color:var(--muted);margin-top:4px}.hrTemplate{border-right:5px solid var(--teal)}@media(max-width:760px){.hrGrid,.hrForm,.hrAnswers,.hrQuick{grid-template-columns:1fr}.hrForm .wide{grid-column:auto}.hrPortal section{width:100%}}';
    document.head.appendChild(s);
  }

  function status(msg,bad=false){
    const el=$('hrStatus');if(!el)return;
    el.textContent=msg;el.className='hrStatus '+(bad?'bad':'good');
  }

  function ensure(){
    let m=$('hrPortalModal');if(m)return m;
    style();
    m=document.createElement('div');m.id='hrPortalModal';m.className='modal hrPortal';
    m.innerHTML='<section><button type="button" class="close" id="hrClose">×</button>'+
      '<small>ניהול עובדים</small><h2>מרכז עובד חדש · ראיון, התאמה, קליטה ומסמכים</h2>'+
      '<p>כל תהליך העובד החדש במקום אחד. שום טופס לא נעלם בתוך תפריט אחר.</p>'+
      '<div class="hrTabs">'+
      '<button class="btn primary" data-hr-tab="home">מרכז</button>'+
      '<button class="btn secondary" data-hr-tab="interview">ראיון עבודה</button>'+
      '<button class="btn secondary" data-hr-tab="fit">שאלון התאמה</button>'+
      '<button class="btn secondary" data-hr-tab="onboarding">טופס קליטה</button>'+
      '<button class="btn secondary" data-hr-tab="documents">מסמכים וקבצים</button>'+
      '<button class="btn secondary" data-hr-tab="archive">בקשות וארכיון</button>'+
      '</div><div id="hrStatus" class="hrStatus">הפורטל מחובר למערכת העובדים.</div>'+
      '<div class="hrView active" id="hr-home">'+homeHtml()+'</div>'+
      '<div class="hrView" id="hr-interview">'+interviewHtml()+'</div>'+
      '<div class="hrView" id="hr-fit">'+fitHtml()+'</div>'+
      '<div class="hrView" id="hr-onboarding">'+onboardingHtml()+'</div>'+
      '<div class="hrView" id="hr-documents">'+documentsHtml()+'</div>'+
      '<div class="hrView" id="hr-archive"><div id="hrArchive">טוען…</div></div>'+
      '</section>';
    document.body.appendChild(m);
    $('hrClose').onclick=()=>closeModal?.('hrPortalModal');
    m.querySelectorAll('[data-hr-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.hrTab));
    bind();
    return m;
  }

  function homeHtml(){return '<div class="hrGrid">'+
    '<article class="hrCard hrTemplate"><h3>1. ראיון עבודה</h3><small>טופס פנימי למנהל: התרשמות, ניסיון, שירות, זמינות והמלצה.</small><div class="hrActions"><button class="btn secondary" data-go="interview">פתיחת ראיון</button></div></article>'+
    '<article class="hrCard hrTemplate"><h3>2. שאלון התאמה</h3><small>קישור אישי ב־WhatsApp למועמד/ת לפני ראיון או קליטה.</small><div class="hrActions"><button class="btn secondary" data-go="fit">שליחת שאלון</button></div></article>'+
    '<article class="hrCard hrTemplate"><h3>3. טופס קליטה</h3><small>שאלון קליטה + העלאת PDF/תמונה/Word/Excel ופענוח ישיר לעובד.</small><div class="hrActions"><button class="btn secondary" data-go="onboarding">פתיחת קליטה</button></div></article>'+
    '<article class="hrCard hrTemplate"><h3>4. מסמכים וקבצים</h3><small>קורות חיים, צילום מסמך, מסמך ראיון, אישורים וקבצים נוספים.</small><div class="hrActions"><button class="btn secondary" data-go="documents">העלאת מסמך</button></div></article>'+
    '<article class="hrCard"><h3>ממתינים לטיפול</h3><b id="hrPendingCount">—</b><small> שאלונים / קליטות שממתינים לבדיקה.</small></article>'+
    '<article class="hrCard"><h3>מסמכים שנשמרו</h3><b id="hrDocCount">—</b><small> קבצי מועמדים ועובדים בארכיון HR.</small></article>'+
    '</div>'; }

  function interviewHtml(){return '<article class="hrCard"><h3>טופס ראיון עבודה</h3><p>ממלאים בזמן הראיון או מיד אחריו. הטופס נשמר בארכיון המועמד.</p><div class="hrForm">'+
    '<label>שם מלא *<input id="hrInterviewName"></label><label>טלפון *<input id="hrInterviewPhone" type="tel"></label>'+
    '<label>תאריך ראיון<input id="hrInterviewDate" type="date"></label><label>מראיין/ת<input id="hrInterviewer"></label>'+
    '<label>שירות ויחסי אנוש<select id="hrServiceScore"><option value="">בחר</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label>'+
    '<label>יכולת מכירה<select id="hrSalesScore"><option value="">בחר</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label>'+
    '<label>אמינות / אחריות<select id="hrReliabilityScore"><option value="">בחר</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label>'+
    '<label>המלצה<select id="hrRecommendation"><option value="">בחר</option><option>מתאים/ה לקליטה</option><option>ראיון נוסף</option><option>לשמור למאגר</option><option>לא מתאים/ה כרגע</option></select></label>'+
    '<label class="wide">זמינות ומשמרות<textarea id="hrInterviewAvailability"></textarea></label>'+
    '<label>ניסיון בקופה<input id="hrInterviewCashier"></label><label>ידע ברשתות חברתיות<input id="hrInterviewSocial"></label>'+
    '<label>הגעה עצמאית<input id="hrInterviewArrival"></label><label>ציפיות שכר<input id="hrInterviewSalary"></label>'+
    '<label class="wide">סיכום ראיון / הערות<textarea id="hrInterviewNotes"></textarea></label>'+
    '</div><button type="button" class="btn primary" id="hrSaveInterview">שמירת הראיון</button></article>'; }

  function fitHtml(){return '<article class="hrCard"><h3>שאלון התאמה למועמד/ת</h3><p>יוצר קישור אישי חד־פעמי לשבעה ימים. WhatsApp נפתח עם הודעה מוכנה, ואתה לוחץ שליחה.</p><div class="hrForm"><label>טלפון WhatsApp *<input id="hrFitPhone" type="tel" placeholder="05…"></label><label>שם המועמד/ת (לא חובה)<input id="hrFitName"></label></div><div class="hrActions"><button type="button" class="btn primary" id="hrFitWa">יצירה ושליחה ב־WhatsApp</button><button type="button" class="btn secondary" id="hrFitCopy">יצירת קישור להעתקה</button></div><div id="hrFitResult"></div></article>'; }

  function onboardingHtml(){return '<div class="hrGrid"><article class="hrCard"><h3>שאלון קליטת עובד</h3><p>שולחים לעובד/ת לאחר החלטה על קליטה. התשובות נכנסות למערכת לבדיקה ולהקמת עובד.</p><label>טלפון WhatsApp<input id="hrOnboardPhone" type="tel" placeholder="05…"></label><div class="hrActions"><button type="button" class="btn primary" id="hrOnboardWa">שליחה ב־WhatsApp</button><button type="button" class="btn secondary" id="hrOnboardCopy">יצירת קישור</button></div><div id="hrOnboardResult"></div></article>'+
    '<article class="hrCard"><h3>העלאת קובץ קליטה</h3><p>PDF, צילום, Word, Excel, CSV או טקסט. הפענוח הקיים נשמר: שם, ת״ז, טלפון, עיר, שכר ועוד.</p><button type="button" class="btn primary" id="hrOpenIntakeUpload">בחירת קובץ קליטה</button></article>'+
    '<article class="hrCard"><h3>בקשות קליטה</h3><p>פותח את הרשומות שהתקבלו משאלון או קובץ.</p><button type="button" class="btn secondary" data-go="archive">פתיחת בקשות וארכיון</button></article></div>'; }

  function documentsHtml(){return '<article class="hrCard"><h3>מסמכי מועמד / עובד חדש</h3><p>המסמך נשמר בארכיון HR פרטי למנהל.</p><div class="hrForm"><label>שם<input id="hrDocName"></label><label>טלפון<input id="hrDocPhone" type="tel"></label><label>שיוך לעובד קיים<select id="hrDocStaff"><option value="">לא משויך עדיין</option></select></label><label>סוג מסמך<select id="hrDocType"><option value="cv">קורות חיים</option><option value="id_copy">מסמך זיהוי</option><option value="interview">מסמך ראיון</option><option value="onboarding">מסמך קליטה</option><option value="certificate">אישור / תעודה</option><option value="other">אחר</option></select></label><label class="wide">קובץ<input id="hrDocFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.txt,.csv"></label></div><button type="button" class="btn primary" id="hrUploadDoc">שמירת המסמך</button></article><div id="hrDocumentList" class="hrList" style="margin-top:10px"></div>'; }

  function bind(){
    ensure().querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>tab(b.dataset.go));
    $('hrSaveInterview').onclick=saveInterview;
    $('hrFitWa').onclick=()=>createFit(true);$('hrFitCopy').onclick=()=>createFit(false);
    $('hrOnboardWa').onclick=()=>createOnboarding(true);$('hrOnboardCopy').onclick=()=>createOnboarding(false);
    $('hrOpenIntakeUpload').onclick=()=>{window.matokOpenEmployeeIntakeUpload?.();status('נפתח בוחר קובץ הקליטה.')};
    $('hrUploadDoc').onclick=uploadDocument;
  }

  async function tab(name){
    activeTab=name;
    const m=ensure();
    m.querySelectorAll('[data-hr-tab]').forEach(b=>{const on=b.dataset.hrTab===name;b.classList.toggle('primary',on);b.classList.toggle('secondary',!on)});
    m.querySelectorAll('.hrView').forEach(v=>v.classList.toggle('active',v.id==='hr-'+name));
    if(name==='documents')await loadDocuments();
    if(name==='archive')await loadArchive();
    if(name==='home')await refreshCounts();
  }

  async function refreshData(){
    if(!isAdmin())return;
    const [f,d,i,s]=await Promise.all([
      supabaseClient.rpc('admin_list_candidate_hr_forms'),
      supabaseClient.rpc('admin_list_candidate_hr_documents'),
      supabaseClient.rpc('admin_list_onboarding_records'),
      supabaseClient.from('staff').select('id,full_name,phone,is_active').order('full_name')
    ]);
    if(f.error)throw f.error;if(d.error)throw d.error;if(i.error)throw i.error;if(s.error)throw s.error;
    forms=f.data||[];docs=d.data||[];intakes=i.data||[];staff=s.data||[];
    fillStaff();
  }

  function fillStaff(){
    const sel=$('hrDocStaff');if(!sel)return;
    const before=sel.value;
    sel.innerHTML='<option value="">לא משויך עדיין</option>'+staff.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.full_name)+(x.is_active?'':' · לא פעיל')+'</option>').join('');
    if([...sel.options].some(o=>o.value===before))sel.value=before;
  }

  async function refreshCounts(){
    try{await refreshData();const pending=forms.filter(x=>x.status!=='reviewed').length+intakes.filter(x=>x.review_status==='pending').length;if($('hrPendingCount'))$('hrPendingCount').textContent=String(pending);if($('hrDocCount'))$('hrDocCount').textContent=String(docs.length)}catch(e){console.error(e);status('טעינת נתוני מרכז העובד נכשלה.',true)}
  }

  async function saveInterview(){
    if(busy)return;
    const name=$('hrInterviewName').value.trim(),phone=$('hrInterviewPhone').value.trim();
    if(name.length<2||phone.replace(/\D/g,'').length<9){status('יש להזין שם וטלפון תקינים לראיון.',true);return}
    const answers={
      interview_date:$('hrInterviewDate').value||new Date().toISOString().slice(0,10),
      interviewer:$('hrInterviewer').value.trim(),
      service_score:$('hrServiceScore').value,
      sales_score:$('hrSalesScore').value,
      reliability_score:$('hrReliabilityScore').value,
      recommendation:$('hrRecommendation').value,
      availability:$('hrInterviewAvailability').value.trim(),
      cashier_experience:$('hrInterviewCashier').value.trim(),
      social_media:$('hrInterviewSocial').value.trim(),
      independent_arrival:$('hrInterviewArrival').value.trim(),
      salary_expectation:$('hrInterviewSalary').value.trim(),
      notes:$('hrInterviewNotes').value.trim()
    };
    busy=true;
    try{
      const r=await supabaseClient.rpc('admin_save_candidate_interview',{p_full_name:name,p_phone:phone,p_answers:answers});
      if(r.error)throw r.error;
      status('הראיון נשמר בארכיון המועמד.');
      ['hrInterviewName','hrInterviewPhone','hrInterviewer','hrInterviewAvailability','hrInterviewCashier','hrInterviewSocial','hrInterviewArrival','hrInterviewSalary','hrInterviewNotes'].forEach(id=>$(id).value='');
      ['hrServiceScore','hrSalesScore','hrReliabilityScore','hrRecommendation'].forEach(id=>$(id).value='');
      await refreshData();
    }catch(e){console.error(e);status('שמירת הראיון נכשלה: '+(e?.message||'שגיאה'),true)}finally{busy=false}
  }

  async function createFit(openWa){
    const phone=$('hrFitPhone').value.trim();if(openWa&&phone.replace(/\D/g,'').length<9){status('יש להזין מספר WhatsApp תקין.',true);return}
    try{
      const r=await supabaseClient.rpc('admin_create_candidate_hr_invite',{p_form_type:'suitability'});if(r.error||!r.data)throw r.error||new Error('no_token');
      const url=location.origin+'/candidate-fit.html?t='+encodeURIComponent(r.data);
      const msg='שלום, מצורף שאלון התאמה לעבודה ב-MATOK BASIC. נא למלא בקישור האישי:\\n'+url+'\\nתודה.';
      renderGenerated('hrFitResult',url,openWa?'https://wa.me/'+phone972(phone)+'?text='+encodeURIComponent(msg):'');
      if(openWa)window.open('https://wa.me/'+phone972(phone)+'?text='+encodeURIComponent(msg),'_blank','noopener,noreferrer');
      status('שאלון ההתאמה נוצר.');
    }catch(e){console.error(e);status('יצירת שאלון ההתאמה נכשלה.',true)}
  }

  async function createOnboarding(openWa){
    const phone=$('hrOnboardPhone').value.trim();if(openWa&&phone.replace(/\D/g,'').length<9){status('יש להזין מספר WhatsApp תקין.',true);return}
    try{
      const r=await supabaseClient.rpc('admin_create_onboarding_invite');if(r.error||!r.data)throw r.error||new Error('no_token');
      const url=location.origin+'/join.html?t='+encodeURIComponent(r.data);
      const msg='שלום, מצורף שאלון קליטת עובד/ת ל-MATOK BASIC. נא למלא בקישור האישי:\\n'+url+'\\nתודה, הנהלת MATOK BASIC.';
      renderGenerated('hrOnboardResult',url,openWa?'https://wa.me/'+phone972(phone)+'?text='+encodeURIComponent(msg):'');
      if(openWa)window.open('https://wa.me/'+phone972(phone)+'?text='+encodeURIComponent(msg),'_blank','noopener,noreferrer');
      status('טופס הקליטה נוצר.');
    }catch(e){console.error(e);status('יצירת טופס הקליטה נכשלה.',true)}
  }

  function renderGenerated(id,url,wa){
    const box=$(id);box.innerHTML='<div class="hrStatus good"><input value="'+esc(url)+'" readonly data-copy-value style="width:100%;margin-bottom:7px"><div class="hrActions">'+(wa?'<a class="btn secondary" target="_blank" rel="noopener noreferrer" href="'+esc(wa)+'">פתיחת WhatsApp</a>':'')+'<button type="button" class="btn secondary" data-copy-link>העתקת קישור</button></div></div>';
    box.querySelector('[data-copy-link]').onclick=async()=>{try{await navigator.clipboard.writeText(url);status('הקישור הועתק.')}catch(_){const i=box.querySelector('[data-copy-value]');i.select();status('הקישור מסומן להעתקה.')}}
  }

  async function uploadDocument(){
    if(busy)return;
    const file=$('hrDocFile').files?.[0];if(!file){status('בחר קובץ להעלאה.',true);return}
    if(file.size<=0||file.size>12*1024*1024){status('הקובץ ריק או גדול מ־12MB.',true);return}
    const name=$('hrDocName').value.trim(),phone=$('hrDocPhone').value.trim(),staffId=$('hrDocStaff').value||null,type=$('hrDocType').value;
    if(!staffId&&name.length<2&&phone.replace(/\D/g,'').length<9){status('יש להזין שם או טלפון, או לבחור עובד קיים.',true);return}
    const path='private/'+crypto.randomUUID()+'/'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-80);
    busy=true;let uploaded=false;
    try{
      const up=await supabaseClient.storage.from('candidate-hr-documents').upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});if(up.error)throw up.error;uploaded=true;
      const reg=await supabaseClient.rpc('admin_register_candidate_hr_document',{p_full_name:name||null,p_phone:phone||null,p_staff_id:staffId,p_doc_type:type,p_original_name:file.name.slice(0,220),p_storage_path:path});
      if(reg.error)throw reg.error;
      $('hrDocFile').value='';status('המסמך נשמר בארכיון HR הפרטי.');
      await loadDocuments();
    }catch(e){console.error(e);if(uploaded)await supabaseClient.storage.from('candidate-hr-documents').remove([path]);status('שמירת המסמך נכשלה: '+(e?.message||'שגיאה'),true)}finally{busy=false}
  }

  async function loadDocuments(){
    try{await refreshData();const box=$('hrDocumentList');box.innerHTML=docs.length?docs.map(d=>'<div class="hrRow"><div class="hrRowHead"><div><b>'+esc(d.full_name||staff.find(x=>x.id===d.staff_id)?.full_name||'ללא שם')+'</b><small> · '+esc(docType(d.doc_type))+' · '+esc(d.original_name)+'</small></div><span class="hrBadge ok">התקבל</span></div><div class="hrActions"><button type="button" class="btn secondary" data-open-hr-doc="'+esc(d.id)+'">פתיחה</button></div></div>').join(''):'<div class="hrStatus">אין עדיין מסמכי HR.</div>';box.querySelectorAll('[data-open-hr-doc]').forEach(b=>b.onclick=()=>openDocument(b.dataset.openHrDoc))}catch(e){console.error(e);status('טעינת המסמכים נכשלה.',true)}
  }

  const docType=t=>({cv:'קורות חיים',id_copy:'מסמך זיהוי',interview:'מסמך ראיון',onboarding:'מסמך קליטה',certificate:'אישור / תעודה',other:'אחר'}[t]||t);

  async function openDocument(id){
    const d=docs.find(x=>x.id===id);if(!d)return;
    const r=await supabaseClient.storage.from('candidate-hr-documents').createSignedUrl(d.storage_path,300);
    if(r.error||!r.data?.signedUrl){status('פתיחת המסמך נכשלה.',true);return}
    window.open(r.data.signedUrl,'_blank','noopener,noreferrer');
  }

  function answerLabel(key){return ({preferred_shifts:'משמרות',friday_availability:'שישי',start_date:'תחילת עבודה',sales_experience:'ניסיון מכירה/שירות',cashier_experience:'ניסיון בקופה',social_media:'רשתות חברתיות',independent_arrival:'הגעה עצמאית',customer_service:'תרחיש שירות',commitment:'מחויבות',notes:'הערות',interview_date:'תאריך ראיון',interviewer:'מראיין/ת',service_score:'שירות',sales_score:'מכירה',reliability_score:'אחריות',recommendation:'המלצה',availability:'זמינות',salary_expectation:'ציפיות שכר'}[key]||key)}

  async function loadArchive(){
    const box=$('hrArchive');box.textContent='טוען…';
    try{
      await refreshData();
      const formHtml=forms.map(f=>'<div class="hrRow"><div class="hrRowHead"><div><b>'+esc(f.full_name)+'</b><small> · '+esc(f.phone)+' · '+(f.form_type==='interview'?'ראיון עבודה':'שאלון התאמה')+'</small></div><span class="hrBadge '+(f.status==='reviewed'?'ok':'wait')+'">'+(f.status==='reviewed'?'נבדק':'התקבל')+'</span></div><div class="hrAnswers">'+Object.entries(f.answers||{}).filter(([,v])=>String(v||'').trim()).map(([k,v])=>'<div><b>'+esc(answerLabel(k))+':</b> '+esc(v)+'</div>').join('')+'</div></div>').join('');
      const intakeHtml=intakes.map(i=>'<div class="hrRow"><div class="hrRowHead"><div><b>'+esc(i.details?.full_name||'קליטה ללא שם')+'</b><small> · '+esc(i.details?.phone||'')+' · '+(i.source==='questionnaire'?'טופס קליטה':'קובץ קליטה')+'</small></div><span class="hrBadge '+(i.review_status==='approved'?'ok':'wait')+'">'+(i.review_status==='approved'?'נקלט':'ממתין לבדיקה')+'</span></div><div class="hrActions"><button type="button" class="btn secondary" data-open-intake="'+esc(i.id)+'">פתיחה ובדיקה</button></div></div>').join('');
      box.innerHTML='<h3>ראיונות ושאלוני התאמה</h3><div class="hrList">'+(formHtml||'<div class="hrStatus">אין רשומות.</div>')+'</div><h3 style="margin-top:16px">טפסי וקבצי קליטה</h3><div class="hrList">'+(intakeHtml||'<div class="hrStatus">אין בקשות קליטה.</div>')+'</div>';
      box.querySelectorAll('[data-open-intake]').forEach(b=>b.onclick=()=>window.matokOpenEmployeeIntakeRecord?.(b.dataset.openIntake));
      await refreshCounts();
    }catch(e){console.error(e);box.textContent='טעינת הארכיון נכשלה.';status('טעינת הארכיון נכשלה.',true)}
  }

  function mount(){
    if(!isAdmin())return;
    const panel=$('employees'),head=panel?.querySelector('.employeeHead');if(!panel||!head||$('hrPortalEntry'))return;
    const existing=head.querySelector('button[onclick="openEmployee(-1)"]');
    const b=document.createElement('button');b.id='hrPortalEntry';b.type='button';b.className='btn primary';b.textContent='מרכז עובד חדש';
    b.onclick=async()=>{ensure();openModal?.('hrPortalModal');await tab('home')};
    if(existing){existing.classList.remove('primary');existing.classList.add('secondary');existing.textContent='+ עובד ידני';head.insertBefore(b,existing)}
    else head.appendChild(b);
  }

  window.openMatokEmployeeHrPortal=async(tabName='home')=>{if(!isAdmin())return;ensure();openModal?.('hrPortalModal');await tab(tabName)};
  let timer=null;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(mount,120)}).observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,180),{once:true});else setTimeout(mount,160);
})();