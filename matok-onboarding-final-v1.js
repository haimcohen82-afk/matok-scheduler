(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isAdmin=()=>{try{return appSession?.type==='admin'}catch(_){return false}};
  const BUCKET='staff-onboarding-originals';
  const KEYS=[
    ['full_name','שם מלא'],['first_name','שם פרטי'],['last_name','שם משפחה'],
    ['identity_number','תעודה מזהה'],['birth_date','תאריך לידה'],
    ['phone','טלפון'],['email','דוא״ל'],['city','עיר / יישוב'],['address','כתובת'],
    ['bank_details','חשבון בנק'],['emergency_contact','איש קשר לחירום'],
    ['preferred_role','תפקיד'],['direct_manager','ממונה ישיר/ה'],
    ['employment_scope','היקף משרה'],['pos_employee_number','מספר עובד/ת בקופה'],
    ['hourly_wage','שכר לשעה'],['preferred_start','תאריך תחילת עבודה'],
    ['payment_terms','מועד ואופן תשלום'],['weekly_rest_day','יום מנוחה שבועי'],
    ['health_fund','קופת חולים'],['available_shifts','משמרות'],['friday','שישי'],
    ['experience','ניסיון'],['notes','הערות'],['extra_fields','שדות נוספים שזוהו בקובץ']
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
    const modalStatus=$('intakeReviewStatus');const modal=$('matokIntakeModal');
    if(modalStatus&&modal?.classList.contains('show')){
      modalStatus.className='intakeState'+(error?' bad':' good');modalStatus.textContent=message;
      modalStatus.style.display='block';
    }
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
      '<div id="intakeReviewStatus" class="intakeState" style="display:none"></div>'+
      '<div class="intakeReview" id="intakeReview"><div><div id="intakeFields" class="intakeFields"></div>'+
      '<div class="intakeModalActions" id="intakeReviewActions"></div></div>'+
      '<div class="intakeOriginal" id="intakeOriginal"><h3>מסמך המקור · בדיקה לפי צורך</h3><div id="intakeOriginalViewer"></div></div></div><div id="intakeFullTextPanel" style="display:none;white-space:pre-wrap;overflow:auto;max-height:260px;background:#f6f5f0;border:1px solid #ddd;padding:10px;border-radius:10px;margin-top:9px"></div></section>';
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
      const invalidIdentity=key==='identity_number'&&value&&data.identity_valid===false;
      const doubtful=record.source==='uploaded_file'&&(confidence[key]!=='high'||!value||invalidIdentity);
      const note=invalidIdentity?' · המספר לא עבר בדיקת ת״ז':doubtful?' · לבדיקה מול המקור':'';
      return '<label class="'+(doubtful?'uncertain':'')+'">'+safe(label)+
        (note?' <small>'+safe(note)+'</small>':'')+
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
  async function showFullExtractedText(record){
    if(!record||record.source!=='uploaded_file')return;
    const panel=$('intakeFullTextPanel');
    panel.style.display='block';
    panel.textContent='טוען את הטקסט המלא שנקלט…';
    try{
      const res=await supabaseClient.rpc('admin_get_onboarding_text',{p_record_id:record.id});
      if(res.error)throw res.error;
      panel.textContent=res.data
        ?'תמלול מלא של הקובץ (פרטי מנהל בלבד):\n\n'+res.data
        :'לא נמצא טקסט קריא. יש לפתוח את הקובץ המקורי כדי לבדוק פרטים.';
    }catch(e){panel.textContent='טעינת הטקסט המלא נכשלה. נסה לפתוח את מסמך המקור.'}
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
    $('intakeFullTextPanel').style.display='none';$('intakeFullTextPanel').textContent='';
    $('intakeOriginalViewer').textContent='';
    $('intakeReviewStatus').textContent='';$('intakeReviewStatus').style.display='none';
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
    if(active.source==='uploaded_file')add('הצגת הטקסט המלא שחולץ',()=>showFullExtractedText(active));
    if(editing){
      add('שמירת תיקוני פענוח',async()=>{try{await savePending()}catch(e){feedback('שמירת התיקונים נכשלה.',true)}},'secondary');
      if(active.source==='uploaded_file')add('קליטה ישירה למערכת',()=>materializeDirect(),'primary');
      add('קליטת עובד חדש ידנית',()=>openCreateApproval(),'secondary');
      add('שיוך לעובד קיים',()=>openExistingApproval());
    }
    openModal('matokIntakeModal');
  }
  async function materializeDirect(){
    if(!active||active.review_status!=='pending')return;
    try{await savePending()}catch(e){feedback('לא ניתן לשמור את הפענוח לפני הקליטה.',true);return}
    const d=active.details||{},c=active.confidence||{};
    const missing=[];
    if(!d.full_name||c.full_name==='low')missing.push('שם מלא');
    if(!d.phone||c.phone==='low')missing.push('טלפון');
    if(d.identity_number&&d.identity_valid===false)missing.push('תעודה מזהה לא תקינה');
    if(missing.length){
      feedback('לפני קליטה ישירה צריך לבדוק מול קובץ המקור: '+missing.join(', ')+'.',true);
      if(active.original_path)await openSource(active);
      return;
    }
    const summary=[
      d.full_name,
      d.phone?'טלפון '+d.phone:'',
      d.city?'עיר '+d.city:'',
      d.preferred_start?'תחילת עבודה '+d.preferred_start:'',
      d.hourly_wage?'שכר '+d.hourly_wage+' ₪ לשעה':''
    ].filter(Boolean).join('\n');
    if(!confirm('להקים את העובד ישירות במערכת ללא הקלדה מחדש?\n\n'+summary))return;
    const actions=$('intakeReviewActions');
    const buttons=[...actions.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
    try{
      feedback('מקים כרטיס עובד, פרופיל מנהל ונתוני שכר…');
      const r=await supabaseClient.rpc('admin_materialize_onboarding_employee',{p_record_id:active.id});
      if(r.error)throw r.error;
      const result=r.data||{};
      const credentials='שם משתמש: '+String(result.username||'')+'\nקוד כניסה: '+String(result.pin||'');
      actions.innerHTML='<div class="intakeState good" style="width:100%"><b>העובד נקלט ישירות במערכת.</b><br>'+
        safe(result.full_name||d.full_name)+'<br>'+
        (result.hourly_rate!=null?'שכר לשעה: '+safe(result.hourly_rate)+' ₪<br>':'')+
        (result.employment_start?'תחילת עבודה: '+safe(result.employment_start)+'<br>':'')+
        '<textarea id="intakeNewCredentials" readonly style="width:100%;margin-top:8px">'+safe(credentials)+'</textarea>'+
        '<button type="button" class="btn secondary" id="intakeCopyCredentials">העתקת פרטי כניסה</button></div>';
      $('intakeCopyCredentials').onclick=async()=>{
        const value=$('intakeNewCredentials').value;
        try{await navigator.clipboard.writeText(value);feedback('פרטי הכניסה הועתקו.')}
        catch(_){$('intakeNewCredentials').select();feedback('פרטי הכניסה מסומנים להעתקה.')}
      };
      await window.loadAdminData?.();
      await loadItems();
      active=items.find(x=>String(x.id)===String(active.id))||active;
    }catch(e){
      console.error('direct employee materialization',e);
      const msg=String(e?.message||'');
      feedback(msg.includes('phone_matches_existing_employee')
        ?'הטלפון כבר קיים במערכת. השתמש ב״שיוך לעובד קיים״ כדי למנוע כפילות.'
        :msg.includes('identity_requires_review')
          ?'התעודה המזהה דורשת בדיקה מול המקור לפני יצירת העובד.'
          :'הקליטה הישירה נכשלה: '+msg,true);
      buttons.forEach(b=>b.disabled=false);
    }
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
    let privateProfile={};
    try{
      const profile=await supabaseClient.rpc('admin_get_staff_private_profile',{p_staff_id:staffId});
      if(!profile.error)privateProfile=profile.data||{};
    }catch(e){console.warn('private staff profile',e)}
    ensureModal();active=null;$('intakeReview').classList.remove('withOriginal');
    $('intakeFullTextPanel').style.display='none';$('intakeFullTextPanel').textContent='';
    $('intakeTitle').textContent='כל פרטי העובד · מנהל בלבד';
    const labels={
      first_name:'שם פרטי',last_name:'שם משפחה',identity_type:'סוג תעודה',
      identity_number:'תעודה מזהה',email:'דוא״ל',city:'עיר / יישוב',
      address:'כתובת',birth_date:'תאריך לידה',preferred_start:'תאריך התחלה',
      bank_details:'חשבון בנק',emergency_contact:'איש קשר לחירום',
      direct_manager:'ממונה ישיר/ה',employment_scope:'היקף משרה',
      pos_employee_number:'מספר עובד/ת בקופה',hourly_wage:'שכר לשעה',
      payment_terms:'מועד ואופן תשלום',weekly_rest_day:'יום מנוחה שבועי',
      health_fund:'קופת חולים'
    };
    const profileRows=Object.entries(labels).filter(([key])=>privateProfile?.[key]).map(([key,label])=>{
      const suffix=key==='identity_number'&&privateProfile.identity_valid===false
        ?' <small>· דורש אימות מול המקור</small>':'';
      return '<div class="intakeDetail"><b>'+safe(label)+':</b> '+safe(privateProfile[key])+suffix+'</div>';
    }).join('');
    const profileCard='<div class="intakeCard"><b>פרטי עובד מרוכזים</b><small> · פרטי מנהל בלבד</small>'+
      (profileRows||'<p>טרם נשמר פרופיל פרטי מרוכז לעובד זה.</p>')+'</div>';
    const history=linked.length?linked.map(item=>
      '<div class="intakeCard"><b>'+safe(item.source==='questionnaire'?'שאלון עובד':'קובץ קליטה')+
      '</b><small> · '+safe(new Date(item.created_at).toLocaleDateString('he-IL'))+'</small>'+
      KEYS.filter(([key])=>item.details?.[key]).map(([key,label])=>
        '<div class="intakeDetail"><b>'+safe(label)+':</b> '+safe(
        typeof item.details[key]==='object'?JSON.stringify(item.details[key]):item.details[key])+'</div>').join('')+
      (item.original_path?'<button class="btn secondary" type="button" data-intake-doc="'+safe(item.id)+'">פתח מסמך מקורי</button><button class="btn secondary" type="button" data-intake-text="'+safe(item.id)+'">הצג את כל הטקסט שנקלט</button>':'')+
      '</div>').join(''):'<p>אין עדיין שאלון או קובץ קליטה המשויך לעובד הזה.</p>';
    $('intakeFields').innerHTML=profileCard+'<h3>היסטוריית קליטה ומקורות</h3>'+history;
    $('intakeOriginalViewer').textContent='';$('intakeReviewActions').innerHTML='';
    $('intakeFields').querySelectorAll('[data-intake-text]').forEach(b=>b.onclick=()=>{
      const rec=linked.find(x=>x.id===b.dataset.intakeText);if(rec)showFullExtractedText(rec)
    });
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
  async function matokTemplateNumericPass(pdf,recognized){
    if(!/(?:טופס\s+קליטת\s+עובד|כרטיס\s+עובד)/i.test(recognized||''))return recognized;
    try{
      const page=await pdf.getPage(1),viewport=page.getViewport({scale:3});
      const canvas=document.createElement('canvas');
      canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
      await page.render({canvasContext:ctx,viewport}).promise;
      async function cropOcr(box){
        const [x1,y1,x2,y2]=box;
        const sx=Math.round(canvas.width*x1),sy=Math.round(canvas.height*y1);
        const sw=Math.max(1,Math.round(canvas.width*(x2-x1))),sh=Math.max(1,Math.round(canvas.height*(y2-y1)));
        const crop=document.createElement('canvas');crop.width=sw;crop.height=sh;
        const c=crop.getContext('2d',{willReadFrequently:true});
        c.fillStyle='#fff';c.fillRect(0,0,sw,sh);c.drawImage(canvas,sx,sy,sw,sh,0,0,sw,sh);
        const r=await Tesseract.recognize(crop,'eng');
        crop.width=0;crop.height=0;
        return String(r.data?.text||'').replace(/\s+/g,' ').trim();
      }
      const id=await cropOcr([0.576,0.181,0.792,0.209]);
      const birth=await cropOcr([0.576,0.207,0.792,0.235]);
      const phone=await cropOcr([0.576,0.254,0.792,0.282]);
      const pos=await cropOcr([0.576,0.475,0.792,0.508]);
      const fields=[];
      const idMatch=id.match(/(?<!\d)(\d{9})(?!\d)/);if(idMatch)fields.push('תעודת זהות: '+idMatch[1]);
      const birthMatch=birth.match(/\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}/);if(birthMatch)fields.push('תאריך לידה: '+birthMatch[0]);
      const phoneMatch=phone.match(/0\d{8,10}/);if(phoneMatch)fields.push('טלפון נייד: '+phoneMatch[0]);
      const posMatch=pos.match(/\d{3,9}/);if(posMatch)fields.push('מספר עובד/ת בקופה: '+posMatch[0]);
      canvas.width=0;canvas.height=0;
      return fields.length?(recognized+'\n-- MATOK FIELD PASS --\n'+fields.join('\n')):recognized;
    }catch(error){
      console.warn('MATOK numeric field pass',error);
      return recognized;
    }
  }

  async function fileText(file){
    const suffix=file.name.split('.').pop().toLowerCase();
    const data=await file.arrayBuffer();
    if(['txt','csv'].includes(suffix))return new TextDecoder('utf-8').decode(data);
    if(suffix==='xlsx'||suffix==='xls'){
      await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','XLSX');
      const wb=XLSX.read(data,{type:'array'});
      return wb.SheetNames.map(name=>'-- גיליון '+name+' --\n'+
        XLSX.utils.sheet_to_csv(wb.Sheets[name],{FS:'\t',RS:'\n',blankrows:false}))
        .join('\n').slice(0,120000);
    }
    if(suffix==='docx'){
      await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js','mammoth');
      const r=await mammoth.extractRawText({arrayBuffer:data});return r.value||'';
    }
    if(suffix==='pdf'){
      await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js','pdfjsLib');
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
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
          const ocrPages=Math.min(pdf.numPages,3);
          for(let pageNumber=1;pageNumber<=ocrPages;pageNumber++){
            const page=await pdf.getPage(pageNumber);
            const scale=pageNumber<=2?3.0:2.0;
            const viewport=page.getViewport({scale});
            const canvas=document.createElement('canvas');
            canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
            const ctx=canvas.getContext('2d',{willReadFrequently:true});
            ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
            await page.render({canvasContext:ctx,viewport}).promise;
            const result=await Tesseract.recognize(canvas,'heb+eng');
            recognized+='\n-- OCR עמוד '+pageNumber+' --\n'+(result.data?.text||'');
            canvas.width=0;canvas.height=0;
          }
          recognized=await matokTemplateNumericPass(pdf,recognized);
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
  const normalizeHeader=value=>String(value??'').toLowerCase()
    .replace(/[\u0591-\u05c7]/g,'').replace(/[״”"']/g,'').replace(/[._/\\()-]/g,' ')
    .replace(/\s+/g,' ').trim();

  const HEADER_ALIASES={
    full_name:['שם מלא','שם העובד','שם עובד','עובד','שם פרטי ומשפחה','full name','employee name','name'],
    first_name:['שם פרטי','פרטי','first name','firstname'],
    last_name:['שם משפחה','משפחה','last name','lastname','surname'],
    identity_number:['תעודת זהות','תז','ת ז','מספר זהות','מס תז','מס ת ז','תעודה מזהה','מספר תעודה','id number','identity number','identity','id'],
    phone:['טלפון','טלפון נייד','נייד','פלאפון','מספר טלפון','phone','mobile','cellphone'],
    email:['דואל','אימייל','מייל','email','e mail'],
    city:['עיר','יישוב','ישוב','מקום מגורים','עיר מגורים','city','town'],
    address:['כתובת','רחוב וכתובת','address','street address'],
    birth_date:['תאריך לידה','לידה','date of birth','birth date','dob'],
    preferred_role:['תפקיד','תפקיד מבוקש','תפקיד בעבודה','role','position','job'],
    available_shifts:['משמרות','זמינות','שעות עבודה','זמינות לעבודה','availability','shifts'],
    friday:['יום שישי','שישי','friday'],
    preferred_start:['תאריך התחלה','תחילת עבודה','מועד התחלה','start date','employment start'],
    experience:['ניסיון','ניסיון תעסוקתי','וותק','experience']
  };
  const HEADER_LOOKUP=(()=>{
    const map=new Map();
    Object.entries(HEADER_ALIASES).forEach(([key,aliases])=>aliases.forEach(a=>map.set(normalizeHeader(a),key)));
    return map;
  })();
  const headerKey=value=>{
    const norm=normalizeHeader(value);
    return HEADER_LOOKUP.get(norm)||'';
  };
  const cleanIdentity=value=>String(value??'').replace(/[^0-9A-Za-z]/g,'').trim();
  function validIsraeliId(value){
    const id=String(value??'').replace(/\D/g,'').padStart(9,'0');
    if(!/^\d{9}$/.test(id))return false;
    let sum=0;
    for(let i=0;i<9;i++){
      let n=Number(id[i])*(i%2?2:1);
      if(n>9)n-=9;
      sum+=n;
    }
    return sum%10===0;
  }
  function parseDelimitedLine(line,delimiter){
    const values=[];let current='',quoted=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){
        if(quoted&&line[i+1]==='"'){current+='"';i++}
        else quoted=!quoted;
      }else if(ch===delimiter&&!quoted){values.push(current.trim());current=''}
      else current+=ch;
    }
    values.push(current.trim());
    return values;
  }
  function bestDelimiter(line){
    const candidates=['\t',';',','];
    let best='',count=0;
    for(const d of candidates){
      const n=parseDelimitedLine(line,d).length;
      if(n>count){best=d;count=n}
    }
    return count>=2?best:'';
  }
  function finalizeDetails(details,confidence={}){
    const d={...details},c={...confidence};
    if(!d.full_name&&d.first_name){
      d.full_name=[d.first_name,d.last_name].filter(Boolean).join(' ').trim();
      if(d.full_name)c.full_name=c.first_name==='high'&&(!d.last_name||c.last_name==='high')?'high':'medium';
    }
    if(d.full_name&&(!d.first_name||!d.last_name)){
      const parts=String(d.full_name).trim().split(/\s+/).filter(Boolean);
      if(parts.length>=2){
        if(!d.first_name){d.first_name=parts.shift();c.first_name='medium'}
        if(!d.last_name){d.last_name=parts.join(' ');c.last_name='medium'}
      }
    }
    if(d.identity_number){
      const cleaned=cleanIdentity(d.identity_number);
      d.identity_number=cleaned;
      d.identity_type=d.identity_type||(/^\d{9}$/.test(cleaned)?'תעודת זהות':'תעודה מזהה');
      if(/^\d{9}$/.test(cleaned)){
        d.identity_valid=validIsraeliId(cleaned);
        c.identity_number=d.identity_valid?'high':'low';
      }else{
        d.identity_valid=null;
        c.identity_number=c.identity_number==='high'?'medium':(c.identity_number||'medium');
      }
    }
    if(d.phone)d.phone=String(d.phone).replace(/[^\d+() -]/g,'').trim();
    d.notes=d.notes||'קובץ מקור נשמר בארכיון. יש לבדוק רק שדות שסומנו כלא ודאיים.';
    for(const [key] of KEYS)if(!(key in c))c[key]=d[key]?'medium':'low';
    return {details:d,confidence:c};
  }
  function parseTableRows(src){
    const lines=String(src||'').replace(/\r/g,'\n').split(/\n/).map(x=>x.trim()).filter(Boolean);
    const out=[];let headerKeys=null,delimiter='',headerSignature='';
    for(const line of lines){
      if(/^-- .* --$/.test(line)){headerKeys=null;delimiter='';continue}
      const d=bestDelimiter(line);
      if(d){
        const cells=parseDelimitedLine(line,d);
        const mapped=cells.map(headerKey);
        const meaningful=mapped.filter(Boolean).length;
        const identity=mapped.some(x=>['full_name','first_name','last_name','identity_number','phone'].includes(x));
        if(meaningful>=2&&identity){
          headerKeys=mapped;delimiter=d;headerSignature=mapped.join('|');
          continue;
        }
      }
      if(!headerKeys||!delimiter)continue;
      const cells=parseDelimitedLine(line,delimiter);
      if(cells.filter(Boolean).length<1)continue;
      const remapped=cells.map(headerKey);
      if(remapped.filter(Boolean).length>=2&&remapped.join('|')===headerSignature)continue;
      const details={},confidence={};
      headerKeys.forEach((key,index)=>{
        if(!key||!cells[index])return;
        if(details[key])return;
        details[key]=cells[index].trim();confidence[key]='high';
      });
      const final=finalizeDetails(details,confidence);
      const d0=final.details;
      if(d0.full_name||d0.identity_number||d0.phone)out.push(final);
      if(out.length>=200)break;
    }
    const seen=new Set();
    return out.filter(row=>{
      const d=row.details||{};
      const key=[d.identity_number||'',String(d.phone||'').replace(/\D/g,''),normalizeHeader(d.full_name||'')].join('|');
      if(!key.replace(/\|/g,''))return false;
      if(seen.has(key))return false;
      seen.add(key);return true;
    });
  }
  function parseLabeledText(text){
    const src=String(text||'')
      .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'')
      .replace(/\r/g,'\n');
    const details={},confidence={},extra=[];
    const page1=(src.split(/-- OCR עמוד 2 --/i)[0]||src);
    const page2=(src.match(/-- OCR עמוד 2 --([\s\S]*?)(?:-- OCR עמוד 3 --|$)/i)?.[1]||src);
    const template=(src.match(/-- MATOK FIELD PASS --([\s\S]*)$/i)?.[1]||'');

    const set=(key,value,level='high',overwrite=false)=>{
      value=String(value??'').replace(/\s+/g,' ').trim().replace(/[.;,:-]+$/,'').trim();
      if(!value)return;
      if(overwrite||!details[key]){details[key]=value;confidence[key]=level}
    };
    const pick=(key,regex,level='high',source=src,overwrite=false)=>{
      const m=source.match(regex);if(m?.[1])set(key,m[1],level,overwrite);
    };

    // First page: personal data. Accept label + whitespace because generated PDFs
    // and OCR do not reliably preserve colons/table borders.
    pick('full_name',/(?:^|\n)\s*שם מלא\s*[:：\-]?\s*([^\n]{2,150})/i,'high',page1);
    pick('first_name',/(?:^|\n)\s*שם פרטי\s*[:：\-]?\s*([^\n]{1,100})/i,'high',page1);
    pick('last_name',/(?:^|\n)\s*שם משפחה\s*[:：\-]?\s*([^\n]{1,100})/i,'high',page1);
    pick('birth_date',/(?:^|\n)\s*תאריך לידה\s*[:：\-]?\s*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i,'high',page1);
    pick('address',/(?:^|\n)\s*כתובת\s*[:：\-]?\s*([^\n]{3,250})/i,'high',page1);
    pick('email',/(?:^|\n)\s*(?:אימייל|דוא.?ל|מייל)\s*[:：\-]?\s*([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/i,'high',page1);
    pick('bank_details',/(?:^|\n)\s*חשבון בנק\s*[:：\-]?\s*([^\n]{3,300})/i,'low',page1);
    pick('emergency_contact',/(?:^|\n)\s*איש קשר לחירום\s*[:：\-]?\s*([^\n]{3,300})/i,'medium',page1);
    pick('health_fund',/קופת חולים\s*[:：\-]?\s*([^\n]{2,100})/i,'medium',page1);

    // OCR frequently reverses/loses the identity label, so choose the first valid
    // Israeli 9-digit ID from the personal-data area. A checksum match is high confidence.
    if(!details.identity_number){
      const candidates=[...page1.matchAll(/(?<!\d)(\d{9})(?!\d)/g)].map(m=>m[1]);
      const identity=candidates.find(validIsraeliId);
      if(identity)set('identity_number',identity,'high');
    }

    if(!details.phone){
      const p=page1.match(/(?:\+972[\s-]?|0)5\d[\s-]?\d{3}[\s-]?\d{4}/);
      if(p)set('phone',p[0],'high');
    }
    if(!details.email){
      const e=page1.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/i);
      if(e)set('email',e[0],'medium');
    }
    if(template){
      pick('identity_number',/תעודת זהות\s*[:：\-]?\s*(\d{9})/i,'high',template,true);
      pick('birth_date',/תאריך לידה\s*[:：\-]?\s*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4})/i,'high',template,true);
      pick('phone',/טלפון נייד\s*[:：\-]?\s*(0\d{8,10})/i,'high',template,true);
      pick('pos_employee_number',/מספר עובד\/?ת בקופה\s*[:：\-]?\s*(\d{3,9})/i,'high',template,true);
    }

    // Employment agreement on page 2 repeats core employment values as sentences and
    // is materially more reliable than the compact table on page 1. Prefer page 2.
    pick('preferred_start',/תאריך תחילת העבודה\s*[:：\-]?\s*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4})/i,'high',page2,true);
    pick('preferred_role',/(?:תיאור\s+)?התפקיד(?:\s+העיקרי)?\s*[:：\-]?\s*([^\n.]{2,120})/i,'high',page2,true);
    pick('direct_manager',/הממונה\s+(?:ה)?(?:ישיר\/?ה|יששיר\/?ה|ישיר)\s*[:：\-]?\s*([^\n.]{2,100})/i,'high',page2,true);
    pick('employment_scope',/היקף המשרה\s*[:：\-]?\s*([^\n.]{2,220})/i,'high',page2,true);
    pick('pos_employee_number',/מספר עובד\/?ת בקופה\s*[:：\-]?\s*(\d{3,9})/i,'high',page2,true);
    pick('hourly_wage',/(?:שכר יסוד|שכר לשעה(?:\s*\(ברוטו\))?)\s*[:：\-]?\s*(\d+(?:[.,]\d+)?)\s*₪?/i,'high',page2,true);
    pick('payment_terms',/מועד(?:\s+ואופן)?\s+התשלום\s*[:：\-]?\s*([^\n.]{4,220})/i,'high',page2,true);
    {
      const rest=page2.match(/יום\s+(?:המנוחה|מנוחה)\s+השבועי\s*[:：\-]?\s*([^\n.]{2,60})/i)?.[1]?.trim();
      if(rest&&/^(?:שבת|ראשון|שני|שלישי|רביעי|חמישי|שישי)(?:\s|$)/.test(rest))set('weekly_rest_day',rest,'high',true);
    }

    // Fallbacks when the agreement page is absent.
    pick('preferred_start',/(?:^|\n)\s*תאריך תחילת עבודה\s*[:：\-]?\s*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4})/i,'medium',src);
    pick('preferred_role',/(?:^|\n)\s*תפקיד\s*[:：\-]?\s*([^\n]{2,120})/i,'medium',src);
    pick('direct_manager',/(?:^|\n)\s*ממונה [^:\n]*\s*[:：\-]?\s*([^\n]{2,100})/i,'medium',src);
    pick('employment_scope',/(?:^|\n)\s*היקף משרה\s*[:：\-]?\s*([^\n]{2,220})/i,'medium',src);
    pick('pos_employee_number',/(?:^|\n)\s*מספר עובד\/?ת בקופה\s*[:：\-]?\s*(\d{3,9})/i,'medium',src);
    pick('hourly_wage',/(?:^|\n)\s*שכר לשעה[^0-9\n]*(\d+(?:[.,]\d+)?)/i,'low',src);
    pick('payment_terms',/(?:^|\n)\s*מועד(?:\s+ואופן)?\s+תשלום\s*[:：\-]?\s*([^\n]{4,220})/i,'medium',src);
    {
      const rest=src.match(/(?:^|\n)\s*יום מנוחה שבועי\s*[:：\-]?\s*([^\n]{2,60})/i)?.[1]?.trim();
      if(rest&&/^(?:שבת|ראשון|שני|שלישי|רביעי|חמישי|שישי)(?:\s|$)/.test(rest))set('weekly_rest_day',rest,'medium');
    }

    // Standard MATOK form writes "city street number" in the address row.
    if(!details.city&&details.address){
      const parts=String(details.address).trim().split(/\s+/);
      if(parts.length>=3&&/^[\u0590-\u05ff'-]{2,}$/.test(parts[0])&&/\d/.test(parts.join(' '))){
        set('city',parts[0],'medium');
      }
    }

    // Preserve useful labeled fields not mapped above, but never auto-import medical
    // or bank-account fragments into arbitrary extras.
    for(const raw of src.split(/\n/)){
      const line=raw.trim();
      if(!/^[^\n:：]{2,48}\s*[:：]\s*\S/.test(line))continue;
      if(/חשבון בנק|סניף בנק|iban|מחלה|רפואי|אבחון/i.test(line))continue;
      const already=Object.values(details).some(v=>String(v||'')&&line.includes(String(v)));
      if(!already)extra.push(line.slice(0,280));
    }
    if(extra.length){details.extra_fields=extra.slice(0,45).join('\n');confidence.extra_fields='low'}

    return finalizeDetails(details,confidence);
  }
  function parseEmployeeRows(text){
    const rows=parseTableRows(text);
    return rows.length?rows:[parseLabeledText(text)];
  }
  function parseText(text){return parseEmployeeRows(text)[0]}

  function canAutoMaterialize(row){
    const d=row?.details||{},c=row?.confidence||{};
    if(!d.full_name||!d.phone)return false;
    if(c.full_name!=='high'||c.phone!=='high')return false;
    if(d.identity_number&&(d.identity_valid!==true||c.identity_number!=='high'))return false;
    return true;
  }
  function showAutoCreatedEmployees(results){
    const holder=$('intakeGenerated');if(!holder||!results.length)return;
    holder.innerHTML='<div class="intakeState good"><b>עובדים שנקלטו ישירות במערכת</b><p>הפרטים נבנו מהקובץ ללא הקלדה. שמור את פרטי הכניסה ושלח לעובד לפי הצורך.</p>'+
      results.map(r=>'<div class="intakeCard"><b>'+safe(r.full_name||'עובד')+'</b>'+
        '<div>שם משתמש: <code>'+safe(r.username||'')+'</code> · קוד: <code>'+safe(r.pin||'')+'</code></div>'+
        (r.hourly_rate!=null?'<small>שכר לשעה: '+safe(r.hourly_rate)+' ₪</small>':'')+
        (r.employment_start?'<small> · תחילת עבודה: '+safe(r.employment_start)+'</small>':'')+
        '</div>').join('')+
      '<button type="button" class="btn secondary" id="intakeCopyAllCredentials">העתקת כל פרטי הכניסה</button></div>';
    $('intakeCopyAllCredentials').onclick=async()=>{
      const text=results.map(r=>(r.full_name||'עובד')+'\nשם משתמש: '+(r.username||'')+'\nקוד: '+(r.pin||'')).join('\n\n');
      try{await navigator.clipboard.writeText(text);feedback('פרטי הכניסה הועתקו.')}
      catch(_){feedback('העתקה אוטומטית לא זמינה; פרטי הכניסה מוצגים על המסך.',true)}
    };
  }

  async function importFile(file,input){
    if(!isAdmin()||!file)return;
    if(file.size===0||file.size>12*1024*1024){feedback('הקובץ ריק או גדול מ־12MB.',true);input.value='';return}
    const suffix=file.name.split('.').pop().toLowerCase();
    if(!['pdf','jpg','jpeg','png','webp','docx','xlsx','xls','txt','csv'].includes(suffix)){
      feedback('סוג קובץ אינו נתמך.',true);input.value='';return;
    }
    feedback('קורא את הקובץ ומפרק אותו לשדות עובדים…');
    let text='',parseWarning='';
    try{text=await fileText(file)}catch(e){
      parseWarning=String(e?.message||'ניתוח נכשל');
      feedback('הקובץ יישמר במלואו, אך הפענוח דורש בדיקה מול המקור: '+parseWarning,true);
    }
    let rows=parseEmployeeRows(text);
    if(parseWarning){
      rows=rows.length?rows:[finalizeDetails({notes:'פענוח לא הושלם: '+parseWarning},{full_name:'low',phone:'low'})];
      rows.forEach(row=>{
        row.details.notes='פענוח לא הושלם במלואו: '+parseWarning;
        row.confidence.full_name=row.confidence.full_name||'low';
        row.confidence.phone=row.confidence.phone||'low';
      });
    }
    const ext=suffix==='jpeg'?'jpg':suffix;
    const path='private/'+crypto.randomUUID()+'.'+ext;
    const mime={pdf:'application/pdf',jpg:'image/jpeg',png:'image/png',webp:'image/webp',
      docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls:'application/vnd.ms-excel',txt:'text/plain',csv:'text/csv'}[ext];
    let uploaded=false;
    try{
      feedback('שומר את קובץ המקור בארכיון פרטי…');
      const up=await supabaseClient.storage.from(BUCKET).upload(path,file,{contentType:mime,upsert:false});
      if(up.error)throw up.error;uploaded=true;

      let ids=[];
      if(rows.length>1){
        const reg=await supabaseClient.rpc('admin_import_onboarding_batch',{
          p_rows:rows,p_text:text.slice(0,115000),p_path:path,p_filename:file.name.slice(0,200)
        });
        if(reg.error)throw reg.error;
        ids=reg.data||[];
      }else{
        const row=rows[0]||finalizeDetails({},{});
        const reg=await supabaseClient.rpc('admin_import_onboarding_file',{
          p_details:row.details,p_confidence:row.confidence,p_text:text.slice(0,115000),
          p_path:path,p_filename:file.name.slice(0,200)
        });
        if(reg.error)throw reg.error;
        ids=reg.data?[reg.data]:[];
      }
      if(!ids.length)throw new Error('לא נמצאו שורות עובד לשמירה');

      const created=[],reviewIds=[];
      for(let i=0;i<ids.length;i++){
        const row=rows[i]||rows[0];
        if(!parseWarning&&canAutoMaterialize(row)){
          const materialized=await supabaseClient.rpc('admin_materialize_onboarding_employee',{p_record_id:ids[i]});
          if(!materialized.error&&materialized.data?.created){
            created.push(materialized.data);continue;
          }
          console.warn('direct materialization deferred',materialized.error);
        }
        reviewIds.push(ids[i]);
      }

      input.value='';
      if(created.length)await window.loadAdminData?.();
      await loadItems();
      if(created.length)showAutoCreatedEmployees(created);
      feedback(
        created.length+' עובד/ים נקלטו ישירות במערכת'+
        (reviewIds.length?' · '+reviewIds.length+' רשומה/ות דורשות בדיקה מול המקור.':' · אין צורך בהקלדה ידנית.')
      );
      if(reviewIds.length===1)openReview(reviewIds[0]);
    }catch(e){
      console.error('import staff original',e);
      if(uploaded)await supabaseClient.storage.from(BUCKET).remove([path]);
      feedback('שמירת קובץ הקליטה נכשלה. אין להקליד הכול מחדש; נסה שוב או פתח את המקור לבדיקה: '+String(e?.message||''),true);
    }
  }

  // Pure parser exposed for verification; it has no database or file access.
  window.matokOnboardingParseText=parseText;
  window.matokOnboardingParseRows=parseEmployeeRows;
  window.matokValidateIsraeliId=validIsraeliId;
  window.matokCanAutoMaterialize=canAutoMaterialize;
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