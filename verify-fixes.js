/* Targeted verification of the three UI fixes (Build 2026.08.26.7):
 *  1) fmtAmtBlur no longer prepends "$" (kills the double-dollar).
 *  2) buildMGrid custom-month cells now carry a "$".
 *  3) "Pull in a category" adds existing categories into the itemized BILLS list.
 */
const {chromium}=require('playwright');
const http=require('http');
const fs=require('fs');
const path=require('path');
const APP=path.join(__dirname,'app.html');

const server=http.createServer((req,res)=>{
  if(req.url.startsWith("/app.html")){res.writeHead(200,{'Content-Type':'text/html'});res.end(fs.readFileSync(APP,'utf8'));return;}
  res.writeHead(200,{'Content-Type':'text/plain'});res.end("");
});

(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errs=[]; page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{
    window.google={accounts:{oauth2:{initTokenClient:function(cfg){return {requestAccessToken:function(){}};},revoke:function(t,cb){cb&&cb();}},id:{disableAutoSelect:function(){}}},picker:{}};
    window.gapi={load:function(_,o){(o&&o.callback)&&o.callback();}};
  });
  await page.route('**/*',async route=>{
    const url=route.request().url();
    if(url.includes('127.0.0.1')||url.includes('localhost'))return route.continue();
    if(url.includes('googleapis.com')||url.includes('google.com'))return route.fulfill({status:200,contentType:'application/json',body:'{}'});
    const ct=url.endsWith('.css')?'text/css':'application/javascript';
    return route.fulfill({status:200,contentType:ct,body:''});
  });
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof fmtAmtBlur==='function'&&typeof buildMGrid==='function'&&typeof openPullCats==='function',{timeout:8000});

  const out=[];
  function check(name,ok,detail){out.push({name,ok,detail:detail||''});}

  // 1) fmtAmtBlur — no leading "$"
  const r1=await page.evaluate(()=>{
    function t(v){var i=document.createElement('input');i.value=v;fmtAmtBlur(i);return i.value;}
    return {a:t('2400'),b:t('1500.5'),c:t('-30'),d:t('')};
  });
  check('fmtAmtBlur adds commas + 2dp, NO $',
    r1.a==='2,400.00'&&r1.b==='1,500.50'&&r1.c==='-30.00'&&r1.d==='',
    JSON.stringify(r1));

  // 1b) real cAmt field: static "$" + formatted value = single "$"
  const r1b=await page.evaluate(()=>{
    var el=document.getElementById('cAmt');el.value='2400';fmtAmtBlur(el);
    var rowText=document.getElementById('cAmtRow').textContent.replace(/\s+/g,' ').trim();
    return {val:el.value,dollars:(rowText.match(/\$/g)||[]).length};
  });
  check('cAmt row shows a single $ (no $$)', r1b.val==='2,400.00'&&r1b.dollars===1, JSON.stringify(r1b));

  // 2) buildMGrid custom-month cells carry a $
  const r2=await page.evaluate(()=>{
    buildMGrid('cGrid','cm');
    var g=document.getElementById('cGrid');
    return {moin:g.querySelectorAll('.moin').length, inputs:g.querySelectorAll('.moin input').length, dollars:(g.textContent.match(/\$/g)||[]).length, firstId:g.querySelector('.moin input')?g.querySelector('.moin input').id:null};
  });
  check('custom month grid: 12 cells each with $', r2.moin===12&&r2.inputs===12&&r2.dollars===12&&r2.firstId==='cm0', JSON.stringify(r2));

  // 3) Pull-in-categories from state.cats into BILLS
  const r3=await page.evaluate(()=>{
    window.state=window.state||{};
    state.cats=[{name:'Gas',mbud:200,annual:2400},{name:'Hair',mbud:73.56,annual:882.72},{name:'Water',mbud:40,annual:480}];
    window.catWizIdx=-1; window.catEdit='Water'; // editing Water -> excluded from the picker
    window.BILLS=[{name:'',amount:'',cadence:'Monthly',month:1,day:'',months:[]}];
    openPullCats();
    var list=document.getElementById('pullList');
    var html=list.innerHTML;
    var cbs=list.querySelectorAll('.pull-cb');
    var names=Array.prototype.map.call(cbs,cb=>cb.getAttribute('data-n'));
    var gas=null; cbs.forEach(cb=>{if(cb.getAttribute('data-n')==='Gas')gas=cb;});
    gas.checked=true;
    pullAddSelected();
    var overlayClosed=document.getElementById('pullOv').style.display==='none';
    return {names:names, doubleDollar:/\$\$/.test(html), moneyMatches:(html.match(/\$[\d.,]+\/mo/g)||[]), bills:BILLS.map(b=>({n:b.name,a:b.amount,c:b.cadence})), overlayClosed:overlayClosed};
  });
  check('picker lists other cats (Water excluded)', r3.names.length===2&&r3.names.indexOf('Gas')>=0&&r3.names.indexOf('Water')<0, JSON.stringify(r3.names));
  check('picker money has no $$ and shows /mo', !r3.doubleDollar&&r3.moneyMatches.length===2, JSON.stringify({dd:r3.doubleDollar,m:r3.moneyMatches}));
  check('pulling Gas replaces blank first bill -> Gas @200 monthly', r3.bills.length===1&&r3.bills[0].n==='Gas'&&r3.bills[0].a===200&&r3.bills[0].c==='Monthly'&&r3.overlayClosed, JSON.stringify(r3.bills));

  let pass=0,fail=0;
  out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.name+(r.detail?('  ['+r.detail+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await browser.close();server.close();
  process.exit(fail?1:0);
})();
