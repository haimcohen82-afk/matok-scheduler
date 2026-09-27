import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync('dist/index.html','utf8');
const manifest=JSON.parse(readFileSync('dist/manifest.webmanifest','utf8'));
for(const key of ['matokCompactV2','matokInstallBtn','epOpenClock','mfHome','mfActionGrid','mfSectionHeader','employee_attendance_state','employee_attendance_punch','admin_attendance_overview','admin_configure_attendance_site','matokAttendanceAdminTab','data-mf-section','mfBackHome']) assert.ok(html.includes(key),`Missing attendance/compact capability: ${key}`);
assert.equal(manifest.display,'standalone');
assert.ok(!html.includes('employee-simple-ui-v1.js'));
assert.ok(!html.includes("el('epHome')"),'Attendance must attach to the real mfHome portal');
console.log('Attendance and compact UI build checks passed');
