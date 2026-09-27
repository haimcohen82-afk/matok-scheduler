(() => {
  'use strict';
  // SIDIR navigation: every page and nested form has an explicit back route.
  // No browser-history guesses or reloads: this preserves unsaved form data.
  const employee=()=>{try{return appSession?.type==='employee'}catch(_){return false}};
  const admin=()=>{try{return appSession?.type==='admin'}catch(_){return false}};
  function style(){
    if(document.getElementById('matokNavigationStyle'))return;
    const s=document.createElement('style');s.id='matokNavigationStyle';
    s.textContent='.matokFlowBack{display:flex;justify-content:flex-start;margin:0 0 11px;gap:8px}.matokFlowBack .btn{min-height:40px;padding:8px 15px;font-weight:900;cursor:pointer}.matokModalBack{margin:0 0 12px;display:flex;justify-content:flex-start}.matokModalBack .btn{min-height:39px}@media(max-width:550px){.matokFlowBack .btn,.matokModalBack .btn{min-width:105px}}@media print{.matokFlowBack,.matokModalBack{display:none!important}}';
    document.head.appendChild(s);
  }
  function button(label,handler,container,kind){
    const b=document.createElement('button');
    b.type='button';b.className='btn secondary';b.textContent=label;
    b.setAttribute('aria-label',label);b.onclick=handler;
    const nav=document.createElement('nav');
    nav.className=kind==='modal'?'matokModalBack':'matokFlowBack';
    nav.dataset.matokNav='1';nav.appendChild(b);
    container.prepend(nav);
  }
  function adminHome(){
    const overview=document.querySelector('#admin .adminTabs [data-target="overview"]');
    if(overview)overview.click();
    else document.getElementById('overview')?.classList.add('active');
    window.scrollTo?.({top:0,behavior:'smooth'});
  }
  function payrollHome(){
    const tab=document.querySelector('#payrollFinal .mpNav [data-mp="dash"]');
    tab?.click();document.getElementById('payrollFinal')?.scrollIntoView?.({block:'start',behavior:'smooth'});
  }
  function addPageControls(){
    if(employee()){
      document.querySelectorAll('#worker > .panel').forEach(panel=>{
        if(panel.querySelector(':scope > .matokFlowBack'))return;
        button('← חזרה לתפריט הראשי',()=>window.showEmployeeHome?.(),panel,'page');
      });
    }
    if(admin()){
      document.querySelectorAll('#admin > .panel').forEach(panel=>{
        if(panel.id==='overview'||panel.querySelector(':scope > .matokFlowBack'))return;
        button('← חזרה ללוח הניהול',adminHome,panel,'page');
      });
      document.querySelectorAll('#payrollFinal > .mpSub').forEach(sub=>{
        if(sub.id==='mp-dash'||sub.querySelector(':scope > .matokFlowBack'))return;
        button('← חזרה לתפריט השכר',payrollHome,sub,'page');
      });
    }
  }
  function addModalControls(){
    document.querySelectorAll('.modal').forEach(modal=>{
      const content=modal.querySelector(':scope > section');
      if(!content||content.querySelector(':scope > .matokModalBack'))return;
      button('← חזרה',()=>{if(typeof closeModal==='function')closeModal(modal.id);
        else{modal.classList.remove('show');document.body.style.overflow='';}},content,'modal');
    });
  }
  let pending=false;
  function ensure(){
    pending=false;
    style();addPageControls();addModalControls();
  }
  function schedule(){
    if(pending)return;
    pending=true;setTimeout(ensure,70);
  }
  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
  else schedule();
  window.matokRefreshBackNavigation=schedule;
})();