/* Verify per-account net-worth freshness: an account not updated in >45 days reads as stale; a new account falls back to
   the global date; and updating balances stamps only the accounts that actually changed. */
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
  await page.waitForFunction(()=>typeof staleAccounts==='function'&&typeof acctAsOf==='function'&&typeof applyNW==='function'&&typeof todayISO==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(async()=>{
    function iso(daysAgo){var d=new Date();d.setDate(d.getDate()-daysAgo);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,'0')+"-"+String(d.getDate()).padStart(2,'0');}
    var today=todayISO(),d10=iso(10),d60=iso(60);

    // A) helpers: 401k (60d) is stale; Savings (no per-account date) falls back to the fresh global date
    state.meta={cats:{},cons:{},goals:[],acctAsOf:{'checking':d10,'401k':d60},nwUpdated:today};
    state.assets=[{name:'Checking',bal:100},{name:'401k',bal:200},{name:'Savings',bal:50}];state.debts=[];
    var stale=staleAccounts().map(function(x){return x.name;});
    var savingsFallback=acctAsOf('Savings')===today;
    var checkingFresh=acctAsOf('Checking')===d10;

    // B) applyNW stamps only changed accounts
    window.vBatchClear=async()=>{};window.vBatchUpdate=async()=>{};window.writeMeta=async()=>{};window.loadAll=async()=>{};window.renderAll=()=>{};window.reconcileNeeded=()=>[];window.askConfirm=async()=>false;
    if(!document.getElementById('nwAsOf')){var i=document.createElement('input');i.id='nwAsOf';document.body.appendChild(i);}
    if(!document.getElementById('nwApply')){var b2=document.createElement('button');b2.id='nwApply';document.body.appendChild(b2);}
    if(!document.getElementById('nwMsg')){var m=document.createElement('div');m.id='nwMsg';document.body.appendChild(m);}
    state.meta.acctAsOf={'checking':d60,'savings':d60};state.meta.nwUpdated=d60;
    state.assets=[{name:'Checking',bal:100,row:2},{name:'Savings',bal:50,row:3}];state.debts=[];
    window.NWITEMS={assets:[{name:'Checking',amount:150},{name:'Savings',amount:50}],debts:[]}; // Checking changed, Savings unchanged
    $("nwAsOf").value=today;
    await applyNW();
    var stampedChanged=state.meta.acctAsOf['checking']===today;   // changed → refreshed
    var keptUnchanged=state.meta.acctAsOf['savings']===d60;       // untouched → keeps old date (can read stale)

    return {stale,savingsFallback,checkingFresh,stampedChanged,keptUnchanged};
  });

  ck('an account not updated in >45 days is flagged stale (401k), fresh ones are not', JSON.stringify(res.stale)===JSON.stringify(['401k']), JSON.stringify(res.stale));
  ck('a new account with no per-account date falls back to the global date (not falsely stale)', res.savingsFallback&&res.checkingFresh, JSON.stringify({save:res.savingsFallback,chk:res.checkingFresh}));
  ck('updating balances stamps only the account that actually changed', res.stampedChanged, String(res.stampedChanged));
  ck('an untouched account keeps its old date (so it can read as stale)', res.keptUnchanged, String(res.keptUnchanged));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();
