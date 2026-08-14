(() => {
  const PERMANENT_TEXT = 'נשמר בארכיון הקבוע';

  function patchStaticText(){
    const admin=document.getElementById('payrollDocsAdmin');
    if(admin){
      admin.querySelectorAll('small,p,div').forEach(el=>{
        if(el.childElementCount) return;
        const t=(el.textContent||'').trim();
        if(t.includes('שמירה זמנית')) el.textContent=t.replace('שמירה זמנית','שמירה קבועה בארכיון');
        if(t.includes('מסמכים פגים אוטומטית')) el.textContent='המסמכים נשמרים בארכיון באופן קבוע ומסודרים לפי עובד ותקופה.';
      });
      const retention=document.getElementById('payrollRetention');
      if(retention){
        retention.value='30';
        const label=retention.closest('label');
        if(label) label.style.display='none';
      }
      const heading=[...admin.querySelectorAll('h2')].find(x=>x.textContent.includes('מסמכים פעילים'));
      if(heading) heading.textContent='ארכיון מסמכים';
    }

    const card=document.getElementById('employeeDocumentsCard');
    if(card){
      const truth=card.querySelector('.truth');
      if(truth) truth.innerHTML='<b>פרטי ומאובטח.</b><br>תלושי השכר ודוחות השעות נשמרים כאן בארכיון האישי שלך. ניתן לפתוח, להדפיס או לשמור בכל עת.';
    }
  }

  function patchRenderedRows(root){
    if(!root) return;
    root.querySelectorAll('.docRow .meta small').forEach(el=>{
      const t=(el.textContent||'').trim();
      if(t.includes('זמין עוד')||t.includes('פג תוקף')) el.textContent=PERMANENT_TEXT;
    });
  }

  async function permanentWhatsapp(btn){
    const staffId=btn.dataset.waStaff, type=btn.dataset.waType, period=btn.dataset.waPeriod;
    const {data:staff}=await supabaseClient.from('staff').select('id,full_name,phone').eq('id',staffId).single();
    if(!staff?.phone){ window.toast?.('לעובד אין מספר טלפון שמור'); return; }
    const phone=typeof window.normalizeIsraeliPhone==='function'?window.normalizeIsraeliPhone(staff.phone):String(staff.phone).replace(/\D/g,'');
    const label=type==='payslip'?'תלוש השכר':'דוח השעות';
    const msg=`היי ${staff.full_name},\n${label} שלך לתקופה ${period} זמין כעת במערכת MATOK.\n\nכניסה למערכת:\nhttps://voluble-marigold-95c410.netlify.app/\n\nלאחר הכניסה יש לפתוח „שעות ושכר”. משם ניתן לצפות, להדפיס או לשמור את המסמך.\nהמסמך נשמר גם בארכיון האישי שלך במערכת לצפייה עתידית.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,'_blank');
  }

  function replaceWhatsappHandlers(){
    const root=document.getElementById('adminPayrollDocs');
    if(!root) return;
    root.querySelectorAll('[data-wa-staff]').forEach(btn=>{
      if(btn.dataset.permanentBound==='1') return;
      const clone=btn.cloneNode(true);
      clone.dataset.permanentBound='1';
      btn.replaceWith(clone);
      clone.addEventListener('click',()=>permanentWhatsapp(clone));
    });
  }

  function patchAll(){
    patchStaticText();
    patchRenderedRows(document.getElementById('adminPayrollDocs'));
    patchRenderedRows(document.getElementById('employeeDocumentsList'));
    replaceWhatsappHandlers();
  }

  const obs=new MutationObserver(()=>patchAll());
  obs.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(patchAll,300));
  else setTimeout(patchAll,300);
  setInterval(patchAll,1500);
})();