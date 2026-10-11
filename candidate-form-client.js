(() => {
'use strict';
const $=id=>document.getElementById(id);
const tokenRaw=new URLSearchParams(location.search).get('t')||'';
const token=/^[a-f0-9-]{36}$/i.test(tokenRaw)?tokenRaw:null;
const api=window.supabase?.createClient(window.MATOK_PUBLIC_CONFIG.url,window.MATOK_PUBLIC_CONFIG.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const fields={
 fit:[
  ['full_name','שם מלא *','text','name'],['phone','טלפון *','tel','tel'],['email','דוא״ל','email','email'],
  ['preferred_role','איזה תפקיד מעניין אותך?','text',''],['available_shifts','אילו משמרות מתאימות לך?','text',''],
  ['friday','זמינות לימי שישי','select',''],['experience','ניסיון קודם במכירות / שירות','textarea','wide'],
  ['register_experience','ניסיון בקופה','textarea','wide'],['social_media','ידע ברשתות חברתיות','textarea','wide'],
  ['independent_arrival','יכולת הגעה עצמאית לעבודה','text',''],['availability_notes','מגבלות או זמינות מיוחדת','textarea','wide'],
  ['why_matok','למה העבודה ב-MATOK מתאימה לך?','textarea','wide'],['notes','משהו נוסף שחשוב שנדע','textarea','wide']
 ],
 intake:[
  ['full_name','שם מלא *','text','name'],['phone','טלפון *','tel','tel'],['email','דוא״ל','email','email'],
  ['identity_number','תעודת זהות / תעודה מזהה','text',''],['city','עיר / יישוב','text','address-level2'],['address','כתובת','text','street-address'],
  ['preferred_role','תפקיד','text',''],['available_shifts','משמרות אפשריות','text',''],['friday','זמינות לימי שישי','select',''],
  ['preferred_start','מועד תחילת עבודה מועדף','date',''],['experience','ניסיון / תחומי אחריות','textarea','wide'],['notes','הערות נוספות','textarea','wide']
 ]
};
function input(def){
 const [name,label,type,cls]=def;
 const wrap=document.createElement('label');if(cls==='wide')wrap.className='wide';wrap.textContent=label;
 let el;
 if(type==='textarea'){el=document.createElement('textarea')}
 else if(type==='select'){el=document.createElement('select');['','כל שישי','שישי לסירוגין','בתיאום','לא זמין/ה'].forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v||'בחרו';el.appendChild(o)})}
 else{el=document.createElement('input');el.type=type; if(cls&&cls!=='wide')el.autocomplete=cls}
 el.name=name;if(name==='full_name'||name==='phone')el.required=true;wrap.appendChild(el);return wrap;
}
function status(text,bad=false){const x=$('status');x.textContent=text;x.className='status show'+(bad?' error':'')}
async function boot(){
 if(!token||!api){$('initial').textContent='הקישור אינו תקין. בקשו קישור חדש מהנהלת MATOK.';return}
 try{
  const {data,error}=await api.rpc('hr_public_form_status',{p_token:token});if(error||!data?.open)throw error||new Error('closed');
  const type=data.form_type;$('title').textContent=type==='fit'?'שאלון התאמה לעבודה':'טופס קליטת עובד/ת';
  $('intro').textContent=type==='fit'?'השאלון עוזר לנו להכיר את הזמינות, הניסיון וההתאמה לתפקיד.':'נא למלא את פרטי הקליטה. הפרטים יעברו לבדיקת מנהל לפני יצירת כרטיס עובד.';
  $('fields').replaceChildren(...fields[type].map(input));$('initial').style.display='none';$('candidateForm').style.display='block';$('candidateForm').dataset.type=type;
 }catch(e){$('initial').textContent='הקישור כבר נוצל, פג תוקפו או אינו תקין. בקשו קישור חדש.'}
}
$('candidateForm').addEventListener('submit',async e=>{
 e.preventDefault();const form=e.currentTarget;if(!form.reportValidity()||form.elements.website.value)return;
 const btn=$('submitBtn');btn.disabled=true;btn.textContent='שולחים…';
 const data=Object.fromEntries(new FormData(form).entries());data.consent=form.elements.consent.checked;delete data.website;
 try{const res=await api.rpc('hr_public_form_submit',{p_token:token,p_data:data});if(res.error||!res.data?.submitted)throw res.error||new Error('save_failed');form.style.display='none';status('הפרטים התקבלו בהצלחה והועברו להנהלה. תודה רבה.')}
 catch(err){status('השמירה נכשלה. בדקו את החיבור או בקשו קישור חדש.',true);btn.disabled=false;btn.textContent='שליחה מחדש'}
});
boot();
})();