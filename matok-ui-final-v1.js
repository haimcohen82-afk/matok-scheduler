(() => {
  'use strict';
  const VERSION='20260829-final-ui-4';

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

      /* Consistent MATOK visual system; presentation only, no event or API changes */
      :root{--ink:#172641;--cream:#f5f7fa;--soft:#f8fafc;--line:#dde4eb;--shadow:0 9px 26px rgba(23,38,65,.075)}
      body{background:var(--cream)}
      .wrap{max-width:1420px}
      .top{background:#172641;border-bottom:3px solid #79bfb5;box-shadow:0 5px 18px rgba(14,28,48,.12)}
      .top .brand b{font-weight:900;letter-spacing:.04em}
      .tabs.adminTabs{background:white;border:1px solid var(--line);border-radius:16px;box-shadow:0 5px 18px rgba(23,38,65,.04);padding:7px;gap:5px}
      .tabs.adminTabs button{border-radius:11px;min-height:43px;font-size:13px}
      .tabs.adminTabs button.active{background:var(--ink);color:white}
      #admin .card,#payrollFinal .card,.mfWeekHero{border:1px solid var(--line);border-radius:19px;box-shadow:0 6px 20px rgba(23,38,65,.05)}
      #admin .card h2,#payrollFinal .card h2{letter-spacing:-.015em;line-height:1.3}
      #admin .btn,#payrollFinal .btn,.mfPayrollShortcuts button{min-height:43px;border-radius:12px;transition:background .16s,transform .12s,box-shadow .16s}
      #admin .btn:active,#payrollFinal .btn:active{transform:scale(.99)}
      #admin .btn:focus-visible,#payrollFinal .btn:focus-visible,#worker button:focus-visible{outline:3px solid #4e9b92;outline-offset:3px}
      #admin .btn.primary,#payrollFinal .btn.primary{background:#1d695f;color:#fff;border-color:#1d695f}
      #admin .btn.primary:hover,#payrollFinal .btn.primary:hover{background:#165249}
      #admin .btn.secondary,#payrollFinal .btn.secondary{background:#fff;color:var(--ink);border:1px solid var(--line)}
      #admin label,#payrollFinal label{line-height:1.5}
      #admin input,#admin textarea,#admin select,#payrollFinal input,#payrollFinal select{min-height:43px;border-color:#cdd7e1;background:#fff}
      #admin input:focus,#admin select:focus,#payrollFinal input:focus,#payrollFinal select:focus{outline:2px solid #86c3b8;outline-offset:1px}
      .mfManagerWeeks .mfWeekHero{padding:20px 18px;background:#fff}
      .mfManagerWeeks .mfWeekHero.current{border-right:5px solid #45988d}
      .mfManagerWeeks .mfWeekHero.next{border-right:5px solid #e8826a}
      .mfPayrollShortcuts{gap:10px}
      .mfPayrollShortcuts button{padding:12px 14px;text-align:right;white-space:normal}
      #payrollFinal .mpNav{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));overflow:visible;gap:8px;margin-bottom:15px}
      #payrollFinal .mpNav button{min-height:64px;white-space:normal;text-align:center;border:1px solid var(--line);border-radius:15px;background:#fff;color:var(--ink);box-shadow:0 4px 10px rgba(23,38,65,.025)}
      #payrollFinal .mpNav button.primary{background:#eaf6f3;color:#16564f;border:2px solid #4e9f92;box-shadow:0 6px 17px rgba(40,104,95,.10)}
      #payrollFinal .mpSub>.card{padding:21px}
      #payrollFinal .mpUploadSteps span{padding:13px 8px;border-radius:12px;background:#f5faf9;border:1px solid #d4e6e1;font-size:12px}
      #payrollFinal .mpUploadChoice button{padding:17px 12px;border-radius:14px}
      #payrollFinal .mpPdfRow{border:1px solid #d9e4e9;border-right:4px solid #70b2a6;padding:13px;gap:14px;border-radius:14px;background:#fff;margin-top:10px}
      #payrollFinal .mpPdfRow:has(.mpConfidence.low){border-right-color:#d99375;background:#fffaf7}
      #payrollFinal .mpPdfRow .btn{min-height:37px}
      #payrollFinal .mpStatus{padding:13px;border:1px solid var(--line);border-radius:12px;line-height:1.6}
      #payrollFinal .mpTable th{background:#eef4f5}
      #payrollFinal .mpTable td,#payrollFinal .mpTable th{padding:12px 9px}
      #worker .mfWelcome{box-shadow:0 12px 29px rgba(23,38,65,.13)}
      #worker .mfAction{border-radius:22px;box-shadow:0 5px 17px rgba(23,38,65,.06);min-height:146px}
      #worker .mfActionIcon{border-radius:50%;width:58px;height:58px;display:grid;place-items:center}
      @media(max-width:760px){
        .tabs.adminTabs{top:64px;border-radius:0}
        .mfPayrollShortcuts{grid-template-columns:1fr 1fr}
        #payrollFinal .mpNav{grid-template-columns:1fr 1fr}
        #payrollFinal .mpNav button{min-height:60px;font-size:12px;padding:10px 7px}
        #payrollFinal .mpSub>.card{padding:14px 12px}
        #payrollFinal .mpUploadSteps{grid-template-columns:1fr}
        #payrollFinal .mpUploadSteps span{text-align:right}
        #payrollFinal .mpPdfRow{grid-template-columns:1fr}
      }
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

  function applyEmployeeSimpleMode(mode=''){
    try{
      if(appSession?.type!=='employee') return;
      const root=document.getElementById('worker');if(!root)return;
      root.dataset.mfSimpleMode=mode||'';
      const docs=document.getElementById('mfEmployeeDocumentsCard');
      const payroll=document.getElementById('mfEmployeePayrollCard');
      const hoursPanel=document.getElementById('mfHoursPanel');
      const hoursIssue=hoursPanel?[...hoursPanel.children].find(x=>x!==docs&&x!==payroll):null;
      const contact=document.getElementById('mfContactPanel');
      const shortage=document.getElementById('mfShortageCard');
      const messages=contact?[...contact.querySelectorAll(':scope>.mfReportGrid>article')].find(x=>x!==shortage):null;

      [docs,payroll,hoursIssue,shortage,messages].forEach(x=>{if(x)x.style.display='';});
      document.querySelectorAll('#mfEmployeePayroll .mpWorkerFacts span').forEach(x=>x.style.display='');
      document.querySelectorAll('#mfEmployeePayroll .mpWorkerFacts,#mfEmployeePayroll .mcBonusFormula').forEach(x=>x.style.display='');

      if(mode==='documents'){
        if(payroll)payroll.style.display='none';
        if(hoursIssue)hoursIssue.style.display='none';
      }else if(mode==='attendance'){
        if(docs)docs.style.display='none';
        if(hoursIssue)hoursIssue.style.display='none';
        document.querySelectorAll('#mfEmployeePayroll .mpWorkerFacts span').forEach(x=>{if((x.textContent||'').includes('בונוס'))x.style.display='none';});
        document.querySelectorAll('#mfEmployeePayroll .mcBonusFormula').forEach(x=>x.style.display='none');
        document.querySelectorAll('#mfEmployeePayroll .mpWorkerFacts').forEach(x=>x.style.display='');
        const h=payroll?.querySelector('h2');if(h)h.textContent='שעות נוכחות';
        const p=payroll?.querySelector('p');if(p)p.textContent='השעות שנשמרו עבורך לפי חודש.';
      }else if(mode==='bonus'){
        if(docs)docs.style.display='none';
        if(hoursIssue)hoursIssue.style.display='none';
        document.querySelectorAll('#mfEmployeePayroll .mpWorkerFacts span').forEach(x=>{if(!(x.textContent||'').includes('בונוס'))x.style.display='none';});
        document.querySelectorAll('#mfEmployeePayroll .mpWorkerFacts').forEach(x=>x.style.display='none');
        document.querySelectorAll('#mfEmployeePayroll .mcBonusFormula').forEach(x=>x.style.display='');
        const h=payroll?.querySelector('h2');if(h)h.textContent='בונוסים';
        const p=payroll?.querySelector('p');if(p)p.textContent='הבונוסים שנשמרו עבורך לפי חודש.';
      }else{
        const h=payroll?.querySelector('h2');if(h)h.textContent='שעות ובונוסים';
        const p=payroll?.querySelector('p');if(p)p.textContent='נתונים שנשמרו עבורך במערכת. התלוש הרשמי הוא הקובע.';
      }

      if(mode==='shortage'&&messages)messages.style.display='none';
      if(mode==='messages'&&shortage)shortage.style.display='none';
    }catch(_){ }
  }

  function polishEmployeeMenu(){
    try{
      if(appSession?.type!=='employee') return;
      const home=document.getElementById('mfHome');if(!home)return;
      const welcome=home.querySelector('.mfWelcome p');if(welcome)welcome.textContent='מה ברצונך לעשות?';
      const docs=home.querySelector('.mfAction.docs');
      if(docs && docs.dataset.mfPolished!=='1'){
        docs.dataset.mfPolished='1';
        const b=docs.querySelector('b'),small=docs.querySelector('small');
        if(b)b.textContent='הנתונים שלי';if(small)small.textContent='תלושים, דוחות ומסמכים אישיים';
        docs.addEventListener('click',()=>setTimeout(()=>applyEmployeeSimpleMode('documents'),40));
      }
      const hours=home.querySelector('.mfAction.hours');
      if(hours && hours.dataset.mfPolished!=='1'){
        hours.dataset.mfPolished='1';
        const b=hours.querySelector('b'),small=hours.querySelector('small');
        if(b)b.textContent='שעות נוכחות';if(small)small.textContent='צפייה בשעות שנשמרו עבורך';
        hours.addEventListener('click',()=>setTimeout(()=>applyEmployeeSimpleMode('attendance'),40));
        const bonus=hours.cloneNode(true);bonus.classList.remove('hours');bonus.classList.add('messages');bonus.removeAttribute('data-mf-section');bonus.removeAttribute('data-mf-focus');bonus.dataset.mfBonus='1';
        const bb=bonus.querySelector('b'),bs=bonus.querySelector('small'),bi=bonus.querySelector('.mfActionIcon');if(bb)bb.textContent='בונוסים';if(bs)bs.textContent='צפייה בבונוסים לפי חודש';if(bi)bi.textContent='₪';
        bonus.onclick=()=>{hours.click();setTimeout(()=>{applyEmployeeSimpleMode('bonus');document.getElementById('mfEmployeePayrollCard')?.scrollIntoView({behavior:'smooth',block:'start'});},120)};
        hours.after(bonus);
      }
      const shortage=home.querySelector('.mfAction.report');
      if(shortage&&shortage.dataset.mfSimpleBound!=='1'){shortage.dataset.mfSimpleBound='1';shortage.addEventListener('click',()=>setTimeout(()=>applyEmployeeSimpleMode('shortage'),40));}
      const messages=home.querySelector('.mfAction.messages:not([data-mf-bonus])');
      if(messages&&messages.dataset.mfSimpleBound!=='1'){messages.dataset.mfSimpleBound='1';messages.addEventListener('click',()=>setTimeout(()=>applyEmployeeSimpleMode('messages'),40));}
      home.querySelectorAll('.mfAction.schedule,.mfAction.availability').forEach(b=>{if(b.dataset.mfSimpleBound==='1')return;b.dataset.mfSimpleBound='1';b.addEventListener('click',()=>applyEmployeeSimpleMode(''));});
      const back=document.getElementById('mfBackHome');if(back&&back.dataset.mfSimpleBound!=='1'){back.dataset.mfSimpleBound='1';back.addEventListener('click',()=>applyEmployeeSimpleMode(''));}
      const activeMode=document.getElementById('worker')?.dataset.mfSimpleMode||'';if(activeMode)applyEmployeeSimpleMode(activeMode);
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
  const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enforce,35)});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(enforce,120),{once:true}); else setTimeout(enforce,80);
})();