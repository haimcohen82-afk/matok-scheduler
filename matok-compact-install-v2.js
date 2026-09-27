(()=>{'use strict';
const STYLES=`
body.matokEmployeeFinal .wrap{max-width:720px!important}
#mfHome .mfWelcome{padding:16px 17px!important;border-radius:16px!important;margin-bottom:10px!important;box-shadow:0 6px 18px #1a1a2e18}
#mfHome .mfWelcome h1{font-size:23px!important;margin:2px 0 4px!important}
#mfHome .mfQuestion{text-align:center!important;font-size:16px!important;margin:10px 0!important}
#mfHome .mfActionGrid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important;justify-items:center!important}
#mfHome .mfAction{width:100%!important;max-width:124px!important;min-height:0!important;aspect-ratio:1/1!important;border-radius:50%!important;padding:9px 6px!important;box-shadow:0 4px 14px #1a1a2e0d!important}
#mfHome .mfActionIcon{width:33px!important;height:33px!important;font-size:18px!important;margin:0 0 4px!important}
#mfHome .mfAction b{font-size:12px!important;line-height:1.23!important;text-align:center!important}
#mfHome .mfAction small{font-size:9px!important;line-height:1.16!important;text-align:center!important;margin-top:3px!important}
#mfHome .mfTip{margin-top:11px!important;border-radius:12px!important;padding:10px 12px!important;line-height:1.45!important}
#worker .mfSectionHeader{padding:7px 0 9px!important;gap:8px!important}
#worker .mfSectionHeader h2{font-size:18px!important}
#worker .mfBack{min-height:42px!important}
#worker .card{padding:11px!important;border-radius:12px!important;box-shadow:0 3px 10px #1a1a2e09!important}
#admin .hero h1{font-size:21px!important}
#admin .card{padding:12px!important;border-radius:12px!important;box-shadow:0 3px 11px #1a1a2e08}
#admin .tabs button{font-size:12px!important;padding:8px 10px!important}
#admin .stat b{font-size:20px!important}
#admin table{max-width:100%;margin-inline:auto}
#admin table th,#admin table td{text-align:center!important;vertical-align:middle!important;padding:8px!important}
#admin .payrollTable,#admin .mpTable{overflow-x:auto;max-width:100%}
.matokInstallHint{margin-top:10px;text-align:center;background:#eff8f3;border:1px solid #a8d4c1;border-radius:11px;padding:9px;font-size:12px}
.matokBackOverview{margin:0 0 9px}
@media(max-width:600px){body .wrap{padding:9px!important}#admin .stats{grid-template-columns:repeat(2,minmax(0,1fr))}#mfHome .mfActionGrid{gap:7px!important}#mfHome .mfAction{padding:7px 5px!important}#mfHome .mfAction small{font-size:8.5px!important}#mfHome .mfWelcome h1{font-size:21px!important}}
@media(max-width:345px){#mfHome .mfActionGrid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
`;
let installEvent=null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event});
function apply(){
 if(!document.getElementById('matokCompactV2')){const st=document.createElement('style');st.id='matokCompactV2';st.textContent=STYLES;document.head.appendChild(st)}
 const manager=document.getElementById('admin');
 if(manager&&appSession?.type==='admin'){
  manager.querySelectorAll(':scope > section.panel').forEach(panel=>{
   if(panel.id==='overview'||panel.querySelector('.matokBackOverview'))return;
   const back=document.createElement('div');back.className='matokBackOverview';
   back.innerHTML='<button type="button" class="btn secondary">← חזרה לסקירה</button>';
   back.querySelector('button').onclick=()=>document.querySelector('.adminTabs [data-target="overview"]')?.click();
   panel.prepend(back);
  });
 }
 if(appSession?.type!=='employee')return;
 const home=document.getElementById('mfHome');if(!home||home.querySelector('#matokInstallBtn'))return;
 const hint=document.createElement('div');hint.className='matokInstallHint';
 hint.innerHTML='<b>MATOK תמיד בהישג יד</b><br><button class="btn secondary" type="button" id="matokInstallBtn">הוספה למסך הבית</button>';
 home.appendChild(hint);
 hint.querySelector('button').onclick=async()=>{
  if(window.matchMedia?.('(display-mode: standalone)')?.matches){alert('האפליקציה כבר מותקנת');return}
  if(installEvent){const e=installEvent;installEvent=null;e.prompt();await e.userChoice;return}
  alert(/iPhone|iPad|iPod/i.test(navigator.userAgent)?'ב-Safari: שיתוף ← הוספה למסך הבית':'בתפריט הדפדפן: התקנת אפליקציה / הוספה למסך הבית');
 };
}
let timer;const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(apply,90)});
observer.observe(document.documentElement,{subtree:true,childList:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();