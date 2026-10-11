(() => {
  'use strict';

  const PROFILE=Object.freeze({
    productId:'matok-sidir',
    productName:'SIDIR',
    suiteId:'matok-suite',
    edition:'internal',
    distribution:'internal',
    securityProfile:'internal-standard',
    brandingProfile:'matok-basic',
    integrationProfile:'standalone',
    tenantMode:'single-tenant',
    version:1,
    ...(window.__MATOK_PROFILE__||{})
  });

  const modules=new Map();
  const capabilities=new Map();
  const adapters=new Map();
  const listeners=new Map();

  const freezeMeta=meta=>Object.freeze({...meta});

  function registerModule(name,meta={}){
    const key=String(name||'').trim();
    if(!key)throw new Error('module_name_required');
    const next=freezeMeta({
      name:key,
      version:String(meta.version||'1'),
      domain:String(meta.domain||'core'),
      status:String(meta.status||'active'),
      publicApi:Array.isArray(meta.publicApi)?[...meta.publicApi]:[],
      dependencies:Array.isArray(meta.dependencies)?[...meta.dependencies]:[],
      capabilities:Array.isArray(meta.capabilities)?[...meta.capabilities]:[]
    });
    modules.set(key,next);
    for(const capability of next.capabilities){
      if(!capabilities.has(capability))capabilities.set(capability,new Set());
      capabilities.get(capability).add(key);
    }
    emit('platform:module-registered',next);
    return next;
  }

  function registerAdapter(kind,name,implementation){
    const group=String(kind||'').trim(),key=String(name||'').trim();
    if(!group||!key||!implementation)throw new Error('invalid_adapter');
    if(!adapters.has(group))adapters.set(group,new Map());
    adapters.get(group).set(key,implementation);
    emit('platform:adapter-registered',{kind:group,name:key});
    return implementation;
  }

  function getAdapter(kind,name){
    return adapters.get(String(kind||''))?.get(String(name||''))||null;
  }

  function on(event,handler){
    if(typeof handler!=='function')throw new Error('handler_required');
    const key=String(event||'');
    if(!listeners.has(key))listeners.set(key,new Set());
    listeners.get(key).add(handler);
    return ()=>listeners.get(key)?.delete(handler);
  }

  function emit(event,payload){
    const handlers=[...(listeners.get(String(event||''))||[])];
    for(const handler of handlers){
      try{handler(payload)}catch(error){console.error('MATOK platform event handler',event,error)}
    }
  }

  function hasCapability(name){
    return (capabilities.get(String(name||''))?.size||0)>0;
  }

  function capabilityProviders(name){
    return [...(capabilities.get(String(name||''))||[])];
  }

  function describe(){
    return Object.freeze({
      profile:PROFILE,
      modules:Object.freeze([...modules.values()]),
      capabilities:Object.freeze([...capabilities.keys()]),
      adapters:Object.freeze([...adapters.entries()].map(([kind,set])=>({kind,names:[...set.keys()]})))
    });
  }

  const api=Object.freeze({
    profile:PROFILE,
    registerModule,
    listModules:()=>[...modules.values()],
    hasCapability,
    capabilityProviders,
    registerAdapter,
    getAdapter,
    on,
    emit,
    describe
  });

  Object.defineProperty(window,'MATOK_PLATFORM',{
    value:api,writable:false,configurable:false,enumerable:true
  });

  registerModule('platform',{
    version:'1',
    domain:'platform',
    capabilities:['module-registry','event-bus','adapter-registry','product-profile']
  });
  for(const moduleMeta of (window.__MATOK_MODULE_MANIFEST__||[])){
    if(moduleMeta?.name&&moduleMeta.name!=='platform')registerModule(moduleMeta.name,moduleMeta);
  }
})();