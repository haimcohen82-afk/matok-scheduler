import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const [platform,build,dist,version]=await Promise.all([
  readFile('matok-platform-final-v1.js','utf8'),
  readFile('build.mjs','utf8'),
  readFile('dist/index.html','utf8'),
  readFile('dist/version.json','utf8').then(JSON.parse)
]);

const events=[];
const context={
  window:{
    __MATOK_PROFILE__:{
      productId:'matok-sidir',productName:'SIDIR',suiteId:'matok-suite',
      edition:'internal',distribution:'internal',securityProfile:'internal-standard',
      brandingProfile:'matok-basic',integrationProfile:'standalone',tenantMode:'single-tenant'
    },
    __MATOK_MODULE_MANIFEST__:[
      {name:'core',version:'1',domain:'scheduling',capabilities:['availability']},
      {name:'onboarding',version:'1',domain:'workforce',capabilities:['employee-onboarding']}
    ]
  },
  console:{error(){}}
};
vm.runInNewContext(platform,context);
const api=context.window.MATOK_PLATFORM;
assert(api,'platform API missing');
assert(Object.isFrozen(api),'platform API must be immutable');
assert(Object.isFrozen(api.profile),'product profile must be immutable');
assert.equal(api.profile.productId,'matok-sidir');
assert.equal(api.profile.integrationProfile,'standalone');
assert.equal(api.listModules().length,3,'platform + manifest modules expected');
assert(api.hasCapability('availability'));
assert(api.hasCapability('employee-onboarding'));
assert.deepEqual([...api.capabilityProviders('availability')],['core']);

const off=api.on('test:event',payload=>events.push(payload));
api.emit('test:event',{ok:true});
off();
api.emit('test:event',{ok:false});
assert.equal(events.length,1);
assert.equal(events[0].ok,true);

const adapter={kind:'mock'};
api.registerAdapter('data','mock',adapter);
assert.equal(api.getAdapter('data','mock'),adapter);
assert.equal(api.getAdapter('data','missing'),null);

assert(build.includes("'matok-platform-final-v1.js'"));
assert(build.includes('const MODULE_MANIFEST=['));
assert(build.includes('const PRODUCT_PROFILE={'));
assert(build.includes("securityProfile:process.env.MATOK_SECURITY_PROFILE||'internal-standard'"));
assert(build.includes("tenantMode:process.env.MATOK_TENANT_MODE||'single-tenant'"));

assert(dist.includes('window.__MATOK_PROFILE__='));
assert(dist.includes('window.__MATOK_MODULE_MANIFEST__='));
assert(dist.includes('MATOK_PLATFORM'));
assert(version.profile?.productId==='matok-sidir');
assert(version.profile?.securityProfile==='internal-standard');
assert(Array.isArray(version.moduleManifest)&&version.moduleManifest.some(m=>m.name==='onboarding'));

console.log('MATOK platform foundation checks passed');
