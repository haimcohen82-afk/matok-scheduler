(() => {
  'use strict';
  const VERSION='20260816-employee-schedule-fix-2';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function currentEmployeeSession(){
    try { return appSession?.type==='employee' ? appSession : null; }
    catch(_){ return null; }
  }

  function setAvailabilityWeekLabel(){
    try{
      if(!workerTargetWeek) return;
      const el=document.getElementById('workerWeekLabel');
      if(el) el.textContent='זמינות · '+weekLabel(workerTargetWeek);
      const hero=document.querySelector('#worker .hero p');
      if(hero) hero.textContent='כאן מוסרים זמינות לשבוע הבא. הסידור שכבר פורסם לשבוע הנוכחי נמצא בלשונית „הסידור”.';
    }catch(e){ console.error('setAvailabilityWeekLabel',e); }
  }

  async function loadPublishedScheduleStable(){
    const session=currentEmployeeSession();
    if(!session) return;
    const box=document.getElementById('publishedScheduleBox');
    if(!box) return;
    box.innerHTML='<h2>הסידור המפורסם</h2><p>טוען את הסידור…</p>';
    try{
      const {data,error}=await supabaseClient.rpc('employee_get_current_schedule_v2',{
        p_staff_id:session.user.id,
        p_username:session.username,
        p_code:session.code
      });
      if(error) throw error;
      const payload=Array.isArray(data)?data[0]:data;
      if(!payload?.published){
        box.innerHTML='<h2>הסידור המפורסם</h2><p>עדיין לא פורסם סידור עבודה לשבוע הנוכחי.</p>';
        return;
      }
      const rows=Array.isArray(payload.assignments)?payload.assignments:[];
      const week=payload.week_start;
      const note=payload.manager_note||'';
      if(!rows.length){
        box.innerHTML=`<h2>הסידור פורסם · ${esc(weekLabel(week))}</h2><div class="truth"><b>הסידור פורסם בהצלחה.</b><br>כרגע לא קיימת עבורך משמרת משובצת בשבוע הזה. אם זה לא תואם למה שסוכם, שלחי פנייה למנהל.</div>${note?`<p><b>הודעת מנהל:</b> ${esc(note)}</p>`:''}`;
        return;
      }
      box.innerHTML=`<h2>הסידור שלך · ${esc(weekLabel(week))}</h2><p style="margin-bottom:10px">זהו הסידור שפורסם לשבוע הנוכחי. הזמינות שמופיעה בראש המסך היא לשבוע הבא.</p>${rows.map(r=>`<div class="item approvedAssignment"><div class="meta"><b>${esc(slotLabelByKey(r.slot_key))}</b><small>${esc(r.role_name||'מכירה')}</small></div><span class="badge ok">משובצת</span></div>`).join('')}${note?`<p><b>הודעת מנהל:</b> ${esc(note)}</p>`:''}`;
    }catch(e){
      console.error('employee_get_current_schedule_v2',e);
      box.innerHTML='<h2>הסידור המפורסם</h2><p>לא הצלחנו לטעון את הסידור. נסי לצאת ולהיכנס שוב.</p>';
    }
  }

  function install(){
    try{
      if(typeof loadPublishedSchedule==='function') loadPublishedSchedule=loadPublishedScheduleStable;
      else window.loadPublishedSchedule=loadPublishedScheduleStable;

      if(typeof renderWorkerWeek==='function'){
        const originalRenderWorkerWeek=renderWorkerWeek;
        renderWorkerWeek=function(...args){
          const out=originalRenderWorkerWeek.apply(this,args);
          setAvailabilityWeekLabel();
          return out;
        };
      }

      document.querySelectorAll('.workerTabs button').forEach(b=>{
        if(b.dataset.target==='scheduleWorker' && b.dataset.stableScheduleBound!=='1'){
          b.dataset.stableScheduleBound='1';
          b.addEventListener('click',()=>setTimeout(loadPublishedScheduleStable,0));
        }
      });

      setAvailabilityWeekLabel();
      if(currentEmployeeSession()) setTimeout(loadPublishedScheduleStable,100);
    }catch(e){ console.error('employee portal stable install',e); }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(install,300));
  else setTimeout(install,300);
  setTimeout(install,1200);
  window.loadPublishedScheduleStable=loadPublishedScheduleStable;
})();