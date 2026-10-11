import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const [platform,utils,services,onboarding,build,dist,version]=await Promise.all([
  'matok-platform-final-v1.js','matok-utils-final-v1.js','matok-services-final-v1.js',
  'matok-onboarding-final-v1.js','build.mjs','dist/index.html','dist/version.json'
].map(async file=>file.endsWith('.json')?JSON.parse(await readFile(file,'utf8')):readFile(file,'utf8')));

const calls=[];
const storageCalls=[];
const chain={
  select(){return this},order(){return this},
  then(resolve){resolve({data:[{id:'s1',full_name:'עובד',phone:'0501234567',is_active:true}],error:null})}
};
const supabaseClient={
  rpc:async(name,args)=>{calls.push({name,args});return {data: name==='admin_create_onboarding_invite'?'token-1':name==='admin_materialize_onboarding_employee'?{created:true,staff_id:'s1'}:[],error:null}},
  from:table=>{calls.push({table});return chain},
  storage:{from:bucket=>({
    upload:async(path,file,options)=>{storageCalls.push({kind:'upload',bucket,path,options});return {data:{path},error:null}},
    remove:async(paths)=>{storageCalls.push({kind:'remove',bucket,paths});return {data:paths,error:null}},
    createSignedUrl:async(path,seconds)=>({data:{signedUrl:'https://signed.example/'+path+'?s='+seconds},error:null})
  })}
};

const context={
  window:{__MATOK_PROFILE__:{productId:'matok-sidir'},__MATOK_MODULE_MANIFEST__:[]},
  supabaseClient,
  console:{error(){},warn(){}},
  document:{documentElement:{},readyState:'loading',addEventListener(){},getElementById(){return null}},
  MutationObserver:class{observe(){}},setTimeout(){return 0},clearTimeout(){}
};
vm.runInNewContext(platform,context);
vm.runInNewContext(utils,context);
vm.runInNewContext(services,context);

assert.equal(context.window.MATOK_UTILS.phone972('050-123-4567'),'972501234567');
assert.equal(context.window.MATOK_UTILS.normalizeIsraeliPhone('+972501234567'),'0501234567');
assert.equal(context.window.MATOK_UTILS.isoDate('21.10.2026'),'2026-10-21');
assert(Object.isFrozen(context.window.MATOK_UTILS));
assert(Object.isFrozen(context.window.MATOK_SERVICES));

const token=await context.window.MATOK_SERVICES.onboarding.createInvite();
assert.equal(token,'token-1');
const created=await context.window.MATOK_SERVICES.onboarding.materialize('r1');
assert.equal(created.created,true);
const staff=await context.window.MATOK_SERVICES.workforce.listStaff();
assert.equal(staff.length,1);
const signed=await context.window.MATOK_SERVICES.onboarding.originalUrl('private/a.pdf',90);
assert(signed.includes('private/a.pdf'));
await context.window.MATOK_SERVICES.onboarding.uploadOriginal('private/a.pdf',{},'application/pdf');
await context.window.MATOK_SERVICES.onboarding.removeOriginal('private/a.pdf');
assert(calls.some(x=>x.name==='admin_create_onboarding_invite'));
assert(calls.some(x=>x.name==='admin_materialize_onboarding_employee'&&x.args.p_record_id==='r1'));
assert(storageCalls.some(x=>x.kind==='upload'));
assert(storageCalls.some(x=>x.kind==='remove'));

assert(!onboarding.includes('supabaseClient'),'onboarding UI must not call Supabase directly after service extraction');
assert(onboarding.includes('MATOK_SERVICES'));
assert(build.includes("'matok-utils-final-v1.js'"));
assert(build.includes("'matok-services-final-v1.js'"));
assert(dist.includes('MATOK_UTILS'));
assert(dist.includes('MATOK_SERVICES'));
assert(version.moduleManifest.some(x=>x.name==='utils'));
assert(version.moduleManifest.some(x=>x.name==='services'));

console.log('MATOK shared utilities and service-layer checks passed');