import { spawnSync } from 'node:child_process';
import { access, stat } from 'node:fs/promises';

const syntaxFiles=[
  'matok-core-final-v1.js',
  'matok-payroll-final-v1.js',
  'matok-ui-final-v1.js',
  'matok-notifications-final-v1.js',
  'matok-access-final-v1.js',
  'matok-whatsapp-final-v1.js',
  'matok-health-final-v1.js',
  'matok-realtime-final-v1.js',
  'matok-admin-tools-final-v1.js',
  'matok-manager-home-final-v1.js',
  'matok-availability-roster-final-v1.js',
  'build.mjs',
  'tests/smoke.mjs',
  'tests/schedule-regression.mjs',
  'tests/requirements-17.mjs'
];

function run(args,label){
  const r=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env});
  if(r.status!==0) throw new Error(`${label} failed`);
}

await access('app-shell.html');
const shell=await stat('app-shell.html');
if(shell.size<10000)throw new Error('app-shell.html is unexpectedly small');
for(const legacy of ['Index.html','index.html']){try{await access(legacy);throw new Error(`legacy ${legacy} must not exist`)}catch(e){if(e?.message===`legacy ${legacy} must not exist`)throw e}}

for(const file of syntaxFiles) run(['--check',file],`syntax check: ${file}`);
run(['build.mjs'],'production build');
run(['tests/smoke.mjs'],'smoke checks');
run(['tests/schedule-regression.mjs'],'schedule regression checks');
run(['tests/requirements-17.mjs'],'17 requirement checks');
console.log('MATOK production verification passed');