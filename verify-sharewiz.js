/* Verify the "Invite to this Nest" sharing wizard: one flow — email → grant Editor access → success screen with the
   app link to send. */
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
  await page.waitForFunction(()=>typeof openShareWiz==='function'&&typeof swGrant==='function'&&typeof joinLink==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(async()=>{
    var sleep=function(ms){return new Promise(function(r){setTimeout(r,ms);});};
    window.sheetId='SHEET1';
    var granted=null;window.api=async function(url,opts){if(/\/permissions/.test(url))granted=JSON.parse(opts.body);return {id:'perm1'};};
    show('appScreen');
    openShareWiz();
    var vis=function(id){return getComputedStyle(document.getElementById(id)).display!=='none';};
    var step1Start=vis('swStep1')&&!vis('swStep2')&&getComputedStyle($("shareWizOv")).display==='flex';
    // invalid email stays on step 1 with an error
    $("swEmail").value='notanemail';swGrant();await sleep(20);
    var invalidStays=/valid email/i.test($("swMsg").textContent)&&!vis('swStep2');
    // valid email → grants Editor access and advances to the success screen with the app link
    $("swEmail").value='fam@example.com';swGrant();await sleep(80);
    var advanced=vis('swStep2')&&!vis('swStep1');
    var grantedWriter=granted&&granted.role==='writer'&&granted.emailAddress==='fam@example.com';
    var doneNames=/fam@example.com/.test($("swDoneTitle").textContent);
    var linkShown=/\?join$/.test(($("swLink").textContent||'').trim());
    var shareThrew=false;try{if(navigator.share)delete navigator.share;swShareLink();}catch(e){shareThrew=true;}
    return {step1Start,invalidStays,advanced,grantedWriter,doneNames,linkShown,shareThrew,link:joinLink()};
  });

  ck('wizard opens on step 1 (email entry)', res.step1Start, String(res.step1Start));
  ck('an invalid email stays on step 1 with an error', res.invalidStays, String(res.invalidStays));
  ck('a valid email grants Editor access (writer) to that person', res.grantedWriter, String(res.grantedWriter));
  ck('it advances to the success screen naming the invitee', res.advanced&&res.doneNames, JSON.stringify({adv:res.advanced,name:res.doneNames}));
  ck('the success screen shows the app join link', res.linkShown&&/\?join$/.test(res.link), JSON.stringify(res.link));
  ck('sharing the link does not error', !res.shareThrew, String(!res.shareThrew));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();
