import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';

const [manager,publicJs,join,schema,build,shell,dist,distJoin]=await Promise.all([
 'matok-onboarding-final-v1.js','join-client.js','join.html',
 'sql/onboarding-private-intake.sql','build.mjs','app-shell.html',
 'dist/index.html','dist/join.html'
].map(p=>readFile(p,'utf8')));

// The candidate's personal link is on a standalone public page, not in the manager portal.
assert(join.includes('name="referrer" content="no-referrer"'));
assert(join.includes('name="robots" content="noindex,nofollow"'));
assert(join.includes('name="consent" type="checkbox" required'));
assert(!join.includes('name="bank"')&&!join.includes('name="pin"'));
assert(!distJoin.includes('%%SUPABASE_'),'injected config placeholders were not filled');
assert(distJoin.includes('sb_publishable_'),'only a public Supabase key may be embedded');
assert(!distJoin.includes('service_role'),'secret service key must never be embedded');
assert(dist.includes('matokOnboardingParseText')&&dist.includes('matokOpenOnboardingProfile'));
assert(dist.includes('admin_create_onboarding_invite'));
assert(shell.includes('כל פרטי הקליטה'));
assert(build.includes("'matok-onboarding-final-v1.js'"));
assert(build.includes("dist/join-client.js"));

// No anonymous list/admin grants. One-time token is checked under a lock.
for(const line of [
 'alter table public.staff_onboarding_records enable row level security',
 'revoke all on public.staff_onboarding_invites, public.staff_onboarding_records from public, anon, authenticated',
 'and submitted_at is null for update',
 "coalesce(p_data->>'consent','')<>'true'",
 'grant execute on function public.onboarding_submit_form(uuid,jsonb) to anon,authenticated',
 'grant execute on function public.admin_list_onboarding_records() to authenticated'
])assert(schema.includes(line),'onboarding privacy invariant missing: '+line);
assert(!schema.includes('grant execute on function public.admin_list_onboarding_records() to anon'));
assert(manager.includes("const BUCKET='staff-onboarding-originals'"));
assert(manager.includes('createSignedUrl(record.original_path,120)'));
assert(manager.includes('if(active.original_path)add('));
assert(manager.includes('admin_approve_onboarding_new'));
assert(manager.includes('admin_link_onboarding_existing'));
assert(manager.includes('admin_import_onboarding_file'));
assert(manager.includes('window.matokOnboardingParseText=parseText'));

// Test Hebrew field extraction including confidence and sensitive-document restraint.
{
  const ctx={window:{},document:{documentElement:{},readyState:'loading',addEventListener(){}},
    MutationObserver:class{observe(){}},console};
  vm.runInNewContext(manager,ctx);
  const parse=ctx.window.matokOnboardingParseText;
  assert.equal(typeof parse,'function');
  const data=parse('שם מלא: נועה כהן\nטלפון: 050-1234567\nדוא"ל: test@example.org\nכתובת: רחוב לדוגמה 3\nתפקיד: מכירה\nמיומנות מיוחדת: שירות\nתעודת זהות: 123456789');
  assert.equal(data.details.full_name,'נועה כהן');
  assert.equal(data.details.phone,'050-1234567');
  assert.equal(data.confidence.full_name,'high');
  assert.equal(data.confidence.phone,'high');
  assert(data.details.extra_fields.includes('מיומנות מיוחדת'));
  assert(!data.details.extra_fields.includes('123456789'),'identity number must not enter parsed extra fields');
  assert.equal(parse('טלפון: 0501234567').confidence.full_name,'low');
}

// Simulate actual candidate browser code: validate unique token then submit.
async function candidateScenario(open){
  const events={};
  const form={style:{display:'none'},elements:{website:{value:''},consent:{checked:true}},
    reportValidity:()=>true,addEventListener:(event,handler)=>{events[event]=handler}};
  const elements={
    initial:{textContent:'',style:{}},intakeForm:form,
    submitBtn:{disabled:false,textContent:'שליחה'},status:{textContent:'',className:''}
  };
  let sent=null;
  const rpc=async(name,args)=>{
    if(name==='onboarding_form_status')return {data:{open},error:null};
    if(name==='onboarding_submit_form'){sent=args;return {data:{submitted:true},error:null}}
    throw new Error('unexpected rpc '+name);
  };
  const context={
    document:{getElementById:id=>elements[id]},
    window:{supabase:{createClient:()=>({rpc})},MATOK_PUBLIC_CONFIG:{url:'https://example.invalid',key:'sb_publishable_test'}},
    location:{search:'?t=aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'},
    URLSearchParams,
    FormData:class{constructor(){this.values=[['full_name','נועה כהן'],['phone','0501234567'],['website','']]};entries(){return this.values[Symbol.iterator]()}},
    console
  };
  vm.runInNewContext(publicJs,context);
  await delay(5);
  if(!open){assert(elements.initial.textContent.includes('פג תוקף'));assert.equal(form.style.display,'none');return}
  assert.equal(form.style.display,'block');
  await events.submit({preventDefault(){},currentTarget:form});
  assert.equal(sent.p_data.full_name,'נועה כהן');
  assert.equal(sent.p_data.consent,true);
  assert(!('website' in sent.p_data));
  assert.equal(form.style.display,'none','accepted candidate form should close');
  assert(elements.status.textContent.includes('התקבל בהצלחה'));
}
await candidateScenario(true);
await candidateScenario(false);

console.log('MATOK onboarding security, extraction, questionnaire and build tests passed');
