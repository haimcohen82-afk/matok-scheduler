(() => {
  'use strict';
  const VERSION='20260819-final-realtime-3';
  let channel=null,sessionKey='',refreshTimer=null;

  const isAdmin=()=>{try{return appSession?.type==='admin'}catch(_){return false}};
  const isEmployee=()=>{try{return appSession?.type==='employee'}catch(_){return false}};

  function key(){try{return `${appSession?.type||''}:${appSession?.user?.id||''}`}catch(_){return ''}}

  function scheduleRefresh(){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(async()=>{
      try{
        if(isAdmin()){
          await window.loadAdminFinalData?.(window.adminWeekStart||adminWeekStart);
          await window.loadManagerWeekDashboard?.();
        }
        if(isEmployee())await window.loadCurrentPublishedSchedule?.();
      }catch(e){console.error('final refresh',e)}
    },140);
  }

  function stop(){if(channel&&window.supabaseClient){try{supabaseClient.removeChannel(channel)}catch(_){ }}channel=null}

  function sync(){
    const next=key();if(!next){stop();sessionKey='';return}if(next===sessionKey&&(channel||isEmployee()))return;
    stop();sessionKey=next;if(!window.supabaseClient)return;
    // Managers use authenticated Realtime. Employee PIN sessions remain private;
    // employees refresh their own RPC-backed schedule on open/focus instead.
    if(isAdmin()){
      channel=supabaseClient.channel('matok-final-live-'+Date.now())
        .on('postgres_changes',{event:'*',schema:'public',table:'work_assignments'},scheduleRefresh)
        .on('postgres_changes',{event:'*',schema:'public',table:'staff_availability'},scheduleRefresh)
        .on('postgres_changes',{event:'*',schema:'public',table:'staff_week_submissions'},scheduleRefresh);
      channel.subscribe(status=>{if(status==='SUBSCRIBED')scheduleRefresh()});
    }else if(isEmployee())scheduleRefresh();
  }

  function startObserver(){
    const bar=document.getElementById('sessionBar'),gate=document.getElementById('authGate');
    const obs=new MutationObserver(()=>setTimeout(sync,20));
    if(bar)obs.observe(bar,{attributes:true,childList:true,subtree:true});if(gate)obs.observe(gate,{attributes:true,childList:true,subtree:true});sync();
  }

  window.addEventListener('focus',()=>{sync();scheduleRefresh()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){sync();scheduleRefresh()}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startObserver,{once:true});else startObserver();
})();