(() => {
  'use strict';
  const VERSION='20260823-final-notifications-1';
  let lastKey='';
  let busy=false;

  const isEmployee=()=>{try{return appSession?.type==='employee'}catch(_){return false}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));
  const fmtDate=iso=>{try{return new Date(iso+'T12:00:00').toLocaleDateString('he-IL',{day:'numeric',month:'numeric'})}catch(_){return iso}};
  const fmtWeek=iso=>{try{const d=new Date(iso+'T12:00:00'),e=new Date(d);e.setDate(d.getDate()+5);return `${fmtDate(iso)}–${e.toLocaleDateString('he-IL',{day:'numeric',month:'numeric'})}`}catch(_){return iso}};

  function addStyles(){
    if(document.getElementById('mfScheduleNoticeStyles'))return;
    const s=document.createElement('style');s.id='mfScheduleNoticeStyles';s.textContent=`
      .mfScheduleNotice{display:none;background:linear-gradient(135deg,#eef9f6,#fff);border:1px solid #93cfc3;border-right:6px solid #3b8f80;border-radius:17px;padding:13px 14px;margin:-3px 0 15px;box-shadow:0 8px 22px #1a1a2e0b}
      .mfScheduleNotice.active{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .mfScheduleNotice b{display:block;font-size:15px;margin-bottom:2px}.mfScheduleNotice small{display:block;color:var(--muted);line-height:1.45}
      .mfScheduleNotice .btn{flex:0 0 auto}
      .mfAction.schedule{position:relative}.mfScheduleNewBadge{display:none;position:absolute;top:8px;left:50%;transform:translateX(-50%);background:#b83d31;color:#fff;border-radius:999px;padding:4px 8px;font-size:9px;font-weight:900;box-shadow:0 4px 10px #0002}
      .mfAction.schedule.hasUnreadSchedule .mfScheduleNewBadge{display:block}
      @media(max-width:430px){.mfScheduleNotice.active{align-items:stretch;flex-direction:column}.mfScheduleNotice .btn{width:100%}.mfScheduleNewBadge{top:5px}}
    `;document.head.appendChild(s);
  }

  function ensureUi(){
    const home=document.getElementById('mfHome');if(!home)return null;
    let notice=document.getElementById('mfScheduleNotice');
    if(!notice){
      notice=document.createElement('div');notice.id='mfScheduleNotice';notice.className='mfScheduleNotice';
      notice.innerHTML='<div><b id="mfScheduleNoticeTitle">סידור עבודה מחכה לך</b><small id="mfScheduleNoticeText"></small></div><button type="button" class="btn primary" id="mfScheduleNoticeOpen">לצפייה עכשיו</button>';
      const welcome=home.querySelector('.mfWelcome');welcome?.after(notice);
      document.getElementById('mfScheduleNoticeOpen').onclick=()=>openAndMark();
    }
    const schedule=home.querySelector('.mfAction.schedule');
    if(schedule&&!schedule.querySelector('.mfScheduleNewBadge')){
      const badge=document.createElement('span');badge.className='mfScheduleNewBadge';badge.textContent='חדש';schedule.appendChild(badge);
      schedule.addEventListener('click',()=>{if(schedule.classList.contains('hasUnreadSchedule'))markCurrentViewed()},true);
    }
    return notice;
  }

  async function getNotice(){
    if(!isEmployee()||busy)return;
    const notice=ensureUi();if(!notice)return;
    busy=true;
    try{
      const {data,error}=await supabaseClient.rpc('employee_get_schedule_notice',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code});
      if(error)throw error;
      const x=Array.isArray(data)?data[0]:data;
      const schedule=document.querySelector('#mfHome .mfAction.schedule');
      if(!x?.published||!x?.is_unread){notice.classList.remove('active');schedule?.classList.remove('hasUnreadSchedule');lastKey='';return}
      lastKey=String(x.week_start||'');
      const title=document.getElementById('mfScheduleNoticeTitle'),text=document.getElementById('mfScheduleNoticeText');
      if(title)title.textContent='סידור עבודה חדש/מעודכן מחכה לך';
      if(text)text.textContent=`שבוע ${fmtWeek(x.week_start)} פורסם במערכת. לחצי כאן כדי לראות את המשמרות שלך.`;
      notice.classList.add('active');schedule?.classList.add('hasUnreadSchedule');
    }catch(e){console.error('schedule notice',e)}finally{busy=false}
  }

  async function markCurrentViewed(){
    if(!isEmployee()||!lastKey)return;
    const key=lastKey;
    try{
      const {data,error}=await supabaseClient.rpc('employee_mark_schedule_viewed',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code,p_week_start:key});
      if(error||data!==true)return;
      document.getElementById('mfScheduleNotice')?.classList.remove('active');
      document.querySelector('#mfHome .mfAction.schedule')?.classList.remove('hasUnreadSchedule');
      lastKey='';
    }catch(e){console.error('mark schedule viewed',e)}
  }

  function openAndMark(){
    const schedule=document.querySelector('#mfHome .mfAction.schedule');
    schedule?.click();
    setTimeout(markCurrentViewed,80);
  }

  function enforce(){
    addStyles();
    if(!isEmployee())return;
    if(document.getElementById('mfHome')){
      ensureUi();
      getNotice();
    }
    mcMessagesEnforce();
  }

  window.refreshEmployeeScheduleNotice=getNotice;
  addStyles();
  let timer=null;
  const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enforce,80)});
  observer.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(enforce,180),{once:true});else setTimeout(enforce,120);

  // MATOK_MANAGER_MESSAGES_V1
  let mcManagerRows=[];
  const mcFmtMsgTime=v=>{try{return v?new Date(v).toLocaleString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):''}catch(_){return ''}};
  function mcEnsureMessageStyles(){
    if(document.getElementById('mcManagerMessageStyles'))return;
    const s=document.createElement('style');s.id='mcManagerMessageStyles';s.textContent='.mcAdminBroadcast{border:1px solid var(--line);border-radius:14px;padding:13px;background:#fff;margin-bottom:12px}.mcCompose{display:grid;grid-template-columns:1fr 1fr;gap:8px}.mcCompose .full{grid-column:1/-1}.mcSentMsg{border:1px solid var(--line);border-radius:11px;padding:10px;margin-top:8px;background:#fff}.mcSentMsg.public{border-right:6px solid var(--teal)}.mcSentMsg.personal{border-right:6px solid var(--coral)}.mcMeta{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0}.mcMeta span{font-size:9px;padding:4px 7px;border-radius:999px;background:var(--soft);border:1px solid var(--line)}.mcEmployeeBroadcast{border:1px solid var(--line);border-radius:13px;padding:12px;margin-top:8px;background:#fff}.mcEmployeeBroadcast.unread{border-right:6px solid var(--coral);background:#fffaf7}.mcEmployeeBroadcast textarea{min-height:58px;margin-top:8px}.mcOwnReply{padding:7px 9px;border-radius:8px;background:#eef9f6;margin-top:7px;font-size:11px}.mcUnreadMsgBadge{display:none;position:absolute;top:7px;left:50%;transform:translateX(-50%);background:#b83d31;color:#fff;border-radius:999px;padding:3px 7px;font-size:9px;font-weight:900}.mfAction.mcMsgUnread{position:relative}.mfAction.mcMsgUnread .mcUnreadMsgBadge{display:block}@media(max-width:650px){.mcCompose{grid-template-columns:1fr}.mcCompose .full{grid-column:auto}}';document.head.appendChild(s);
  }
  function mcEnsureAdminBroadcast(){
    if(appSession?.type!=='admin')return;
    const panel=document.getElementById('requests');if(!panel||document.getElementById('mcAdminBroadcast'))return;
    mcEnsureMessageStyles();
    const root=document.createElement('article');root.id='mcAdminBroadcast';root.className='mcAdminBroadcast';
    root.innerHTML='<div class="employeeHead"><div><h2>הודעות לעובדים</h2><small>ציבורית = כל העובדים הפעילים. אישית = רק העובד שנבחר. העובדים יכולים להגיב אליך.</small></div><button class="btn secondary" id="mcBroadcastRefresh">רענון</button></div><div class="mcCompose"><label>סוג<select id="mcBroadcastAudience"><option value="public">ציבורית — כל העובדים</option><option value="personal">אישית — עובד אחד</option></select></label><label id="mcBroadcastStaffWrap" style="display:none">עובד<select id="mcBroadcastStaff"></select></label><label class="full">כותרת<input id="mcBroadcastTitle" placeholder="נושא קצר"></label><label class="full">הודעה<textarea id="mcBroadcastBody" rows="4" placeholder="מה חשוב שהעובדים ידעו?"></textarea></label><button class="btn primary full" id="mcBroadcastSend">שליחת הודעה</button></div><div id="mcBroadcastList" style="margin-top:11px"><small>טוען…</small></div>';
    panel.prepend(root);
    document.getElementById('mcBroadcastAudience').onchange=()=>{document.getElementById('mcBroadcastStaffWrap').style.display=document.getElementById('mcBroadcastAudience').value==='personal'?'':'none'};
    document.getElementById('mcBroadcastSend').onclick=mcSendBroadcast;
    document.getElementById('mcBroadcastRefresh').onclick=mcLoadAdminBroadcast;
    mcLoadBroadcastStaff();mcLoadAdminBroadcast();
  }
  async function mcLoadBroadcastStaff(){
    const s=document.getElementById('mcBroadcastStaff');if(!s)return;
    const r=await supabaseClient.rpc('admin_get_portal_access_controls');
    if(r.error)return;s.innerHTML=(r.data||[]).map(x=>'<option value="'+x.staff_id+'">'+esc(x.full_name)+'</option>').join('');
  }
  async function mcSendBroadcast(){
    const audience=document.getElementById('mcBroadcastAudience').value,staff=audience==='personal'?document.getElementById('mcBroadcastStaff').value:null,title=document.getElementById('mcBroadcastTitle').value.trim(),body=document.getElementById('mcBroadcastBody').value.trim();
    if(!body){toast?.('יש לכתוב הודעה');return}
    const r=await supabaseClient.rpc('admin_send_manager_message',{p_audience:audience,p_staff_id:staff||null,p_title:title,p_body:body});
    if(r.error){console.error(r.error);toast?.('שליחת ההודעה נכשלה');return}
    document.getElementById('mcBroadcastTitle').value='';document.getElementById('mcBroadcastBody').value='';
    toast?.(audience==='public'?'ההודעה הציבורית נשלחה לכל העובדים':'ההודעה האישית נשלחה לעובד');mcLoadAdminBroadcast();
  }
  async function mcLoadAdminBroadcast(){
    const box=document.getElementById('mcBroadcastList');if(!box||appSession?.type!=='admin')return;box.innerHTML='<small>טוען…</small>';
    const r=await supabaseClient.rpc('admin_list_manager_messages',{p_include_archived:false});
    if(r.error){box.innerHTML='<div class="mfEmpty">טעינת ההודעות נכשלה.</div>';return}
    mcManagerRows=r.data||[];
    box.innerHTML=mcManagerRows.length?mcManagerRows.map(m=>'<div class="mcSentMsg '+m.audience+'"><b>'+esc(m.title||'ללא כותרת')+'</b><p>'+esc(m.body).replace(/\n/g,'<br>')+'</p><div class="mcMeta"><span>'+(m.audience==='public'?'ציבורית':'אישית')+'</span><span>'+esc(m.target_name||'')+'</span><span>נקראה '+m.read_count+'/'+m.recipient_count+'</span><span>'+m.reply_count+' תגובות</span><span>'+mcFmtMsgTime(m.created_at)+'</span></div><div class="actions"><button class="btn secondary" data-mc-replies="'+m.id+'">תגובות</button><button class="btn danger" data-mc-archive="'+m.id+'">ארכיון</button></div></div>').join(''):'<div class="mfEmpty">עדיין לא נשלחו הודעות מההנהלה.</div>';
    box.querySelectorAll('[data-mc-replies]').forEach(b=>b.onclick=()=>mcOpenReplies(b.dataset.mcReplies));
    box.querySelectorAll('[data-mc-archive]').forEach(b=>b.onclick=async()=>{if(!confirm('להעביר את ההודעה לארכיון?'))return;await supabaseClient.rpc('admin_archive_manager_message',{p_message_id:b.dataset.mcArchive});mcLoadAdminBroadcast()});
  }
  async function mcOpenReplies(id){
    const r=await supabaseClient.rpc('admin_get_manager_message_replies',{p_message_id:id});if(r.error){toast?.('טעינת התגובות נכשלה');return}
    let m=document.getElementById('mcBroadcastReplies');if(!m){m=document.createElement('div');m.id='mcBroadcastReplies';m.className='modal';m.innerHTML='<section style="width:min(700px,100%);max-height:92vh"><button class="close" id="mcBroadcastRepliesClose">×</button><h2>תגובות עובדים</h2><div id="mcBroadcastRepliesBody"></div></section>';document.body.appendChild(m);document.getElementById('mcBroadcastRepliesClose').onclick=()=>closeModal?.('mcBroadcastReplies')}
    const rows=r.data||[];document.getElementById('mcBroadcastRepliesBody').innerHTML=rows.length?rows.map(x=>'<div class="item"><div class="meta"><b>'+esc(x.full_name)+'</b><p>'+esc(x.body)+'</p><small>'+mcFmtMsgTime(x.created_at)+'</small></div></div>').join(''):'<div class="mfEmpty">אין עדיין תגובות.</div>';openModal?.('mcBroadcastReplies');
  }
  function mcEnsureEmployeeBroadcast(){
    if(appSession?.type!=='employee')return;
    const p=document.getElementById('mfContactPanel');if(!p||document.getElementById('mcEmployeeBroadcast'))return;
    mcEnsureMessageStyles();
    const grid=p.querySelector('.mfReportGrid');if(!grid)return;
    const card=document.createElement('article');card.id='mcEmployeeBroadcast';card.className='card';
    card.innerHTML='<div class="employeeHead"><div><h2>הודעות מההנהלה</h2><small>כאן מופיעות הודעות ציבוריות לכל הצוות והודעות אישיות שרק את רואה.</small></div><button class="btn secondary" id="mcEmployeeBroadcastRefresh">רענון</button></div><div id="mcEmployeeBroadcastList"><small>טוען…</small></div>';
    grid.prepend(card);document.getElementById('mcEmployeeBroadcastRefresh').onclick=()=>mcLoadEmployeeBroadcast(true);
    const home=document.getElementById('mfHome'),action=home?.querySelector('.mfAction.messages:not([data-mf-bonus])');
    if(action){const b=action.querySelector('b'),s=action.querySelector('small');if(b)b.textContent='הודעות';if(s)s.textContent='הודעות מההנהלה והפניות שלך';if(!action.querySelector('.mcUnreadMsgBadge')){const badge=document.createElement('span');badge.className='mcUnreadMsgBadge';badge.textContent='חדש';action.appendChild(badge)}if(!action.dataset.mcMsgBound){action.dataset.mcMsgBound='1';action.addEventListener('click',()=>setTimeout(()=>mcLoadEmployeeBroadcast(true),100))}}
    mcLoadEmployeeBroadcast(false);
  }
  async function mcLoadEmployeeBroadcast(markRead){
    if(appSession?.type!=='employee')return;
    const r=await supabaseClient.rpc('employee_list_manager_messages',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code});if(r.error){console.error(r.error);return}
    const rows=r.data||[],unread=rows.filter(x=>!x.read_at),action=document.querySelector('#mfHome .mfAction.messages:not([data-mf-bonus])');action?.classList.toggle('mcMsgUnread',unread.length>0);
    const box=document.getElementById('mcEmployeeBroadcastList');
    if(box){
      box.innerHTML=rows.length?rows.map(m=>'<div class="mcEmployeeBroadcast '+(m.read_at?'':'unread')+'"><div class="mfMessageHead"><div><b>'+esc(m.title||'הודעה מההנהלה')+'</b><small>'+(m.audience==='public'?'ציבורית לכל הצוות':'אישית')+' · '+mcFmtMsgTime(m.created_at)+'</small></div><span class="mfStatus '+(m.read_at?'ok':'wait')+'">'+(m.read_at?'נקראה':'חדשה')+'</span></div><p>'+esc(m.body).replace(/\n/g,'<br>')+'</p>'+((m.replies||[]).map(x=>'<div class="mcOwnReply"><b>התגובה שלך:</b> '+esc(x.body)+'<br><small>'+mcFmtMsgTime(x.created_at)+'</small></div>').join(''))+'<textarea data-mc-reply="'+m.id+'" placeholder="תגובה פרטית למנהל…"></textarea><button class="btn primary" data-mc-send-reply="'+m.id+'">שליחת תגובה</button></div>').join(''):'<div class="mfEmpty">אין כרגע הודעות מההנהלה.</div>';
      box.querySelectorAll('[data-mc-send-reply]').forEach(b=>b.onclick=async()=>{const id=b.dataset.mcSendReply,ta=box.querySelector('[data-mc-reply="'+id+'"]'),body=ta.value.trim();if(!body){toast?.('יש לכתוב תגובה');return}const z=await supabaseClient.rpc('employee_reply_manager_message',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code,p_message_id:id,p_body:body});if(z.error){toast?.('שליחת התגובה נכשלה');return}toast?.('התגובה נשלחה למנהל');mcLoadEmployeeBroadcast(true)});
    }
    if(markRead&&unread.length){await Promise.all(unread.map(m=>supabaseClient.rpc('employee_mark_manager_message_read',{p_staff_id:appSession.user.id,p_username:appSession.username,p_code:appSession.code,p_message_id:m.id})));setTimeout(()=>mcLoadEmployeeBroadcast(false),60)}
  }
  function mcMessagesEnforce(){
    mcEnsureMessageStyles();
    if(appSession?.type==='admin')mcEnsureAdminBroadcast();
    if(appSession?.type==='employee')mcEnsureEmployeeBroadcast();
  }
  window.refreshMatokManagerMessages=mcLoadEmployeeBroadcast;
})();
