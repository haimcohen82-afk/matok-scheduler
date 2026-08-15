(() => {
  function dedupePreviewAssignments(){
    try{
      Object.keys(previewAssignments||{}).forEach(slot=>{
        const list=Array.isArray(previewAssignments[slot])?previewAssignments[slot]:[];
        const seen=new Map();
        list.forEach(a=>{
          if(!a) return;
          const key=String(a.id||'')+'|'+String(a.name||'').trim().toLowerCase();
          if(!key||key==='|') return;
          const current=seen.get(key);
          if(!current){ seen.set(key,{...a}); return; }
          if(current.status!=='approved' && a.status==='approved') seen.set(key,{...current,...a,status:'approved'});
        });
        previewAssignments[slot]=[...seen.values()];
      });
    }catch(e){ console.error('dedupePreviewAssignments',e); }
  }

  const previousLoad = typeof loadScheduleFromDb==='function' ? loadScheduleFromDb : null;
  let loadQueue = Promise.resolve();
  if(previousLoad){
    loadScheduleFromDb = function(){
      const run = loadQueue.then(async()=>{
        await previousLoad();
        dedupePreviewAssignments();
        if(typeof renderAdminSchedule==='function') renderAdminSchedule();
        if(typeof renderAdminOverview==='function') renderAdminOverview();
        if(typeof renderSchedulePreview==='function') renderSchedulePreview();
      });
      loadQueue = run.catch(err=>console.error('schedule load queue',err));
      return run;
    };
  }

  const wrapWithDedupe = name => {
    try{
      const original = globalThis[name];
      if(typeof original!=='function') return;
      globalThis[name] = function(...args){
        dedupePreviewAssignments();
        return original.apply(this,args);
      };
    }catch(e){ console.error('wrapWithDedupe',name,e); }
  };

  ['renderAdminSchedule','renderAdminOverview','renderSchedulePreview','printSchedulePreview','buildWhatsAppSchedule'].forEach(wrapWithDedupe);

  if(typeof saveScheduleToDb==='function'){
    const previousSave=saveScheduleToDb;
    saveScheduleToDb=async function(...args){
      dedupePreviewAssignments();
      return previousSave.apply(this,args);
    };
  }

  if(typeof choosePreviewEmployee==='function'){
    const previousChoose=choosePreviewEmployee;
    choosePreviewEmployee=function(...args){
      dedupePreviewAssignments();
      const result=previousChoose.apply(this,args);
      dedupePreviewAssignments();
      return result;
    };
  }

  window.dedupePreviewAssignments=dedupePreviewAssignments;
  setTimeout(()=>{
    dedupePreviewAssignments();
    if(typeof renderAdminSchedule==='function') renderAdminSchedule();
    if(typeof renderSchedulePreview==='function') renderSchedulePreview();
  },900);
})();