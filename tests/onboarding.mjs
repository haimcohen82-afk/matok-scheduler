import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';

const [manager,publicJs,join,schema,structuredSchema,directSchema,build,shell,dist,distJoin]=await Promise.all([
 'matok-onboarding-final-v1.js','join-client.js','join.html',
 'sql/onboarding-private-intake.sql','sql/onboarding-structured-import.sql',
 'sql/onboarding-direct-materialization.sql',
 'build.mjs','app-shell.html','dist/index.html','dist/join.html'
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
assert(manager.includes('admin_import_onboarding_batch'));
assert(manager.includes('admin_get_staff_private_profile'));
assert(manager.includes('admin_get_onboarding_text'));
assert(manager.includes('admin_materialize_onboarding_employee'));
assert(manager.includes('matokCanAutoMaterialize'));
assert(manager.includes('MATOK FIELD PASS'));
assert(directSchema.includes('admin_materialize_onboarding_employee'));
assert(directSchema.includes('admin_save_payroll_profile'));
assert(directSchema.includes("identity_requires_review"));
assert(directSchema.includes("v_profile_details:=v_profile_details-'bank_details'"));
assert(!directSchema.includes('grant execute on function public.admin_materialize_onboarding_employee(uuid) to anon'));
assert(structuredSchema.includes('create table if not exists public.staff_private_profiles'));
assert(structuredSchema.includes('alter table public.staff_private_profiles enable row level security'));
assert(structuredSchema.includes('admin_import_onboarding_batch'));
assert(structuredSchema.includes('admin_upsert_staff_private_profile'));
assert(!structuredSchema.includes('grant execute on function public.admin_get_staff_private_profile(uuid) to anon'));
assert(manager.includes('showFullExtractedText'));
assert(schema.includes('grant execute on function public.admin_get_onboarding_text(uuid) to authenticated'));
assert(!schema.includes('grant execute on function public.admin_get_onboarding_text(uuid) to anon'));

assert(manager.includes('window.matokOnboardingParseText=parseText'));

// Test Hebrew labeled fields, Israeli identity validation and spreadsheet/hour-summary tables.
{
  const ctx={window:{},document:{documentElement:{},readyState:'loading',addEventListener(){}},
    MutationObserver:class{observe(){}},console};
  vm.runInNewContext(manager,ctx);
  const parse=ctx.window.matokOnboardingParseText;
  const parseRows=ctx.window.matokOnboardingParseRows;
  const validId=ctx.window.matokValidateIsraeliId;
  assert.equal(typeof parse,'function');
  assert.equal(typeof parseRows,'function');
  assert.equal(validId('123456782'),true);

  const labeled=parse('שם מלא: נועה כהן\nתעודת זהות: 123456782\nטלפון: 050-1234567\nדוא"ל: test@example.org\nעיר: חולון\nכתובת: רחוב לדוגמה 3\nתפקיד: מכירה\nמיומנות מיוחדת: שירות');
  assert.equal(labeled.details.full_name,'נועה כהן');
  assert.equal(labeled.details.identity_number,'123456782');
  assert.equal(labeled.details.identity_valid,true);
  assert.equal(labeled.details.phone,'050-1234567');
  assert.equal(labeled.details.city,'חולון');
  assert.equal(labeled.confidence.identity_number,'high');
  assert(labeled.details.extra_fields.includes('מיומנות מיוחדת'));

  const tsv='שם מלא\tת.ז\tטלפון\tעיר\tכתובת\nנועה כהן\t123456782\t0501234567\tחולון\tדב הוז 1\nדנה לוי\t111111118\t0527654321\tבת ים\tבלפור 2';
  const rows=parseRows(tsv);
  assert.equal(rows.length,2,'two spreadsheet employees should create two intake rows');
  assert.equal(rows[0].details.full_name,'נועה כהן');
  assert.equal(rows[0].details.identity_number,'123456782');
  assert.equal(rows[0].details.city,'חולון');
  assert.equal(rows[1].details.phone,'0527654321');

  const csv='שם פרטי,שם משפחה,מספר זהות,טלפון,עיר\nיעל,כהן,123456782,0541234567,ראשון לציון';
  const csvRows=parseRows(csv);
  assert.equal(csvRows.length,1);
  assert.equal(csvRows[0].details.full_name,'יעל כהן');
  assert.equal(csvRows[0].details.first_name,'יעל');
  assert.equal(csvRows[0].details.last_name,'כהן');
  assert.equal(csvRows[0].details.city,'ראשון לציון');

  const invalid=parse('שם מלא: ישראל ישראלי\nתעודת זהות: 123456789\nטלפון: 0501234567');
  assert.equal(invalid.details.identity_valid,false);
  assert.equal(invalid.confidence.identity_number,'low');
  assert.equal(parse('טלפון: 0501234567').confidence.full_name,'low');

  // Scanned MATOK-style form: compact page-1 OCR may misread numeric values,
  // while the agreement and numeric field pass must recover the reliable values.
  const scanned=parse([
    '-- OCR עמוד 1 --',
    'שם מלא נועה כהן',
    'תעודת זהות 123456782',
    'תאריך לידה 8',
    'כתובת חולון דב הוז 1',
    'נייד 0501234567',
    'אימייל test@example.org',
    'מספר עובד/ת בקופה 20000',
    'שכר לשעה (ברוטו) 5 ₪',
    'מועד תשלום עד 10 בחודש העוקב, בהעברה בנקאית',
    'יום מנוחה שבועי שבת',
    '-- OCR עמוד 2 --',
    'תאריך תחילת העבודה: 21.10.2026.',
    'תיאור התפקיד העיקרי: עובד/ת משמרות בחנות.',
    'הממונה הישיר/ה: חיים.',
    'היקף המעורה: משרה חלקית לפי סידור עבודה שבועי.',
    'מספר עובד/ת בקופה: 26000.',
    'יום המנוחה השבועי: AW',
    'שכר יסוד: 35 ₪ לשעה (ברוטו).',
    '-- MATOK FIELD PASS --',
    'תעודת זהות: 123456782',
    'תאריך לידה: 1.2.1988',
    'טלפון נייד: 0501234567',
    'מספר עובד/ת בקופה: 26000'
  ].join('\n'));
  assert.equal(scanned.details.full_name,'נועה כהן');
  assert.equal(scanned.details.identity_number,'123456782');
  assert.equal(scanned.details.identity_valid,true);
  assert.equal(scanned.details.birth_date,'1.2.1988');
  assert.equal(scanned.details.phone,'0501234567');
  assert.equal(scanned.details.city,'חולון');
  assert.equal(scanned.details.pos_employee_number,'26000');
  assert.equal(scanned.details.hourly_wage,'35');
  assert.equal(scanned.details.weekly_rest_day,'שבת');
  assert.equal(ctx.window.matokCanAutoMaterialize(scanned),true);

  const unsafe=parse('שם מלא: בדיקה\nתעודת זהות: 123456789\nטלפון: 0501234567');
  assert.equal(ctx.window.matokCanAutoMaterialize(unsafe),false);
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
