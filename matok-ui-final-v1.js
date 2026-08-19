(() => {
  'use strict';
  const VERSION='20260819-final-ui-1';

  function addStyles(){
    if(document.getElementById('matokFinalUiStyles')) return;
    const s=document.createElement('style');
    s.id='matokFinalUiStyles';
    s.textContent=`
      @media(max-width:650px){
        #mfAdminScheduleBody .mfScheduleGrid{grid-template-columns:1fr 1fr!important;gap:8px!important}
        #mfAdminScheduleBody .mfDay{min-width:0!important}
        #mfAdminScheduleBody .mfDay:not(.mfExpanded) .mfShift{display:none!important}
        #mfAdminScheduleBody .mfDay.mfExpanded{grid-column:1/-1!important}
        #mfAdminScheduleBody .mfDay>header{cursor:pointer;min-height:62px;align-items:center}
        #mfAdminScheduleBody .mfDayCompactFinal{display:block!important;padding:9px 10px;background:#fff;font-size:10px;color:var(--muted);line-height:1.45}
        #mfAdminScheduleBody .mfDay.mfExpanded .mfDayCompactFinal{display:none!important}
        #mfAdminScheduleBody .mfDayNavFinal{display:none;gap:7px;padding:9px;background:var(--soft);border-top:1px solid var(--line)}
        #mfAdminScheduleBody .mfDay.mfExpanded .mfDayNavFinal{display:flex!important}
        #mfAdminScheduleBody .mfDayNavFinal .btn{flex:1}
      }
      @media(min-width:651px){.mfDayCompactFinal,.mfDayNavFinal{display:none!important}}
      .mfPublishedAvailabilityHidden{background:#eef9f6;border:1px solid #abd8cf;border-radius:11px;padding:12px;line-height:1.55}
      .mfFinalSettingsCard{max-width:650px}
    `;
    document.head.appendChild(s);
  }

  function daySummary(day){
    const shifts=[...day.querySelectorAll('.mfShift')];
    if(!shifts.length) return 'אין משמרות';
    return shifts.map(shift=>{
      const title=shift.querySelector('.mfShiftHead b')?.textContent?.trim()||'';
      const names=[...shift.querySelectorAll('.mfPerson b')].map(x=>x.textContent.trim()).filter(Boolean);
      return `${title}: ${names.length?names.join(', '):'—'}`;
    }).join(' · ');
  }

  function decorateSchedule(){
    const root=document.getElementById('mfAdminScheduleBody');
    if(!root) return;
    const days=[...root.querySelectorAll('.mfDay')];
    days.forEach((day,index)=>{
      let compact=day.querySelector('.mfDayCompactFinal');
      if(!compact){
        compact=document.createElement('div');compact.className='mfDayCompactFinal';
        const header=day.querySelector(':scope>header');header?.after(compact);
      }
      compact.textContent=daySummary(day);
      let nav=day.querySelector('.mfDayNavFinal');
      if(!nav){
        nav=document.createElement('div');nav.className='mfDayNavFinal';
        nav.innerHTML='<button type="button" class="btn secondary" data-mf-day-prev>יום קודם</button><button type="button" class="btn secondary" data-mf-day-next>יום הבא</button>';
        day.appendChild(nav);
      }
      const header=day.querySelector(':scope>header');
      if(header && !header.dataset.mfFinalBound){
        header.dataset.mfFinalBound='1';
        header.addEventListener('click',()=>{
          const was=day.classList.contains('mfExpanded');
          days.forEach(x=>x.classList.remove('mfExpanded'));
          if(!was){day.classList.add('mfExpanded');setTimeout(()=>day.scrollIntoView({behavior:'smooth',block:'start'}),30)}
        });
      }
      const go=delta=>{
        const target=days[index+delta];if(!target) return;
        days.forEach(x=>x.classList.remove('mfExpanded'));
        target.classList.add('mfExpanded');target.scrollIntoView({behavior:'smooth',block:'start'});
      };
      nav.querySelector('[data-mf-day-prev]').onclick=e=>{e.stopPropagation();go(-1)};
      nav.querySelector('[data-mf-day-next]').onclick=e=>{e.stopPropagation();go(1)};
      nav.querySelector('[data-mf-day-prev]').disabled=index===0;
      nav.querySelector('[data-mf-day-next]').disabled=index===days.length-1;
    });
  }

  function cleanPublishedAvailability(){
    try{
      if(appSession?.type!=='admin' || currentWeekRecord?.status!=='published') return;
      const box=document.getElementById('mfAvailabilityAdmin');
      if(box && !box.querySelector('.mfPublishedAvailabilityHidden')){
        box.innerHTML='<div class="mfPublishedAvailabilityHidden"><b>השבוע כבר פורסם.</b><br>הגשות הזמינות של השבוע הזה נשמרות בהיסטוריה ובסיכום העובדים, אבל אינן מוצגות כאן יותר. העבודה הפעילה עוברת לזמינות של השבוע הבא.</div>';
      }
      document.querySelectorAll('#mfAdminScheduleBody .mfAvailability').forEach(x=>x.style.display='none');
    }catch(_){ }
  }

  function cleanSettingsTab(){
    try{
      if(appSession?.type!=='admin') return;
      const panel=document.getElementById('settings');
      if(!panel || panel.dataset.mfFinalSettings==='1') return;
      panel.dataset.mfFinalSettings='1';
      panel.innerHTML='<article class="card mfFinalSettingsCard"><h2>הגדרות הסידור</h2><p>כל שעות המשמרות וכמות העובדים מנוהלות במקום אחד, מתוך סידור העבודה, כדי שלא יהיו שתי הגדרות שסותרות זו את זו.</p><button type="button" class="btn primary" id="mfFinalOpenSettings">פתיחת שעות וכוח אדם</button></article>';
      document.getElementById('mfFinalOpenSettings').onclick=()=>document.getElementById('mfSettingsBtn')?.click();
    }catch(_){ }
  }

  function enforce(){
    addStyles();
    if(document.querySelector('#mfAdminScheduleBody .mfDay')) decorateSchedule();
    cleanPublishedAvailability();
    cleanSettingsTab();
  }

  addStyles();
  let timer=null;
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enforce,30)}).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(enforce,1200);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(enforce,200)); else setTimeout(enforce,200);
})();