/* Verify weekly / every-2-weeks flat income types: correct annualization + form behavior. */
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
  await page.waitForFunction(()=>typeof monthsFor==='function'&&typeof annualOf==='function'&&typeof conTypeUI==='function'&&typeof readConCfg==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    var wk=monthsFor({type:'weekly',amount:100}), bw=monthsFor({type:'biweekly',amount:200});
    var wkAnnual=annualOf({type:'weekly',amount:100}), bwAnnual=annualOf({type:'biweekly',amount:200});
    document.getElementById('conType').value='weekly';conTypeUI();
    var wkUI={amt:getComputedStyle(document.getElementById('conAmtRow')).display!=='none',freqHidden:getComputedStyle(document.getElementById('conFreqRow')).display==='none',label:document.getElementById('conAmtLbl').textContent};
    document.getElementById('conAmt').value='150';var wkCfg=readConCfg();
    document.getElementById('conType').value='biweekly';conTypeUI();
    var bwLabel=document.getElementById('conAmtLbl').textContent;
    return {wkMonth:wk[0], wkFlat:wk.every(function(x){return Math.abs(x-wk[0])<0.005;}), bwMonth:bw[0],
      wkAnnual, bwAnnual, wkUI, wkCfg, bwLabel, opts:[].map.call(document.getElementById('conType').options,function(o){return o.value;})};
  });

  ck('weekly + biweekly are options in the income Budget type list', res.opts.indexOf('weekly')>=0&&res.opts.indexOf('biweekly')>=0, JSON.stringify(res.opts));
  ck('$100/week annualizes to ~$5200 (×52) spread flat across months', Math.abs(res.wkAnnual-5200)<1&&res.wkMonth===433.33&&res.wkFlat, JSON.stringify({m:res.wkMonth,a:res.wkAnnual}));
  ck('$200 every 2 weeks annualizes to ~$5200 (×26)', Math.abs(res.bwAnnual-5200)<1&&res.bwMonth===433.33, JSON.stringify({m:res.bwMonth,a:res.bwAnnual}));
  ck('weekly form shows a simple amount row (no paycheck frequency), labeled per week', res.wkUI.amt&&res.wkUI.freqHidden&&res.wkUI.label==='Amount per week', JSON.stringify(res.wkUI));
  ck('biweekly amount labeled "Amount every 2 weeks"', res.bwLabel==='Amount every 2 weeks', res.bwLabel);
  ck('readConCfg returns {type:weekly, amount}', res.wkCfg.type==='weekly'&&res.wkCfg.amount===150, JSON.stringify(res.wkCfg));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();
