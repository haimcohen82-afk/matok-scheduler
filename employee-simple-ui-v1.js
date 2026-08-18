(() => {
  'use strict';
  const VERSION = '20260818-employee-simple-ui-1';
  let initializedFor = '';
  let currentSection = '';
  let lastScheduleMetaAt = 0;
  let scheduleMetaBusy = false;
  let observerTimer = null;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const svg = path => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${path}</svg>`;
  const icons = {
    schedule: svg('<rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 18h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
    availability: svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 12.5l2.5 2.5L16.5 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
    report: svg('<path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 9h8M8 13h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
    docs: svg('<path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3v5h5M9 13h6M9 17h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
    hours: svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
    messages: svg('<path d="M4 5h16v12H9l-5 4V5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 9h8M8 13h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>')
  };

  function isEmployee(){
    try { return appSession?.type === 'employee'; } catch (_) { return false; }
  }
  function worker(){ return document.getElementById('worker'); }
  function employeeName(){
    try { return workerContext?.full_name || appSession?.user?.name || ''; } catch (_) { return ''; }
  }
  function targetWeekText(){
    try { return workerTargetWeek ? weekLabel(workerTargetWeek) : ''; } catch (_) { return ''; }
  }
  function dayGreeting(){
    const h = new Date().getHours();
    if(h < 12) return 'בוקר טוב';
    if(h < 18) return 'צהריים טובים';
    return 'ערב טוב';
  }

  function addStyles(){
    if(document.getElementById('employeeSimpleUiStyles')) return;
    const style = document.createElement('style');
    style.id = 'employeeSimpleUiStyles';
    style.textContent = `
      body.employeeSimplePortal .notice{display:none!important}
      body.employeeSimplePortal .top .switch{display:none!important}
      body.employeeSimplePortal .top{min-height:64px;height:auto;padding-top:8px;padding-bottom:8px}
      #worker.employeeSimpleUi>.hero{display:none!important}
      #worker.employeeSimpleUi>.workerTabs{display:none!important}
      #worker.employeeSimpleUi.employeeHomeMode>.panel{display:none!important}
      #worker.employeeSimpleUi.employeeHomeMode>.metricRow{display:none!important}
      #worker.employeeSimpleUi.employeeSectionMode>.metricRow{display:none!important}
      #worker.employeeSimpleUi.employeeSectionMode.employeeAvailabilityMode>.metricRow{display:grid!important}
      #worker.employeeSimpleUi #employeeEngagementBanner{display:none!important}
      .employeeSimpleHome{display:none}
      #worker.employeeSimpleUi.employeeHomeMode .employeeSimpleHome{display:block}
      .employeeWelcomeCard{position:relative;overflow:hidden;background:linear-gradient(145deg,#1a1a2e 0%,#242642 100%);color:#fff;border-radius:22px;padding:22px 20px 20px;box-shadow:0 14px 32px #1a1a2e24;margin-bottom:15px}
      .employeeWelcomeCard:after{content:"";position:absolute;width:150px;height:150px;border-radius:50%;left:-54px;top:-58px;background:#ffffff0b;border:1px solid #ffffff14}
      .employeeWelcomeEyebrow{font-size:12px;font-weight:800;opacity:.72;margin-bottom:3px}
      .employeeWelcomeCard h1{font-size:28px;line-height:1.2;margin:0 0 6px;font-weight:900}
      .employeeWelcomeCard p{margin:0;color:#ffffffc7;font-size:14px}
      .employeeHomeQuestion{font-size:18px;font-weight:900;margin:17px 2px 10px}
      .employeeActionGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .employeeActionCard{position:relative;min-height:154px;border:1px solid var(--line);background:#fff;border-radius:20px;padding:16px 13px 14px;text-align:right;color:var(--ink);box-shadow:0 8px 22px #1a1a2e0b;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease}
      .employeeActionCard:active{transform:scale(.985)}
      .employeeActionCard .employeeActionIcon{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;margin-bottom:11px;background:var(--soft);color:var(--ink)}
      .employeeActionCard .employeeActionIcon svg{width:28px;height:28px}
      .employeeActionCard b{font-size:16px;line-height:1.25}
      .employeeActionCard small{display:block;color:var(--muted);font-size:11px;line-height:1.45;margin-top:4px}
      .employeeActionCard.primaryAction{background:#fff7f2;border-color:#e9b5a8}
      .employeeActionCard.primaryAction .employeeActionIcon{background:#f7d5cc;color:#8d3d2f}
      .employeeActionCard.scheduleAction{background:#eef8f6;border-color:#a8d7cf}
      .employeeActionCard.scheduleAction .employeeActionIcon{background:#d5efea;color:#296d63}
      .employeeActionCard.docsAction .employeeActionIcon{background:#e9f0f8;color:#3c6386}
      .employeeActionCard.hoursAction .employeeActionIcon{background:#fff1cf;color:#8a6720}
      .employeeActionCard.messagesAction .employeeActionIcon{background:#eee9f7;color:#63448b}
      .employeeActionCard.reportAction .employeeActionIcon{background:#f7e5df;color:#934d3c}
      .employeeHomeHint{margin-top:12px;border:1px solid #b9ddd7;background:#f1faf8;border-radius:14px;padding:12px 13px;font-size:12px;line-height:1.55;color:#315f58}
      .employeeHomeHint b{display:block;color:#234d47;margin-bottom:2px}
      .employeeSectionHeader{display:none;position:sticky;top:72px;z-index:18;background:rgba(245,240,232,.96);backdrop-filter:blur(8px);padding:8px 0 10px;margin:0 0 10px;border-bottom:1px solid #ded9d177}
      #worker.employeeSimpleUi.employeeSectionMode .employeeSectionHeader{display:block}
      .employeeSectionTop{display:flex;gap:10px;align-items:center}
      .employeeBackBtn{height:46px;flex:0 0 auto;border:1px solid var(--line);border-radius:14px;background:#fff;color:var(--ink);display:flex;align-items:center;justify-content:center;padding:0 15px;font-size:13px;font-weight:900;box-shadow:0 5px 16px #1a1a2e0b}
      .employeeSectionTitleBox{min-width:0;flex:1}
      .employeeSectionTitleBox h2{margin:0;font-size:21px;line-height:1.2}
      .employeeSectionTitleBox p{margin:3px 0 0;color:var(--muted);font-size:12px;line-height:1.35}
      #worker.employeeSimpleUi.employeeSectionMode>.panel.active{animation:employeePanelIn .18s ease}
      @keyframes employeePanelIn{from{opacity:.3;transform:translateY(5px)}to{opacity:1;transform:none}}
      #worker.employeeSimpleUi.employeeSectionMode #availability .compactExplain{margin-top:0}
      #worker.employeeSimpleUi.employeeSectionMode .workerFinishPanel{border-radius:16px}
      #worker.employeeSimpleUi.employeeSectionMode .card{border-radius:16px}
      @media(min-width:720px){.employeeActionGrid{grid-template-columns:repeat(3,minmax(0,1fr))}.employeeActionCard{min-height:165px}.employeeWelcomeCard{padding:27px}.employeeWelcomeCard h1{font-size:32px}}
      @media(max-width:430px){
        body.employeeSimplePortal .wrap{padding:10px 10px 90px}
        .employeeWelcomeCard{padding:19px 16px 17px;border-radius:19px}
        .employeeWelcomeCard h1{font-size:25px}
        .employeeActionGrid{gap:8px}
        .employeeActionCard{min-height:145px;border-radius:18px;padding:13px 11px}
        .employeeActionCard .employeeActionIcon{width:52px;height:52px;margin-bottom:9px}
        .employeeActionCard .employeeActionIcon svg{width:25px;height:25px}
        .employeeActionCard b{font-size:15px}
        .employeeActionCard small{font-size:10px}
        .employeeSectionHeader{top:64px}
      }
    `;
    document.head.appendChild(style);
  }

  function buildHome(){
    const root = worker();
    if(!root || document.getElementById('employeeSimpleHome')) return;
    const home = document.createElement('section');
    home.id = 'employeeSimpleHome';
    home.className = 'employeeSimpleHome';
    home.innerHTML = `
      <div class="employeeWelcomeCard">
        <div class="employeeWelcomeEyebrow">MATOK BASIC · אזור אישי</div>
        <h1 id="employeeSimpleGreeting">${esc(dayGreeting())}</h1>
        <p>מה תרצי לעשות עכשיו?</p>
      </div>
      <div class="employeeHomeQuestion">בחרי פעולה</div>
      <div class="employeeActionGrid">
        <button type="button" class="employeeActionCard scheduleAction" data-simple-target="scheduleWorker">
          <span class="employeeActionIcon">${icons.schedule}</span><b>הסידור שלי</b><small id="employeeScheduleMeta">צפייה בסידור העבודה שפורסם</small>
        </button>
        <button type="button" class="employeeActionCard primaryAction" data-simple-target="availability">
          <span class="employeeActionIcon">${icons.availability}</span><b>הגשת משמרות</b><small id="employeeAvailabilityMeta">זמינות לשבוע הבא</small>
        </button>
        <button type="button" class="employeeActionCard reportAction" data-simple-target="contact">
          <span class="employeeActionIcon">${icons.report}</span><b>דיווח / חוסרים</b><small>חוסר בחנות, בקשה או רעיון לשיפור</small>
        </button>
        <button type="button" class="employeeActionCard docsAction" data-simple-target="hours" data-simple-anchor="employeeDocumentsCard">
          <span class="employeeActionIcon">${icons.docs}</span><b>תלושים ודוחות</b><small>תלושי שכר ודוחות שעות אישיים</small>
        </button>
        <button type="button" class="employeeActionCard hoursAction" data-simple-target="hours" data-simple-anchor="workerPayrollSummary">
          <span class="employeeActionIcon">${icons.hours}</span><b>שעות ובונוסים</b><small>צפייה בשעות ובבונוסים שנשמרו</small>
        </button>
        <button type="button" class="employeeActionCard messagesAction" data-simple-target="contact" data-simple-anchor="myMessagesList">
          <span class="employeeActionIcon">${icons.messages}</span><b>הפניות שלי</b><small>לראות אם המנהל צפה או ענה</small>
        </button>
      </div>
      <div class="employeeHomeHint"><b>משהו השתנה בחנות?</b>חוסר, תקלה, שינוי או רעיון — שלחי דרך „דיווח / חוסרים”. זה מגיע ישירות למנהל.</div>
    `;
    const hero = root.querySelector(':scope > .hero');
    if(hero) hero.after(home); else root.prepend(home);
    home.querySelectorAll('[data-simple-target]').forEach(btn => {
      btn.addEventListener('click', () => openSection(btn.dataset.simpleTarget, btn.dataset.simpleAnchor || ''));
    });
  }

  function buildSectionHeader(){
    const root = worker();
    if(!root || document.getElementById('employeeSectionHeader')) return;
    const header = document.createElement('div');
    header.id = 'employeeSectionHeader';
    header.className = 'employeeSectionHeader';
    header.innerHTML = `
      <div class="employeeSectionTop">
        <button type="button" class="employeeBackBtn" id="employeeBackHome" aria-label="חזרה לתפריט הראשי">חזרה</button>
        <div class="employeeSectionTitleBox"><h2 id="employeeSectionTitle">האזור שלי</h2><p id="employeeSectionSubtitle"></p></div>
      </div>`;
    const tabs = root.querySelector(':scope > .workerTabs');
    if(tabs) tabs.after(header); else root.prepend(header);
    document.getElementById('employeeBackHome').addEventListener('click', showHome);
  }

  function sectionCopy(target, anchor){
    const week = targetWeekText();
    if(target === 'scheduleWorker') return ['הסידור שלי', 'המשמרות שפורסמו עבורך לשבוע הנוכחי'];
    if(target === 'availability') return ['הגשת משמרות', week ? `זמינות לשבוע ${week} · סמני רק מתי אינך יכולה` : 'זמינות לשבוע הבא'];
    if(target === 'contact' && anchor === 'myMessagesList') return ['הפניות שלי', 'כאן רואים אם המנהל צפה, ענה או סיים טיפול'];
    if(target === 'contact') return ['דיווח / חוסרים', 'שלחי חוסר בחנות, בקשה, שינוי או הצעת ייעול'];
    if(target === 'hours' && anchor === 'employeeDocumentsCard') return ['תלושים ודוחות', 'המסמכים האישיים שלך נשמרים כאן בצורה פרטית'];
    if(target === 'hours' && anchor === 'workerPayrollSummary') return ['שעות ובונוסים', 'צפייה בנתוני השעות והבונוסים שנשמרו עבורך'];
    if(target === 'hours') return ['השעות והשכר שלי', 'הנתונים האישיים והמסמכים שלך'];
    return ['האזור שלי', ''];
  }

  function activateOriginalTab(target){
    const root = worker();
    const tab = root?.querySelector(`.workerTabs button[data-target="${target}"]`);
    if(tab){
      tab.click();
      return true;
    }
    if(root){
      root.querySelectorAll(':scope > .panel').forEach(p => p.classList.toggle('active', p.id === target));
    }
    return false;
  }

  function openSection(target, anchor=''){
    if(!isEmployee()) return;
    const root = worker();
    if(!root) return;
    currentSection = target;
    activateOriginalTab(target);
    root.classList.remove('employeeHomeMode','employeeAvailabilityMode');
    root.classList.add('employeeSectionMode');
    if(target === 'availability') root.classList.add('employeeAvailabilityMode');
    const [title, subtitle] = sectionCopy(target, anchor);
    const titleEl = document.getElementById('employeeSectionTitle');
    const subEl = document.getElementById('employeeSectionSubtitle');
    if(titleEl) titleEl.textContent = title;
    if(subEl) subEl.textContent = subtitle;
    window.scrollTo({top:0,behavior:'smooth'});
    if(anchor){
      let tries = 0;
      const seek = setInterval(() => {
        tries++;
        const el = document.getElementById(anchor);
        if(el){ clearInterval(seek); el.scrollIntoView({behavior:'smooth', block:'start'}); }
        else if(tries >= 12) clearInterval(seek);
      }, 120);
    }
  }

  function showHome(){
    if(!isEmployee()) return;
    const root = worker();
    if(!root) return;
    currentSection = '';
    root.classList.remove('employeeSectionMode','employeeAvailabilityMode');
    root.classList.add('employeeHomeMode');
    updateLabels();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  async function updateScheduleMeta(){
    const el = document.getElementById('employeeScheduleMeta');
    if(!el || !isEmployee() || scheduleMetaBusy) return;
    if(Date.now() - lastScheduleMetaAt < 10000) return;
    lastScheduleMetaAt = Date.now();
    scheduleMetaBusy = true;
    try{
      const s = appSession;
      const {data,error} = await supabaseClient.rpc('employee_get_current_schedule_v2', {
        p_staff_id:s.user.id,p_username:s.username,p_code:s.code
      });
      if(error) return;
      const x = Array.isArray(data) ? data[0] : data;
      const text = x?.published && x.week_start ? `פורסם · שבוע ${weekLabel(x.week_start)}` : 'עדיין לא פורסם סידור לשבוע הנוכחי';
      if(el.textContent !== text) el.textContent = text;
    }catch(_){ } finally { scheduleMetaBusy = false; }
  }

  function updateLabels(){
    const name = employeeName();
    const greet = document.getElementById('employeeSimpleGreeting');
    const greetText = `${dayGreeting()}${name ? ', ' + name : ''}`;
    if(greet && greet.textContent !== greetText) greet.textContent = greetText;
    const week = targetWeekText();
    const av = document.getElementById('employeeAvailabilityMeta');
    const avText = week ? `לשבוע ${week}` : 'זמינות לשבוע הבא';
    if(av && av.textContent !== avText) av.textContent = avText;
    updateScheduleMeta();
  }

  function installForEmployee(){
    if(!isEmployee()) return false;
    const root = worker();
    if(!root) return false;
    const id = String(appSession?.user?.id || employeeName() || 'employee');
    addStyles();
    buildHome();
    buildSectionHeader();
    document.body.classList.add('employeeSimplePortal');
    root.classList.add('employeeSimpleUi');
    updateLabels();
    if(initializedFor !== id){
      initializedFor = id;
      showHome();
    }
    return true;
  }

  function removeEmployeeShellForAdmin(){
    if(isEmployee()) return;
    document.body.classList.remove('employeeSimplePortal');
    const root = worker();
    root?.classList.remove('employeeSimpleUi','employeeHomeMode','employeeSectionMode','employeeAvailabilityMode');
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    if(isEmployee()) installForEmployee(); else removeEmployeeShellForAdmin();
    if(attempts > 600) clearInterval(timer);
  }, 250);

  const obs = new MutationObserver(() => {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(() => {
      if(isEmployee()){
        if(!document.getElementById('employeeSimpleHome') || !document.getElementById('employeeSectionHeader')) installForEmployee();
        else if(!currentSection) updateLabels();
      }
    }, 80);
  });
  obs.observe(document.documentElement,{subtree:true,childList:true});

  window.employeeSimpleHome = showHome;
  window.employeeSimpleOpen = openSection;
})();