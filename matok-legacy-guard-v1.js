(() => {
  'use strict';
  const VERSION='20260819-legacy-guard-1';

  const noop=()=>{};
  const asyncNoop=async()=>{};

  // The original single-file app still contains legacy schedule/availability renderers.
  // The final runtime owns those screens now, so prevent background polling/realtime
  // from repainting them or changing final UI state after login.
  try{ if(typeof renderAdminSchedule==='function') renderAdminSchedule=noop; }catch(_){ }
  try{ if(typeof renderAdminOverview==='function') renderAdminOverview=noop; }catch(_){ }
  try{ if(typeof loadScheduleFromDb==='function') loadScheduleFromDb=asyncNoop; }catch(_){ }
  try{ if(typeof loadAdminAvailability==='function') loadAdminAvailability=asyncNoop; }catch(_){ }
  try{ if(typeof startAdminAvailabilityLive==='function') startAdminAvailabilityLive=noop; }catch(_){ }
  try{ if(typeof syncScheduleLockUi==='function') syncScheduleLockUi=noop; }catch(_){ }

  // Keep legacy static/demo panels from flashing after authentication. Final modules
  // replace them with cloud-backed panels; this guard only hides them until replacement.
  function hideLegacyFlash(){
    try{
      if(appSession?.type==='admin'){
        const attendance=document.getElementById('attendance');
        if(attendance && !document.getElementById('mfHoursReports')) attendance.style.visibility='hidden';
        else if(attendance) attendance.style.visibility='';
        const requests=document.getElementById('requests');
        if(requests && !document.getElementById('mfAdminReports')) requests.style.visibility='hidden';
        else if(requests) requests.style.visibility='';
      }
      if(appSession?.type==='employee'){
        const hours=document.getElementById('hours');
        if(hours && !document.getElementById('mfHoursPanel')) hours.style.visibility='hidden';
        else if(hours) hours.style.visibility='';
        const contact=document.getElementById('contact');
        if(contact && !document.getElementById('mfContactPanel')) contact.style.visibility='hidden';
        else if(contact) contact.style.visibility='';
      }
    }catch(_){ }
  }
  setInterval(hideLegacyFlash,250);
  setTimeout(hideLegacyFlash,20);
})();