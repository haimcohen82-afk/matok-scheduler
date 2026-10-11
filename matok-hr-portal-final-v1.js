(() => {
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const isAdmin=()=>{try{return appSession?.type==='admin'}catch(_){return false}};
const phone972=v=>{let d=String(v||'').replace(/\D/g,'');if(d.startsWith('972'))return d;if(d.startsWith('0'))return '972'+d.slice(1);return d};
const STATUS={new:'חדש',interview:'ראיון',fit_sent:'שאלון התאמה נשלח',fit_received:'שאלון התאמה התקבל',intake_sent:'טופס קליטה נשלח',intake_received:'טופס קליטה התקבל',ready:'מוכן לקליטה',hired:'נקלט כעובד',rejected:'לא ממשיכים'};
const DOC_STATUS={required:'נדרש',sent:'נשלח',received:'התקבל',reviewed:'נבדק',approved:'אושר'};
let cases=[],current=null,currentDetail=null,busy=false,lastLinks={};

function styles(){
 if($('hrPortalStyle'))return;
 const s=document.createElement('style');s.id='hrPortalStyle';
 s.textContent='.hrEntry{display:flex;gap:7px;flex-wrap:wrap}.hrPortal section{width:min(1160px,98vw);max-height:94vh;overflow:auto}.hrTop{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.hrTabs{display:flex;gap:6px;overflow:auto;margin:10px 0;padding-bottom:3px}.hrTabs button{white-space:nowrap}.hrGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.hrCard{border:1px solid var(--line);border-radius:12px;padding:12px;background:#fff;margin:8px 0}.hrCase{border-right:5px solid #6bbfb5}.hrCase small{display:block;color:var(--muted)}.hrStatus{display:inline-flex;padding:4px 8px;border-radius:999px;background:#eef5f4;font-size:10px;font-weight:900}.hrView{display:none}.hrView.active{display:block}.hrForm{display:grid;grid-template-columns:1fr 1fr;gap:8px}.hrForm label{font-size:11px;font-weight:800}.hrForm .wide{grid-column:1/-1}.hrForm textarea{min-height:82px}.hrTimeline{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.hrStep{padding:9px;border:1px solid var(--line);border-radius:10px;background:var(--soft);font-size:10px}.hrStep.done{background:#e9f6e9;border-color:#a5cda7}.hrSource{white-space:pre-wrap;background:var(--soft);border:1px solid var(--line);padding:10px;border-radius:10px}.hrDocRow{display:grid;grid-template-columns:1.2fr .8fr .7fr auto;gap:7px;align-items:center;border-bottom:1px solid var(--line);padding:8px 0}.hrLibrary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.hrLibrary article{border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--soft)}.hrEmpty{padding:15px;border:1px dashed var(--line);border-radius:12px;color:var(--muted)}.obStatus{padding:10px;border-radius:10px;background:#f4f7f6;margin:8px 0}.obStatus.error{background:#fff0ed;color:#8d372f}@media(max-width:760px){.hrGrid,.hrForm{grid-template-columns:1fr}.hrForm .wide{grid-column:auto}.hrTimeline,.hrLibrary{grid-template-columns:1fr 1fr}.hrDocRow{grid-template-columns:1fr}.hrPortal section{width:100%}}';
 document.head.appendChild(s);
}
function notify(msg,bad=false){
 const el=$('hrStatus');if(el){el.textContent=msg;el.className='obStatus'+(bad?' error':'')}
 if(typeof toast==='function')toast(msg);
}
function ensure(){
 if($('hrPortalModal'))return $('hrPortalModal');
 styles();
 const m=document.createElement('div');m.id='hrPortalModal';m.className='modal hrPortal';
 m.innerHTML='<section><button type="button" class="close" id="hrClose">×</button>'+
 '<div class="hrTop"><div><h2>מרכז עובד חדש ומסמכים</h2><small>מועמד → ראיון → התאמה → קליטה → מסמכים → עובד</small></div><button class="btn secondary" id="hrManualEmployee">+ עובד ידני</button></div>'+
 '<div id="hrStatus" class="obStatus">כל תהליך הקליטה מרוכז כאן. שום מודול קיים לא הוסר.</div>'+
 '<div id="hrHome"><div class="hrLibrary">'+
 '<article><b>ראיון עבודה</b><small>טופס מנהל פנימי</small></article>'+
 '<article><b>שאלון התאמה</b><small>קישור WhatsApp חד־פעמי</small></article>'+
 '<article><b>טופס קליטה</b><small>קישור WhatsApp + מעבר למערכת העובדים</small></article>'+
 '<article><b>מסמכים וקבצים</b><small>העלאה פרטית, סטטוס ופתיחת מקור</small></article></div>'+
 '<div class="hrGrid" style="margin-top:10px"><article class="hrCard"><h3>פתיחת מועמד / עובד חדש</h3><div class="hrForm">'+
 '<label>שם מלא<input id="hrNewName"></label><label>טלפון<input id="hrNewPhone" type="tel"></label>'+
 '<label class="wide">דוא״ל<input id="hrNewEmail" type="email"></label></div><button class="btn primary" id="hrCreateCase" style="margin-top:8px">פתיחת תיק עובד חדש</button></article>'+
 '<article class="hrCard"><h3>תיקים קיימים</h3><button class="btn secondary" id="hrRefresh">רענון</button><div id="hrCases"></div></article></div></div>'+
 '<div id="hrCase" hidden><div class="hrTop"><div><h3 id="hrCaseTitle"></h3><span id="hrCaseStatus" class="hrStatus"></span></div><button class="btn secondary" id="hrBackCases">← כל התיקים</button></div>'+
 '<div id="hrTimeline" class="hrTimeline"></div><div class="hrTabs">'+
 '<button class="btn primary" data-hr-tab="summary">סיכום</button><button class="btn secondary" data-hr-tab="interview">ראיון עבודה</button>'+
 '<button class="btn secondary" data-hr-tab="fit">שאלון התאמה</button><button class="btn secondary" data-hr-tab="intake">טופס קליטה</button>'+
 '<button class="btn secondary" data-hr-tab="documents">מסמכים וקבצים</button><button class="btn secondary" data-hr-tab="captured">פרטים שנקלטו</button>'+
 '<button class="btn secondary" data-hr-tab="approval">אישור והקמת עובד</button></div>'+
 '<div class="hrView active" id="hr-summary"></div><div class="hrView" id="hr-interview"></div><div class="hrView" id="hr-fit"></div>'+
 '<div class="hrView" id="hr-intake"></div><div class="hrView" id="hr-documents"></div><div class="hrView" id="hr-captured"></div><div class="hrView" id="hr-approval"></div></div>'+
 '</section>';
 document.body.appendChild(m);
 $('hrClose').onclick=()=>closeModal?.('hrPortalModal');
 $('hrManualEmployee').onclick=()=>{closeModal?.('hrPortalModal');openEmployee?.(-1)};
 $('hrCreateCase').onclick=createCase;
 $('hrRefresh').onclick=loadCases;
 $('hrBackCases').onclick=showHome;
 m.querySelectorAll('[data-hr-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.hrTab));
 return m;
}
function tab(name){
 const m=ensure();
 m.querySelectorAll('[data-hr-tab]').forEach(b=>{const on=b.dataset.hrTab===name;b.classList.toggle('primary',on);b.classList.toggle('secondary',!on)});
 m.querySelectorAll('.hrView').forEach(v=>v.classList.toggle('active',v.id==='hr-'+name));
}
function showHome(){
 $('hrHome').hidden=false;$('hrCase').hidden=true;current=null;currentDetail=null;loadCases();
}
async function openPortal(){
 if(!isAdmin())return;
 ensure();openModal?.('hrPortalModal');showHome();
}
async function loadCases(){
 if(!isAdmin()||busy)return;busy=true;const box=$('hrCases');if(box)box.innerHTML='<small>טוען…</small>';
 try{
  const r=await supabaseClient.rpc('admin_hr_list_cases');if(r.error)throw r.error;cases=r.data||[];
  if(!box)return;
  box.innerHTML=cases.length?cases.map(c=>'<div class="hrCard hrCase"><b>'+esc(c.full_name)+'</b><span class="hrStatus">'+esc(STATUS[c.status]||c.status)+'</span><small>'+esc(c.phone)+' · '+new Date(c.updated_at).toLocaleDateString('he-IL')+'</small><button class="btn secondary" data-hr-case="'+esc(c.id)+'" style="margin-top:7px">פתיחת התיק</button></div>').join(''):'<div class="hrEmpty">אין עדיין תיקים. פתח עובד חדש בצד שמאל.</div>';
  box.querySelectorAll('[data-hr-case]').forEach(b=>b.onclick=()=>openCase(b.dataset.hrCase));
 }catch(e){console.error(e);if(box)box.textContent='טעינת התיקים נכשלה';notify('טעינת תיקי העובדים נכשלה.',true)}
 finally{busy=false}
}
async function createCase(){
 const name=$('hrNewName').value.trim(),phone=$('hrNewPhone').value.trim(),email=$('hrNewEmail').value.trim();
 if(name.length<2||phone.replace(/\D/g,'').length<9){notify('יש להזין שם מלא ומספר טלפון תקין.',true);return}
 const b=$('hrCreateCase');b.disabled=true;
 try{
  const r=await supabaseClient.rpc('admin_hr_create_case',{p_full_name:name,p_phone:phone,p_email:email});if(r.error)throw r.error;
  $('hrNewName').value='';$('hrNewPhone').value='';$('hrNewEmail').value='';await loadCases();await openCase(r.data);
 }catch(e){console.error(e);notify('פתיחת תיק העובד נכשלה.',true)}
 finally{b.disabled=false}
}
async function openCase(id){
 const r=await supabaseClient.rpc('admin_hr_get_case',{p_case_id:id});if(r.error){notify('פתיחת התיק נכשלה.',true);return}
 current=id;currentDetail=r.data||{};$('hrHome').hidden=true;$('hrCase').hidden=false;renderCase();tab('summary');
}
function resp(type){
 const rows=currentDetail?.responses||[];return rows.find(x=>x.form_type===type)?.response||{};
}
function latestInvite(type){
 const rows=currentDetail?.invites||[];return rows.find(x=>x.form_type===type)||null;
}
function stepDone(key){
 const c=currentDetail?.case||{},interview=currentDetail?.interview||{};
 if(key==='interview')return interview.updated_at;
 if(key==='fit')return (currentDetail?.responses||[]).some(x=>x.form_type==='fit');
 if(key==='intake')return !!c.onboarding_record_id||(currentDetail?.responses||[]).some(x=>x.form_type==='intake');
 if(key==='documents')return (currentDetail?.documents||[]).length>0;
 return false;
}
function renderCase(){
 const c=currentDetail.case||{},interview=currentDetail.interview||{},fit=resp('fit'),intake=resp('intake');
 $('hrCaseTitle').textContent=c.full_name+' · '+c.phone;$('hrCaseStatus').textContent=STATUS[c.status]||c.status;
 $('hrTimeline').innerHTML=[['interview','ראיון'],['fit','התאמה'],['intake','קליטה'],['documents','מסמכים']].map(([k,t])=>'<div class="hrStep '+(stepDone(k)?'done':'')+'">'+(stepDone(k)?'✓ ':'')+t+'</div>').join('');
 $('hr-summary').innerHTML='<div class="hrGrid"><article class="hrCard"><h3>פרטי תיק</h3><div class="hrForm"><label>שם<input id="hrEditName" value="'+esc(c.full_name)+'"></label><label>טלפון<input id="hrEditPhone" value="'+esc(c.phone)+'"></label><label class="wide">דוא״ל<input id="hrEditEmail" value="'+esc(c.email||'')+'"></label><label>סטטוס<select id="hrEditStatus">'+Object.entries(STATUS).map(([v,l])=>'<option value="'+v+'" '+(c.status===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label></div><button class="btn primary" id="hrSaveCase">שמירה</button></article>'+
 '<article class="hrCard"><h3>ספריית התהליך</h3><p>כל הטפסים והמסמכים של המועמד מרוכזים בתיק אחד.</p><div class="actions"><button class="btn secondary" data-go="interview">ראיון</button><button class="btn secondary" data-go="fit">התאמה</button><button class="btn secondary" data-go="intake">קליטה</button><button class="btn secondary" data-go="documents">מסמכים</button></div></article></div>';
 $('hr-summary').querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>tab(b.dataset.go));$('hrSaveCase').onclick=saveCase;

 $('hr-interview').innerHTML='<article class="hrCard"><h3>טופס ראיון עבודה · למנהל בלבד</h3><div class="hrForm">'+
 field('hrIvAvailability','זמינות למשמרות',interview.answers?.availability)+field('hrIvExperience','ניסיון במכירות',interview.answers?.sales_experience)+
 field('hrIvRegister','ניסיון בקופה',interview.answers?.register_experience)+field('hrIvSocial','ידע ברשתות חברתיות',interview.answers?.social_media)+
 field('hrIvArrival','הגעה עצמאית',interview.answers?.independent_arrival)+field('hrIvFriday','זמינות שישי',interview.answers?.friday)+
 area('hrIvStrengths','חוזקות / התרשמות',interview.answers?.strengths)+area('hrIvConcerns','נקודות לבדיקה',interview.answers?.concerns)+
 area('hrIvNotes','סיכום ראיון',interview.answers?.notes)+
 '<label>דירוג 1–5<input id="hrIvRating" type="number" min="1" max="5" value="'+esc(interview.rating||'')+'"></label>'+
 '<label>החלטה<select id="hrIvDecision"><option value="pending">ממתין</option><option value="continue">להמשיך</option><option value="hold">להמתין</option><option value="reject">לא ממשיכים</option></select></label></div><button class="btn primary" id="hrSaveInterview">שמירת הראיון</button></article>';
 $('hrIvDecision').value=interview.decision||'pending';$('hrSaveInterview').onclick=saveInterview;

 $('hr-fit').innerHTML=formPanel('fit','שאלון התאמה ב-WhatsApp','שאלון למועמד על זמינות, ניסיון, קופה, רשתות חברתיות והגעה עצמאית.',fit,latestInvite('fit'));
 $('hr-intake').innerHTML=formPanel('intake','טופס קליטת עובד ב-WhatsApp','טופס קליטה מובנה. לאחר השליחה הנתונים נכנסים למערכת הקליטה הקיימת.',intake,latestInvite('intake'))+
 '<article class="hrCard"><h3>העלאת קובץ קליטה ופענוח אוטומטי</h3><p>PDF, צילום, Word, Excel, CSV או טקסט. הקובץ עובר דרך מנוע הפענוח הקיים ומתחבר חזרה לתיק הזה.</p><button type="button" class="btn primary" id="hrUploadIntakeFile">בחירת קובץ קליטה</button></article>';
 bindFormActions('fit');bindFormActions('intake');
 $('hrUploadIntakeFile').onclick=startCaseFileImport;

 renderDocuments();
 renderCaptured();
 renderApproval();
}
function field(id,label,value=''){return '<label>'+esc(label)+'<input id="'+id+'" value="'+esc(value||'')+'"></label>'}
function area(id,label,value=''){return '<label class="wide">'+esc(label)+'<textarea id="'+id+'">'+esc(value||'')+'</textarea></label>'}
async function saveCase(){
 const c=currentDetail.case;
 const r=await supabaseClient.rpc('admin_hr_update_case',{p_case_id:c.id,p_full_name:$('hrEditName').value,p_phone:$('hrEditPhone').value,p_email:$('hrEditEmail').value,p_status:$('hrEditStatus').value});
 if(r.error){notify('שמירת התיק נכשלה.',true);return}notify('פרטי התיק נשמרו.');openCase(c.id);loadCases();
}
async function saveInterview(){
 const answers={availability:$('hrIvAvailability').value,sales_experience:$('hrIvExperience').value,register_experience:$('hrIvRegister').value,social_media:$('hrIvSocial').value,independent_arrival:$('hrIvArrival').value,friday:$('hrIvFriday').value,strengths:$('hrIvStrengths').value,concerns:$('hrIvConcerns').value,notes:$('hrIvNotes').value};
 const rating=$('hrIvRating').value?Number($('hrIvRating').value):null,decision=$('hrIvDecision').value;
 const r=await supabaseClient.rpc('admin_hr_save_interview',{p_case_id:current,p_answers:answers,p_decision:decision,p_rating:rating});if(r.error){notify('שמירת הראיון נכשלה.',true);return}notify('הראיון נשמר.');openCase(current);
}
function formPanel(type,title,desc,response,invite){
 const answered=response&&Object.keys(response).length;
 return '<article class="hrCard"><h3>'+title+'</h3><p>'+desc+'</p><div class="actions"><button class="btn primary" data-create-link="'+type+'">יצירת קישור ושליחה ב-WhatsApp</button><button class="btn secondary" data-copy-link="'+type+'" '+(lastLinks[type]?'':'disabled')+'>העתקת קישור אחרון</button></div><div id="hrLink-'+type+'" class="obStatus">'+(invite?(invite.submitted_at?'הטופס האחרון הושלם.':'קישור פעיל נוצר בעבר.'):'טרם נוצר קישור בתיק זה.')+'</div>'+
 (answered?'<h4>תשובה שהתקבלה</h4><div class="hrSource">'+Object.entries(response).filter(([,v])=>v).map(([k,v])=>esc(k)+': '+esc(v)).join('\n')+'</div>':'<div class="hrEmpty">טרם התקבלה תשובה.</div>')+'</article>';
}
function bindFormActions(type){
 $('hr-'+type).querySelector('[data-create-link="'+type+'"]').onclick=()=>createFormLink(type);
 const copy=$('hr-'+type).querySelector('[data-copy-link="'+type+'"]');copy.onclick=()=>copyLink(type);
}
async function createFormLink(type){
 const c=currentDetail.case,popup=window.open('about:blank','_blank');
 try{
  const r=await supabaseClient.rpc('admin_hr_create_form_invite',{p_case_id:c.id,p_form_type:type});if(r.error)throw r.error;
  const url=location.origin+'/candidate-form.html?t='+encodeURIComponent(r.data);lastLinks[type]=url;
  const msg=(type==='fit'?'שלום, מצורף שאלון התאמה לעבודה ב-MATOK BASIC:':'שלום, מצורף טופס קליטת עובד/ת ל-MATOK BASIC:')+'\n'+url+'\nתודה, הנהלת MATOK BASIC.';
  const wa='https://wa.me/'+phone972(c.phone)+'?text='+encodeURIComponent(msg);
  if(popup){popup.opener=null;popup.location.replace(wa)}else window.open(wa,'_blank');
  notify('נוצר קישור אישי ונפתח WhatsApp. יש ללחוץ על שליחה.');await openCase(c.id);tab(type);
 }catch(e){if(popup)popup.close();console.error(e);notify('יצירת הקישור נכשלה.',true)}
}
async function copyLink(type){
 const url=lastLinks[type];if(!url)return;try{await navigator.clipboard.writeText(url);notify('הקישור הועתק.')}catch(_){notify('העתקה אוטומטית לא זמינה.',true)}
}
function startCaseFileImport(){
 if(!current){notify('יש לפתוח תיק עובד לפני העלאת קובץ קליטה.',true);return}
 if(typeof window.matokOpenEmployeeIntakeUpload!=='function'){notify('מנוע קליטת הקבצים אינו זמין.',true);return}
 window.__MATOK_HR_IMPORT_CASE__=current;
 notify('בחר קובץ קליטה. לאחר הפענוח הוא יחובר אוטומטית לתיק הזה.');
 window.matokOpenEmployeeIntakeUpload();
}
async function linkImportedOnboarding(event){
 const caseId=window.__MATOK_HR_IMPORT_CASE__;
 if(!caseId)return;
 window.__MATOK_HR_IMPORT_CASE__='';
 const detail=event?.detail||{},ids=Array.isArray(detail.ids)?detail.ids:[],created=Array.isArray(detail.created)?detail.created:[];
 if(ids.length!==1){
   notify(ids.length>1?'הקובץ מכיל כמה עובדים ולכן לא שויך אוטומטית לתיק יחיד. הרשומות נשמרו במרכז הקליטה.':'הקובץ נשמר אך לא התקבלה רשומת קליטה לקישור.',true);
   return;
 }
 try{
   const linked=await supabaseClient.rpc('admin_hr_link_onboarding_record',{p_case_id:caseId,p_record_id:ids[0]});
   if(linked.error)throw linked.error;
   const staffId=created[0]?.staff_id||created[0]?.staffId||null;
   if(staffId){
     const staffLink=await supabaseClient.rpc('admin_hr_link_staff',{p_case_id:caseId,p_staff_id:staffId});
     if(staffLink.error)throw staffLink.error;
   }
   notify(staffId?'קובץ הקליטה פוענח, העובד נוצר והתיק חובר לכרטיס העובד.':'קובץ הקליטה פוענח וחובר לתיק. נשאר לבדוק ולאשר את הקליטה.');
   if(String(current)===String(caseId)){await openCase(caseId);tab('intake')}
 }catch(e){console.error('link imported onboarding to HR case',e);notify('הקובץ נקלט, אך החיבור לתיק העובד נכשל: '+(e?.message||'שגיאה'),true)}
}
function renderDocuments(){
 const docs=currentDetail.documents||[];
 $('hr-documents').innerHTML='<article class="hrCard"><h3>מסמכים וקבצים</h3><p>כאן מעלים קורות חיים, טופס ראיון סרוק, תעודות, הסכם או כל קובץ הקשור לקליטת העובד.</p><div class="hrForm"><label>סוג מסמך<select id="hrDocType"><option value="cv">קורות חיים</option><option value="interview">ראיון עבודה</option><option value="intake">טופס קליטה</option><option value="agreement">הסכם/הודעה לעובד</option><option value="identity">תעודה מזהה</option><option value="other">אחר</option></select></label><label>קובץ<input id="hrDocFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.txt,.csv"></label><label class="wide">הערה<input id="hrDocNote"></label></div><button class="btn primary" id="hrUploadDoc">העלאת המסמך לתיק</button><div id="hrDocList">'+(docs.length?docs.map(docRow).join(''):'<div class="hrEmpty">אין עדיין מסמכים בתיק.</div>')+'</div></article>';
 $('hrUploadDoc').onclick=uploadDocument;
 $('hrDocList').querySelectorAll('[data-open-hr-doc]').forEach(b=>b.onclick=()=>openDocument(b.dataset.openHrDoc));
 $('hrDocList').querySelectorAll('[data-doc-status]').forEach(s=>s.onchange=()=>updateDocumentStatus(s.dataset.docStatus,s.value));
}
function docRow(d){
 return '<div class="hrDocRow"><div><b>'+esc(d.original_name||'מסמך')+'</b><small>'+esc(d.document_type)+' · '+new Date(d.created_at).toLocaleDateString('he-IL')+'</small></div><select data-doc-status="'+esc(d.id)+'">'+Object.entries(DOC_STATUS).map(([v,l])=>'<option value="'+v+'" '+(d.status===v?'selected':'')+'>'+l+'</option>').join('')+'</select><span class="hrStatus">'+esc(DOC_STATUS[d.status]||d.status)+'</span><button class="btn secondary" data-open-hr-doc="'+esc(d.id)+'">פתיחה</button></div>';
}
async function uploadDocument(){
 const file=$('hrDocFile').files?.[0];if(!file){notify('יש לבחור קובץ.',true);return}
 if(file.size<=0||file.size>15*1024*1024){notify('הקובץ ריק או גדול מ-15MB.',true);return}
 const ext=(file.name.split('.').pop()||'bin').toLowerCase(),path=current+'/'+crypto.randomUUID()+'.'+ext;
 const mime={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',
   docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',txt:'text/plain',csv:'text/csv'}[ext]||file.type;
 if(!mime){notify('סוג הקובץ אינו נתמך.',true);return}
 const up=await supabaseClient.storage.from('staff-hr-documents').upload(path,file,{contentType:mime,upsert:false});
 if(up.error){notify('העלאת הקובץ נכשלה.',true);return}
 const reg=await supabaseClient.rpc('admin_hr_register_document',{p_case_id:current,p_document_type:$('hrDocType').value,p_storage_path:path,p_original_name:file.name,p_note:$('hrDocNote').value});
 if(reg.error){await supabaseClient.storage.from('staff-hr-documents').remove([path]);notify('רישום המסמך בתיק נכשל.',true);return}
 notify('המסמך נשמר בתיק העובד.');await openCase(current);tab('documents');
}
async function openDocument(id){
 const d=(currentDetail.documents||[]).find(x=>x.id===id);if(!d)return;
 const r=await supabaseClient.storage.from('staff-hr-documents').createSignedUrl(d.storage_path,300);if(r.error||!r.data?.signedUrl){notify('פתיחת המסמך נכשלה.',true);return}
 const w=window.open(r.data.signedUrl,'_blank','noopener,noreferrer');if(!w)notify('הדפדפן חסם את פתיחת המסמך.',true);
}
async function updateDocumentStatus(id,status){
 const r=await supabaseClient.rpc('admin_hr_update_document_status',{p_document_id:id,p_status:status});if(r.error){notify('עדכון סטטוס המסמך נכשל.',true);return}notify('סטטוס המסמך עודכן.');
}
function renderCaptured(){
 const c=currentDetail.case||{},iv=currentDetail.interview||{},fit=resp('fit'),intake=resp('intake');
 const groups=[['פרטי תיק',c],['ראיון מנהל',iv.answers||{}],['שאלון התאמה',fit],['טופס קליטה',intake]];
 $('hr-captured').innerHTML=groups.map(([title,data])=>'<article class="hrCard"><h3>'+title+'</h3>'+(Object.keys(data||{}).length?'<div class="hrSource">'+Object.entries(data).filter(([k,v])=>v&& !['id','created_by','updated_at','created_at'].includes(k)).map(([k,v])=>esc(k)+': '+esc(typeof v==='object'?JSON.stringify(v):v)).join('\n')+'</div>':'<div class="hrEmpty">אין עדיין נתונים.</div>')+'</article>').join('');
}
function renderApproval(){
 const c=currentDetail.case||{};
 let body='<article class="hrCard"><h3>אישור והקמת עובד</h3>';
 if(c.staff_id)body+='<div class="obStatus"><b>העובד כבר נקלט במערכת.</b><br>מזהה עובד: '+esc(c.staff_id)+'</div>';
 else if(c.onboarding_record_id)body+='<p>טופס הקליטה התקבל. פתח את בדיקת הקליטה הקיימת, בדוק את הפרטים והקם את העובד.</p><button class="btn primary" id="hrOpenOnboarding">פתיחת בדיקת הקליטה ואישור העובד</button>';
 else body+='<p>עדיין לא התקבל טופס קליטה. אפשר לשלוח אותו עכשיו.</p><button class="btn primary" id="hrGoIntake">מעבר לטופס קליטה</button>';
 body+='<button class="btn secondary" id="hrManualFromCase" style="margin-right:7px">פתיחת עובד ידנית</button></article>';$('hr-approval').innerHTML=body;
 if($('hrOpenOnboarding'))$('hrOpenOnboarding').onclick=()=>{closeModal?.('hrPortalModal');window.matokOpenOnboardingRecord?.(c.onboarding_record_id)};
 if($('hrGoIntake'))$('hrGoIntake').onclick=()=>tab('intake');
 $('hrManualFromCase').onclick=()=>{closeModal?.('hrPortalModal');openEmployee?.(-1)};
}
function initEntry(){
 if(!isAdmin())return;styles();
 const head=document.querySelector('#employees .employeeHead');if(!head||$('hrPortalEntry'))return;
 const actions=document.createElement('div');actions.className='hrEntry';
 const primary=document.createElement('button');primary.id='hrPortalEntry';primary.type='button';primary.className='btn primary';primary.textContent='+ עובד חדש / מרכז קליטה';primary.onclick=openPortal;
 const original=[...head.querySelectorAll('button')].find(b=>(b.getAttribute('onclick')||'').includes('openEmployee(-1)'));
 if(original){original.className='btn secondary';original.textContent='עובד ידני';original.parentNode?.insertBefore(actions,original);actions.appendChild(primary);actions.appendChild(original)}
 else{actions.appendChild(primary);head.appendChild(actions)}
 ensure();
}
window.matokOpenHrPortal=openPortal;
window.addEventListener('matok:onboarding-imported',linkImportedOnboarding);
let t=null;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(initEntry,100)}).observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(initEntry,120),{once:true});else setTimeout(initEntry,120);
})();