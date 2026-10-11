import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const [portal,onboarding,payroll,candidateHtml,candidateJs,schema,build,shell,dist,distCandidate]=await Promise.all([
 'matok-hr-portal-final-v1.js','matok-onboarding-final-v1.js','matok-payroll-final-v1.js',
 'candidate-form.html','candidate-form-client.js','sql/hr-candidate-portal.sql',
 'build.mjs','app-shell.html','dist/index.html','dist/candidate-form.html'
].map(p=>readFile(p,'utf8')));

// Nothing from the existing employee/onboarding/payroll system may disappear.
for(const token of [
 'intakeSendWa','intakeCopyLink','intakeUploadFile','matokOnboardingParseText',
 'matokCanAutoMaterialize','matokOpenOnboardingProfile','matokOpenOnboardingRecord'
])assert(onboarding.includes(token),'existing onboarding capability missing: '+token);
for(const token of ['mpUploadChoice','mpAnalyzePdf','mpSavePdf','mpSingleSave','employee_list_documents','employee-documents'])
 assert(payroll.includes(token),'existing payroll/document capability missing: '+token);
assert(shell.includes('openEmployee(-1)'),'manual employee creation must remain available');

// Restored HR portal must include every requested stage.
for(const token of [
 'מרכז עובד חדש ומסמכים','ראיון עבודה','שאלון התאמה','טופס קליטה',
 'מסמכים וקבצים','פרטים שנקלטו','אישור והקמת עובד',
 'admin_hr_create_case','admin_hr_save_interview','admin_hr_create_form_invite',
 'admin_hr_register_document','staff-hr-documents','matokOpenOnboardingRecord'
])assert(portal.includes(token),'HR portal capability missing: '+token);

assert(build.includes("'matok-hr-portal-final-v1.js'"));
assert(build.includes("dist/candidate-form.html"));
assert(build.includes("dist/candidate-form-client.js"));
assert(dist.includes('matokOpenHrPortal'));
assert(dist.includes('admin_hr_create_form_invite'));
assert(!distCandidate.includes('%%SUPABASE_'),'candidate form public config was not injected');
assert(distCandidate.includes('sb_publishable_'),'candidate form must use the publishable client key only');
assert(!distCandidate.includes('service_role'));

// HR data is private by default; only narrow one-time form endpoints are public.
for(const token of [
 'alter table public.hr_candidate_cases enable row level security',
 'alter table public.hr_candidate_interviews enable row level security',
 'alter table public.hr_candidate_form_invites enable row level security',
 'alter table public.hr_candidate_form_responses enable row level security',
 'alter table public.hr_candidate_documents enable row level security',
 "values(\n  'staff-hr-documents','staff-hr-documents',false",
 'grant execute on function public.hr_public_form_status(uuid) to anon,authenticated',
 'grant execute on function public.hr_public_form_submit(uuid,jsonb) to anon,authenticated'
])assert(schema.includes(token),'HR privacy invariant missing: '+token);
assert(!schema.includes('grant execute on function public.admin_hr_list_cases() to anon'));
assert(!schema.includes('grant execute on function public.admin_hr_get_case(uuid) to anon'));
assert(!schema.includes('grant execute on function public.admin_hr_register_document(uuid,text,text,text,text) to anon'));

// Public candidate form must expose no manager screens and require explicit consent.
assert(candidateHtml.includes('name="consent"'));
assert(candidateHtml.includes('noindex,nofollow'));
assert(!candidateHtml.includes('service_role'));
assert(candidateJs.includes("hr_public_form_status"));
assert(candidateJs.includes("hr_public_form_submit"));
assert(candidateJs.includes("fit:["));
assert(candidateJs.includes("intake:["));

// Browser-level simulation for both public form types.
async function simulate(type){
 const events={};
 const form={style:{display:'none'},dataset:{},elements:{website:{value:''},consent:{checked:true}},
   reportValidity:()=>true,addEventListener:(event,handler)=>events[event]=handler};
 const elements={
  title:{textContent:''},intro:{textContent:''},initial:{textContent:'',style:{}},
  candidateForm:form,fields:{replaceChildren(...children){this.children=children},children:[]},
  submitBtn:{disabled:false,textContent:'שליחת השאלון'},status:{textContent:'',className:''}
 };
 const make=(tag)=>({tagName:tag,children:[],style:{},appendChild(x){this.children.push(x);return x},set textContent(v){this._text=v},get textContent(){return this._text||''}});
 let submitted=null;
 const api={rpc:async(name,args)=>{
   if(name==='hr_public_form_status')return {data:{open:true,form_type:type},error:null};
   if(name==='hr_public_form_submit'){submitted=args;return {data:{submitted:true,form_type:type},error:null}
   } throw new Error('unexpected '+name);
 }};
 const context={
  window:{supabase:{createClient:()=>api},MATOK_PUBLIC_CONFIG:{url:'https://example.invalid',key:'sb_publishable_test'}},
  document:{getElementById:id=>elements[id],createElement:make},
  location:{search:'?t=aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'},URLSearchParams,console,
  FormData:class{constructor(){this.rows=[['full_name','נועה כהן'],['phone','0501234567'],['website','']]};entries(){return this.rows[Symbol.iterator]()}},
  setTimeout
 };
 vm.runInNewContext(candidateJs,context);
 await new Promise(r=>setTimeout(r,5));
 assert.equal(form.dataset.type,type);
 assert.equal(form.style.display,'block');
 await events.submit({preventDefault(){},currentTarget:form});
 assert.equal(submitted.p_data.full_name,'נועה כהן');
 assert.equal(submitted.p_data.consent,true);
 assert(!('website' in submitted.p_data));
 assert.equal(form.style.display,'none');
 assert(elements.status.textContent.includes('התקבלו בהצלחה'));
}
await simulate('fit');
await simulate('intake');

console.log('MATOK full employee HR portal restoration checks passed');
