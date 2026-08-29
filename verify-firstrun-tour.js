/* FIRST-RUN TOUR TIMING (unfamiliar-user walkthrough finding). The auto-tour must NOT launch over a brand-new person who is
   still deciding at the first-run card (Set up / Import / Just log expenses), nor over an open setup/import overlay. It should
   wait until they've chosen a path and landed on a clear screen, then start — and give up quietly if they stay busy, rather
   than interrupt. Uses a controllable fake timer to drive maybeStartTour's deferred retries deterministically. */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');const src=fs.readFileSync(APP,'utf8');
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(src);return;}r.writeHead(200,{'Content-Type':'text/plain'});r.end("");});
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof maybeStartTour==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const R=await page.evaluate(()=>{
    // controllable fake timer: maybeStartTour's setTimeout callbacks queue here; we flush them one step at a time
    var Q=[];window.setTimeout=function(fn){Q.push(fn);return Q.length;};
    function flush(n){n=n||1;var ran=0;for(var i=0;i<n&&Q.length;i++){var f=Q.shift();ran++;f();}return ran;}
    var started=0,startedView=null;
    window.startTour=function(){started++;};window.switchView=function(v){startedView=v;};
    try{localStorage.removeItem("nw_tour_seen");}catch(e){}
    $("appScreen").classList.add("on");
    var fr=$("firstRunCard");
    var Rz={};

    // Scenario A — first-run card visible: the tour must NOT start while it stays up (and must give up, not loop forever)
    fr.style.display="block";started=0;Q=[];
    maybeStartTour();
    var flushedWhileCard=flush(60); // more than the retry cap
    Rz.cardVisible={started:started,keptChecking:flushedWhileCard>1,gaveUp:Q.length===0};

    // Scenario B — resume: while it's deferring, the user picks a path → card hides → the tour then starts (on Add)
    fr.style.display="block";started=0;startedView=null;Q=[];
    maybeStartTour();flush(1); // one deferred check while the card is up
    var duringCard=started;
    fr.style.display="none";     // user chose a path; card goes away
    flush(1);                    // next scheduled check
    Rz.resume={duringCard:duringCard,afterChoice:started,view:startedView};

    // Scenario C — an open overlay (setup/import wizard) also defers the tour
    fr.style.display="none";started=0;Q=[];
    var ov=document.querySelector(".ov");var prev=ov?ov.style.display:null;if(ov)ov.style.display="flex";
    maybeStartTour();flush(3);
    Rz.overlay={started:started};
    if(ov)ov.style.display=(prev||"none");

    // Scenario D — clear screen (no card, no overlay): the tour starts promptly, on the Add tab
    fr.style.display="none";started=0;startedView=null;Q=[];
    document.querySelectorAll(".ov").forEach(function(o){o.style.display="none";});
    maybeStartTour();flush(1);
    Rz.clear={started:started,view:startedView};

    // Scenario E — already seen: never auto-starts again
    try{localStorage.setItem("nw_tour_seen","1");}catch(e){}started=0;Q=[];
    maybeStartTour();flush(3);
    Rz.seen={started:started,scheduled:Q.length};
    try{localStorage.removeItem("nw_tour_seen");}catch(e){}
    return Rz;
  });

  ck('first-run card up → tour does NOT take over, and it stops retrying (no infinite loop)', R.cardVisible.started===0&&R.cardVisible.keptChecking&&R.cardVisible.gaveUp, JSON.stringify(R.cardVisible));
  ck('once the user chooses a path (card hides), the deferred tour THEN starts — on the Add tab', R.resume.duringCard===0&&R.resume.afterChoice===1&&R.resume.view==='add', JSON.stringify(R.resume));
  ck('an open setup/import overlay also defers the tour', R.overlay.started===0, JSON.stringify(R.overlay));
  ck('on a clear screen (no card, no overlay) the tour starts promptly on Add', R.clear.started===1&&R.clear.view==='add', JSON.stringify(R.clear));
  ck('once the tour has been seen, it never auto-starts again', R.seen.started===0&&R.seen.scheduled===0, JSON.stringify(R.seen));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();
