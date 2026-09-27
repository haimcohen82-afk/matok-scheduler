(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isAdmin=()=>{try{return appSession?.type==='admin'}catch(_){return false}};
  const BUCKET='staff-onboarding-originals';
  const KEYS=[
    ['full_name','שם מלא'],['phone','טלפון'],['email','דוא״ל'],['city','יישוב'],
    ['address','כתובת'],['preferred_role','תפקיד'],['available_shifts','משמרות'],
    ['friday','שישי'],['preferred_start','תאריך התחלה'],['experience','ניסיון'],
    ['notes','הערות'],['extra_fields','שדות נוספים שזוהו בקובץ']
  ];
  let items=[],active=null,listBusy=false;
  function ensureStyle(){
    if($('matokIntakeStyle'))return;
    const style=document.createElement('style');style.id='matokIntakeStyle';
    style.textContent='.intakeHub{border:2px solid #90c8bd;background:linear-gradient(145deg,#f2fbf8,#fff);padding:15px;margin:12px 0;border-radius:16px}.intakeHub h2{margin:0 0 6px}.intakeRow{display:flex;flex-wrap:wrap;gap:9px;align-items:end}.intakeRow label{flex:1;min-width:190px}.intakeHub input,.intakeReview input,.intakeReview textarea,.intakeReview select{width:100%;padding:9px;border:1px solid #bbb;border-radius:9px}.intakeCard{border:1px solid #ddd;border-radius:11px;background:#fff;padding:11px;margin:7px 0}.intakeCard .actions{margin-top:7px}.intakeState{padding:7px;border-radius:9px;background:#f6f3ec;margin-top:8px}.intakeState.bad{background:#fff0ed;color:#872f2e}.intakeState.good{background:#e6f5ed;color:#205b3b}.intakeReview{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:13px}.intakeReview .uncertain{border:2px solid #e1ad75;background:#fff8ed;padding:7px;border-radius:9px}.intakeFields{display:grid;gap:7px;max-height:60vh;overflow:auto}.intakeReview label{display:block;font-size:12px;font-weight:800}.intakeReview textarea{min-height:72px}.intakeOriginal{display:none;border:1px solid #ddd;border-radius:12px;padding:8px}.intakeOriginal iframe,.intakeOriginal img{width:100%;min-height:450px;border:0;object-fit:contain}.intakeReview.withOriginal{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.intakeReview:not(.withOriginal){grid-template-columns:1fr}.intakeReview.withOriginal .intakeOriginal{display:block}.intakeDetail{border-bottom:1px solid #eee;padding:5px 0;overflow-wrap:anywhere}.intakeArchive{max-height:280px;overflow:auto}.intakeModalActions{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.intakeModalActions button{flex:1;min-width:140px}@media(max-width:720px){.intakeReview.withOriginal{grid-template-columns:1fr}.intakeReview .intakeFields{max-height:none}.intakeOriginal iframe{min-height:320px}}';
    document.head.appendChild(style);
  }
  function feedback(message,error=false){
    const box=$('intakeStatus');if(!box)return;
    box.className='intakeState'+(error?' bad':' good');box.textContent=message;
  }
  const phone972=raw=>{
    const x=String(raw||'').trim().replace(/[\s()\-]/g,'');
    if(x.startsWith('+'))return x.slice(1).replace(/\D/g,'');
    const digits=x.replace(/\D/g,'');
    return digits.startsWith('972')?digits:digits.startsWith('0')?'972'+digits.slice(1):digits;
  };
  function init(){
    if(!isAdmin())return;
    const panel=$('employees');
    if(!panel||$('matokIntakeHub'))return;
    ensureStyle();
    const root=document.createElement('article');root.id='matokIntakeHub';root.className='intakeHub';
    root.innerHTML='<h2>קליטת עובדים · שאלונים ומסמכים</h2>'+
      '<p>שאלון אישי חד־פעמי ב־WhatsApp. לאחר מילוי הוא מופיע כאן לבדיקה ולהקמת כרטיס עובד.</p>'+
      '<div class="intakeRow"><label>טלפון WhatsApp של המועמד/ת<input id="intakeTargetPhone" type="tel" placeholder="05… או מספר בינלאומי עם +"></label>'+
      '<button type="button" class="btn primary" id="intakeSendWa">יצירת קישור ושליחה ב־WhatsApp</button>'+
      '<button type="button" class="btn secondary" id="intakeCopyLink">יצירת קישור להעתקה</button></div>'+
      '<p style="font-size:11px;margin:5px 0">תוקף השאלון: 7 ימים, שליחה אחת. ב־WhatsApp תידרש לחיצה על שליחה.</p>'+
      '<div class="intakeRow"><label>קליטת קובץ עובד מקורי (PDF, תמונה, Word, Excel, טקסט)<input id="intakeUploadFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.xls,.txt,.csv"></label>'+
      '<button type="button" class="btn secondary" id="intakeRefresh">רענון קליטות</button></div>'+
      '<div id="intakeStatus" role="status" class="intakeState">כאן יופיעו שאלונים שהוגשו וקובצי קליטה שנותחו.</div>'+
      '<div id="intakeGenerated"></div><div id="intakeQueue"></div>';
    const grid=$('employeeGrid');
    if(grid)grid.before(root);else panel.prepend(root);
    $('intakeSendWa').onclick=()=>sendInvitation(true);
    $('intakeCopyLink').onclick=()=>sendInvitation(false);
    $('intakeRefresh').onclick=()=>loadItems();
    $('intakeUploadFile').onchange=e=>importFile(e.target.files?.[0],e.target);
    ensureModal();
    void loadItems();
  }
  function ensureModal(){
    if($('matokIntakeModal'))return;
    const m=document.createElement('div');m.id='matokIntakeModal';m.className='modal';
    m.innerHTML='<section style="width:min(1100px,98vw);max-height:95vh;overflow:auto"><button type="button" class="close" id="intakeClose">×</button>'+
      '<h2 id="intakeTitle">בדיקת קליטת עובד</h2>'+
      '<div class="intakeReview" id="intakeReview"><div><div id="intakeFields" class="intakeFields"></div>'+
      '<div class="intakeModalActions" id="intakeReviewActions"></div></div>'+
      '<div class="intakeOriginal" id="intakeOriginal"><h3>מסמך המקור · בדיקה לפי צורך</h3><div id="intakeOriginalViewer"></div></div></div></section>';
    document.body.appendChild(m);
    $('intakeClose').onclick=()=>closeModal('matokIntakeModal');
  }
  async function sendInvitation(wa){
    if(!isAdmin())return;
    const raw=$('intakeTargetPhone').value.trim();
    const digits=phone972(raw);
    if(wa&&(digits.length<9||digits.length>15)){
      feedback('יש להזין מספר WhatsApp תקין, עם קידומת מדינה לפי הצורך.',true);return;
    }
    const popup=wa?window.open('about:blank','_blank'):null;
    const b=$(wa?'intakeSendWa':'intakeCopyLink');b.disabled=true;
    try{
      const res=await supabaseClient.rpc('admin_create_onboarding_invite');
      if(res.error||!res.data)throw res.error||new Error('no_token');
      const url=location.origin+'/join.html?t='+encodeURIComponent(res.data);
      const message='שלום, מצורף שאלון קליטת עובד/ת ל־MATOK BASIC.\nנא למלא את הפרטים בקישור האישי:\n'+url+'\nתודה, הנהלת MATOK BASIC.';
      const whatsapp='https://wa.me/'+digits+'?text='+encodeURIComponent(message);
      const holder=$('intakeGenerated');
      holder.innerHTML='<div class="intakeState good"><b>קישור שאלון נוצר:</b> '+
        '<input type="text" id="intakeLinkValue" aria-label="קישור שאלון חד־פעמי" readonly value="'+safe(url)+'" style="width:100%;margin:7px 0">'+
        (wa?'<a target="_blank" rel="noreferrer noopener" href="'+safe(whatsapp)+'">פתיחת הודעת WhatsApp מוכנה</a>':'')+
        ' <button type="button" class="btn secondary" id="intakeLinkCopy">העתקת קישור</button></div>';
      $('intakeLinkCopy').onclick=async()=>{
        try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url);
          else{$('intakeLinkValue').select();document.execCommand('copy')}
          feedback('הקישור הועתק.');}
        catch(_){$('intakeLinkValue').select();feedback('הקישור מוצג ומסומן להעתקה ידנית.',true)}
      };
      if(wa){
        if(popup){
          popup.opener=null;
          popup.location.replace(whatsapp);
          feedback('WhatsApp נפתח עם ההודעה. יש ללחוץ על שליחה.');
        }else feedback('הקישור נוצר, אך פתיחת WhatsApp נחסמה. לחץ על קישור WhatsApp שמופיע כאן.');
      }else{
        $('intakeLinkCopy').click();
        feedback('הקישור נוצר. אפשר להעתיק אותו או לשלוח לכל מספר.');
      }
    }catch(e){
      if(popup)popup.close();
      console.error('onboarding invite',e);
      feedback('יצירת הקישור נכשלה. לא נשלחה הודעה.',true);
    }finally{b.disabled=false}
  }

  async function loadItems(){
    if(!isAdmin()||listBusy)return;
    listBusy=true;
    try{
      const r=await supabaseClient.rpc('admin_list_onboarding_records');
      if(r.error)throw r.error;
      items=r.data||[];renderItems();
    }catch(e){console.error('onboarding records',e);feedback('טעינת השאלונים וקובצי הקליטה נכשלה.',true)}
    finally{listBusy=false}
  }
  function renderItems(){
    const box=$('intakeQueue');if(!box)return;
    const pending=items.filter(x=>x.review_status==='pending');
    const approved=items.filter(x=>x.review_status==='approved');
    box.innerHTML='<h3>ממתינים לבדיקה ('+pending.length+')</h3>'+
      (pending.length?pending.map(card).join(''):'<div class="intakeState">אין כרגע קליטות הממתינות לאישור.</div>')+
      '<details><summary>ארכיון קליטות שאושרו ('+approved.length+')</summary><div class="intakeArchive">'+approved.map(card).join('')+'</div></details>';
    box.querySelectorAll('[data-intake-open]').forEach(b=>b.onclick=()=>openReview(b.dataset.intakeOpen));
  }
  function card(item){
    const d=item.details||{};
    return '<div class="intakeCard"><b>'+safe(d.full_name||'שם לבדיקה')+'</b> · '+safe(d.phone||'אין טלפון מזוהה')+
      '<div><small>'+safe(item.source==='questionnaire'?'שאלון WhatsApp':'קובץ קליטה')+
      ' · '+safe(new Date(item.created_at).toLocaleString('he-IL'))+
      (item.review_status==='approved'?' · נקלט':' · ממתין')+'</small></div>'+
      '<div class="actions"><button type="button" class="btn '+(item.review_status==='pending'?'primary':'secondary')+
      '" data-intake-open="'+safe(item.id)+'">'+(item.review_status==='pending'?'בדיקה וקליטה':'הצגת פרטים')+'</button></div></div>';
  }
  const selectedData=()=>Object.fromEntries([...$('intakeFields').querySelectorAll('[data-intake-key]')]
      .map(el=>[el.dataset.intakeKey,el.value]));
  function renderFields(record,editable=true){
    const data=record.details||{},confidence=record.confidence||{};
    $('intakeFields').innerHTML=KEYS.map(([key,label])=>{
      let value=data[key]??'';
      if(typeof value==='object')value=JSON.stringify(value,null,2);
      const doubtful=record.source==='uploaded_file'&&(confidence[key]!=='high'||!value);
      return '<label class="'+(doubtful?'uncertain':'')+'">'+safe(label)+
        (doubtful?' <small>· לבדיקה מול המקור</small>':'')+
        (key==='experience'||key==='notes'||key==='extra_fields'
          ?'<textarea data-intake-key="'+key+'" '+(editable?'':'readonly')+'>'+safe(value)+'</textarea>'
          :'<input data-intake-key="'+key+'" value="'+safe(value)+'" '+(editable?'':'readonly')+'>')+
        '</label>';
    }).join('');
  }
  async function openSource(record){
    const wrap=$('intakeReview'),box=$('intakeOriginalViewer');
    if(!record.original_path){feedback('לקליטה זו אין קובץ מקורי מצורף.',true);return}
    box.textContent='פותח את המסמך המקורי…';
    const r=await supabaseClient.storage.from(BUCKET).createSignedUrl(record.original_path,120);
    if(r.error||!r.data?.signedUrl){box.textContent='פתיחת המקור נכשלה. יש לרענן הרשאות או לנסות שוב.';return}
    const url=r.data.signedUrl;
    const name=record.original_name||'';
    box.innerHTML=/\.(png|jpg|jpeg|webp)$/i.test(name)
      ?'<img alt="תצוגת מסמך המקור" src="'+safe(url)+'">'
      :/\.pdf$/i.test(name)?'<iframe title="מסמך המקור" src="'+safe(url)+'"></iframe>':
        '<p>סוג מסמך זה לא מוצג ישירות בדפדפן.</p>';
    const btn=document.createElement('button');btn.type='button';btn.className='btn secondary';
    btn.textContent='פתיחת קובץ המקור בחלון נפרד';btn.onclick=()=>window.open(url,'_blank','noopener,noreferrer');
    box.appendChild(btn);wrap.classList.add('withOriginal');
  }
  async function savePending(){
    if(!active||active.review_status!=='pending')return false;
    const data={...active.details,...selectedData()};
    const res=await supabaseClient.rpc('admin_update_onboarding_record',{p_record_id:active.id,p_details:data});
    if(res.error)throw res.error;
    active.details=data;
    feedback('התיקונים נשמרו בכרטיס המועמד.');
    return true;
  }
  function openReview(id){
    active=items.find(x=>String(x.id)===String(id));
    if(!active)return;
    ensureModal();$('intakeReview').classList.remove('withOriginal');
    $('intakeOriginalViewer').textContent='';
    $('intakeTitle').textContent=(active.review_status==='approved'?'כרטיס קליטה':'בדיקת קליטה')+
      ' · '+String(active.details?.full_name||'ללא שם');
    const editing=active.review_status==='pending';
    renderFields(active,editing);
    const actions=$('intakeReviewActions');
    actions.innerHTML='';
    const add=(text,fn,kind='secondary')=>{
      const b=document.createElement('button');b.type='button';b.className='btn '+kind;b.textContent=text;b.onclick=fn;actions.appendChild(b);return b;
    };
    if(active.original_path)add('הצגת מקור לבדיקה',()=>openSource(active));
    if(editing){
      add('שמירת תיקוני פענוח',async()=>{try{await savePending()}catch(e){feedback('שמירת התיקונים נכשלה.',true)}},'secondary');
      add('קליטת עובד חדש',()=>openCreateApproval(),'primary');
      add('שיוך לעובד קיים',()=>openExistingApproval());
    }
    openModal('matokIntakeModal');
  }
  async function openCreateApproval(){
    try{await savePending()}catch(e){feedback('יש לשמור תחילה את תיקוני הנתונים.',true);return}
    const data=active.details||{},box=$('intakeReviewActions');
    box.innerHTML='<div style="width:100%"><h3>אישור מנהל והקמת כרטיס עובד</h3>'+
      '<p>רק לאחר אישורך ייווצר עובד פעיל. פרטי השאלון והקובץ המקורי יישארו בכרטיס.</p>'+
      '<div class="intakeRow"><label>שם מלא<input id="intakeApproveName" value="'+safe(data.full_name||'')+'"></label>'+
      '<label>טלפון<input id="intakeApprovePhone" value="'+safe(data.phone||'')+'"></label>'+
      '<label>שם משתמש (אנגלית)<input id="intakeApproveUsername" value="'+safe('matok'+String(data.phone||'').replace(/\D/g,'').slice(-6))+'"></label>'+
      '<label>תפקיד<select id="intakeApproveRole"><option>מכירה</option><option>קופה</option><option>אחראית משמרת</option></select></label>'+
      '<label>קוד כניסה חדש בן 4 ספרות<input id="intakeApprovePin" type="password" autocomplete="new-password" inputmode="numeric" maxlength="4"></label></div>'+
      '<div class="intakeModalActions"><button type="button" class="btn secondary" id="intakeApprovalBack">חזרה לבדיקה</button>'+
      '<button type="button" class="btn primary" id="intakeApproveCreate">אישור ופתיחת עובד</button></div></div>';
    if(['קופה','אחראית משמרת'].includes(data.preferred_role))$('intakeApproveRole').value=data.preferred_role;
    $('intakeApprovalBack').onclick=()=>openReview(active.id);
    $('intakeApproveCreate').onclick=async()=>{
      const name=$('intakeApproveName').value.trim(),phone=$('intakeApprovePhone').value.trim(),
        user=$('intakeApproveUsername').value.trim().toLowerCase(),pin=$('intakeApprovePin').value,
        role=$('intakeApproveRole').value,button=$('intakeApproveCreate');
      if(!name||!phone||!/^[a-z0-9._-]{4,24}$/.test(user)||!/^\d{4}$/.test(pin)){
        feedback('יש למלא שם, טלפון, שם משתמש תקין וקוד בן 4 ספרות.',true);return;
      }
      if(!confirm('לאשר את הפרטים וליצור עובד פעיל במערכת?'))return;
      button.disabled=true;
      try{
        const shift=String(active.details?.available_shifts||'');
        const friday=String(active.details?.friday||'');
        const settings={morning:!shift.includes('ערב')||shift.includes('בוקר')||shift.includes('גמיש'),
          evening:!shift.includes('בוקר')||shift.includes('ערב')||shift.includes('גמיש'),
          friday:friday.includes('כל')?'every':friday.includes('לסירוגין')?'alternate':'none',
          notes:String(active.details?.notes||'').slice(0,900)};
        const r=await supabaseClient.rpc('admin_approve_onboarding_new',{
          p_record_id:active.id,p_name:name,p_phone:phone,p_username:user,p_code:pin,p_role:role,p_settings:settings
        });
        if(r.error)throw r.error;
        feedback('העובד נוצר והפרטים נשמרו בכרטיס. אפשר להיכנס לניהול העובדים כדי להשלים משמרות.');
        closeModal('matokIntakeModal');
        await window.loadAdminData?.();
        await loadItems();
      }catch(e){console.error('approve onboarding',e);
        feedback(e.message?.includes('phone_matches_existing_employee')
          ?'מספר זה משויך לעובד קיים. יש לבחור ״שיוך לעובד קיים״ כדי להימנע מכפילות.'
          :'יצירת העובד נכשלה: '+(e?.message||'שגיאה'),true)}
      finally{button.disabled=false}
    };
  }
  async function openExistingApproval(){
    try{await savePending()}catch(e){feedback('שמירת התיקונים נכשלה.',true);return}
    const r=await supabaseClient.from('staff').select('id,full_name,phone,is_active').order('full_name');
    if(r.error){feedback('רשימת העובדים לא נטענה. בדוק הרשאות מנהל.',true);return}
    const box=$('intakeReviewActions');
    box.innerHTML='<div style="width:100%"><h3>שיוך מסמך לעובד קיים (פעיל או לא פעיל)</h3>'+
      '<p>השיוך מוסיף את פרטי הקליטה לכרטיס העובד, ללא דריסת נתונים שכבר קיימים.</p>'+
      '<select id="intakeExistingStaff"><option value="">בחר עובד</option>'+r.data.map(x=>
        '<option value="'+safe(x.id)+'">'+safe(x.full_name)+' · '+safe(x.phone)+(x.is_active?'':' · לא פעיל')+'</option>').join('')+
      '</select><div class="intakeModalActions"><button type="button" class="btn secondary" id="intakeExistingBack">חזרה</button>'+
      '<button type="button" class="btn primary" id="intakeExistingConfirm">אישור ושיוך לכרטיס העובד</button></div></div>';
    $('intakeExistingBack').onclick=()=>openReview(active.id);
    const matching=r.data.filter(x=>String(x.phone).replace(/\D/g,'')===String(active.details?.phone||'').replace(/\D/g,''));
    if(matching.length===1)$('intakeExistingStaff').value=matching[0].id;
    $('intakeExistingConfirm').onclick=async()=>{
      const target=$('intakeExistingStaff').value;
      if(!target){feedback('יש לבחור עובד.',true);return}
      if(!confirm('לשייך את הפרטים והמסמך המקורי לעובד שנבחר?'))return;
      const z=await supabaseClient.rpc('admin_link_onboarding_existing',{p_record_id:active.id,p_staff_id:target});
      if(z.error){feedback('השיוך נכשל. בדוק את פרטי העובד.',true);return}
      closeModal('matokIntakeModal');feedback('המסמך והפרטים שויכו לעובד הקיים.');await loadItems();
    };
  }
  async function showStaffProfile(staffId){
    if(!isAdmin())return;
    const linked=items.filter(x=>String(x.staff_id)===String(staffId)&&x.review_status==='approved');
    ensureModal();active=null;$('intakeReview').classList.remove('withOriginal');
    $('intakeTitle').textContent='כל פרטי הקליטה של העובד';
    $('intakeFields').innerHTML=linked.length?linked.map(item=>
      '<div class="intakeCard"><b>'+safe(item.source==='questionnaire'?'שאלון עובד':'קובץ קליטה')+
      '</b><small> · '+safe(new Date(item.created_at).toLocaleDateString('he-IL'))+'</small>'+
      KEYS.filter(([key])=>item.details?.[key]).map(([key,label])=>
        '<div class="intakeDetail"><b>'+safe(label)+':</b> '+safe(
        typeof item.details[key]==='object'?JSON.stringify(item.details[key]):item.details[key])+'</div>').join('')+
      (item.original_path?'<button class="btn secondary" type="button" data-intake-doc="'+safe(item.id)+'">פתח מסמך מקורי</button>':'')+
      '</div>').join(''):'<p>אין עדיין שאלון או קובץ קליטה המשויך לעובד הזה.</p>';
    $('intakeOriginalViewer').textContent='';$('intakeReviewActions').innerHTML='';
    $('intakeFields').querySelectorAll('[data-intake-doc]').forEach(b=>b.onclick=()=>{
      const rec=linked.find(x=>x.id===b.dataset.intakeDoc);if(rec)openSource(rec)
    });
    openModal('matokIntakeModal');
  }
  async function loadScript(src,globalName){
    if(window[globalName])return;
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=src;
      script.onload=()=>window[globalName]?resolve():reject(new Error('module_not_ready'));
      script.onerror=()=>reject(new Error('module_load_failed'));document.head.appendChild(script);
    });
  }
  async function fileText(file){
    const suffix=file.name.split('.').pop().toLowerCase();
    const data=await file.arrayBuffer();
    if(['txt','csv'].includes(suffix))return new TextDecoder('utf-8').decode(data);
    if(suffix==='xlsx'||suffix==='xls'){
      await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','XLSX');
      const wb=XLSX.read(data,{type:'array'});
      return wb.SheetNames.map(name=>name+'\n'+XLSX.utils.sheet_to_csv(wb.Sheets[name])).join('\n').slice(0,120000);
    }
    if(suffix==='docx'){
      await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js','mammoth');
      const r=await mammoth.extractRawText({arrayBuffer:data});return r.value||'';
    }
    if(suffix==='pdf'){
      await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js','pdfjsLib');
      const pdf=await pdfjsLib.getDocument({data}).promise;
      let text='';
      for(let i=1;i<=Math.min(pdf.numPages,30);i++){
        const page=await pdf.getPage(i),r=await page.getTextContent();
        text+='\n-- עמוד '+i+' --\n'+r.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('')+'\n';
      }
      if(text.trim().length<45){
        try{
          await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js','Tesseract');
          let recognized='';
          for(let pageNumber=1;pageNumber<=Math.min(pdf.numPages,3);pageNumber++){
            const page=await pdf.getPage(pageNumber),viewport=page.getViewport({scale:1.5});
            const canvas=document.createElement('canvas');
            canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
            await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
            const result=await Tesseract.recognize(canvas,'heb+eng');
            recognized+='\n-- OCR עמוד '+pageNumber+' --\n'+(result.data?.text||'');
            canvas.width=0;canvas.height=0;
          }
          text=recognized;
        }catch(err){console.warn('scanned PDF OCR fallback',err)}
        if(text.trim().length<45)throw new Error('הקובץ סרוק או לא קריא; המקור נשמר לבדיקה ידנית.');
        if(pdf.numPages>3)text+='\nנדרש להשוות למקור: OCR בוצע לשלושת העמודים הראשונים בלבד.';
      }
      return text.slice(0,120000);
    }
    if(['jpg','jpeg','png','webp'].includes(suffix)){
      await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js','Tesseract');
      const r=await Tesseract.recognize(file,'heb+eng');return r.data.text||'';
    }
    throw new Error('סוג קובץ לא נתמך');
  }
  function parseText(text){
    const src=String(text||'').replace(/\r/g,'\n'),lines=src.split(/\n/).map(x=>x.trim()).filter(Boolean);
    const patterns={
      full_name:/^(?:שם מלא|שם העובד(?:\/ת)?|שם פרטי ומשפחה|full name|employee name)\s*[:：\-]\s*(.{2,150})$/i,
      phone:/^(?:טלפון(?: נייד)?|נייד|פלאפון|מספר טלפון|phone|mobile)\s*[:：\-]\s*([+\d\s()\-]{9,22})$/i,
      email:/^(?:דוא.?ל|אימייל|email|e-mail)\s*[:：\-]\s*(.{3,180})$/i,
      city:/^(?:עיר|יישוב|מקום מגורים|city)\s*[:：\-]\s*(.{2,100})$/i,
      address:/^(?:כתובת|address)\s*[:：\-]\s*(.{2,200})$/i,
      preferred_role:/^(?:תפקיד|תפקיד מבוקש|role|position)\s*[:：\-]\s*(.{2,90})$/i,
      available_shifts:/^(?:משמרות|זמינות|שעות עבודה|availability)\s*[:：\-]\s*(.{2,300})$/i,
      friday:/^(?:יום שישי|שישי|friday)\s*[:：\-]\s*(.{2,80})$/i,
      preferred_start:/^(?:תאריך התחלה|תחילת עבודה|start date)\s*[:：\-]\s*(.{2,50})$/i,
      experience:/^(?:ניסיון|ניסיון תעסוקתי|experience)\s*[:：\-]\s*(.{2,900})$/i
    };
    const details={},confidence={},extra=[];
    for(const line of lines){
      let matched=false;
      for(const [key,pattern] of Object.entries(patterns)){
        const match=line.match(pattern);
        if(match){if(!details[key]){details[key]=match[1].trim();confidence[key]='high'}matched=true;break}
      }
      if(!matched&&/^[^\n:：]{2,48}\s*[:：]\s*\S/.test(line)){
        // Do not automatically convert identity, bank or medical identifiers.
        if(/תעודת זהות|חשבון בנק|סניף בנק|iban|תאריך לידה|מחלה|רפואי/i.test(line))continue;
        extra.push(line.slice(0,280));
      }
    }
    if(!details.phone){
      const p=src.match(/(?:\+972[\s-]?|0)5\d[\s-]?\d{3}[\s-]?\d{4}/);
      if(p){details.phone=p[0];confidence.phone='low'}
    }
    if(!details.email){
      const e=src.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
      if(e){details.email=e[0];confidence.email='low'}
    }
    if(extra.length){details.extra_fields=extra.slice(0,45).join('\n');confidence.extra_fields='low'}
    for(const key of Object.keys(patterns))if(!details[key])confidence[key]='low';
    details.notes='קובץ מקור נשמר בארכיון. נא לבדוק רק שדות שסומנו כלא ודאיים.';
    return {details,confidence};
  }
  async function importFile(file,input){
    if(!isAdmin()||!file)return;
    if(file.size===0||file.size>12*1024*1024){feedback('הקובץ ריק או גדול מ־12MB.',true);input.value='';return}
    const suffix=file.name.split('.').pop().toLowerCase();
    if(!['pdf','jpg','jpeg','png','webp','docx','xlsx','xls','txt','csv'].includes(suffix)){
      feedback('סוג קובץ אינו נתמך.',true);input.value='';return;
    }
    feedback('קורא את הקובץ המקורי ומחלץ שדות…');
    let text='',parseWarning='';
    try{text=await fileText(file)}catch(e){
      parseWarning=String(e?.message||'ניתוח נכשל');
      feedback('הקובץ יישמר במלואו, אך חילוץ הטקסט לא הושלם: '+parseWarning+' יש לבדוק במקור.',true);
    }
    const {details,confidence}=parseText(text);
    if(parseWarning){details.notes='פענוח לא הושלם: '+parseWarning;confidence.full_name='low';confidence.phone='low'}
    const ext=suffix==='jpeg'?'jpg':suffix;
    const path='private/'+crypto.randomUUID()+'.'+ext;
    const mime={pdf:'application/pdf',jpg:'image/jpeg',png:'image/png',webp:'image/webp',
      docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls:'application/vnd.ms-excel',txt:'text/plain',csv:'text/csv'}[ext];
    let uploaded=false;
    try{
      feedback('שומר קובץ מקורי בארכיון פרטי…');
      const up=await supabaseClient.storage.from(BUCKET).upload(path,file,{contentType:mime,upsert:false});
      if(up.error)throw up.error;uploaded=true;
      const reg=await supabaseClient.rpc('admin_import_onboarding_file',{
        p_details:details,p_confidence:confidence,p_text:text.slice(0,115000),
        p_path:path,p_filename:file.name.slice(0,200)
      });
      if(reg.error)throw reg.error;
      feedback('הקובץ נקלט. השדות שזוהו הופיעו לבדיקה ורק מידע לא ודאי דורש התאמה למקור.');
      input.value='';
      await loadItems();openReview(reg.data);
    }catch(e){
      console.error('import staff original',e);
      if(uploaded)await supabaseClient.storage.from(BUCKET).remove([path]);
      feedback('שמירת קובץ הקליטה נכשלה. אין לשייך עובד לפני בדיקה: '+String(e?.message||''),true);
    }
  }
  window.matokOpenOnboardingProfile=async staffId=>{
    if(!$('matokIntakeHub'))init();
    if(!items.length)await loadItems();
    await showStaffProfile(staffId);
  };
  let timer=null;
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(init,120)}).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,140),{once:true});
  else setTimeout(init,140);
})();