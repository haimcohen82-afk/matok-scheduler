import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile('matok-payroll-final-v1.js','utf8');
const ui=await readFile('matok-ui-final-v1.js','utf8');
const begin=source.indexOf('  function matchPage(text){');
const end=source.indexOf('  async function ocrPage(',begin);
assert(begin>=0&&end>begin,'matching function must be present');
const matching=source.slice(begin,end);
const defs=String.raw`
const norm=v=>String(v??'').toLowerCase().replace(/[\u0591-\u05C7]/g,'').replace(/[״”]/g,'"').replace(/[׳’]/g,"'").replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
const tokens=v=>norm(v).split(' ').filter(Boolean);
function levenshtein(a,b){a=String(a||'');b=String(b||'');if(a===b)return 0;if(!a.length)return b.length;if(!b.length)return a.length;const prev=Array.from({length:b.length+1},(_,i)=>i),cur=new Array(b.length+1);for(let i=1;i<=a.length;i++){cur[0]=i;for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));for(let j=0;j<=b.length;j++)prev[j]=cur[j]}return prev[b.length]}
`;
const staff=[
 {id:'staff-1',full_name:'אוריה ברק',username:'oria731',is_active:true},
 {id:'staff-2',full_name:'שירה בבגנוב',username:'shira268',is_active:true},
 {id:'staff-3',full_name:'אורטל ל',username:'ortal482',is_active:true}
];
const run=(text,employees=staff)=>vm.runInNewContext(defs+'\nconst staff='+JSON.stringify(employees)+';\n'+matching+'\nmatchPage('+JSON.stringify(text)+')');
const exact=run('תלוש שכר שם העובד אוריה ברק תאריך 08/2026');
assert.equal(exact.staffId,'staff-1','full exact name should match');
assert.equal(exact.confidence,'high');
const short=run('שם העובד אוריה ברק',[
 {id:'short',full_name:'אוריה ב',username:'oria731',is_active:true},
 {id:'other',full_name:'אורטל ל',username:'ortal482',is_active:true}
]);
assert.equal(short.staffId,'','short family name must require manual confirmation');
assert.equal(short.suggestedId,'short');
const first=run('תלוש חודשי שירה ללא שם משפחה');
assert.equal(first.staffId,'','first name alone must never assign a confidential payslip');
const blank=run('');
assert.equal(blank.staffId,'');
for(const token of ['mpReviewCanvas','mpOpenOriginal','mpSkipUnmatched','mpDownloadUnmatched','cameraImagesToPdf','openNewPayrollStaff','pdfPages.filter(x=>x.staffId&&!x.skip&&!x.sharedRisk)','savedStaffIds','createSignedUrl'])assert(source.includes(token),'missing payroll behavior: '+token);
const multiStart=source.indexOf('  function multipleStaffOnPage(text){');
const multiEnd=source.indexOf('  function matchPage(text){',multiStart);
assert(multiStart>=0&&multiEnd>multiStart);
const multi=source.slice(multiStart,multiEnd);
const names=vm.runInNewContext(defs+'\nconst staff='+JSON.stringify(staff)+';\n'+multi+'\nmultipleStaffOnPage('+JSON.stringify('תלושי שכר אוריה ברק וגם שירה בבגנוב')+')');
assert.equal(names.length,2,'multi-employee PDFs must be identified as unsafe to assign');
assert(source.includes('if(r.sharedRisk&&v!==\'__skip__\')'),'shared page manual override must be blocked');
assert(source.includes('savedStaffIds'),'retry must avoid duplicate uploads');
assert(ui.includes('Consistent MATOK visual system'));
console.log('Payroll intake UX and privacy tests passed');
