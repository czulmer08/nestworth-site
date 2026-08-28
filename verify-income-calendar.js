/* Verify weekly/biweekly income math (flat ×52÷12 / ×26÷12 AND the real-payday calendar with 3-paycheck months), plus
   year-rollover behavior (goal math across the year boundary; this-year index excludes prior-year rows). */
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
  await page.waitForFunction(()=>typeof monthsFor==='function'&&typeof paydaysPerMonth==='function'&&typeof buildIndexes==='function'&&typeof monthsUntil==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    window.budYear=0;var Y=curYear();
    // flat annualization
    var wkFlat=monthsFor({type:'weekly',amount:100});      // 100 × 52 ÷ 12
    var bwFlat=monthsFor({type:'biweekly',amount:1000});    // 1000 × 26 ÷ 12
    // real payday calendar (biweekly), anchored Jan 2 of this year
    var anchor=Y+'-01-02';
    var pp=paydaysPerMonth(anchor,14,Y),sumBW=pp.reduce(function(a,b){return a+b;},0),threeChk=pp.filter(function(c){return c>=3;}).length;
    var bwCal=monthsFor({type:'biweekly',amount:1000,calendar:true,payAnchor:anchor});
    var calMatches=bwCal.every(function(v,i){return v===r2(1000*pp[i]);});
    var wp=paydaysPerMonth(anchor,7,Y),sumWK=wp.reduce(function(a,b){return a+b;},0);
    // year rollover: goal target next year
    var muCross=monthsUntil((Y+1)+'-'+String(((curMonth()%12)+1)).padStart(2,'0')); // ~ next year, still positive
    // year rollover: this-year index excludes prior-year rows
    state.meta={cats:{},cons:{},prefs:{},goals:[]};state.goalSet={};
    state.rows=[[Y-1,12,(Y-1)+'-12-15','Me','Food','X',999,'','N'],[Y,1,Y+'-01-15','Me','Food','X',100,'','N'],[Y,8,Y+'-08-15','Me','Food','X',50,'','N']];
    buildIndexes();
    var foodYr=((state.spend&&state.spend['food'])||[]).reduce(function(a,b){return a+b;},0);
    return {wkFlat0:wkFlat[0],bwFlat0:bwFlat[0],sumBW,threeChk,calMatches,notAllEqual:!bwCal.every(function(v){return v===bwCal[0];}),sumWK,muCross,foodYr};
  });

  ck('weekly flat = amount × 52 ÷ 12 ($100 → $433.33/mo)', res.wkFlat0===433.33, JSON.stringify(res.wkFlat0));
  ck('biweekly flat = amount × 26 ÷ 12 ($1000 → $2166.67/mo)', res.bwFlat0===2166.67, JSON.stringify(res.bwFlat0));
  ck('biweekly calendar has ~26 paydays with two 3-paycheck months', res.sumBW>=26&&res.sumBW<=27&&res.threeChk>=2, JSON.stringify({sum:res.sumBW,three:res.threeChk}));
  ck('calendar months = per-check amount × that month\'s paydays (uneven, not flat)', res.calMatches&&res.notAllEqual, JSON.stringify({match:res.calMatches,uneven:res.notAllEqual}));
  ck('weekly calendar has ~52 paydays', res.sumWK>=52&&res.sumWK<=53, JSON.stringify(res.sumWK));
  ck('goal months-until works across the year boundary (positive)', res.muCross>0, JSON.stringify(res.muCross));
  ck('this-year spend index excludes prior-year rows (Dec $999 not counted; $150 this year)', res.foodYr===150, JSON.stringify(res.foodYr));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();
