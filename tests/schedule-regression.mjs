import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

function functionSource(source,name){
  const match=new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`).exec(source);
  if(!match)throw new Error(`missing function ${name}`);
  const brace=match.index+match[0].lastIndexOf('{');
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){
      if(escaped){escaped=false;continue}
      if(ch==='\\'){escaped=true;continue}
      if(ch===quote)quote='';
      continue;
    }
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue}
    if(ch==='{')depth++;
    if(ch==='}'&&--depth===0)return source.slice(match.index,i+1);
  }
  throw new Error(`unclosed function ${name}`);
}

function context(values={}){
  const box={innerHTML:'',querySelectorAll:()=>[]};
  const list={innerHTML:'',querySelectorAll:()=>[]};
  return vm.createContext({
    console,
    document:{getElementById:id=>id==='mfAdminScheduleBody'?box:id==='mfCandidateList'?list:{textContent:'',innerHTML:''}},
    box,list,
    esc:value=>String(value??''),
    ...values
  });
}

const core=await readFile('matok-core-final-v1.js','utf8');
const adminTools=await readFile('matok-admin-tools-final-v1.js','utf8');

{
  const assigned={slot_key:'sun-am',staff_id:'1',role_name:'מכירה',status:'approved'};
  const c=context({
    adminState:{weekStart:'2026-08-23',week:{status:'availability_open'},assignments:[assigned],availability:[
      {slot_key:'sun-am',staff_id:'1',full_name:'עובדת משובצת',status:'available'},
      {slot_key:'sun-am',staff_id:'2',full_name:'עובדת פנויה',status:'preferred'}
    ]},
    currentWeekRecord:null,published:false,
    DAYS:[['ראשון',['sun-am']]],
    fmtWeek:()=>'',slotName:()=> 'בוקר',cfg:()=>({required_count:2,start_time:'10:00',end_time:'15:00'}),
    assFor:()=>[assigned],staffById:id=>({id,full_name:id==='1'?'עובדת משובצת':'עובדת פנויה',role_name:'מכירה'}),
    openCandidateFinal(){},setAssignmentFinal(){}
  });
  vm.runInContext(functionSource(core,'renderAdminScheduleFinal'),c);
  vm.runInContext('renderAdminScheduleFinal()',c);
  const availability=c.box.innerHTML.match(/<div class="mfAvailability">([\s\S]*?)<\/div><div class="mfAssigned">/)?.[1]||'';
  assert(!availability.includes('עובדת משובצת'),'assigned worker leaked into availability chips');
  assert(availability.includes('עובדת פנויה'),'unassigned worker missing from availability chips');
  assert(c.box.innerHTML.includes('עובדת משובצת'),'assigned worker missing from assigned list');
}

{
  const c=context({
    activeCandidateSlot:'sun-am',
    adminState:{staff:[{id:'1',full_name:'עובדת משובצת',role_name:'מכירה'},{id:'2',full_name:'עובדת פנויה',role_name:'קופה'}]},
    assFor:()=>[{staff_id:'1',status:'approved'}],
    avFor:()=> 'available',configuredFor:()=>true,setAssignmentFinal(){}
  });
  vm.runInContext(functionSource(core,'renderCandidateFinal'),c);
  vm.runInContext('renderCandidateFinal()',c);
  assert(!c.list.innerHTML.includes('עובדת משובצת'),'assigned worker leaked into candidate picker');
  assert(c.list.innerHTML.includes('עובדת פנויה'),'unassigned worker missing from candidate picker');
}

{
  let opened=false,message='';
  const c=context({
    isAdmin:()=>true,
    scheduleData:async()=>({weekStart:'2026-08-23',week:{status:'availability_open'},assignments:[],settings:[]}),
    toast:text=>{message=text},
    window:{open:()=>{opened=true}}
  });
  vm.runInContext(functionSource(adminTools,'printSchedule'),c);
  await vm.runInContext('printSchedule()',c);
  assert.equal(opened,false,'blank schedule opened a print window');
  assert(message.includes('לא להפיק דף ריק'),'blank print did not explain why it stopped');
}

{
  const assignments=[{slot_key:'sun-am',staff_id:'1',role_name:'מכירה',status:'approved'}];
  let message='';
  const c=context({
    adminState:{weekStart:'2026-08-23',week:{status:'availability_open'},assignments},
    confirm:()=>true,fmtWeek:()=>'',
    document:{getElementById:()=>({value:''})},
    supabaseClient:{rpc:async()=>({error:new Error('publish_failed')})},
    toast:text=>{message=text},
    loadAdminFinalData:async()=>{throw new Error('must not reload after failed publish')},
    openTeamWhatsAppFinal(){},console:{error(){} }
  });
  vm.runInContext(functionSource(core,'publishFinal'),c);
  await vm.runInContext('publishFinal()',c);
  assert.deepEqual(c.adminState.assignments,assignments,'failed publish changed the in-memory schedule');
  assert(message.includes('הפרסום נכשל'),'failed publish did not report failure');
}

console.log('MATOK schedule regression checks passed');
