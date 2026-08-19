import { spawnSync } from 'node:child_process';

const syntaxFiles=[
  'matok-core-final-v1.js',
  'matok-payroll-final-v1.js',
  'matok-ui-final-v1.js',
  'matok-access-final-v1.js',
  'matok-whatsapp-final-v1.js',
  'matok-health-final-v1.js',
  'matok-realtime-final-v1.js',
  'build.mjs',
  'tests/smoke.mjs'
];

function run(args,label){
  const r=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env});
  if(r.status!==0) throw new Error(`${label} failed`);
}

for(const file of syntaxFiles) run(['--check',file],`syntax check: ${file}`);
run(['build.mjs'],'production build');
run(['tests/smoke.mjs'],'smoke checks');
console.log('MATOK production verification passed');
