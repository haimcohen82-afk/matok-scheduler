(function matokManagerAttendance(){
'use strict';
let mounted=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const t=v=>v?new Date(v).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'}):'—';
const el=x=>document.getElementById(x);
const isAdmin=()=>{try{return appSession?.type==='admin'}catch(_){return false}};
const notice=s=>{try{toast?.(s)}catch(_){alert(s)}};
function mount(){
 if(mounted||!isAdmin())return;
 const admin=el('admin'),tabs=document.querySelector('#admin .adminTabs');
 if(!admin||!tabs)return;
 mounted=true;
 const b=document.createElement('button');b.type='button';b.id='matokAttendanceAdminTab';b.textContent='שעון נוכחות';tabs.appendChild(b);
 const root=document.createElement('section');root.className='panel';root.id='matokAttendanceAdmin';
 root.innerHTML='<div class="employeeHead"><div><h2>מרכז הנוכחות</h2><small>שעות מקוריות, בקשות תיקון ומספרי עובד.</small></div><button type="button" class="btn secondary" id="matokAttendanceBack">חזרה לסקירה</button></div>'+
 '<article class="card"><div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap"><label>חודש<input type="month" id="matokAttendanceMonth"></label><button type="button" class="btn secondary" id="matokAttendanceReload">רענון</button></div><div id="matokAttendanceRows" style="overflow-x:auto;margin-top:12px"></div></article>'+
 '<article class="card"><h3>הגדרת החנות לדיווח מיקום</h3><p>הגדרה זו מתבצעת בידי מנהל הנמצא בתוך החנות. היא אינה מפעילה מעקב רציף בטלפון העובדות.</p><div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap"><label>רדיוס<select id="matokAttendanceRadius"><option value="100">100 מטר</option><option value="150" selected>150 מטר</option><option value="200">200 מטר</option></select></label><button type="button" class="btn primary" id="matokAttendanceConfigure">הגדרת מיקום החנות מהמכשיר שלי</button></div><div id="matokAttendanceSiteNote" style="margin-top:10px;font-size:12px"></div></article>';
 admin.appendChild(root);
 el('matokAttendanceMonth').value=new Date().toISOString().slice(0,7);
 b.onclick=()=>{admin.querySelectorAll(':scope > .panel').forEach(p=>p.classList.remove('active'));tabs.querySelectorAll('button').forEach(t=>t.classList.remove('active'));root.classList.add('active');b.classList.add('active');load()};
 el('matokAttendanceBack').onclick=()=>tabs.querySelector('[data-target="overview"]')?.click();
 el('matokAttendanceReload').onclick=load;el('matokAttendanceConfigure').onclick=configure;
 const style=document.createElement('style');style.textContent='#matokAttendance table{width:100%;border-collapse:collapse;text-align:center;font-size:11px}#matokAttendance td,#matokAttendance th{border-bottom:1px solid #ded9d1;padding:9px 6px;text-align:center}#matokAttendance th{background:#f5f0e8}#matokAttendance .btn{font-size:12px}';document.head.appendChild(style);
}
async function load(){
 if(!isAdmin())return;
 const box=el('matokAttendanceRows');if(!box)return;box.textContent='טוען את הדיווחים…';
 const p=(el('matokAttendanceMonth')?.value||new Date().toISOString().slice(0,7))+'-01';
 try{
  const {data,error}=await supabaseClient.rpc('admin_attendance_overview',{p_from:p});if(error)throw error;
  el('matokAttendanceSiteNote').textContent=data.sites?.length?data.sites.map(s=>s.label+' · '+s.radius_m+' מטר').join(' | '):'מיקום החנות טרם הוגדר. עד להגדרה זמינה קליטת שעות ידנית לאישור.';
  const rows=data.entries||[];
  box.innerHTML='<table><thead><tr><th>עובדת</th><th>מס׳</th><th>כניסה</th><th>יציאה</th><th>סטטוס</th><th></th></tr></thead><tbody>'+
   (rows.length?rows.map(s=>'<tr><td>'+esc(s.full_name)+'</td><td>'+esc(s.employee_number||'—')+'</td><td>'+esc(t(s.clock_in_at))+'</td><td>'+esc(t(s.clock_out_at))+'</td><td>'+esc(s.status==='review_required'?'ממתין לבקרה':s.clock_out_at?'מאומת':'פעיל')+'</td><td>'+(s.status==='review_required'&&s.clock_out_at?'<button type="button" class="btn primary" data-approve-att="'+esc(s.id)+'">אישור</button>':'')+'</td></tr>').join(''):'<tr><td colspan="6">אין דיווחים לחודש הנבחר.</td></tr>')+'</tbody></table>';
  box.querySelectorAll('[data-approve-att]').forEach(b=>b.onclick=async()=>{
    const why=prompt('מה נבדק? יש לרשום סיבת אישור לביקורת.');if(!why||why.trim().length<4)return;
    b.disabled=true;try{const {error}=await supabaseClient.rpc('admin_approve_attendance',{p_entry_id:b.dataset.approveAtt,p_note:why.trim()});if(error)throw error;notice('הדיווח אושר');await load()}catch(e){console.error(e);notice('האישור לא נשמר');b.disabled=false}
  });
 }catch(e){console.error('attendance dashboard',e);box.textContent='טעינת הנוכחות נכשלה.'}
}
function configure(){
 if(!isAdmin()||!navigator.geolocation)return notice('יש להיכנס כמנהל ממכשיר התומך בשירותי מיקום.');
 if(!confirm('הגדרת המיקום חייבת להתבצע פיזית מתוך החנות. האם אתה בחנות עכשיו?'))return;
 const b=el('matokAttendanceConfigure');b.disabled=true;
 navigator.geolocation.getCurrentPosition(async p=>{
  try{
    if(p.coords.accuracy>100)throw new Error('accuracy');
    const {error}=await supabaseClient.rpc('admin_configure_attendance_site',{p_lat:p.coords.latitude,p_lon:p.coords.longitude,p_radius_m:Number(el('matokAttendanceRadius').value),p_label:'MATOK BASIC - חולון'});
    if(error)throw error;notice('מיקום החנות נשמר');await load();
  }catch(e){console.error(e);notice(e.message==='accuracy'?'דיוק המיקום נמוך, יש לנסות מתוך החנות.':'שמירת המיקום נכשלה')}finally{b.disabled=false}
 },()=>{b.disabled=false;notice('לא התקבלה הרשאת מיקום')},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
}
const watcher=new MutationObserver(()=>{mount();if(mounted)watcher.disconnect()});watcher.observe(document.documentElement,{subtree:true,childList:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();