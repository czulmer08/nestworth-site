/* Verify a receipt scan falls back to another flash model when the primary is overloaded (503), and only gives up after all are busy. */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(fs.readFileSync(APP,'utf8'));return;}r.writeHead(200,{'Content-Type':'text/plain'});r.end("");});
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage();
  const errs=[];page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof geminiScan==='function'&&typeof geminiRankList==='function'&&typeof geminiModels==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  // ranking: flash-latest first, real numbered flash next, lite/preview demoted
  const r0=await page.evaluate(()=>geminiRankList(['gemini-2.0-flash-lite','gemini-flash-latest','gemini-2.5-flash','gemini-2.0-flash','gemini-2.5-flash-preview-09']));
  ck('ranking: flash-latest first, lite/preview demoted', r0[0]==='gemini-flash-latest'&&r0.indexOf('gemini-2.5-flash')<r0.indexOf('gemini-2.0-flash-lite'), JSON.stringify(r0));

  // 1) primary model 503s, second model succeeds -> scan returns, using the 2nd model
  const r1=await page.evaluate(async()=>{
    localStorage.setItem('nw_gemini_models',JSON.stringify(['modelA','modelB','modelC']));
    var calls=[];
    window.fetch=async function(url,opts){
      var m=(url.match(/models\/([^:]+):generateContent/)||[])[1];
      if(m){calls.push(m); if(m==='modelA')return {ok:false,status:503,json:async()=>({error:{message:'overloaded'}})};
        return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:'{"ok":1}'}]}}]})};}
      return {ok:true,status:200,json:async()=>({models:[]})};
    };
    var txt=await geminiScan('KEY',{},'fail');
    return {txt:txt, calls:calls};
  });
  ck('503 on primary -> falls back to next model and succeeds', r1.txt==='{"ok":1}'&&r1.calls[0]==='modelA'&&r1.calls[1]==='modelB', JSON.stringify(r1));

  // 2) ALL models 503 -> after sweeping every model (multiple passes) it throws the friendly "all overloaded" message
  const r2=await page.evaluate(async()=>{
    localStorage.setItem('nw_gemini_models',JSON.stringify(['mA','mB']));
    var distinct={},total=0;
    window.fetch=async function(url,opts){
      var m=(url.match(/models\/([^:]+):generateContent/)||[])[1];
      if(m){distinct[m]=1;total++;return {ok:false,status:503,json:async()=>({error:{message:'busy'}})};}
      return {ok:true,status:200,json:async()=>({models:[]})};
    };
    // neutralize backoff waits for speed
    var realTO=window.setTimeout; window.setTimeout=function(fn){return realTO(fn,0);};
    var err='';try{await geminiScan('KEY',{},'fail');}catch(e){err=e.message;}
    window.setTimeout=realTO;
    return {err:err, distinctCount:Object.keys(distinct).length, total:total};
  });
  ck('all models 503 -> tries both models, multiple passes, friendly overload error', /overloaded/.test(r2.err)&&r2.distinctCount===2&&r2.total>=4, JSON.stringify(r2));

  // 3) a non-retryable 400 (bad request) fails immediately, no model hopping
  const r3=await page.evaluate(async()=>{
    localStorage.setItem('nw_gemini_models',JSON.stringify(['mA','mB','mC']));
    var calls=0;
    window.fetch=async function(url,opts){
      var m=(url.match(/models\/([^:]+):generateContent/)||[])[1];
      if(m){calls++;return {ok:false,status:400,json:async=>({}),json:async()=>({error:{message:'bad'}})};}
      return {ok:true,status:200,json:async()=>({models:[]})};
    };
    var err='';try{await geminiScan('KEY',{},'fail');}catch(e){err=e.message;}
    return {err:err, calls:calls};
  });
  ck('400 fails fast (one call, no fallback loop)', /Scan failed \(400\)/.test(r3.err)&&r3.calls===1, JSON.stringify(r3));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();
