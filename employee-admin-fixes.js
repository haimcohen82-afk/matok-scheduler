(function(){
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const showSaved=msg=>{try{toast(msg)}catch(e){}; const b=document.getElementById('saveEmployeeBtn'); if(b){const old=b.textContent;b.textContent='נשמר ✓';b.classList.add('ok');setTimeout(()=>{b.textContent=old==='שומר...'?'שמירת העובד':old;b.classList.remove('ok')},1800)}};

  window.saveEmployeePreview=async function(){
    if(savingEmployee)return;
    const btn=document.getElementById('saveEmployeeBtn');
    const name=document.getElementById('employeeName').value.trim(),phone=document.getElementById('employeePhone').value.trim(),username=document.getElementById('employeeUsername').value.trim().toLowerCase(),code=document.getElementById('employeeCode').value.trim(),morning=document.getElementById('employeeMorning').checked,evening=document.getElementById('employeeEvening').checked;
    if(!name||!phone||!username){toast('יש למלא שם, טלפון ושם משתמש');return}
    if(!/^[a-z0-9._-]{4,24}$/.test(username)){toast('שם המשתמש חייב להכיל 4–24 תווים באנגלית, מספרים, נקודה, מקף או קו תחתון');return}
    if(!morning&&!evening){toast('יש לבחור בוקר, ערב או שניהם');return}
    if(editingEmployee<0&&!/^\d{4}$/.test(code)){toast('לעובד חדש יש להגדיר קוד בן 4 ספרות');return}
    if(code&&!/^\d{4}$/.test(code)){toast('הקוד האישי חייב להכיל 4 ספרות');return}
    const n=id=>Number(document.getElementById(id).value||0);
    const weekdayMorning=[...document.querySelectorAll('.dayMorning')].map(x=>x.checked?1:0),weekdayEvening=[...document.querySelectorAll('.dayEvening')].map(x=>x.checked?1:0);
    const record={id:editingEmployee>=0?employees[editingEmployee].id:null,name,phone,username,role:document.getElementById('employeeRole').value,morning,evening,weeklyRequired:n('weeklyRequired'),morningRequired:morning?n('morningRequired'):0,eveningRequired:evening?n('eveningRequired'):0,morningMax:morning?n('morningMax'):0,eveningMax:evening?n('eveningMax'):0,morningOptions:morning?n('morningOptions'):0,eveningOptions:evening?n('eveningOptions'):0,friday:document.getElementById('employeeFriday').value,customEndTime:document.getElementById('employeeCustomEndTime').value,notes:document.getElementById('employeeNotes').value.trim(),weekdayMorning,weekdayEvening,weekdays:weekdayMorning.map((x,i)=>x||weekdayEvening[i]?1:0)};
    const settings={morning,evening,weeklyRequired:record.weeklyRequired,morningRequired:record.morningRequired,eveningRequired:record.eveningRequired,morningMax:record.morningMax,eveningMax:record.eveningMax,morningOptions:record.morningOptions,eveningOptions:record.eveningOptions,friday:record.friday,notes:record.notes,customEndTime:record.customEndTime,weekdayMorning,weekdayEvening,weekdays:record.weekdays};
    const payload={full_name:name,phone,username,role_name:record.role,is_active:true,settings};
    savingEmployee=true;btn.disabled=true;btn.textContent='שומר...';
    try{
      const wasEditing=editingEmployee>=0;
      if(wasEditing){
        const {error:updateError}=await supabaseClient.from('staff').update({full_name:name,phone,username,role_name:record.role,settings,is_active:true}).eq('id',record.id);
        if(updateError)throw updateError;
        if(code){const {error:pinError}=await supabaseClient.rpc('admin_set_staff_pin',{p_staff_id:record.id,p_code:code});if(pinError)throw pinError;}
      }else{
        const {error:createError}=await supabaseClient.rpc('admin_upsert_staff',{p_id:null,p_payload:payload,p_code:code});if(createError)throw createError;
      }
      await loadAdminData();
      closeEmployee();
      showSaved(wasEditing?(code?'העובד נשמר והקוד עודכן':'הגדרות העובד נשמרו'):'העובד נוסף בהצלחה');
    }catch(error){console.error('saveEmployeePreview',error);toast('שמירת העובד נכשלה: '+(error?.message||'שגיאה לא ידועה'));}
    finally{savingEmployee=false;btn.disabled=false;btn.textContent='שמירת העובד';}
  };

  window.issueEmployeeCredentials=async function(index,openWhatsapp){
    if(appSession.type!=='admin'){toast('פעולה זו זמינה למנהל בלבד');return}
    const employee=employees[index];if(!employee?.id){toast('עובד לא נמצא');return}
    let popup=null;
    if(openWhatsapp){popup=window.open('about:blank','_blank');if(popup){try{popup.document.write('<title>MATOK</title><p style="font-family:Arial;text-align:center;padding:30px">מכין הודעת WhatsApp...</p>')}catch(e){}}}
    toast('מייצר קוד חדש...');
    const {data,error}=await supabaseClient.rpc('admin_issue_staff_credentials',{p_staff_id:employee.id});
    if(error||!data?.length){if(popup)popup.close();console.error(error);toast('יצירת פרטי הכניסה נכשלה: '+(error?.message||'שגיאה לא ידועה'));return}
    const c=data[0];
    const message=`היי ${c.full_name},\n\nאלו פרטי הכניסה שלך למערכת סידור העבודה של MATOK:\n\nקישור:\nhttps://voluble-marigold-95c410.netlify.app/\n\nשם משתמש: ${c.username}\nקוד PIN: ${c.pin}\n\nיש לבחור „כניסת עובד/ת”, להזין את שם המשתמש והקוד, ולהגיש זמינות לשבוע הקרוב.\n\nהקוד אישי ואין להעביר אותו לעובד אחר.`;
    if(openWhatsapp){const wa=`https://wa.me/${normalizeIsraeliPhone(c.phone)}?text=${encodeURIComponent(message)}`;if(popup)popup.location.href=wa;else window.location.href=wa;toast('נוצר קוד חדש והודעת WhatsApp מוכנה לשליחה');}
    else{try{await navigator.clipboard.writeText(`שם משתמש: ${c.username}\nקוד PIN: ${c.pin}`)}catch(e){}alert(`פרטי כניסה חדשים ל${c.full_name}\n\nשם משתמש: ${c.username}\nקוד PIN: ${c.pin}\n\nהפרטים הועתקו ללוח.`)}
  };
  window.shareEmployeeCredentials=function(index){if(!confirm('הפעולה תיצור לעובד קוד חדש ותפתח הודעת WhatsApp מוכנה. להמשיך?'))return;return issueEmployeeCredentials(index,true)};
  window.resetEmployeePin=function(index){if(!confirm('לאפס את הקוד הקודם וליצור קוד חדש?'))return;return issueEmployeeCredentials(index,false)};

  const renameButtons=()=>document.querySelectorAll('#employeeGrid button').forEach(b=>{if(b.textContent.trim()==='שליחת פרטי כניסה')b.textContent='שליחת קוד חדש בוואטסאפ'});
  renameButtons();
  new MutationObserver(renameButtons).observe(document.body,{subtree:true,childList:true});
})();
