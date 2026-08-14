(() => {
  const ready = () => typeof window.supabaseClient !== 'undefined';
  const applyFixes = () => {
    if (!ready()) return setTimeout(applyFixes, 50);

    const originalRpc = window.supabaseClient.rpc.bind(window.supabaseClient);
    window.supabaseClient.rpc = (fn, args, options) => {
      if (fn === 'admin_upsert_staff') fn = 'admin_save_staff_v2';
      if (fn === 'admin_issue_staff_credentials') fn = 'admin_issue_staff_credentials_v2';
      return originalRpc(fn, args, options);
    };

    window.issueEmployeeCredentials = async function(index, openWhatsapp) {
      if (window.appSession?.type !== 'admin') {
        window.toast?.('פעולה זו זמינה למנהל בלבד');
        return;
      }
      const employee = window.employees?.[index];
      if (!employee?.id) {
        window.toast?.('עובד לא נמצא');
        return;
      }

      let popup = null;
      if (openWhatsapp) {
        popup = window.open('about:blank', '_blank');
        if (popup) {
          popup.document.write('<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><body style="font-family:Arial;padding:24px">מכין הודעת WhatsApp...</body></html>');
        }
      }

      const { data, error } = await originalRpc('admin_issue_staff_credentials_v2', { p_staff_id: employee.id });
      if (error || !data?.length) {
        console.error('issueEmployeeCredentials', error);
        if (popup) popup.close();
        window.toast?.('יצירת פרטי הכניסה נכשלה: ' + (error?.message || 'שגיאה לא ידועה'));
        return;
      }

      const c = data[0];
      const message = `היי ${c.full_name},\n\nאלו פרטי הכניסה שלך למערכת סידור העבודה של MATOK:\n\nקישור:\nhttps://voluble-marigold-95c410.netlify.app/\n\nשם משתמש: ${c.username}\nקוד PIN: ${c.pin}\n\nיש לבחור „כניסת עובד/ת”, להזין את שם המשתמש והקוד, ולהגיש זמינות לשבוע הקרוב.\n\nהקוד אישי ואין להעביר אותו לעובד אחר.`;
      try { await navigator.clipboard.writeText(`שם משתמש: ${c.username}\nקוד PIN: ${c.pin}`); } catch (_) {}

      if (openWhatsapp) {
        const phone = typeof window.normalizeIsraeliPhone === 'function' ? window.normalizeIsraeliPhone(c.phone) : String(c.phone || '').replace(/\D/g, '');
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        if (popup) popup.location.href = url;
        else window.location.href = url;
        window.toast?.('נוצר קוד חדש ונפתחה הודעת WhatsApp');
      } else {
        alert(`פרטי כניסה חדשים ל${c.full_name}\n\nשם משתמש: ${c.username}\nקוד PIN: ${c.pin}\n\nהפרטים הועתקו ללוח.`);
        window.toast?.('הקוד אופס בהצלחה');
      }
    };

    window.shareEmployeeCredentials = index => window.issueEmployeeCredentials(index, true);
    window.resetEmployeePin = index => {
      if (!confirm('לאפס את הקוד הקודם וליצור קוד חדש?')) return;
      return window.issueEmployeeCredentials(index, false);
    };

    const originalRenderEmployees = window.renderEmployees;
    if (typeof originalRenderEmployees === 'function') {
      window.renderEmployees = function() {
        originalRenderEmployees();
        document.querySelectorAll('#employeeGrid button').forEach(btn => {
          if (btn.textContent.trim() === 'שליחת פרטי כניסה') btn.textContent = 'שליחת שם משתמש + קוד חדש';
          if (btn.textContent.trim() === 'איפוס קוד') btn.textContent = 'איפוס קוד והצגת קוד חדש';
        });
      };
      window.renderEmployees();
    }

    const codeInput = document.getElementById('employeeCode');
    if (codeInput) codeInput.placeholder = '4 ספרות לשינוי הקוד; ריק = ללא שינוי';
  };

  applyFixes();
})();
