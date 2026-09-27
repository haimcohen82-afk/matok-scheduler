import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [admin,form,build,html]=await Promise.all([
 'matok-onboarding-final-v1.js',
 'onboarding.html',
 'build.mjs',
 'dist/index.html'
].map(x=>readFile(x,'utf8')));
const has=(src,t,msg)=>assert(src.includes(t),msg);
for(const [needle,label] of [
 ['admin_create_onboarding_invite','admin-only invite creation'],
 ['admin_list_onboarding_records','review inbox'],
 ['onboarding.html#','one-time questionnaire URL with fragment'],
 ['staff-onboarding-originals','private original storage'],
 ['admin_import_onboarding_file','file intake RPC'],
 ['admin_update_onboarding_record','manual data correction'],
 ['admin_approve_onboarding_new','manual new staff approval'],
 ['admin_link_onboarding_existing','safe existing-employee linking'],
 ['createSignedUrl','private original file access'],
 ['pdfjs-dist','local PDF extraction'],
 ['tesseract.js','local OCR'],
 ['mammoth','DOCX extraction'],
 ['loadAdminData()','synchronization with existing staff management'],
 ['obOpenFile','view original if OCR uncertain']
])has(admin,needle,label);
for(const [needle,label] of [
 ['onboarding_form_status','status validation'],
 ['onboarding_submit_form','one-time form submission'],
 ["data.consent=",'explicit consent'],
 ['persistSession:false','no anonymous employee session persistence']
])has(form,needle,label);
has(build,"'matok-onboarding-final-v1.js'",'production module must include onboarding');
has(build,"'onboarding.html'",'questionnaire must be deployed as independent static page');
has(html,'admin_create_onboarding_invite','production app must include onboarding manager');
has(html,'obEntry','existing staff panel must include onboarding control');
assert(!/service_role|supabase_service_key|sb_secret_/i.test(form),'questionnaire must not embed private credentials');
assert(!/service_role|supabase_service_key|sb_secret_/i.test(admin),'admin UI must not embed private credentials');
const publicForm=form.slice(form.indexOf('<form id="onboardForm"'),form.indexOf('</form>'));
assert(!/name="(?:bank|identity|id_number|bank_account)"/.test(publicForm),'public form should not solicit unnecessary sensitive details');
console.log('MATOK onboarding questionnaire, admin intake and document privacy checks passed');