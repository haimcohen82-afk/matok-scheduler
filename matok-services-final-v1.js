(() => {
  'use strict';

  const utils=()=>window.MATOK_UTILS;
  function client(){
    if(typeof supabaseClient==='undefined'||!supabaseClient)throw new Error('supabase_client_unavailable');
    return supabaseClient;
  }
  function unwrap(response,context='backend_call_failed'){
    if(response?.error){
      const error=response.error instanceof Error?response.error:new Error(utils()?.errorMessage(response.error,context)||context);
      error.context=context;throw error;
    }
    return response?.data??null;
  }

  const data=Object.freeze({
    async rpc(name,args={}){return unwrap(await client().rpc(name,args),'rpc:'+name)},
    async select(table,configure){
      let query=client().from(table).select('*');
      query=typeof configure==='function'?configure(query):query;
      return unwrap(await query,'select:'+table);
    },
    async upload(bucket,path,file,options={}){return unwrap(await client().storage.from(bucket).upload(path,file,options),'storage_upload:'+bucket)},
    async remove(bucket,paths){return unwrap(await client().storage.from(bucket).remove(paths),'storage_remove:'+bucket)},
    async signedUrl(bucket,path,seconds=120){return unwrap(await client().storage.from(bucket).createSignedUrl(path,seconds),'storage_signed_url:'+bucket)}
  });

  const workforce=Object.freeze({
    async listStaff(){
      const response=await client().from('staff').select('id,full_name,phone,username,role_name,is_active').order('is_active',{ascending:false}).order('full_name');
      return unwrap(response,'staff:list');
    },
    async getPrivateProfile(staffId){return data.rpc('admin_get_staff_private_profile',{p_staff_id:staffId})}
  });

  const onboarding=Object.freeze({
    bucket:'staff-onboarding-originals',
    createInvite:()=>data.rpc('admin_create_onboarding_invite'),
    listRecords:()=>data.rpc('admin_list_onboarding_records'),
    getExtractedText:recordId=>data.rpc('admin_get_onboarding_text',{p_record_id:recordId}),
    updateRecord:(recordId,details)=>data.rpc('admin_update_onboarding_record',{p_record_id:recordId,p_details:details}),
    approveNew:payload=>data.rpc('admin_approve_onboarding_new',payload),
    linkExisting:(recordId,staffId)=>data.rpc('admin_link_onboarding_existing',{p_record_id:recordId,p_staff_id:staffId}),
    materialize:recordId=>data.rpc('admin_materialize_onboarding_employee',{p_record_id:recordId}),
    importFile:payload=>data.rpc('admin_import_onboarding_file',payload),
    importBatch:payload=>data.rpc('admin_import_onboarding_batch',payload),
    uploadOriginal:(path,file,contentType)=>data.upload('staff-onboarding-originals',path,file,{contentType,upsert:false}),
    removeOriginal:path=>data.remove('staff-onboarding-originals',[path]),
    originalUrl:async(path,seconds=120)=>{const data0=await data.signedUrl('staff-onboarding-originals',path,seconds);return data0?.signedUrl||''}
  });

  const api=Object.freeze({data,workforce,onboarding});
  Object.defineProperty(window,'MATOK_SERVICES',{value:api,writable:false,configurable:false,enumerable:true});

  window.MATOK_PLATFORM?.registerAdapter('data','supabase',data);
  window.MATOK_PLATFORM?.registerModule('services',{
    version:'1',domain:'platform',dependencies:['utils'],
    capabilities:['data-adapter','onboarding-service','workforce-service']
  });
})();