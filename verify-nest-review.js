/* Verify the Monthly Nest Review: a deterministic recap of the last completed month (spending vs plan, net-worth change
   with attribution, goal progress, income, and a forward cash heads-up), plus the "Why?" progressive-explanation chain. */
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
  await page.waitForFunction(()=>typeof buildNestReview==='function'&&typeof nestReviewCards==='function'&&typeof openNestReview==='function'&&document.getElementById('revOv'),{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    var Y=curYear(),M=curMonth(),mi=M-2; // last completed month index (0-based); test host date has M>=2
    if(mi<0)return {skip:true};
    window.isGoalName=(n)=>((""+n).toLowerCase()==='vacation');
    state.goalSet={vacation:1};
    state.meta={startCash:12000,floor:5000,cats:{},cons:{},goals:[]};
    var z=()=>Array(12).fill(0);
    state.cats=[{name:'Dining',bud12:z().map((_,i)=>i===mi?300:300),annual:3600},{name:'Groceries',bud12:z().map((_,i)=>i===mi?400:400),annual:4800}];
    state.cons=[{name:'Job',bud12:z().map(()=>5000),annual:60000}];
    state.goals=[{name:'Vacation',target:6000,balance:2500,monthly:500,targetDate:'',archived:false,category:'',residual:false}];
    var reviewYm=Y*100+(mi+1),prevYm=(mi===0)?((Y-1)*100+12):(Y*100+mi);
    state.nwHist=[{ym:prevYm,net:100000,assets:105000,debts:5000},{ym:reviewYm,net:103000,assets:107000,debts:4000}];
    // a real ledger for the review month (mi+1): income $5,200; Dining $480 (over $300); Groceries $200 (under $400); $500 to Vacation goal
    var rm=mi+1,dt=Y+'-0'+rm+'-';
    state.rows=[[Y,rm,dt+'01','Me','Deposit','Job',5200,'','N'],[Y,rm,dt+'02','Me','Dining','X',480,'','N'],[Y,rm,dt+'03','Me','Groceries','X',200,'','N'],[Y,rm,dt+'04','Me','Vacation','Move',500,'','N']];
    try{buildIndexes();}catch(e){}

    var rv=buildNestReview();
    var spendOk=rv&&Math.abs(rv.spending.actual-680)<0.5&&Math.abs(rv.spending.plan-700)<0.5&&Math.abs(rv.spending.diff-(-20))<0.5;
    var overTop=rv&&rv.spending.over.length&&rv.spending.over[0].name==='Dining'&&Math.abs(rv.spending.over[0].diff-180)<0.5;
    var underTop=rv&&rv.spending.under.length&&rv.spending.under[0].name==='Groceries'&&Math.abs(rv.spending.under[0].diff-(-200))<0.5;
    var netOk=rv&&rv.net&&Math.abs(rv.net.change-3000)<0.5&&Math.abs(rv.net.dAssets-2000)<0.5&&Math.abs(rv.net.dDebts-(-1000))<0.5;
    var goalOk=rv&&rv.goals.length&&rv.goals[0].name==='Vacation'&&Math.abs(rv.goals[0].added-500)<0.5;
    var incOk=rv&&Math.abs(rv.income.actual-5200)<0.5&&Math.abs(rv.income.plan-5000)<0.5;

    var cards=nestReviewCards(rv);
    var hasNW=cards.some(c=>/net worth grew \$3,000/i.test(c.head));
    var nwWhy=cards.filter(c=>/net worth grew/i.test(c.head))[0];
    var attribution=nwWhy&&nwWhy.why.some(w=>/Assets rose \$2,000/.test(w))&&nwWhy.why.some(w=>/paid down \$1,000/i.test(w));
    var spendCard=cards.filter(c=>/You spent/.test(c.head))[0];
    var spendWhy=spendCard&&spendCard.why.some(w=>/Dining.*\$180\.00 over/.test(w));
    var cashCard=cards.some(c=>/Looking ahead/.test(c.head));

    // UI: opening the review renders cards with working Why? toggles
    show('appScreen');openNestReview();
    var body=$("revBody"),nCards=body.querySelectorAll('.rev-card').length,whyBtns=body.querySelectorAll('.rev-why').length;
    var firstDetail=body.querySelector('.rev-detail'),wasHidden=getComputedStyle(firstDetail).display==='none';
    body.querySelector('.rev-why').click();
    var nowShown=getComputedStyle(firstDetail).display!=='none';
    var titleOk=/in review/.test($("revTitle").textContent);

    // Wren intent routes "monthly review" to the review action
    var intent=wrenMatch("monthly review");
    var wrenOk=!!(intent&&intent.review===true);

    return {spendOk,overTop,underTop,netOk,goalOk,incOk,hasNW,attribution,spendWhy,cashCard,nCards,whyBtns,wasHidden,nowShown,titleOk,wrenOk};
  });

  if(res.skip){console.log('  SKIP (host month is January — no completed month in the live year)');await b.close();server.close();process.exit(0);}
  ck('spending totals: $680 spent vs $700 plan → $20 under', res.spendOk, String(res.spendOk));
  ck('top over-plan category is Dining (+$180)', res.overTop, String(res.overTop));
  ck('top under-plan category is Groceries (−$200)', res.underTop, String(res.underTop));
  ck('net-worth change +$3,000 = +$2,000 assets and $1,000 debt paid down', res.netOk, String(res.netOk));
  ck('goal progress: $500 moved toward Vacation', res.goalOk, String(res.goalOk));
  ck('income: $5,200 actual vs $5,000 plan', res.incOk, String(res.incOk));
  ck('a net-worth headline card is produced', res.hasNW, String(res.hasNW));
  ck('the "Why?" chain attributes it to assets up and debt down', res.attribution, String(res.attribution));
  ck('the spending "Why?" names Dining as $180 over', res.spendWhy, String(res.spendWhy));
  ck('a forward cash heads-up card is included', res.cashCard, String(res.cashCard));
  ck('opening the review renders cards ('+res.nCards+') each with a Why? toggle', res.nCards>=4&&res.whyBtns>=4, JSON.stringify({nCards:res.nCards,whyBtns:res.whyBtns}));
  ck('a Why? toggle reveals the hidden detail', res.wasHidden&&res.nowShown, JSON.stringify({wasHidden:res.wasHidden,nowShown:res.nowShown}));
  ck('the overlay title reads "… in review"', res.titleOk, String(res.titleOk));
  ck('Wren routes "monthly review" to the review action', res.wrenOk, String(res.wrenOk));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();
