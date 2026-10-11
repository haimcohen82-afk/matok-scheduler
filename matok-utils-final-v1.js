(() => {
  'use strict';

  const escapeHtml=value=>String(value??'').replace(/[&<>\"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'
  }[char]));

  const digits=value=>String(value??'').replace(/\D/g,'');

  function normalizeIsraeliPhone(value){
    const raw=String(value??'').trim();
    if(!raw)return '';
    const d=digits(raw);
    if(d.startsWith('972'))return '0'+d.slice(3);
    if(d.startsWith('0'))return d;
    return d.length===9?'0'+d:d;
  }

  function phone972(value){
    let d=digits(value);
    if(!d)return '';
    if(d.startsWith('972'))return d;
    if(d.startsWith('0'))return '972'+d.slice(1);
    if(d.length===9)return '972'+d;
    return d;
  }

  function isoDate(value){
    if(!value)return '';
    const raw=String(value).trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
    const match=raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
    if(!match)return '';
    return match[3]+'-'+String(match[2]).padStart(2,'0')+'-'+String(match[1]).padStart(2,'0');
  }

  function formatDate(value,locale='he-IL'){
    if(!value)return '';
    try{
      const iso=isoDate(value)||String(value);
      const date=new Date(iso.includes('T')?iso:iso+'T12:00:00');
      if(Number.isNaN(date.getTime()))return String(value);
      return date.toLocaleDateString(locale);
    }catch(_){return String(value)}
  }

  function safeJson(value,fallback=null){
    try{return JSON.parse(value)}catch(_){return fallback}
  }

  function errorMessage(error,fallback='שגיאה לא ידועה'){
    if(!error)return fallback;
    if(typeof error==='string')return error;
    return String(error.message||error.error_description||error.details||fallback);
  }

  function result(data,error=null){
    return Object.freeze({ok:!error,data:data??null,error:error||null});
  }

  function assert(condition,message='assertion_failed'){
    if(!condition)throw new Error(message);
    return true;
  }

  const api=Object.freeze({escapeHtml,digits,normalizeIsraeliPhone,phone972,isoDate,formatDate,safeJson,errorMessage,result,assert});

  Object.defineProperty(window,'MATOK_UTILS',{value:api,writable:false,configurable:false,enumerable:true});

  window.MATOK_PLATFORM?.registerModule('utils',{
    version:'1',domain:'platform',
    capabilities:['shared-utils','phone-normalization','date-normalization','safe-errors']
  });
})();