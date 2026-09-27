import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

function functionSource(source,name){
  const re=new RegExp('(?:async\\s+)?function\\s+'+name+'\\s*\\([^)]*\\)\\s*\\{');
  const m=re.exec(source);assert(m,'missing function '+name);
  const brace=m.index+m[0].lastIndexOf('{');
  let q='',escaped=false,depth=0;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(q){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===q)q='';continue}
    if(ch==='"'||ch==="'"||ch.charCodeAt(0)===96){q=ch;continue}
    if(ch==='{')depth++;
    if(ch==='}'&&--depth===0)return source.slice(m.index,i+1);
  }
  throw new Error('unclosed function '+name);
}
const [nav,payroll,shell,build,dist]=await Promise.all([
  'matok-navigation-final-v1.js','matok-payroll-final-v1.js','app-shell.html',
  'build.mjs','dist/index.html'
].map(path=>readFile(path,'utf8')));

// Every standalone menu, submenu and dynamic modal must receive an actual clickable back button.
function makeHarness(type){
  const element=(tag='div')=>({
    tagName:tag,className:'',dataset:{},children:[],style:{},id:'',
    appendChild(node){this.children.push(node);return node},
    prepend(node){this.children.unshift(node);return node},
    setAttribute(name,value){this[name]=value},
    querySelector(selector){
      if(selector.startsWith(':scope > .')){
        const name=selector.slice(':scope > .'.length);
        return this.children.find(n=>n.className.split(' ').includes(name))||null;
      }
      return null;
    }
  });
  const adminPanels=['overview','employees','adminSchedule','settings','attendance','requests','payrollFinal'].map(id=>Object.assign(element('section'),{id}));
  const payrollSubs=['mp-dash','mp-pdf','mp-single','mp-hours','mp-profiles','mp-delivery','mp-policy'].map(id=>Object.assign(element('section'),{id}));
  const employeePanels=['availability','hours','contact','scheduleWorker'].map(id=>Object.assign(element('section'),{id}));
  const modalContents=Array.from({length:5},()=>element('section'));
  const modals=modalContents.map((content,i)=>({id:'dialog'+i,querySelector:()=>content}));
  let overviewCalls=0,payrollCalls=0,closed=[];
  const document={
    readyState:'complete',documentElement:{},head:{appendChild(){}},
    getElementById:id=>id==='matokNavigationStyle'?null:id==='payrollFinal'?{scrollIntoView(){}}:null,
    createElement:element,
    querySelectorAll:selector=>({
      '#worker > .panel':employeePanels,
      '#admin > .panel':adminPanels,
      '#payrollFinal > .mpSub':payrollSubs,
      '.modal':modals
    })[selector]||[],
    querySelector:selector=>selector.includes('data-target="overview"')
      ?{click(){overviewCalls++}}:selector.includes('data-mp="dash"')
      ?{click(){payrollCalls++}}:null
  };
  const ctx=vm.createContext({
    appSession:{type},document,window:{scrollTo(){}},
    MutationObserver:class {observe(){}},
    setTimeout:callback=>callback(),
    closeModal:id=>closed.push(id)
  });
  vm.runInContext(nav,ctx);
  return {adminPanels,payrollSubs,employeePanels,modalContents,modals,
    overviewCalls:()=>overviewCalls,payrollCalls:()=>payrollCalls,closed};
}
{
  const h=makeHarness('admin');
  assert(!h.adminPanels[0].children.length,'overview should not have redundant back button');
  for(const panel of h.adminPanels.slice(1)){
    assert(panel.querySelector(':scope > .matokFlowBack'),'missing manager back button: '+panel.id);
    panel.children[0].children[0].onclick();
  }
  assert.equal(h.overviewCalls(),h.adminPanels.length-1,'manager back route failed');
  assert(!h.payrollSubs[0].children.length,'payroll dashboard is a submenu root');
  for(const sub of h.payrollSubs.slice(1)){
    assert(sub.querySelector(':scope > .matokFlowBack'),'missing payroll submenu back button: '+sub.id);
    sub.children[0].children[0].onclick();
  }
  assert.equal(h.payrollCalls(),h.payrollSubs.length-1,'payroll back route failed');
  h.modalContents.forEach((el,i)=>{
    assert(el.querySelector(':scope > .matokModalBack'),'missing back button on modal '+i);
    el.children[0].children[0].onclick();
  });
  assert.equal(h.closed.length,h.modalContents.length,'modal back did not close');
}
{
  const h=makeHarness('employee');
  let n=0; // Employee click handler exists for all panels and targets showEmployeeHome.
  for(const panel of h.employeePanels){
    assert(panel.querySelector(':scope > .matokFlowBack'),'missing employee back button: '+panel.id);
    n++;
  }
  assert.equal(n,4);
}

