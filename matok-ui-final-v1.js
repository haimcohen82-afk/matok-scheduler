(() => {
  'use strict';
  const VERSION='20260819-final-ui-2';

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
      .mfCurrentWeekEditBtn{background:#eef9f6!important;border-color:#9bcfc5!important;color:#245f56!important}
    `;
    document.head.appendChild(s);
  }

  function currentSunday(){
    const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-d.getDay());
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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

  function addCurrentWeekEditButton(){
    try{
      if(appSession?.type!=='admin') return;
      const schedule=document.getElementById('adminSchedule');
      const actions=schedule?.querySelector('.employeeHead .actions');
      if(!actions || document.getElementById('mfCurrentWeekEditBtn')) return;
      const b=document.createElement('button');
      b.id='mfCurrentWeekEditBtn';b.type='button';b.className='btn secondary mfCurrentWeekEditBtn';b.textContent='הסידור של השבוע הנוכחי';
      b.onclick=()=>window.loadAdminFinalData?.(currentSunday());
      actions.prepend(b);
    }catch(_){ }
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

  function polishEmployeeMenu(){
    try{
      if(appSession?.type!=='employee') return;
      const home=document.getElementById('mfHome');if(!home)return;
      const docs=home.querySelector('.mfAction.docs');
      if(docs && docs.dataset.mfPolished!=='1'){
        docs.dataset.mfPolished='1';
        const b=docs.querySelector('b'),small=docs.querySelector('small');
        if(b)b.textContent='הנתונים שלי';if(small)small.textContent='תלושים, דוחות ומסמכים אישיים';
      }
      const hours=home.querySelector('.mfAction.hours');
      if(hours && hours.dataset.mfPolished!=='1'){
        hours.dataset.mfPolished='1';
        const b=hours.querySelector('b'),small=hours.querySelector('small');
        if(b)b.textContent='שעות נוכחות';if(small)small.textContent='צפייה בשעות שנשמרו עבורך';
        const bonus=hours.cloneNode(true);bonus.classList.remove('hours');bonus.classList.add('messages');bonus.removeAttribute('data-mf-section');bonus.removeAttribute('data-mf-focus');bonus.dataset.mfBonus='1';
        const bb=bonus.querySelector('b'),bs=bonus.querySelector('small'),bi=bonus.querySelector('.mfActionIcon');if(bb)bb.textContent='בונוסים';if(bs)bs.textContent='צפייה בבונוסים לפי חודש';if(bi)bi.textContent='₪';
        bonus.onclick=()=>{hours.click();setTimeout(()=>document.getElementById('mfEmployeePayrollCard')?.scrollIntoView({behavior:'smooth',block:'start'}),120)};
        hours.after(bonus);
      }
    }catch(_){ }
  }

  function enforce(){
    addStyles();
    if(document.querySelector('#mfAdminScheduleBody .mfDay')) decorateSchedule();
    addCurrentWeekEditButton();
    cleanPublishedAvailability();
    cleanSettingsTab();
    polishEmployeeMenu();
  }

  addStyles();
  let timer=null;
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enforce,30)}).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(enforce,1200);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(enforce,200)); else setTimeout(enforce,200);
})();