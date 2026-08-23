(() => {
  'use strict';
  const VERSION='20260823-employee-final-1';
  let installedFor='';
  let ctx=null;
  let availRows=[];
  let availStates={};
  let generalNote='';

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const days=[['sun','ראשון'],['mon','שני'],['tue','שלישי'],['wed','רביעי'],['thu','חמישי']];
  const slotNames={
    'sun-am':'ראשון · בוקר','sun-pm':'ראשון · ערב','mon-am':'שני · בוקר','mon-pm':'שני · ערב',
    'tue-am':'שלישי · בוקר','tue-pm':'שלישי · ערב','wed-am':'רביעי · בוקר','wed-pm':'רביעי · ערב',
    'thu-am':'חמישי · בוקר','thu-pm':'חמישי · ערב','fri':'שישי'
  };
  const isEmployee=()=>{try{return appSession?.type==='employee'}catch(_){return false}};
  const session=()=>appSession;
  const toast2=msg=>{try{if(typeof toast==='function')return toast(msg)}catch(_){} const x=document.getElementById('epToast');if(!x)return; x.textContent=msg;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2200)};
  const isoDate=(s,n=0)=>{const d=new Date(String(s)+'T12:00:00');d.setDate(d.getDate()+n);return d};
  const fmt=d=>d.toLocaleDateString('he-IL',{day:'numeric',month:'numeric'});
  const weekRange=s=>`${fmt(isoDate(s,0))}–${fmt(isoDate(s,5))}`;
  const dayGreeting=()=>{const h=new Date().getHours();return h<12?'בוקר טוב':h<18?'צהריים טובים':'ערב טוב'};

  function addStyles(){
    if(document.getElementById('epFinalStyles'))return;
    const s=document.createElement('style');s.id='epFinalStyles';s.textContent=`
      body.epFinal .notice,body.epFinal .top .switch{display:none!important}
      body.epFinal .wrap{max-width:760px;padding:12px 12px 90px}
      body.epFinal #worker{display:block!important}
      .epHomeHero{background:linear-gradient(145deg,#1a1a2e,#252844);color:#fff;border-radius:24px;padding:24px 20px;margin-bottom:18px;box-shadow:0 16px 34px #1a1a2e25;position:relative;overflow:hidden}
      .epHomeHero:after{content:"";position:absolute;width:170px;height:170px;border-radius:50%;left:-65px;top:-72px;background:#ffffff0b;border:1px solid #ffffff12}
      .epHomeHero small{opacity:.7;font-weight:800}.epHomeHero h1{margin:3px 0 5px;font-size:30px}.epHomeHero p{margin:0;color:#ffffffc8}
      .epQuestion{font-size:19px;font-weight:900;margin:4px 2px 13px}.epGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:13px}
      .epAction{border:0;background:transparent;padding:0;text-align:center;color:var(--ink)}
      .epCircle{width:112px;height:112px;border-radius:50%;margin:auto;display:grid;place-items:center;background:#fff;border:1px solid var(--line);box-shadow:0 10px 25px #1a1a2e0d;transition:.12s}
      .epAction:active .epCircle{transform:scale(.97)}.epCircle svg{width:42px;height:42px}.epAction b{display:block;font-size:14px;margin-top:8px}.epAction small{display:block;color:var(--muted);font-size:10px;line-height:1.35;margin-top:2px}
      .epSchedule .epCircle{background:#e9f7f4;color:#24695f}.epAvailability .epCircle{background:#fff0e8;color:#8c4332}.epReport .epCircle{background:#f6e9f9;color:#704578}.epData .epCircle{background:#eef3fb;color:#3f6488}.epMessages .epCircle{background:#fff4d7;color:#80631e}.epLogout .epCircle{background:#f5f3ef;color:#6f685f}
      .epView{display:none}.epView.active{display:block}.epTopbar{position:sticky;top:70px;z-index:25;background:rgba(245,240,232,.97);backdrop-filter:blur(8px);display:flex;align-items:center;gap:10px;padding:8px 0 11px;border-bottom:1px solid #ded9d177;margin-bottom:12px}
      .epBack{border:1px solid var(--line);background:#fff;border-radius:14px;padding:10px 14px;font-weight:900}.epTopbar h2{margin:0;font-size:21px}.epTopbar p{margin:2px 0 0;color:var(--muted);font-size:11px}
      .epCard{background:#fff;border:1px solid var(--line);border-radius:17px;padding:14px;margin-bottom:11px;box-shadow:0 7px 20px #1a1a2e08}.epCard h3{margin:0 0 7px}.epMuted{color:var(--muted);font-size:12px}
      .epScheduleRow{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px;border:1px solid #b9d9bd;background:#eef8ef;border-radius:11px;margin-top:8px}.epBadge{border-radius:999px;padding:5px 8px;background:#dff0df;font-size:10px;font-weight:900}
      .epAvailDay{background:#fff;border:1px solid var(--line);border-radius:15px;padding:11px;margin-bottom:9px}.epAvailDay>header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.epAvailShift{border-top:1px solid var(--line);padding:10px 0}.epAvailShift:first-of-type{border-top:0}.epChoices{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:7px}.epChoices button{border:1px solid var(--line);background:#fff;border-radius:9px;padding:8px 3px;font-size:10px;font-weight:800}.epChoices button.on.available{background:#eaf6ea;border-color:#7cad82}.epChoices button.on.preferred{background:#fff1c9;border-color:#c9a34a}.epChoices button.on.unavailable{background:#fff0ed;border-color:#cc8177}
      .epPrimary{width:100%;border:0;border-radius:12px;padding:13px;background:var(--coral);font-weight:900}.epSecondary{width:100%;border:1px solid var(--line);border-radius:12px;padding:11px;background:#fff;font-weight:900}.epForm{display:grid;gap:9px}.epForm label{display:grid;gap:5px;font-size:11px;font-weight:800}.epForm input,.epForm textarea,.epForm select{width:100%;border:1px solid var(--line);border-radius:10px;padding:10px;background:#fff}
      .epTabs{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:10px}.epTabs button{border:1px solid var(--line);background:#fff;border-radius:10px;padding:9px;font-size:11px;font-weight:900}.epTabs button.active{background:var(--ink);color:#fff}
      .epDoc,.epHours,.epMsg{border:1px solid var(--line);border-radius:12px;padding:11px;background:var(--soft);margin-top:8px}.epDocHead,.epMsgHead{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.epDoc b,.epHours b,.epMsg b{display:block}.epFacts{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.epFacts span{background:#fff;border:1px solid var(--line);border-radius:999px;padding:5px 7px;font-size:10px}.epReply{margin-top:8px;padding:9px;background:#eef9f6;border-right:4px solid var(--teal);border-radius:9px}.epStatus{font-size:9px;font-weight:900;border-radius:999px;padding:4px 7px;background:#ece8e1;white-space:nowrap}.epStatus.reply{background:#e1f2e3;color:#35683a}.epStatus.view{background:#e6eff9;color:#355f87}
      #epToast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%) translateY(10px);opacity:0;transition:.18s;background:#1a1a2e;color:#fff;border-radius:11px;padding:10px 14px;z-index:200;pointer-events:none}#epToast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      @media(max-width:430px){.epCircle{width:102px;height:102px}.epCircle svg{width:38px;height:38px}.epGrid{gap:11px}.epHomeHero{padding:20px 17px}.epHomeHero h1{font-size:26px}.epTopbar{top:64px}}
    `;document.head.appendChild(s);
  }

  const icon=(type)=>({
    schedule:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 18h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    availability:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 12.5l2.5 2.5L16.5 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    report:'<svg viewBox="0 0 24 24"><path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 9h8M8 13h5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    data:'<svg viewBox="0 0 24 24"><path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M14 3v5h5M9 13h6M9 17h6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    messages:'<svg viewBox="0 0 24 24"><path d="M4 5h16v12H9l-5 4V5Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 9h8M8 13h6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    logout:'<svg viewBox="0 0 24 24"><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  })[type];

  function shell(){
    const root=document.getElementById('worker');if(!root)return;
    document.body.classList.add('epFinal');
    root.className='view active';
    root.innerHTML=`
      <section id="epHome" class="epView active">
        <div class="epHomeHero"><small>MATOK BASIC · אזור אישי</small><h1>${esc(dayGreeting())}, ${esc(session()?.user?.name||'')}</h1><p>מה ברצונך לעשות?</p></div>
        <div class="epQuestion">בחרי פעולה</div>
        <div class="epGrid">
          <button class="epAction epSchedule" data-ep-go="schedule"><span class="epCircle">${icon('schedule')}</span><b>הסידור שלי</b><small>המשמרות שפורסמו עבורי</small></button>
          <button class="epAction epAvailability" data-ep-go="availability"><span class="epCircle">${icon('availability')}</span><b>הגשת משמרות</b><small id="epHomeAvailWeek">לשבוע הבא</small></button>
          <button class="epAction epReport" data-ep-go="report"><span class="epCircle">${icon('report')}</span><b>דיווח / חוסרים</b><small>חוסר, תקלה, בקשה או רעיון</small></button>
          <button class="epAction epData" data-ep-go="data"><span class="epCircle">${icon('data')}</span><b>הנתונים שלי</b><small>תלושים, דוחות, שעות ובונוסים</small></button>
          <button class="epAction epMessages" data-ep-go="messages"><span class="epCircle">${icon('messages')}</span><b>הפניות שלי</b><small>צפייה בתגובה ובסטטוס טיפול</small></button>
          <button class="epAction epLogout" id="epLogout"><span class="epCircle">${icon('logout')}</span><b>יציאה</b><small>התנתקות מהמערכת</small></button>
        </div>
      </section>
      <section id="epSchedule" class="epView"><div class="epTopbar"><button class="epBack" data-ep-home>חזרה</button><div><h2>הסידור שלי</h2><p>הסידור שפורסם על ידי המנהל</p></div></div><div id="epScheduleBody"></div></section>
      <section id="epAvailability" class="epView"><div class="epTopbar"><button class="epBack" data-ep-home>חזרה</button><div><h2>הגשת משמרות</h2><p id="epAvailabilitySubtitle">טוען שבוע…</p></div></div><div id="epAvailabilityBody"></div></section>
      <section id="epReport" class="epView"><div class="epTopbar"><button class="epBack" data-ep-home>חזרה</button><div><h2>דיווח / חוסרים</h2><p>הדיווח מגיע ישירות למנהל</p></div></div><div id="epReportBody"></div></section>
      <section id="epData" class="epView"><div class="epTopbar"><button class="epBack" data-ep-home>חזרה</button><div><h2>הנתונים שלי</h2><p>תלושים, דוחות שעות, שעות ובונוסים</p></div></div><div id="epDataBody"></div></section>
      <section id="epMessages" class="epView"><div class="epTopbar"><button class="epBack" data-ep-home>חזרה</button><div><h2>הפניות שלי</h2><p>סטטוס טיפול ותגובות מהמנהל</p></div></div><div id="epMessagesBody"></div></section>
      <div id="epToast"></div>`;
    root.querySelectorAll('[data-ep-go]').forEach(b=>b.onclick=()=>openView(b.dataset.epGo));
    root.querySelectorAll('[data-ep-home]').forEach(b=>b.onclick=showHome);
    document.getElementById('epLogout').onclick=logoutEmployee;
  }

  function showHome(){document.querySelectorAll('#worker .epView').forEach(v=>v.classList.remove('active'));document.getElementById('epHome')?.classList.add('active');window.scrollTo({top:0,behavior:'smooth'})}
  async function openView(name){document.querySelectorAll('#worker .epView').forEach(v=>v.classList.remove('active'));document.getElementById('ep'+name[0].toUpperCase()+name.slice(1))?.classList.add('active');window.scrollTo({top:0,behavior:'smooth'});if(name==='schedule')await loadSchedule();if(name==='availability')await loadAvailability();if(name==='report')renderReport();if(name==='data')await loadData();if(name==='messages')await loadMessages();}
  function logoutEmployee(){try{sessionStorage.removeItem('matokEmployee')}catch(_){} location.href='/?login=employee&v='+VERSION;}

  async function loadContext(){
    const s=session();if(!s)return false;
    const {data,error}=await supabaseClient.rpc('employee_get_portal_context',{p_staff_id:s.user.id,p_username:s.username,p_code:s.code});
    if(error||!data?.length){console.error(error);toast2('לא ניתן לטעון את האזור האישי');return false}
    ctx=data[0];
    const meta=document.getElementById('epHomeAvailWeek');if(meta)meta.textContent='שבוע '+weekRange(ctx.target_week_start);
    return true;
  }

  async function loadSchedule(){
    const box=document.getElementById('epScheduleBody');box.innerHTML='<div class="epCard">טוען את הסידור…</div>';
    const s=session();
    const {data,error}=await supabaseClient.rpc('employee_get_current_schedule_v2',{p_staff_id:s.user.id,p_username:s.username,p_code:s.code});
    if(error){console.error(error);box.innerHTML='<div class="epCard">טעינת הסידור נכשלה. נסי לצאת ולהיכנס שוב.</div>';return}
    const x=Array.isArray(data)?data[0]:data;
    if(!x?.published){box.innerHTML='<div class="epCard"><h3>עדיין לא פורסם סידור</h3><div class="epMuted">כשהמנהל יפרסם את הסידור הוא יופיע כאן.</div></div>';return}
    const rows=Array.isArray(x.assignments)?x.assignments:[];
    box.innerHTML=`<div class="epCard"><h3>שבוע ${esc(weekRange(x.week_start))}</h3><div class="epMuted">זהו הסידור העדכני שפורסם עבורך.</div>${rows.length?rows.map(r=>`<div class="epScheduleRow"><div><b>${esc(slotNames[r.slot_key]||r.slot_key)}</b><div class="epMuted">${esc(r.role_name||'מכירה')}</div></div><span class="epBadge">משובצת</span></div>`).join(''):'<div class="epMuted" style="margin-top:10px">הסידור פורסם, אך לא קיימות עבורך משמרות בשבוע זה.</div>'}${x.manager_note?`<div class="epReply"><b>הודעת מנהל</b><br>${esc(x.manager_note)}</div>`:''}</div>`;
  }

  function allowedSlots(){
    const st=ctx?.settings||{},out=[];
    days.forEach((d,i)=>{
      const ma=st.morning!==false&&(!Array.isArray(st.weekdayMorning)||st.weekdayMorning[i]!==0);
      const ev=st.evening!==false&&(!Array.isArray(st.weekdayEvening)||st.weekdayEvening[i]!==0);
      if(ma)out.push(d[0]+'-am');if(ev)out.push(d[0]+'-pm');
    });
    if((st.friday||'none')!=='none')out.push('fri');
    return out;
  }
  function choiceButton(slot,val,label){return `<button type="button" class="${val} ${availStates[slot]===val?'on':''}" data-av-slot="${slot}" data-av-val="${val}">${label}</button>`}
  function renderAvailability(){
    const box=document.getElementById('epAvailabilityBody');if(!ctx)return;
    const allowed=new Set(allowedSlots());
    const daysHtml=days.map((d,i)=>{const slots=[d[0]+'-am',d[0]+'-pm'].filter(s=>allowed.has(s));if(!slots.length)return'';return `<article class="epAvailDay"><header><b>${d[1]}</b><span class="epMuted">${fmt(isoDate(ctx.target_week_start,i))}</span></header>${slots.map(s=>`<div class="epAvailShift"><b>${s.endsWith('-am')?'בוקר':'ערב'}</b><div class="epChoices">${choiceButton(s,'preferred','מעדיפה')}${choiceButton(s,'available','זמינה')}${choiceButton(s,'unavailable','לא יכולה')}</div></div>`).join('')}</article>`}).join('');
    const fri=allowed.has('fri')?`<article class="epAvailDay"><header><b>שישי</b><span class="epMuted">${fmt(isoDate(ctx.target_week_start,5))}</span></header><div class="epAvailShift"><b>משמרת שישי</b><div class="epChoices">${choiceButton('fri','preferred','מעדיפה')}${choiceButton('fri','available','זמינה')}${choiceButton('fri','unavailable','לא יכולה')}</div></div></article>`:'';
    const submitted=availRows[0]?.submitted_at;
    box.innerHTML=`${submitted?`<div class="epCard" style="background:#eef8ef"><b>הזמינות כבר נשלחה.</b><div class="epMuted">אפשר לעדכן ולשלוח שוב כל עוד השבוע פתוח להגשה.</div></div>`:''}${daysHtml}${fri}<article class="epCard"><label style="display:grid;gap:5px;font-size:11px;font-weight:800">הערה כללית למנהל<textarea id="epAvailNote" rows="3" style="width:100%;border:1px solid var(--line);border-radius:10px;padding:10px">${esc(generalNote)}</textarea></label><button class="epPrimary" id="epSaveAvailability" style="margin-top:10px">שמירת ושליחת הזמינות</button></article>`;
    box.querySelectorAll('[data-av-slot]').forEach(b=>b.onclick=()=>{const slot=b.dataset.avSlot,val=b.dataset.avVal;if(val==='preferred'&&availStates[slot]!=='preferred'&&Object.values(availStates).filter(x=>x==='preferred').length>=2){toast2('אפשר לבחור עד 2 משמרות מועדפות');return}availStates[slot]=val;renderAvailability()});
    document.getElementById('epSaveAvailability').onclick=saveAvailability;
  }
  async function loadAvailability(){
    if(!ctx)await loadContext();if(!ctx)return;
    document.getElementById('epAvailabilitySubtitle').textContent='לשבוע '+weekRange(ctx.target_week_start);
    const box=document.getElementById('epAvailabilityBody');box.innerHTML='<div class="epCard">טוען את אפשרויות המשמרות…</div>';
    const s=session();const {data,error}=await supabaseClient.rpc('employee_get_availability',{p_staff_id:s.user.id,p_username:s.username,p_code:s.code,p_week_start:ctx.target_week_start});
    if(error){console.error(error);box.innerHTML='<div class="epCard">לא ניתן לטעון את הזמינות כרגע.</div>';return}
    availRows=data||[];availStates={};allowedSlots().forEach(k=>availStates[k]='available');availRows.forEach(r=>availStates[r.slot_key]=r.status);generalNote=availRows[0]?.note||'';renderAvailability();
  }
  async function saveAvailability(){
    const btn=document.getElementById('epSaveAvailability');btn.disabled=true;btn.textContent='שומר…';
    try{const s=session();const note=document.getElementById('epAvailNote')?.value||'';const {error}=await supabaseClient.rpc('employee_save_availability',{p_staff_id:s.user.id,p_username:s.username,p_code:s.code,p_week_start:ctx.target_week_start,p_states:availStates,p_note:note});if(error)throw error;generalNote=note;toast2('הזמינות נשמרה ונשלחה למנהל');await loadAvailability()}catch(e){console.error(e);toast2('שמירת הזמינות נכשלה')}finally{if(btn){btn.disabled=false;btn.textContent='שמירת ושליחת הזמינות'}}
  }

  function renderReport(){
    const box=document.getElementById('epReportBody');
    box.innerHTML=`<article class="epCard"><h3>דיווח חוסר בחנות</h3><div class="epForm"><label>מה חסר?<input id="epShortItem" placeholder="לדוגמה: שקיות בינוניות"></label><label>כמות / מצב<input id="epShortQty" placeholder="לדוגמה: נשארו 2"></label><label>הערה<textarea id="epShortNote" rows="3"></textarea></label><button class="epPrimary" id="epSendShort">שליחת החוסר</button></div></article><article class="epCard"><h3>פנייה / בקשה / רעיון</h3><div class="epForm"><label>סוג<select id="epMsgKind"><option>בקשה</option><option>הצעת ייעול</option><option>הערה</option><option>שינוי בחנות</option></select></label><label>נושא<input id="epMsgTitle"></label><label>פירוט<textarea id="epMsgBody" rows="4"></textarea></label><button class="epPrimary" id="epSendMsg">שליחה למנהל</button></div></article>`;
    document.getElementById('epSendShort').onclick=sendShortage;document.getElementById('epSendMsg').onclick=sendMessage;
  }
  async function submitReport(type,title,body,payload){const s=session();const {error}=await supabaseClient.rpc('employee_submit_report',{p_staff_id:s.user.id,p_username:s.username,p_code:s.code,p_report_type:type,p_title:title,p_body:body,p_payload:payload||{}});if(error)throw error;}
  async function sendShortage(){const item=document.getElementById('epShortItem').value.trim(),qty=document.getElementById('epShortQty').value.trim(),note=document.getElementById('epShortNote').value.trim();if(!item)return toast2('יש לרשום מה חסר');try{await submitReport('shortage',item,[qty&&`כמות/מצב: ${qty}`,note].filter(Boolean).join('\n'),{item,qty,note});toast2('החוסר נשלח למנהל');renderReport()}catch(e){console.error(e);toast2('שליחת החוסר נכשלה')}}
  async function sendMessage(){const kind=document.getElementById('epMsgKind').value,title=document.getElementById('epMsgTitle').value.trim(),body=document.getElementById('epMsgBody').value.trim();if(!body)return toast2('יש לכתוב את תוכן הפנייה');try{await submitReport('contact',title?`${kind} · ${title}`:kind,body,{kind});toast2('הפנייה נשלחה למנהל');renderReport()}catch(e){console.error(e);toast2('שליחת הפנייה נכשלה')}}

  async function loadData(){
    const box=document.getElementById('epDataBody');box.innerHTML='<div class="epCard">טוען את הנתונים האישיים…</div>';
    const s=session();const [docsRes,hoursRes]=await Promise.all([
      supabaseClient.rpc('employee_list_documents',{p_staff_id:s.user.id,p_username:s.username,p_code:s.code}),
      supabaseClient.rpc('employee_list_payroll_hours',{p_staff_id:s.user.id,p_username:s.username,p_code:s.code})
    ]);
    const docs=docsRes.data||[],hours=hoursRes.data||[];
    box.innerHTML=`<div class="epTabs"><button class="active" data-data-tab="docs">תלושים ודוחות</button><button data-data-tab="hours">שעות</button><button data-data-tab="bonus">בונוסים</button></div><div id="epDataDocs">${docs.length?docs.map(d=>`<div class="epDoc"><div class="epDocHead"><div><b>${d.doc_type==='payslip'?'תלוש שכר':'דוח שעות'}</b><span class="epMuted">${esc(d.period_label)} · ${esc(d.original_file_name||'')}</span></div><button class="epBack" data-open-doc="${d.id}">פתיחה</button></div></div>`).join(''):'<div class="epCard">עדיין לא הועלו עבורך תלושים או דוחות.</div>'}</div><div id="epDataHours" style="display:none">${hours.length?hours.map(h=>`<div class="epHours"><b>${esc(h.period_label)}</b><div class="epFacts"><span>רגילות: ${h.regular_hours}</span><span>נוספות: ${h.overtime_hours}</span><span>שבת/חג: ${h.holiday_hours}</span></div>${h.manager_note?`<div class="epMuted" style="margin-top:6px">${esc(h.manager_note)}</div>`:''}</div>`).join(''):'<div class="epCard">אין עדיין נתוני שעות.</div>'}</div><div id="epDataBonus" style="display:none">${hours.length?hours.map(h=>`<div class="epHours"><b>${esc(h.period_label)}</b><div class="epFacts"><span>בונוס: ₪${Number(h.bonus_amount||0).toFixed(2)}</span></div>${h.manager_note?`<div class="epMuted" style="margin-top:6px">${esc(h.manager_note)}</div>`:''}</div>`).join(''):'<div class="epCard">אין עדיין נתוני בונוסים.</div>'}</div>`;
    box.querySelectorAll('[data-data-tab]').forEach(b=>b.onclick=()=>{box.querySelectorAll('[data-data-tab]').forEach(x=>x.classList.remove('active'));b.classList.add('active');['Docs','Hours','Bonus'].forEach(n=>document.getElementById('epData'+n).style.display=(n.toLowerCase()===b.dataset.dataTab?'':'none'))});
    box.querySelectorAll('[data-open-doc]').forEach(b=>b.onclick=()=>openDocument(b.dataset.openDoc,b));
  }
  async function openDocument(id,btn){btn.disabled=true;btn.textContent='פותח…';try{const s=session();const {data,error}=await supabaseClient.functions.invoke('employee-document-link',{body:{staff_id:s.user.id,username:s.username,code:s.code,document_id:id}});if(error||!data?.url)throw error||new Error('no_url');window.open(data.url,'_blank','noopener')}catch(e){console.error(e);toast2('פתיחת המסמך נכשלה')}finally{btn.disabled=false;btn.textContent='פתיחה'}}

  async function loadMessages(){
    const box=document.getElementById('epMessagesBody');box.innerHTML='<div class="epCard">טוען פניות…</div>';const s=session();const {data,error}=await supabaseClient.rpc('employee_get_reports_v2',{p_staff_id:s.user.id,p_username:s.username,p_code:s.code});if(error){console.error(error);box.innerHTML='<div class="epCard">טעינת הפניות נכשלה.</div>';return}const rows=data||[];box.innerHTML=rows.length?rows.map(r=>{const status=r.archived_at?'טופל':r.manager_reply_at?'נענתה':r.viewed_at?'נצפתה':'נשלחה';const cls=r.manager_reply_at?'reply':r.viewed_at?'view':'';return `<div class="epMsg"><div class="epMsgHead"><div><b>${esc(r.title||'פנייה')}</b><span class="epMuted">${new Date(r.created_at).toLocaleString('he-IL')}</span></div><span class="epStatus ${cls}">${status}</span></div><div style="margin-top:7px">${esc(r.body||'').replace(/\n/g,'<br>')}</div>${r.manager_note?`<div class="epReply"><b>תגובת המנהל</b><br>${esc(r.manager_note).replace(/\n/g,'<br>')}</div>`:''}</div>`}).join(''):'<div class="epCard">עדיין לא שלחת פניות.</div>';
  }

  async function install(){
    if(!isEmployee())return;
    const id=String(session()?.user?.id||'');if(!id||installedFor===id)return;
    installedFor=id;addStyles();shell();await loadContext();
  }
  setInterval(install,350);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,200));else setTimeout(install,200);
})();