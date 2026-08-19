(() => {
  'use strict';
  const VERSION='20260819-final-manager-home-2';
  const isAdmin=()=>{try{return appSession?.type==='admin'}catch(_){return false}};
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const sunday=offset=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-d.getDay()+offset);return iso(d)};
  const fmt=week=>{const d=new Date(week+'T12:00:00'),e=new Date(d);e.setDate(d.getDate()+5);return `${d.toLocaleDateString('he-IL',{day:'numeric',month:'numeric'})}–${e.toLocaleDateString('he-IL',{day:'numeric',month:'numeric'})}`};
  const statusText=s=>({published:'פורסם',availability_open:'פתוח להגשת משמרות',draft:'טיוטה',closed:'סגור'}[s]||'לא נפתח');
  let loading=false;

  function style(){if(document.getElementById('mfManagerHomeStyle'))return;const s=document.createElement('style');s.id='mfManagerHomeStyle';s.textContent=`.mfManagerWeeks{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin:0 0 13px}.mfWeekHero{border:1px solid var(--line);background:#fff;border-radius:16px;padding:15px;box-shadow:0 8px 22px #1a1a2e0b}.mfWeekHero.current{border-right:6px solid var(--teal)}.mfWeekHero.next{border-right:6px solid var(--coral)}.mfWeekHero h2{margin:3px 0}.mfWeekHero p{margin:4px 0;color:var(--muted)}.mfWeekMeta{display:flex;gap:6px;flex-wrap:wrap;margin:9px 0}.mfWeekMeta span{background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:5px 8px;font-size:10px;font-weight:800}.mfManagerHomeHead{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:9px}@media(max-width:700px){.mfManagerWeeks{grid-template-columns:1fr}}`;document.head.appendChild(s)}

  function ensure(){
    if(!isAdmin())return null;const overview=document.getElementById('overview');if(!overview)return null;
    let root=document.getElementById('mfManagerWeeks');if(root)return root;
    root=document.createElement('section');root.id='mfManagerWeeks';root.innerHTML='<div class="mfManagerHomeHead"><div><b>מרכז הסידור</b><small style="display:block;color:var(--muted)">השבוע הפעיל והשבוע הבא מופרדים כדי שלא יהיה בלבול.</small></div><button type="button" class="btn secondary" id="mfManagerWeeksRefresh">רענון</button></div><div class="mfManagerWeeks"><article class="mfWeekHero current" id="mfCurrentWeekCard"><small>השבוע הפעיל</small><h2>טוען…</h2></article><article class="mfWeekHero next" id="mfNextWeekCard"><small>השבוע הבא</small><h2>טוען…</h2></article></div>';
    root.dataset.mfMounted='1';overview.prepend(root);document.getElementById('mfManagerWeeksRefresh').onclick=load;return root;
  }

  async function weekInfo(weekStart){
    const {data:week,error}=await supabaseClient.from('work_weeks').select('id,week_start,status,published_at').eq('week_start',weekStart).maybeSingle();if(error)throw error;
    if(!week)return {weekStart,status:null,assignments:0,submitted:0};
    const [a,s]=await Promise.all([
      supabaseClient.from('work_assignments').select('id',{count:'exact',head:true}).eq('week_id',week.id).eq('status','approved'),
      supabaseClient.from('staff_week_submissions').select('staff_id',{count:'exact',head:true}).eq('week_id',week.id)
    ]);
    if(a.error||s.error)throw a.error||s.error;
    return {weekStart,status:week.status,assignments:a.count||0,submitted:s.count||0};
  }

  async function openWeek(weekStart){
    await window.loadAdminFinalData?.(weekStart);
    document.querySelector('.adminTabs [data-target="adminSchedule"]')?.click();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  async function load(){
    if(loading||!isAdmin()||!ensure())return;loading=true;
    const cur=sunday(0),next=sunday(7),curBox=document.getElementById('mfCurrentWeekCard'),nextBox=document.getElementById('mfNextWeekCard');
    curBox.innerHTML='<small>השבוע הפעיל</small><h2>טוען…</h2>';nextBox.innerHTML='<small>השבוע הבא</small><h2>טוען…</h2>';
    try{
      const [c,n]=await Promise.all([weekInfo(cur),weekInfo(next)]);
      curBox.innerHTML=`<small>השבוע הפעיל</small><h2>${fmt(cur)}</h2><p><b>${statusText(c.status)}</b></p><div class="mfWeekMeta"><span>${c.assignments} שיבוצים</span><span>${c.submitted} הגישו זמינות</span></div><button type="button" class="btn primary" id="mfOpenCurrentWeek">${c.status==='published'?'עריכת הסידור המפורסם':'פתיחת השבוע'}</button>`;
      nextBox.innerHTML=`<small>השבוע הבא</small><h2>${fmt(next)}</h2><p><b>${statusText(n.status)}</b></p><div class="mfWeekMeta"><span>${n.assignments} שיבוצים</span><span>${n.submitted} הגישו זמינות</span></div><button type="button" class="btn primary" id="mfOpenNextWeek">ניהול השבוע הבא</button>`;
      document.getElementById('mfOpenCurrentWeek').onclick=()=>openWeek(cur);document.getElementById('mfOpenNextWeek').onclick=()=>openWeek(next);
    }catch(e){console.error('manager home',e);curBox.innerHTML='<small>השבוע הפעיל</small><h2>טעינת הנתונים נכשלה</h2>';nextBox.innerHTML='<small>השבוע הבא</small><h2>טעינת הנתונים נכשלה</h2>'}
    finally{loading=false}
  }

  function mount(){
    style();const root=ensure();if(root&&root.dataset.mfLoaded!=='1'){root.dataset.mfLoaded='1';load()}
  }

  let timer=null;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(mount,80)}).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('focus',()=>{if(isAdmin())load()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,180),{once:true});else setTimeout(mount,100);
})();