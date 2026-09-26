import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

function getFunction(source,name){
  const marker=source.includes('async function '+name+'(')?'async function '+name+'(':'function '+name+'(';
  const start=source.indexOf(marker);
  assert(start>=0,'Missing function: '+name);
  const brace=source.indexOf('{',start);
  let depth=0,quoted='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quoted){
      if(escaped){escaped=false;continue}
      if(ch==='\\'){escaped=true;continue}
      if(ch===quoted)quoted='';
      continue;
    }
    if(ch==='"'||ch==="'"||ch.charCodeAt(0)===96){quoted=ch;continue}
    if(ch==='{')depth++;
    if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error('Unclosed function: '+name);
}

const [admin,legacy,payroll,ui,messages,dist]=await Promise.all([
  'matok-admin-tools-final-v1.js','app-shell.html','matok-payroll-final-v1.js',
  'matok-ui-final-v1.js','matok-notifications-final-v1.js','dist/index.html'
].map(file=>readFile(file,'utf8')));

// A cancelled Friday change must not alter existing availability.
{
  const states={fri:'available'};let renders=0,confirmCalls=0;
  const c=vm.createContext({workerContext:{settings:{friday:'alternate'}},states,window:{confirm(){confirmCalls++;return false}},
    renderFridayWorker(){renders++},updateWorkerMetrics(){},toast(){}});
  vm.runInContext(getFunction(legacy,'fridayDecision'),c);
  vm.runInContext("fridayDecision('not_mine')",c);
  assert.equal(confirmCalls,1);
  assert.equal(states.fri,'available','cancelled Friday confirmation changed availability');
  assert.equal(renders,0,'cancelled Friday confirmation redrew an edited state');
  c.window.confirm=()=>true;
  vm.runInContext("fridayDecision('not_mine')",c);
  assert.equal(states.fri,'unavailable','confirmed Friday availability change was lost');
  assert.equal(renders,1);
  assert(legacy.includes('שיבוץ שכבר פורסם נשאר בתוקף'));
}

// A database update without a returned row must never report a successful save.
for(const scenario of ['no_row','saved','error']){
  let message='',refreshes=0,write=null;
  const button={disabled:false,textContent:'שמירת הודעה'};
  const weekStart='2026-09-27',note='להגיע בזמן';
  const response=scenario==='saved'?{data:{week_start:weekStart,manager_note:note},error:null}:
    scenario==='error'?{data:null,error:new Error('database rejected')}:{data:null,error:null};
  const c=vm.createContext({
    noteSavePending:false,isAdmin:()=>true,currentWeek:()=>weekStart,
    document:{getElementById:id=>id==='mfManagerNote'?{value:note}:button},
    supabaseClient:{from:()=>({update:fields=>{write=fields;return {eq:()=>({select:()=>({maybeSingle:async()=>response})})}}})},
    toast:s=>{message=s},window:{loadAdminFinalData:async()=>{refreshes++}},console:{error(){}}
  });
  vm.runInContext(getFunction(admin,'saveNote'),c);
  await vm.runInContext('saveNote()',c);
  assert.equal(write.manager_note,note);
  assert.equal(button.disabled,false,'save button remained locked');
  if(scenario==='saved'){
    assert(message.includes('נשמרה ואומתה'),'save success was not acknowledged');
    assert.equal(refreshes,1);
  }else{
    assert(message.includes('לא הושלמה'),'false success after failed or zero-row save');
    assert.equal(refreshes,0);
  }
}

assert(payroll.includes('payrollBootKey=key;'));
assert(payroll.includes('window.loadEmployeePayrollFinal=mcLoadEmployeePayrollV2'));
assert(payroll.includes("document.getElementById('mcPayrollRetry').onclick=mcLoadEmployeePayrollV2"));
assert(payroll.includes('window.matokApplyEmployeeSimpleMode?.(mode)'));
assert(ui.includes('window.matokApplyEmployeeSimpleMode=applyEmployeeSimpleMode'));
assert(payroll.includes('mcAttendanceBlocked')&&payroll.includes('mcBonusBlocked'));
assert(ui.includes("mode==='attendance'")&&ui.includes("mode==='bonus'"));
assert(payroll.includes('id="mpBackToAdmin"'));
assert(payroll.includes("getElementById('mpBackToAdmin').onclick"));
assert(messages.includes('id="mcSalesTemplate"'));
for(const key of ['positive','crosssell','near','reached','focus'])assert(messages.includes(key+':{title:'));
assert(messages.includes('admin_send_manager_message'));
assert(dist.includes('mcSalesTemplate'),'message templates missing from built application');
assert(dist.includes('mpBackToAdmin'),'back button missing from built application');
assert(dist.includes('האם את בטוחה שברצונך לבקש שינוי ביום שישי?'),'Friday confirmation missing from built application');

console.log('MATOK September scheduler stabilization checks passed');
