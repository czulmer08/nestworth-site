/* #5 DECISION-ENGINE CONTINGENCY SURFACING (v0.68.57). When the contingency is currently overspent and this month's surplus hasn't
   fully covered it, the Decision result surfaces the reconciled status (the single-source contingencyReconSentence) and says
   DIRECTIONALLY whether the what-if gives more or less monthly room to rebuild it (sign of the annual-surplus delta ÷12). It adds no
   new accounting. These cases STUB contingencyReconNote() (its own reconciliation math is proven in verify-cash-recon-card /
   verify-cross-surface-recon) so they isolate exactly the #5 logic: the relevance gate, the direction, and the rendered copy. */
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
  await page.waitForFunction(()=>typeof decisionContingencyNote==='function'&&typeof decisionContingencyHTML==='function'&&typeof contingencyReconSentence==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    var near=function(a,bb){return Math.abs((a||0)-(bb||0))<0.02;};
    // A partly-repaired OVERSPENT contingency: raw −$500, this month's surplus covers $200 → $300 still short, effective −$300.
    var OVER={hasBuffer:true,over:true,raw:-500,deficit:500,repair:200,build:0,target:0,surplus:200,effective:-300,availableNow:0,remainingCash:0,available:0,fullyRepairs:false,partlyRepairs:true};
    // A FULLY-repaired contingency (surplus covers the whole shortfall) — should NOT be flagged.
    var FULL={hasBuffer:true,over:true,raw:-500,deficit:500,repair:500,build:0,target:0,surplus:900,effective:0,availableNow:0,remainingCash:400,available:0,fullyRepairs:true,partlyRepairs:false};
    // A healthy (in-the-black) contingency — not over, not building.
    var OK={hasBuffer:true,over:false,raw:800,deficit:0,repair:0,build:0,target:0,surplus:300,effective:800,availableNow:800,remainingCash:100,available:800,fullyRepairs:false,partlyRepairs:false};
    var Rz={};
    var res=function(before,after){return {before:{surplus:before},after:{surplus:after}};};
    // ---- helps: overspent + the what-if adds $1,200/yr = $100/mo ----
    window.contingencyReconNote=function(){return OVER;};
    var n1=decisionContingencyNote(res(1200,2400));
    var h1=decisionContingencyHTML(res(1200,2400));
    Rz.helps={relevant:!!(n1&&n1.relevant),dir:n1&&n1.direction,moDelta:n1&&n1.monthlyDelta,gap:n1&&n1.gap,
      html:h1,hasSentence:/covers \$200\.00 of the \$500\.00 shortfall/.test(h1),head:/Contingency to rebuild/.test(h1),
      freeTxt:/frees about \$100\.00 more each month/.test(h1),gapTxt:/\$300\.00 still short/.test(h1)};
    // ---- hurts: overspent + the what-if removes $600/yr = −$50/mo ----
    var n2=decisionContingencyNote(res(2400,1800));
    var h2=decisionContingencyHTML(res(2400,1800));
    Rz.hurts={dir:n2&&n2.direction,moDelta:n2&&n2.monthlyDelta,leavesTxt:/leaves about \$50\.00 less each month/.test(h2),longer:/would take longer to rebuild/.test(h2)};
    // ---- neutral: no surplus change ----
    var n3=decisionContingencyNote(res(2000,2000));
    var h3=decisionContingencyHTML(res(2000,2000));
    Rz.neutral={dir:n3&&n3.direction,txt:/doesn’t move your monthly room/.test(h3)};
    // ---- fully repaired → NOT surfaced ----
    window.contingencyReconNote=function(){return FULL;};
    Rz.full={note:decisionContingencyNote(res(1000,3000)),html:decisionContingencyHTML(res(1000,3000))};
    // ---- healthy → NOT surfaced ----
    window.contingencyReconNote=function(){return OK;};
    Rz.ok={note:decisionContingencyNote(res(1000,3000)),html:decisionContingencyHTML(res(1000,3000))};
    // ---- no recon note at all (no buffer) → NOT surfaced ----
    window.contingencyReconNote=function(){return null;};
    Rz.none={note:decisionContingencyNote(res(1000,3000)),html:decisionContingencyHTML(res(1000,3000))};
    return Rz;
  });

  ck('overspent + surplus-increasing what-if → surfaced, direction "helps", $100/mo, $300 gap',
     R.helps.relevant&&R.helps.dir==='helps'&&near(R.helps.moDelta,100)&&near(R.helps.gap,300), JSON.stringify({relevant:R.helps.relevant,dir:R.helps.dir,mo:R.helps.moDelta,gap:R.helps.gap}));
  ck('it renders the single-source recon sentence, the "Contingency to rebuild" head, and the "frees $100/mo → $300 still short" line',
     R.helps.hasSentence&&R.helps.head&&R.helps.freeTxt&&R.helps.gapTxt, JSON.stringify({sent:R.helps.hasSentence,head:R.helps.head,free:R.helps.freeTxt,gap:R.helps.gapTxt}));
  ck('a surplus-REDUCING what-if → direction "hurts" (−$50/mo), "leaves $50 less … longer to rebuild"',
     R.hurts.dir==='hurts'&&near(R.hurts.moDelta,-50)&&R.hurts.leavesTxt&&R.hurts.longer, JSON.stringify(R.hurts));
  ck('a what-if that doesn’t change surplus → direction "neutral" ("doesn’t move your monthly room")',
     R.neutral.dir==='neutral'&&R.neutral.txt, JSON.stringify(R.neutral));
  ck('a FULLY-repaired contingency is NOT surfaced (note null, html empty)',
     R.full.note===null&&R.full.html==='', JSON.stringify({note:R.full.note,htmlLen:(R.full.html||'').length}));
  ck('a HEALTHY (in-the-black) contingency is NOT surfaced',
     R.ok.note===null&&R.ok.html==='', JSON.stringify({note:R.ok.note,htmlLen:(R.ok.html||'').length}));
  ck('no reconciliation note (no buffer) → NOT surfaced (safe null-guard)',
     R.none.note===null&&R.none.html==='', JSON.stringify({note:R.none.note,htmlLen:(R.none.html||'').length}));

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: the Decision result surfaces an overspent contingency and says, directionally, whether the what-if helps rebuild it — one source, no new math.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();
