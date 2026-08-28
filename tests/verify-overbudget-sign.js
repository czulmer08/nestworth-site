/* Verify the month-detail category diff: OVER budget shows a negative (red), UNDER shows positive (green). */
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
  await page.waitForFunction(()=>typeof renderMonthDetail==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const html=await page.evaluate(()=>{
    window.curYear=function(){return 2026;};window.curMonth=function(){return 8;};window.isGoalName=function(){return false;};
    var jun=5; // index for June
    var b=function(v){var a=[0,0,0,0,0,0,0,0,0,0,0,0];a[jun]=v;return a;};
    state={
      cats:[{name:'Food/Outings',bud12:b(1400)},{name:'Subscriptions',bud12:b(132.83)}],
      cons:[],
      rows:[
        [2026,6,'2026-06-10','Me','Food/Outings','Diner',2755.21,'',''],  // OVER budget
        [2026,6,'2026-06-12','Me','Subscriptions','Netflix',37.98,'','']  // UNDER budget
      ]
    };
    return renderMonthDetail(6,2026);
  });

  // Food/Outings over by 1355.21 -> should show "−$1,355.21" in a neg span
  var foodOverNeg = /Food\/Outings[\s\S]*?class="neg">\(−\$1,355\.21\)/.test(html);
  // Subscriptions under by 94.85 -> "+$94.85" in a pos span
  var subsUnderPos = /Subscriptions[\s\S]*?class="pos">\(\+\$94\.85\)/.test(html);
  // make sure over is NOT shown as a positive
  var noPlusOnOver = !/Food\/Outings[\s\S]*?\(\+\$1,355/.test(html);

  ck('OVER budget shows a NEGATIVE (red) diff', foodOverNeg, foodOverNeg?'':html.slice(html.indexOf('Food/Outings'),html.indexOf('Food/Outings')+160));
  ck('UNDER budget shows a POSITIVE (green) diff', subsUnderPos, subsUnderPos?'':html.slice(html.indexOf('Subscriptions'),html.indexOf('Subscriptions')+160));
  ck('OVER budget is not shown with a + sign', noPlusOnOver, '');

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();
