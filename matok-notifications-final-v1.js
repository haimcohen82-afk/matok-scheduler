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
  }

  window.refreshEmployeeScheduleNotice=getNotice;
  addStyles();
  let timer=null;
  const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enforce,80)});
  observer.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(enforce,180),{once:true});else setTimeout(enforce,120);
})();
