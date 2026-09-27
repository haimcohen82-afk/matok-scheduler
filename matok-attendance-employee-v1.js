(function matokEmployeeClock(){
'use strict';
let installed=false,busy=false;
const el=id=>document.getElementById(id);
const x=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v?new Date(v).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'}):'—';
const session=()=>{try{return appSession?.type==='employee'?appSession:null}catch(_){return null}};
const creds=()=>{const s=session();return {p_staff_id:s.user.id,p_username:s.username,p_code:s.code}};
function message(t){const node=el('epToast');if(node){node.textContent=t;node.classList.add('show');setTimeout(()=>node.classList.remove('show'),3000)}else alert(t)}
function install(){
 if(installed||!session()||!el('mfHome')||!el('mfSectionHeader'))return;
 installed=true;
 const grid=el('mfHome').querySelector('.mfActionGrid');
 const btn=document.createElement('button');btn.type='button';btn.className='mfAction clock';btn.id='epOpenClock';
 btn.innerHTML='<span class="mfActionIcon" style="background:#e2f2e9;color:#326c56"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span><b>שעון נוכחות</b><small>כניסה ויציאה</small>';
 const report=grid.querySelector('.mfAction.report');grid.insertBefore(btn,report||null);btn.onclick=openClock;
 const page=document.createElement('section');page.id='epClock';page.className='panel mfPanelClean';
 page.innerHTML='<div id="epClockContent"></div>';
 el('worker').appendChild(page);
 
 const css=document.createElement('style');css.textContent='#epClock .clockBox{background:#fff;border:1px solid #d8e1db;border-radius:12px;padding:12px;margin-bottom:9px}#epClock .clockStatus{background:#eef8ef;text-align:center;padding:12px;border-radius:10px;font-size:17px;font-weight:900}#epClock .clockButtons{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:11px}#epClock .clockButtons button{min-height:45px}#epClock summary{cursor:pointer;font-weight:800;margin:9px 0}#epClock textarea{min-height:64px;width:100%;}#epClock .clockRow{display:flex;justify-content:space-between;gap:7px;padding:8px 2px;border-bottom:1px solid #eee;font-size:11px}#epClock .clockNotice{font-size:11px;color:#636363;line-height:1.55}@media(max-width:500px){#epClock .clockButtons{grid-template-columns:1fr}}';
 document.head.appendChild(css);
}
function openClock(){
 document.querySelectorAll('#worker > .panel').forEach(v=>v.classList.remove('active'));
 el('mfHome')?.classList.remove('active');
 el('mfSectionHeader')?.classList.add('active');
 if(el('mfSectionTitle'))el('mfSectionTitle').textContent='שעון נוכחות';
 if(el('mfSectionSub'))el('mfSectionSub').textContent='כניסה, יציאה והיסטוריה אישית';
 el('epClock').classList.add('active');scrollTo({top:0,behavior:'smooth'});load();
}
async function load(){
 const box=el('epClockContent');if(!box||!session())return;box.textContent='טוען נתונים…';
 try{
 const {data,error}=await supabaseClient.rpc('employee_attendance_state',creds());if(error)throw error;
 const active=!!data.open_shift,act=active?'out':'in';
 box.innerHTML='<div class="clockBox"><div class="clockStatus">'+(active?'משמרת פעילה':'אין משמרת פתוחה')+'</div><p style="text-align:center">מספר עובד: <b>'+x(data.employee_number)+'</b>'+(active?'<br>שעת התחלה: '+x(fmt(data.open_shift.clock_in_at)):'')+'</p>'+
 (!data.site_configured?'<p class="clockNotice">אימות מיקום החנות עדיין לא הופעל בידי המנהל. בינתיים ניתן לדווח ידנית עם סיבה.</p>':'<p class="clockNotice">מיקום נבדק רק בעת דיווח ולא נאסף מסלול תנועה.</p>')+
 '<div class="clockButtons"><button type="button" class="btn primary" id="epClockGeo">'+(active?'סיום':'כניסה')+' עם מיקום</button><button type="button" class="btn secondary" id="epClockRefresh">רענון</button></div><details><summary>אין שירותי מיקום? דיווח ידני לבדיקה</summary><textarea id="epClockReason" placeholder="יש לציין מדוע דרוש דיווח ידני"></textarea><button class="btn secondary" type="button" id="epClockManual">דיווח '+(active?'יציאה':'כניסה')+' ידני</button></details></div>'+
 '<div class="clockBox"><h3>היסטוריית נוכחות</h3>'+
 (data.history?.length?data.history.map(a=>'<div class="clockRow"><span>'+x(fmt(a.clock_in_at))+' — '+x(fmt(a.clock_out_at))+'</span><b>'+(a.status==='review_required'?'ממתין לבדיקת מנהל':a.clock_out_at?'הושלם':'פתוח')+'</b></div>').join(''):'<p>עדיין אין דיווחים</p>')+'</div><p class="clockNotice">השעון משתמש בזמן השרת. יציאה שנשכחה אפשר לדווח לבדיקה. אין ניכוי שעות אוטומטי על סמך GPS.</p>';
 el('epClockGeo').onclick=()=>geo(act);el('epClockManual').onclick=()=>manual(act);el('epClockRefresh').onclick=load;
 }catch(e){console.error('employee_attendance_state',e);box.textContent='טעינת שעון הנוכחות נכשלה. נסי לרענן את המערכת.'}
}
async function punch(act,extra){
 if(busy)return;busy=true;
 try{
 const {data,error}=await supabaseClient.rpc('employee_attendance_punch',{...creds(),p_action:act,...extra});if(error)throw error;
 message((act==='in'?'כניסה':'יציאה')+' נרשמה'+(data.review_required?' ותועבר לבדיקת מנהל.':'.'));await load();
 }catch(e){
 const m=e.message||'';
 message(m.includes('manual_reason_required')?'המיקום לא אומת. פתחי דיווח ידני ורשמי סיבה.':m.includes('already_clocked_in')?'כבר קיימת משמרת פתוחה.':m.includes('no_open_shift')?'אין משמרת פתוחה.':'לא נרשם שינוי. בדקי את המיקום או השתמשי בדיווח ידני.');
 console.error('attendance_punch',e);
 }finally{busy=false}
}
function manual(act){const reason=el('epClockReason')?.value.trim()||'';if(reason.length<5){message('יש לרשום סיבה של לפחות 5 תווים.');return}punch(act,{p_note:reason})}
function geo(act){
 if(!navigator.geolocation){message('אין תמיכה במיקום. ניתן לדווח ידנית.');return}
 navigator.geolocation.getCurrentPosition(p=>punch(act,{p_lat:p.coords.latitude,p_lon:p.coords.longitude,p_accuracy_m:p.coords.accuracy}),
 ()=>message('לא התקבלה הרשאת מיקום. ניתן לדווח ידנית עם סיבה.'),{enableHighAccuracy:true,maximumAge:0,timeout:15000});
}
const observer=new MutationObserver(()=>{install();if(installed)observer.disconnect()});
observer.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();