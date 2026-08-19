(() => {
  'use strict';
  const VERSION='20260819-final-whatsapp-2';

  function decorate(){
    const modal=document.getElementById('mfWaModal');
    const list=document.getElementById('mfWaList');
    if(!modal||!list)return;
    let controls=document.getElementById('mfWaQueueControls');
    if(!controls){
      controls=document.createElement('div');controls.id='mfWaQueueControls';controls.style.cssText='margin:10px 0;padding:10px;border-radius:10px;background:var(--soft)';
      controls.innerHTML='<div id="mfWaQueueProgress" style="margin-bottom:7px;font-weight:800"></div><button type="button" class="btn primary" id="mfWaNextBtn" style="width:100%">פתח הבא ב-WhatsApp</button>';
      list.before(controls);
      document.getElementById('mfWaNextBtn').onclick=()=>{
        const next=[...list.querySelectorAll('[data-mf-wa]')].find(b=>b.dataset.mfOpened!=='1');
        if(next)next.click();
      };
    }
    list.querySelectorAll('[data-mf-wa]').forEach(b=>{
      if(b.dataset.mfQueueBound==='1')return;
      b.dataset.mfQueueBound='1';
      b.addEventListener('click',()=>{b.dataset.mfOpened='1';b.textContent='נפתח ✓';setTimeout(update,20)});
    });
    update();
  }

  function update(){
    const list=document.getElementById('mfWaList'),p=document.getElementById('mfWaQueueProgress'),next=document.getElementById('mfWaNextBtn');
    if(!list||!p)return;
    const all=[...list.querySelectorAll('[data-mf-wa]')],done=all.filter(b=>b.dataset.mfOpened==='1').length;
    p.textContent=`${done} מתוך ${all.length} הודעות נפתחו`;
    if(next){next.disabled=!all.length||done>=all.length;next.textContent=done>=all.length?'כל ההודעות נפתחו':'פתח הבא ב-WhatsApp'}
  }

  let timer=null;
  const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(decorate,35)});
  observer.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(decorate,120),{once:true});else setTimeout(decorate,80);
})();