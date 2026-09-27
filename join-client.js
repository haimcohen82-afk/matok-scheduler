(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const show=(message,error=false)=>{
    const box=$('status');box.textContent=message;
    box.className='show'+(error?' error':'');
  };
  const raw=new URLSearchParams(location.search).get('t')||'';
  const token=/^[a-f0-9-]{36}$/i.test(raw)?raw:null;
  const client=window.supabase?.createClient(window.MATOK_PUBLIC_CONFIG.url,window.MATOK_PUBLIC_CONFIG.key,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  });
  async function boot(){
    if(!token||!client){$('initial').textContent='הקישור חסר או אינו תקין. בקשו קישור חדש מהמנהל.';return}
    try{
      const {data,error}=await client.rpc('onboarding_form_status',{p_token:token});
      if(error||!data?.open)throw new Error('closed');
      $('initial').style.display='none';$('intakeForm').style.display='block';
    }catch(e){$('initial').textContent='הקישור פג תוקף או שהשאלון כבר נשלח. בקשו קישור חדש מהמנהל.'}
  }
  $('intakeForm').addEventListener('submit',async e=>{
    e.preventDefault();const form=e.currentTarget;
    if(!form.reportValidity()||form.elements.website.value)return;
    const btn=$('submitBtn');btn.disabled=true;btn.textContent='שולחים…';
    const values=Object.fromEntries(new FormData(form).entries());
    values.consent=form.elements.consent.checked;
    delete values.website;
    try{
      const {data,error}=await client.rpc('onboarding_submit_form',{p_token:token,p_data:values});
      if(error||!data?.submitted)throw error||new Error('not_saved');
      form.style.display='none';
      show('השאלון התקבל בהצלחה והועבר לבדיקת הנהלת MATOK BASIC. תודה רבה.');
    }catch(e){
      show('לא הצלחנו לשמור את השאלון. בדקו את החיבור או בקשו קישור חדש. אין צורך לשלוח שוב אם התקבלה הודעת אישור.',true);
      btn.disabled=false;btn.textContent='שליחה מחדש';
    }
  });
  boot();
})();