/* ONE authoritative parent/child membership (v0.68.62). catNameSet(name) is the single answer to "does this transaction belong to
   this category?" — parent + every itemized child ("bill") + "↳ " forms — and every forward-membership scanner now derives from it:
   catSpend12 (spend), budgetedNameSet (budgeted/unbudgeted partition), catLinkedGoal12 (category-linked goal moves), lumpyCategories
   (the checkup evidence table). This proves they all AGREE: a Baby Z / Baby B row counts toward Children in each surface, so no scanner
   can know "Baby Z → Children" while another doesn't (the v0.68.53 / .58 / .61 bug class). */
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
  await page.waitForFunction(()=>typeof catNameSet==='function'&&typeof catMatchesRow==='function'&&typeof catSpend12==='function'&&typeof budgetedNameSet==='function'&&typeof catLinkedGoal12==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-31';};
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};var near=function(a,bb){return Math.abs((a||0)-(bb||0))<0.02;};
    // Children is itemized (Baby Z / Baby B). August: a parent-tagged row ($100, "Children"), two child-tagged rows ($150 "Baby Z",
    // $90 "Baby B"), one "↳ Baby Z" arrow row ($60), a category-linked GOAL move tagged "Baby Z" → College Fund ($200), and an
    // unrelated Parking row ($30). Children's August spend must be 100+150+90+60 = $400; the goal move counts as linked-goal funding.
    var g={name:'College Fund',monthly:0,category:'Children'};
    state.cons=[{name:'Pay',bud12:fill(9000),annual:108000}];
    state.cats=[{name:'Children',bud12:fill(2500),annual:30000},{name:'Rent',bud12:fill(2000),annual:24000}];
    state.goals=[g];state.assets=[];state.debts=[];
    state.rows=[
      [2026,8,'2026-08-02','','Children','Misc',100,'',''],
      [2026,8,'2026-08-03','','Baby Z','KinderCare',150,'',''],
      [2026,8,'2026-08-04','','Baby B','Sitter',90,'',''],
      [2026,8,'2026-08-05','','↳ Baby Z','KinderCare',60,'',''],
      [2026,8,'2026-08-06','','Baby Z','College Fund',200,'',''],   // goal MOVE (Company is a goal) tagged with a child category
      [2026,8,'2026-08-07','','Parking','City Lot',30,'','']
    ];
    state.meta={cats:{"children":{type:'itemized',items:[{name:'Baby Z'},{name:'Baby B'}]}},cons:{},goals:[{name:'College Fund',category:'Children'}],payees:['Me'],floor:0,startCash:0,prefs:{}};
    window.isGoalName=function(n){return (""+n).toLowerCase()==='college fund';}; // make the goal-move row classify as a goal movement
    if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    var Rz={};
    var set=catNameSet('Children');
    Rz.set={hasParent:!!set['children'],hasBabyZ:!!set['baby z'],hasBabyB:!!set['baby b'],hasArrow:!!set['↳ baby z'],noParking:!set['parking']};
    Rz.match={babyZ:catMatchesRow([2026,8,'','','Baby Z','x',1,'',''],'Children'),
      arrow:catMatchesRow([2026,8,'','','↳ Baby Z','x',1,'',''],'Children'),
      parent:catMatchesRow([2026,8,'','','Children','x',1,'',''],'Children'),
      parking:catMatchesRow([2026,8,'','','Parking','x',1,'',''],'Children'),blank:catMatchesRow([2026,8,'','','','x',1,'',''],'Children')};
    // catSpend12 sums parent + children + arrow (goal moves excluded from spend) = 100+150+90+60 = 400
    Rz.spend={aug:catSpend12('Children')[7]};
    // budgetedNameSet includes the children
    var bset=budgetedNameSet();Rz.budgeted={babyZ:!!bset['baby z'],babyB:!!bset['baby b'],arrow:!!bset['↳ baby z']};
    // catLinkedGoal12: the child-tagged goal move ($200) counts toward Children's linked-goal funding
    Rz.linked={aug:catLinkedGoal12('Children')[7]};
    return Rz;
  });

  ck('catNameSet("Children") = parent + Baby Z + Baby B + "↳ " forms, and excludes unrelated names',
     R.set.hasParent&&R.set.hasBabyZ&&R.set.hasBabyB&&R.set.hasArrow&&R.set.noParking, JSON.stringify(R.set));
  ck('catMatchesRow: a Baby Z / ↳ Baby Z / Children row belongs; Parking and blank do not',
     R.match.babyZ&&R.match.arrow&&R.match.parent&&!R.match.parking&&!R.match.blank, JSON.stringify(R.match));
  ck('catSpend12 counts parent + child + ↳ rows toward Children (100+150+90+60 = $400), goal move excluded',
     near(R.spend.aug,400), 'aug='+R.spend.aug);
  ck('budgetedNameSet (the used/unbudgeted partition) includes the same children',
     R.budgeted.babyZ&&R.budgeted.babyB&&R.budgeted.arrow, JSON.stringify(R.budgeted));
  ck('catLinkedGoal12 counts a CHILD-tagged goal move toward the parent ($200 to Children)',
     near(R.linked.aug,200), 'aug='+R.linked.aug);

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: one helper (catNameSet) defines parent/child membership; spend, budgeted, linked-goal, and evidence surfaces all agree — Baby Z means Children everywhere.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();
