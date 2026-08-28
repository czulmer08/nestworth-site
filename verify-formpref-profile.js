/* Verify the Payee / Reimbursed Add-form prefs are PER PROFILE (stored in meta, written to the Meta tab), with a
   legacy device-wide localStorage fallback until a profile sets its own. */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(fs.readFileSync(APP,'utf8'));return;}r.writeHead(200,{'Content-Type':'text/plain'});r.end("");});
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof formPref==='function'&&typeof setFormPref==='function'&&typeof normMeta==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    var wrote=[]; window.writeMeta=async function(){wrote.push(JSON.parse(JSON.stringify(state.meta.prefs||{})));};
    try{localStorage.removeItem("nw_pref_payee");localStorage.removeItem("nw_pref_reimb");}catch(e){}

    // (1) no meta pref, no legacy -> defaults to true (shown)
    state={meta:normMeta({})};
    var def=formPref("payee");

    // (2) legacy device-wide localStorage still honored until the profile sets its own
    try{localStorage.setItem("nw_pref_payee","0");}catch(e){}
    var legacy=formPref("payee");

    // (3) setFormPref writes into meta.prefs and persists (writeMeta called); meta now overrides legacy
    setFormPref("payee",true);
    var afterSet=formPref("payee");
    var persisted=wrote.length>0 && wrote[wrote.length-1].payee===true;

    // (4) PROFILE-DEPENDENT: two different budgets carry their own value
    var A=normMeta({prefs:{payee:false,reimb:true}});
    var B=normMeta({prefs:{payee:true,reimb:false}});
    state.meta=A; var aPay=formPref("payee"), aReimb=formPref("reimb");
    state.meta=B; var bPay=formPref("payee"), bReimb=formPref("reimb");

    // (5) meta round-trips through JSON (what actually gets written to the sheet)
    var roundtrip=normMeta(JSON.parse(JSON.stringify(A))).prefs.payee;

    return {def,legacy,afterSet,persisted,aPay,aReimb,bPay,bReimb,roundtrip,hasPrefsField:('prefs' in normMeta({}))};
  });

  ck('default (no pref anywhere) is shown/true', res.def===true, JSON.stringify(res));
  ck('legacy device-wide localStorage honored as fallback', res.legacy===false, JSON.stringify(res));
  ck('setFormPref stores in meta.prefs and persists via writeMeta', res.afterSet===true&&res.persisted, JSON.stringify(res));
  ck('meta pref overrides the legacy localStorage value', res.afterSet===true, JSON.stringify(res));
  ck('PER-PROFILE: budget A and budget B keep independent values', res.aPay===false&&res.aReimb===true&&res.bPay===true&&res.bReimb===false, JSON.stringify(res));
  ck('prefs survive the JSON round-trip to the Meta tab', res.roundtrip===false&&res.hasPrefsField===true, JSON.stringify(res));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();
