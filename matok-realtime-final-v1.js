(() => {
  'use strict';
  const VERSION='20260819-final-realtime-1';
  let channel=null,sessionKey='',refreshTimer=null;

  const isAdmin=()=>{try{return appSession?.type==='admin'}catch(_){return false}};
  const isEmployee=()=>{try{return appSession?.type==='employee'}catch(_){return false}};

  function key(){
    try{return `${appSession?.type||''}:${appSession?.user?.id||''}`}catch(_){return ''}
  }

  function scheduleRefresh(){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(async()=>{
      try{
        if(isAdmin()) await window.loadAdminFinalData?.(window.adminWeekStart||adminWeekStart);
        if(isEmployee()) await window.loadCurrentPublishedSchedule?.();
      }catch(e){console.error('realtime refresh',e)}
    },140);
  }

  function stop(){
    if(channel&&window.supabaseClient){try{supabaseClient.removeChannel(channel)}catch(_){ }}
    channel=null;
  }

  function sync(){
    const next=key();
    if(!next||next==='undefined:'){stop();sessionKey='';return}
    if(next===sessionKey&&channel)return;
    stop();sessionKey=next;
    if(!window.supabaseClient)return;
    channel=supabaseClient.channel('matok-final-live-'+Date.now());
    if(isAdmin()){
      channel
        .on('postgres_changes',{event:'*',schema:'public',table:'work_assignments'},scheduleRefresh)
        .on('postgres_changes',{event:'*',schema:'public',table:'staff_availability'},scheduleRefresh)
        .on('postgres_changes',{event:'*',schema:'public',table:'staff_week_submissions'},scheduleRefresh);
    }else if(isEmployee()){
      channel.on('postgres_changes',{event:'*',schema:'public',table:'work_assignments'},scheduleRefresh);
    }
    channel.subscribe(status=>{if(status==='SUBSCRIBED')scheduleRefresh()});
  }

  function startObserver(){
    const bar=document.getElementById('sessionBar'),gate=document.getElementById('authGate');
    const obs=new MutationObserver(()=>setTimeout(sync,20));
    if(bar)obs.observe(bar,{attributes:true,childList:true,subtree:true});
    if(gate)obs.observe(gate,{attributes:true,childList:true,subtree:true});
    sync();
  }

  window.addEventListener('focus',()=>{sync();scheduleRefresh()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){sync();scheduleRefresh()}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startObserver,{once:true});else startObserver();
})();