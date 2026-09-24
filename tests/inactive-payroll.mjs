import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const [shell,payroll,core,access,build]=await Promise.all([
  'app-shell.html','matok-payroll-final-v1.js','matok-core-final-v1.js',
  'matok-access-final-v1.js','dist/index.html'
].map(p=>readFile(p,'utf8')));
const has=(source,needle,label)=>assert.ok(source.includes(needle),label);
has(shell,".select('*').order('full_name')",'staff management must load active and inactive');
has(shell,'employees=allStaff.filter(e=>e.isActive)','schedule must remain active-only');
has(shell,'inactiveEmployees=allStaff.filter(e=>!e.isActive)','inactive archive must remain visible');
has(shell,'עובדים לא פעילים','manager must show an inactive section');
has(shell,'openInactiveEmployee','inactive employee cards must remain editable');
has(shell,"is_active:document.getElementById('employeeIsActive').value==='active'",'editing must preserve explicit active status');
has(shell,'reactivateEmployee','manager must explicitly be able to reactivate');
has(payroll,".select('id,full_name,phone,username,role_name,is_active')",'matching must fetch all employees');
has(payroll,"await getStaff(true);pdfBytes=",'a new PDF should refresh the employee directory');
has(payroll,'לא פעילים','manual PDF assignment must include inactive employees');
has(payroll,"admin_list_payroll_profiles_v2",'payroll profiles must include status');
has(payroll,"await getStaff(true);",'payroll import must refresh staff before match');
has(core,"u.login_status==='inactive'",'inactive employees must get a clear login response');
has(core,"data?.[0]?.login_status==='inactive'",'inactive saved sessions must be rejected');
has(access,"check.data?.[0]?.login_status!=='inactive'",'live sessions must be revoked on deactivation');
has(build,'עובדים לא פעילים','production build must include inactive employee management');
has(build,"admin_list_payroll_profiles_v2",'production build must include full payroll matching');
console.log('MATOK inactive-staff and historical payroll regression checks passed');