// Inactive employees have a direct action; they are never reactivated by uploading.
assert(shell.includes('matokOpenStaffDocumentUpload'));
assert(shell.includes('עובדים לא פעילים'));
assert(shell.includes('העברה ללא פעיל'));
assert(build.includes("'matok-navigation-final-v1.js'"));
assert(dist.includes('matokRefreshBackNavigation'));
assert(payroll.includes('mpSingleSelectorSerial'));
assert(payroll.includes("admin_list_payroll_profiles_v2"),'inactive fallback missing');

// Simulate server-side inactive profiles being omitted by direct staff-table results.
{
  let staff=[];
  const c=vm.createContext({staff,isAdmin:()=>true,supabaseClient:{
    from:()=>({select:()=>({order:()=>({order:async()=>({data:[{id:'active-1',is_active:true,full_name:'פעילה'}],error:null})})})}),
    rpc:async name=>{
      assert.equal(name,'admin_list_payroll_profiles_v2');
      return {data:[{staff_id:'archived-2',is_active:false,full_name:'לא פעילה'}],error:null};
    }
  }});
  vm.runInContext(functionSource(payroll,'getStaff'),c);
  const rows=await vm.runInContext('getStaff(true)',c);
  assert.equal(rows.length,2);
  assert(rows.some(x=>x.id==='archived-2'&&x.is_active===false),'inactive employee excluded from upload directory');
}

// Upload must verify the private archived employee document registration.
// If the server rejects it, report the exact stage and clean only unregistered files.
async function uploadScenario(scenario){
  let deleted=0,uploadedPath='',registered=false;
  const status={textContent:'',className:'mpStatus'};
  const saveButton={disabled:false};
  const file={name:'payroll.pdf',size:300,arrayBuffer:async()=>new Uint8Array([37,80,68,70]).buffer};
  const fields={
    mpSingleStaff:{value:'archived-2'},mpSingleType:{value:'payslip'},
    mpSinglePeriod:{value:'2026-09'},mpSingleFile:{files:[file],value:'pdf'},
    mpSingleStatus:status,mpSingleSave:saveButton
  };
  const c=vm.createContext({
    Blob,staff:[{id:'archived-2',is_active:false,full_name:'לא פעילה'}],
    isAdmin:()=>true,safe:v=>String(v),crypto:{randomUUID:()=> 'test-upload'},
    PDFLib:{PDFDocument:{load:async()=>({getPageCount:()=>1})}},
    ensurePdf:async()=>{},confirm:()=>true,loadDash:async()=>{},
    console:{error(){}},
    document:{getElementById:id=>fields[id]},
    supabaseClient:{
      storage:{from:()=>({
        upload:async path=>{uploadedPath=path;return {error:null}},
        remove:async()=>{deleted++;return {error:null}}
      })},
      rpc:async name=>{
        if(name==='admin_register_employee_document'){
          if(scenario==='reject')return {error:new Error('inactive forbidden')};
          registered=true;return {data:{id:'doc-1'},error:null};
        }
        assert.equal(name,'admin_list_employee_documents_v2');
        return {error:null,data:scenario==='not_found'?[]:[{staff_id:'archived-2',storage_path:uploadedPath}]};
      }
    }
  });
  vm.runInContext(functionSource(payroll,'saveSinglePdf'),c);
  await vm.runInContext('saveSinglePdf()',c);
  assert.equal(saveButton.disabled,false,'save button remained disabled');
  if(scenario==='success'){
    assert(registered&&status.className.includes('good'));
    assert(status.textContent.includes('החשבון לא הופעל'));
    assert.equal(deleted,0);
  }else if(scenario==='reject'){
    assert(status.textContent.includes('רישום המסמך לעובד'));
    assert(status.textContent.includes('שרת'));
    assert.equal(deleted,1,'failed registry left unregistered file behind');
  }else{
    assert(registered);
    assert(status.textContent.includes('בדוק את הארכיון'));
    assert.equal(deleted,0,'verified registry should never be rolled back on readback failure');
  }
}
for(const scenario of ['success','reject','not_found'])await uploadScenario(scenario);

console.log('MATOK all-menu navigation and inactive employee document tests passed');
