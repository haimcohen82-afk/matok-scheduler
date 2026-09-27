(() => {
'use strict';
const VERSION='20260928-onboarding-final-1';
const isAdmin=()=>{try{return appSession?.type==='admin'}catch(_){return false}};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const normalPhone=s=>String(s||'').replace(/[^0-9]/g,'').replace(/^972/,'0');
const fields=[['full_name','שם מלא'],['phone','טלפון'],['email','דוא"ל'],['city','עיר'],['address','כתובת'],['preferred_role','תפקיד'],['available_shifts','משמרות אפשריות'],['friday','שישי'],['preferred_start','תאריך התחלה'],['experience','ניסיון'],['notes','הערות']];
let records=[],staffList=[],active=null,busy=false,ocrWorker=null,initDone=false,lastInvite='';
function style(){
 if(document.getElementById('obStyle'))return;
 const s=document.createElement('style');s.id='obStyle';s.textContent=
 '.obPortal section{width:min(990px,100%);max-height:94vh}.obIntro{border:1px solid #b1dad3;border-right:5px solid #367e73;background:#f0faf7;border-radius:13px;padding:14px;margin:9px 0}.obTabs{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:13px 0}.obTabs button{white-space:normal;min-height:52px;border-radius:12px}.obView{display:none}.obView.active{display:block}.obForm{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:12px 0}.obForm label{display:grid;gap:4px;font-size:12px;font-weight:800}.obForm input,.obForm textarea,.obForm select{width:100%;min-height:43px;border:1px solid var(--line);border-radius:10px;padding:9px}.obForm .wide{grid-column:1/-1}.obCard{background:#fff;border:1px solid var(--line);border-right:4px solid #85b7ac;border-radius:13px;padding:13px;margin:8px 0}.obCard b{font-size:14px}.obCard small{color:var(--muted);display:block}.obActions{display:flex;gap:8px;flex-wrap:wrap;margin:9px 0}.obActions button{min-height:43px}.obStatus{margin:9px 0;padding:12px;border:1px solid #bdd9d4;background:#f2faf8;border-radius:12px;line-height:1.5}.obStatus.error{background:#fff1ee;color:#8a3c2f;border-color:#dfbbb0}.obPreview{background:#f2f5f8;border:1px solid var(--line);border-radius:12px;padding:12px;max-height:180px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:12px}.obBadge{background:#eff4fa;padding:4px 8px;border-radius:8px;font-size:11px;font-weight:800}@media(max-width:600px){.obTabs{grid-template-columns:1fr 1fr}.obForm{grid-template-columns:1fr}.obForm .wide{grid-column:auto}.obActions .btn{flex:1;min-width:115px}.obPortal section{width:100%}}';
 document.head.appendChild(s);
}
function notify(text,bad=false){const el=document.getElementById('obStatus');if(el){el.textContent=text;el.className='obStatus'+(bad?' error':'')}}
function ensure(){
 let m=document.getElementById('obModal');if(m)return m;
 m=document.createElement('div');m.id='obModal';m.className='modal obPortal';m.innerHTML=
 '<section><button class="close" id="obClose" type="button">×</button><h2>קליטת עובדים · MATOK BASIC</h2><p>ממלאים שאלון, בודקים את פרטי הקליטה ומאשרים. עובדים לא נוצרים אוטומטית ללא אישור מנהל.</p>'
 +'<div class="obTabs"><button type="button" class="btn primary" data-ob-tab="inbox">בקשות לקליטה</button><button type="button" class="btn secondary" data-ob-tab="invite">שאלון WhatsApp</button><button type="button" class="btn secondary" data-ob-tab="upload">קובץ קליטה</button></div>'
 +'<div id="obStatus" class="obStatus">המערכת מחוברת למאגר העובדים הקיים.</div>'
 +'<div class="obView active" id="ob-inbox"><div class="obActions"><button class="btn secondary" id="obRefresh">רענון בקשות</button></div><div id="obList">טוען…</div><div id="obReview"></div></div>'
 +'<div class="obView" id="ob-invite"><div class="obIntro"><b>קישור אישי חד־פעמי</b><p>שולחים לעובד ב-WhatsApp. הטופס נגיש רק באמצעות הקישור ומועבר לבדיקת מנהל.</p></div><div class="obActions"><button class="btn primary" id="obNewLink">יצירת קישור חדש</button><button class="btn secondary" id="obCopyLink" disabled>העתקת קישור</button></div><label>קישור השאלון<input id="obLink" readonly placeholder="לחץ יצירת קישור"></label><div class="obForm"><label>טלפון למשלוח WhatsApp (לא חובה)<input id="obWaPhone" type="tel" placeholder="05…"></label></div><button class="btn secondary" id="obSendWa" disabled>פתיחת WhatsApp עם הקישור</button></div>'
 +'<div class="obView" id="ob-upload"><div class="obIntro"><b>קליטת קובץ מקורי</b><small>PDF, צילום או קובץ Word DOCX. חילוץ הטקסט מתבצע בדפדפן שלך. רק מנהל מאשר נתונים של עובד.</small></div><label>קובץ<input id="obFile" type="file" accept="application/pdf,.pdf,image/*,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></label><button class="btn primary" id="obAnalyze" style="margin-top:10px">פתיחה וניתוח הקובץ</button><div id="obExtracted" style="margin-top:11px"></div></div></section>';
 document.body.appendChild(m);document.getElementById('obClose').onclick=()=>closeModal?.('obModal');
 m.querySelectorAll('[data-ob-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.obTab));
 document.getElementById('obRefresh').onclick=load;
 document.getElementById('obNewLink').onclick=createInvite;
 document.getElementById('obCopyLink').onclick=async()=>{try{await navigator.clipboard.writeText(lastInvite);notify('הקישור הועתק.')}catch(e){document.getElementById('obLink').focus();document.getElementById('obLink').select();notify('הקישור מסומן. ניתן להעתיק ידנית.')}};
 document.getElementById('obSendWa').onclick=()=>{
   const phone=normalPhone(document.getElementById('obWaPhone').value);
   if(phone.length<9){notify('יש להזין מספר טלפון תקין כדי לפתוח הודעה.',true);return}
   const international=phone.startsWith('0')?'972'+phone.slice(1):phone;
   const msg='שלום, מצורף קישור אישי למילוי שאלון הקליטה של MATOK BASIC:\n'+lastInvite+'\nלאחר השליחה הפרטים יועברו לאישור ההנהלה.';
   const x=window.open('https://wa.me/'+international+'?text='+encodeURIComponent(msg),'_blank');if(!x)notify('פתיחת WhatsApp נחסמה בדפדפן. יש להעתיק את הקישור ולשלוח ידנית.',true);
 };
 document.getElementById('obAnalyze').onclick=importOriginal;
 return m;
}
function tab(name){
 const m=ensure();
 m.querySelectorAll('[data-ob-tab]').forEach(b=>{const on=b.dataset.obTab===name;b.classList.toggle('primary',on);b.classList.toggle('secondary',!on)});
 m.querySelectorAll('.obView').forEach(el=>el.classList.toggle('active',el.id==='ob-'+name));
 if(name==='inbox')load();
}
async function getStaff(){const r=await supabaseClient.from('staff').select('id,full_name,phone,username,is_active').order('full_name');if(r.error)throw r.error;staffList=r.data||[];return staffList}
async function load(){
 if(!isAdmin()||busy)return;
 const box=document.getElementById('obList');if(!box)return;box.textContent='טוען בקשות…';
 try{
   const [a]=await Promise.all([supabaseClient.rpc('admin_list_onboarding_records'),getStaff()]);
   if(a.error)throw a.error;records=a.data||[];
   box.innerHTML=records.length?records.map(x=>{
     const name=x.details?.full_name||'שם לא זוהה';
     return '<div class="obCard"><b>'+esc(name)+'</b><span class="obBadge">'+esc(x.review_status==='approved'?'אושר':'ממתין לבדיקה')+'</span>'
      +'<small>'+esc(x.details?.phone||'אין טלפון')+' · '+esc(x.source==='questionnaire'?'שאלון':'מסמך שהועלה')+' · '+new Date(x.created_at).toLocaleDateString('he-IL')+'</small>'
      +'<button type="button" class="btn secondary" data-ob-view="'+esc(x.id)+'" style="margin-top:8px">צפייה וקליטה</button></div>';
   }).join(''):'<div class="obIntro">אין כרגע בקשות קליטה. אפשר לשלוח שאלון אישי או להעלות קובץ.</div>';
   box.querySelectorAll('[data-ob-view]').forEach(b=>b.onclick=()=>review(b.dataset.obView));
 }catch(e){console.error('onboarding list',e);box.textContent='טעינת הבקשות נכשלה.';notify('אין גישה לבקשות הקליטה. ודא כניסת מנהל.',true)}
}
async function createInvite(){
 if(!isAdmin()||busy)return;busy=true;
 const b=document.getElementById('obNewLink');b.disabled=true;
 try{
   const r=await supabaseClient.rpc('admin_create_onboarding_invite');if(r.error)throw r.error;
   const token=typeof r.data==='string'?r.data:r.data?.token;
   if(!token)throw Error('empty_token');
   lastInvite=location.origin+'/onboarding.html#'+encodeURIComponent(token);
   document.getElementById('obLink').value=lastInvite;
   document.getElementById('obCopyLink').disabled=false;document.getElementById('obSendWa').disabled=false;
   notify('נוצר קישור אישי חדש. הוא חד־פעמי ופג בהתאם להגדרות השרת.');
 }catch(e){console.error('onboarding invite',e);notify('יצירת הקישור נכשלה.',true)}finally{busy=false;b.disabled=false}
}
function fieldMarkup(detail){
 return fields.map(([key,label])=>{
   const v=String(detail?.[key]||'');
   const long=['experience','notes','available_shifts'].includes(key);
   return '<label'+(long?' class="wide"':'')+'>'+esc(label)
     +(long?'<textarea name="'+key+'" rows="2">'+esc(v)+'</textarea>':'<input name="'+key+'" value="'+esc(v)+'">')+'</label>';
 }).join('');
}
function suggested(detail){
 const phone=normalPhone(detail?.phone),name=String(detail?.full_name||'').trim();
 return staffList.filter(s=>(phone&&normalPhone(s.phone)===phone)||(name.length>3&&s.full_name===name));
}
function existingOptions(detail){
 const matched=new Set(suggested(detail).map(x=>x.id));
 return '<option value="">בחר עובד קיים</option>'+staffList.map(s=>'<option value="'+esc(s.id)+'">'+(matched.has(s.id)?'התאמה אפשרית · ':'')+esc(s.full_name)+(s.is_active?'':' (לא פעיל)')+'</option>').join('');
}
function collectForm(id){const f=document.getElementById(id);return Object.fromEntries(new FormData(f).entries())}
async function review(id){
 const item=records.find(x=>x.id===id);if(!item)return;active=item;
 const pending=item.review_status==='pending';
 const box=document.getElementById('obReview'),d=item.details||{},suggest=suggested(d);
 box.innerHTML='<hr style="border:0;border-top:1px solid var(--line);margin:17px 0"><div class="obCard"><h3>'+esc(d.full_name||'קליטה ללא זיהוי')+'</h3><p>מקור: '+esc(item.source==='questionnaire'?'שאלון שהוגש':'קובץ מקורי שהועלה')+'</p>'
 +'<form id="obReviewForm" class="obForm">'+fieldMarkup(d)+'</form>'
 +(item.source==='uploaded_file'?'<div class="obActions"><button type="button" class="btn secondary" id="obOpenFile">פתיחת הקובץ המקורי</button><button type="button" class="btn secondary" id="obOpenText">הטקסט שחולץ</button></div><div id="obSourceText" class="obPreview" hidden></div>':'')
 +(suggest.length?'<div class="obIntro"><b>נמצאה התאמה אפשרית לעובד קיים:</b> '+esc(suggest.map(x=>x.full_name).join(', '))+'<br><small>יש לבחור ולוודא ידנית כדי למנוע כפילות.</small></div>':'')
 +(pending?'<div class="obActions"><button type="button" class="btn primary" id="obSaveDetails">שמירת תיקונים</button></div><h3>אישור הקליטה</h3>'
 +'<div class="obForm"><label>שיוך לעובד קיים<select id="obExisting">'+existingOptions(d)+'</select></label><label style="align-self:end"><button type="button" class="btn secondary" id="obLinkExisting">שיוך לעובד קיים</button></label></div>'
 +'<p>עובד חדש ייווצר רק באישור מנהל. יש לבדוק התאמה אפשרית קודם.</p><div class="obForm"><label>שם משתמש חדש<input id="obUsername" maxlength="24" autocomplete="off" placeholder="באנגלית"></label><label>קוד PIN חדש (4 ספרות)<input id="obPin" type="password" maxlength="4" inputmode="numeric" autocomplete="new-password"></label><label>תפקיד<input id="obRole" value="'+esc(d.preferred_role||'מכירה')+'"></label></div>'
 +'<button class="btn primary" id="obApprove" type="button">אישור וקליטת עובד חדש</button>'
 :'<div class="obIntro"><b>הרשומה כבר טופלה.</b> לא ניתן ליצור באמצעותה עובד נוסף.</div>')+'</div>';
 if(item.source==='uploaded_file'){
   document.getElementById('obOpenFile').onclick=async()=>{
     if(!item.original_path){notify('הקובץ המקורי אינו זמין.',true);return}
     const r=await supabaseClient.storage.from('staff-onboarding-originals').createSignedUrl(item.original_path,300);
     if(r.error||!r.data?.signedUrl){notify('פתיחת המסמך נכשלה.',true);return}
     const w=window.open(r.data.signedUrl,'_blank');if(w)w.opener=null;else notify('הדפדפן חסם את פתיחת המסמך.',true);
   };
   document.getElementById('obOpenText').onclick=async()=>{
     const r=await supabaseClient.rpc('admin_get_onboarding_text',{p_record_id:item.id});
     const t=document.getElementById('obSourceText');
     t.hidden=false;t.textContent=r.error?'לא ניתן לקרוא את הטקסט.':r.data||'לא נמצא טקסט קריא. השתמש בקובץ המקורי.';
   };
 }
 if(pending){
   document.getElementById('obSaveDetails').onclick=saveDetails;
   document.getElementById('obApprove').onclick=approveNew;
   document.getElementById('obLinkExisting').onclick=linkExisting;
 }
 box.scrollIntoView({behavior:'smooth',block:'start'});
}
async function saveDetails(){
 if(!active||busy)return false;
 const details={...active.details,...collectForm('obReviewForm')};
 if(!details.full_name?.trim()||normalPhone(details.phone).length<9){notify('יש להשלים שם מלא וטלפון תקין לפני אישור.',true);return false}
 busy=true;
 try{
   const r=await supabaseClient.rpc('admin_update_onboarding_record',{p_record_id:active.id,p_details:details});
   if(r.error)throw r.error;
   active.details=details;notify('פרטי הקליטה עודכנו.','');return true;
 }catch(e){console.error('onboarding update',e);notify('שמירת תיקונים נכשלה.',true);return false}finally{busy=false}
}
async function linkExisting(){
 if(!active||busy)return;
 const id=document.getElementById('obExisting')?.value;
 if(!id){notify('יש לבחור עובד קיים.',true);return}
 const selected=staffList.find(x=>x.id===id);
 if(!confirm('לשייך את המסמך של '+(active.details?.full_name||'')+' לעובד '+selected?.full_name+'? בדוק את ההתאמה.'))return;
 busy=true;
 try{
   const r=await supabaseClient.rpc('admin_link_onboarding_existing',{p_record_id:active.id,p_staff_id:id});
   if(r.error)throw r.error;active.review_status='approved';
   notify('הרשומה שויכה לעובד הקיים. לא נוצר עובד כפול.');
   document.getElementById('obReview').innerHTML='';await load();
 }catch(e){console.error('onboarding link',e);notify('שיוך לעובד הקיים נכשל.',true)}finally{busy=false}
}
async function approveNew(){
 if(!active||busy)return;
 const details={...active.details,...collectForm('obReviewForm')};
 const username=document.getElementById('obUsername').value.trim().toLowerCase();
 const pin=document.getElementById('obPin').value.trim();
 const role=document.getElementById('obRole').value.trim()||'מכירה';
 if(!details.full_name?.trim()||normalPhone(details.phone).length<9){notify('יש להשלים שם וטלפון.',true);return}
 if(!/^[a-z0-9._-]{4,24}$/.test(username)||!/^\d{4}$/.test(pin)){notify('יש להגדיר שם משתמש באנגלית של 4–24 תווים וקוד אישי בן 4 ספרות.',true);return}
 const duplicates=suggested(details);
 if(duplicates.length){notify('נמצאו עובדים בעלי שם או טלפון תואמים. יש לבדוק שיוך לעובד קיים לפני יצירת עובד חדש.',true);return}
 if(!confirm('ליצור עובד חדש בשם '+details.full_name+'? לא ניתן לבצע זאת בלי הרשאת מנהל.'))return;
 busy=true;
 try{
   const update=await supabaseClient.rpc('admin_update_onboarding_record',{p_record_id:active.id,p_details:details});if(update.error)throw update.error;
   const r=await supabaseClient.rpc('admin_approve_onboarding_new',{p_record_id:active.id,p_name:details.full_name,p_phone:details.phone,p_username:username,p_code:pin,p_role:role,p_settings:{}});
   if(r.error)throw r.error;
   document.getElementById('obPin').value='';notify('העובד נקלט ואושר. פרטי הכניסה נשלחים רק דרך ניהול העובדים.');
   document.getElementById('obReview').innerHTML='';await load();
   try{await loadAdminData()}catch(e){console.warn('refresh employee list',e)}
   document.getElementById('mpRefreshStaff')?.click();
 }catch(e){console.error('onboarding approve',e);notify('קליטת העובד נכשלה: '+(e?.message||'שגיאה'),true)}finally{busy=false}
}
function loadScript(url,globalName){return new Promise((resolve,reject)=>{if(window[globalName])return resolve(window[globalName]);const existing=[...document.scripts].find(s=>s.src===url);if(existing){existing.addEventListener('load',()=>resolve(window[globalName]),{once:true});existing.addEventListener('error',reject,{once:true});return}const s=document.createElement('script');s.src=url;s.onload=()=>resolve(window[globalName]);s.onerror=reject;document.head.appendChild(s)})}
async function extract(file){
 let text='';
 const isPdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
 const isDocx=/\.docx$/i.test(file.name);
 if(isPdf){
   const pdfjs=await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js','pdfjsLib');
   pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
   const doc=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
   if(doc.numPages>30)throw Error('קובץ קליטה צריך להכיל עד 30 עמודים');
   let worker=null;
   try{
     for(let i=1;i<=doc.numPages;i++){
       notify('מנתח עמוד '+i+' מתוך '+doc.numPages+'…');
       const page=await doc.getPage(i),tc=await page.getTextContent();
       let t=tc.items.map(x=>x.str||'').join(' ');
       if(t.replace(/\s/g,'').length<40){
         const T=await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js','Tesseract');
         const v=page.getViewport({scale:2}),canvas=document.createElement('canvas');canvas.width=Math.ceil(v.width);canvas.height=Math.ceil(v.height);
         await page.render({canvasContext:canvas.getContext('2d'),viewport:v}).promise;
         if(!worker)worker=await T.createWorker('heb+eng');
         const r=await worker.recognize(canvas);t+=' '+(r.data?.text||'');
         canvas.width=0;canvas.height=0;
       }
       text+='\nעמוד '+i+'\n'+t;
       if(text.length>110000)break;
     }
   }finally{if(worker)await worker.terminate().catch(()=>{});await doc.destroy()}
 }else if(isDocx){
   const mammoth=await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.10.0/mammoth.browser.min.js','mammoth');
   const r=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});text=r.value||'';
 }else if(file.type.startsWith('image/')){
   const T=await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js','Tesseract');
   const w=await T.createWorker('heb+eng');
   try{const result=await w.recognize(file);text=result.data?.text||''}finally{await w.terminate().catch(()=>{})}
 }else throw Error('יש לבחור PDF, DOCX או תמונה.');
 return text.slice(0,115000);
}
function autoDetails(text){
 const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const phone=(text.match(/(?:\+972|0)[\s\-]?(?:5\d|[2-9])(?:[\s\-]?\d){7,8}/)||[])[0]||'';
 const email=(text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)||[])[0]||'';
 const labeled=lines.find(x=>/^(?:שם מלא|שם העובד|שם פרטי.*משפחה)\s*[:\-]?\s*\S+/i.test(x))||'';
 const name=labeled.replace(/^(?:שם מלא|שם העובד|שם פרטי.*משפחה)\s*[:\-]?\s*/i,'').slice(0,150);
 return {full_name:name,phone,email,city:'',address:'',preferred_role:'',available_shifts:'',friday:'',preferred_start:'',experience:'',notes:''};
}
async function importOriginal(){
 if(!isAdmin()||busy)return;
 const file=document.getElementById('obFile').files?.[0];
 if(!file){notify('בחר קובץ לקליטה.',true);return}
 if(file.size>20*1024*1024){notify('קובץ גדול מדי. יש להעלות קובץ עד 20MB.',true);return}
 const extracted=document.getElementById('obExtracted');
 busy=true;document.getElementById('obAnalyze').disabled=true;
 try{
   const text=await extract(file),guess=autoDetails(text);
   extracted.innerHTML='<div class="obIntro"><b>נדרש אישור ידני</b><small>פרטים שהמערכת הציעה מתוך המסמך. שדות שלא זוהו נשארו ריקים. הקובץ המקורי יישמר בארכיון פרטי לבדיקה.</small></div>'
    +'<form id="obImportForm" class="obForm">'+fieldMarkup(guess)+'</form>'
    +'<details><summary>הצגת הטקסט שחולץ</summary><pre class="obPreview" id="obExtractedText"></pre></details>'
    +'<div class="obActions"><button class="btn primary" id="obImportConfirm" type="button">שמירת בקשה לבדיקה</button></div>';
   document.getElementById('obExtractedText').textContent=text||'לא נמצא טקסט קריא. ניתן לפתוח את המקור לאחר השמירה.';
   document.getElementById('obImportConfirm').onclick=async()=>{
     const details=collectForm('obImportForm');
     if(!confirm('לשמור את המסמך המקורי והפרטים לבדיקה? לא ייווצר עובד עד לאישור.'))return;
     const b=document.getElementById('obImportConfirm');b.disabled=true;
     const path='imports/'+crypto.randomUUID()+'/'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-70);
     let uploaded=false;
     try{
       const up=await supabaseClient.storage.from('staff-onboarding-originals').upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'});
       if(up.error)throw up.error;uploaded=true;
       const confidence={full_name:details.full_name&&details.full_name===guess.full_name?'ocr_candidate':'manual_review',phone:details.phone&&details.phone===guess.phone?'ocr_candidate':'manual_review'};
       const reg=await supabaseClient.rpc('admin_import_onboarding_file',{p_details:details,p_confidence:confidence,p_text:text,p_path:path,p_filename:file.name.slice(0,210)});
       if(reg.error)throw reg.error;
       notify('המסמך והפרטים נקלטו לבדיקת מנהל. טרם נוצר עובד.');
       extracted.innerHTML='';document.getElementById('obFile').value='';tab('inbox');
     }catch(e){console.error('onboarding import',e);if(uploaded)await supabaseClient.storage.from('staff-onboarding-originals').remove([path]);notify('שמירת הקליטה נכשלה: '+(e?.message||'שגיאה'),true);b.disabled=false}
   };
   notify('הניתוח הסתיים. יש לבדוק ולאשר את הפרטים לפני שמירה.');
 }catch(e){console.error('onboarding extract',e);notify('ניתוח הקובץ נכשל: '+(e?.message||'שגיאה')+'. אפשר לפתוח את הקובץ במחשב ולנסות שוב.',true)}
 finally{busy=false;document.getElementById('obAnalyze').disabled=false}
}
function mount(){
 if(!isAdmin())return;
 style();const p=document.getElementById('employees');if(!p||document.getElementById('obEntry'))return;
 const head=p.querySelector('.employeeHead')||p;
 const b=document.createElement('button');b.id='obEntry';b.type='button';b.className='btn primary';b.textContent='קליטת עובד · שאלון או קובץ';
 b.onclick=()=>{ensure();openModal?.('obModal');tab('inbox')};
 head.appendChild(b);initDone=true;
}
let timer=null;new MutationObserver(()=>{if(!initDone){clearTimeout(timer);timer=setTimeout(mount,120)}}).observe(document.documentElement,{subtree:true,childList:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,200),{once:true});else setTimeout(mount,150);
window.openMatokOnboarding=()=>{if(!isAdmin())return;ensure();openModal?.('obModal');tab('inbox')};
})();