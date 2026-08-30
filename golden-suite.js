#!/usr/bin/env node
'use strict';
// NestWorth Golden Financial Model Test Suite
// Usage: node nestworth-golden-financial-tests.js "app 2.html"
// Tests deterministic financial invariants against the functions extracted from the actual app source.
const fs=require('fs'), vm=require('vm');
const path=process.argv[2] || 'app.html';
const src=fs.readFileSync(path,'utf8');
function extractFunction(name){
  const needle='function '+name+'(';
  const start=src.indexOf(needle); if(start<0) throw new Error('Missing function: '+name);
  const brace=src.indexOf('{',start); let depth=0, quote=null, esc=false, line=false, block=false;
  for(let i=brace;i<src.length;i++){
    const c=src[i],n=src[i+1];
    if(line){if(c==='\n')line=false;continue;} if(block){if(c==='*'&&n==='/'){block=false;i++;}continue;}
    if(quote){if(esc){esc=false;continue;} if(c==='\\'){esc=true;continue;} if(c===quote)quote=null;continue;}
    if(c==='/'&&n==='/'){line=true;i++;continue;} if(c==='/'&&n==='*'){block=true;i++;continue;}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
    if(c==='{')depth++; else if(c==='}'){depth--; if(depth===0)return src.slice(start,i+1);}
  }
  throw new Error('Unclosed function: '+name);
}
const fnNames=[
  'r2','_spread','_all12','paydaysPerMonth','monthsFor','detectCadence','billMonths','billAnnual',
  'isGoalName','isDepositRow','isGoalMovementRow','isExpenseRow','actualIE','monthActualTotals','goalContribMonth',
  'fixedGoalMonthly','nestFloor','currentPlan','clonePlan','_cfArrays','_cfCatExp','_cfFutureOut','computeCashflow','computeAnnualPlan',
  'netWorthNow','computeNetWorthTrajectory','planMetrics','goalCompletion','_scenBud12','_applyChange','evaluateDecision',
  'computeResidual','monthsUntil','goalFundMonths','yearEndSpendProjection'
];
const ctx={console,Date,Math,JSON,Number,String,Array,Object,Infinity,NaN,isFinite,parseFloat,parseInt,
  MONTHS:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  state:{rows:[],cats:[],cons:[],assets:[],debts:[],goals:[],goalSet:{},meta:{}},
  __year:2026,__month:8
};
vm.createContext(ctx);
vm.runInContext('function curYear(){return __year} function curMonth(){return __month} function bYear(){return __year} function catSpend12(){return Array(12).fill(0)} function residualPool(){return 0}',ctx);
for(const n of fnNames){ vm.runInContext(extractFunction(n),ctx,{filename:n+'.js'}); }
let pass=0,fail=0,failures=[];
function near(a,b,t=0.005){return Math.abs(Number(a)-Number(b))<=t;}
function eq(name,a,b){if((typeof b==='number'?near(a,b):a===b)){pass++;}else{fail++;failures.push({name,actual:a,expected:b});}}
function ok(name,v,detail){if(v)pass++;else{fail++;failures.push({name,actual:detail||v,expected:true});}}
function reset(){ctx.state={rows:[],cats:[],cons:[],assets:[],debts:[],goals:[],goalSet:{},meta:{}};ctx.__year=2026;ctx.__month=8;}
function row(y,m,date,payee,cat,company,amt,note='',reimb=''){return [y,m,date,payee,cat,company,amt,note,reimb];}
function arr(v){return Array(12).fill(v);}
function plan({inc=0,exp=0,start=0,goals=[],rows=[]}={}){ctx.state.goals=goals;ctx.state.goalSet={};goals.forEach(g=>ctx.state.goalSet[g.name.toLowerCase()]=1);return {cons:[{name:'Income',bud12:arr(inc)}],cats:[{name:'Living',bud12:arr(exp)}],rows,goals,startCash:start,goalMonthlyFixed:ctx.fixedGoalMonthly(goals),oneTime:null};}

// Exact-cent allocation and budget shapes
reset(); let x=ctx._spread(100,[0,1,2]); eq('spread exact total',x.reduce((a,b)=>a+b,0),100); eq('spread 100/3 last remainder',x[2],33.34);
x=ctx.monthsFor({type:'monthly',amount:123.45}); eq('monthly annual total',x.reduce((a,b)=>a+b,0),1481.40);
x=ctx.monthsFor({type:'split',amount:100,cover:[true,true,true,false,false,false,false,false,false,false,false,false]}); eq('split exact total',x.reduce((a,b)=>a+b,0),100);
x=ctx.monthsFor({type:'onetime',amount:100,month:3,saveup:true,start:1}); eq('saveup exact total',x.reduce((a,b)=>a+b,0),100); eq('saveup remainder in final month',x[2],33.34);
x=ctx.monthsFor({type:'annual',amount:1200,month:6}); eq('annual correct month',x[5],1200); eq('annual only once',x.reduce((a,b)=>a+b,0),1200);
x=ctx.monthsFor({type:'weekly',amount:100}); eq('weekly annualization',x.reduce((a,b)=>a+b,0),5200);
x=ctx.monthsFor({type:'biweekly',amount:100}); eq('biweekly annualization',x.reduce((a,b)=>a+b,0),2600);
x=ctx.monthsFor({type:'paycheck',amount:2000,freq:26,pct:80}); eq('paycheck percent annual',x.reduce((a,b)=>a+b,0),41600);
x=ctx.monthsFor({type:'paycheck',amount:2000,freq:26,mode:'keep',keep:500}); eq('paycheck setaside annual',x.reduce((a,b)=>a+b,0),46000);
let pc=ctx.paydaysPerMonth('2026-01-02',14,2026); eq('biweekly calendar has 26 checks',pc.reduce((a,b)=>a+b,0),26); ok('biweekly calendar has 3-check months',pc.filter(v=>v===3).length>=2,pc);
pc=ctx.paydaysPerMonth('2026-01-02',7,2026); eq('weekly calendar has 52 checks',pc.reduce((a,b)=>a+b,0),52);
let bm=ctx.billMonths([{name:'Insurance',amount:1200,cadence:'AnnualSaveUp',start:8,month:12}]); eq('midyear annual saveup total',bm.reduce((a,b)=>a+b,0),1200); eq('midyear annual saveup Aug',bm[7],240); eq('midyear annual saveup Dec',bm[11],240);
let dc=ctx.detectCadence(ctx._spread(100,[0,1,2])); eq('cadence preserves exact-cent saveup',dc.cadence,'AnnualSaveUp'); eq('cadence inferred total',dc.amount,100);

// Canonical row classification
reset();ctx.state.goalSet={'vacation':1};
let rExp=row(2026,8,'2026-08-01','','Food','Store',50), rDep=row(2026,8,'2026-08-01','Pay','Deposit','',2000), rGoalE=row(2026,8,'2026-08-01','','Vacation','',500), rGoalF=row(2026,8,'2026-08-01','','Travel','Vacation',500), rRefund=row(2026,8,'2026-08-01','','Food','Store',-20);
ok('expense classification',ctx.isExpenseRow(rExp)); ok('deposit excluded from expense',!ctx.isExpenseRow(rDep)); ok('goal category excluded',ctx.isGoalMovementRow(rGoalE)); ok('goal company excluded',ctx.isGoalMovementRow(rGoalF));
ctx.state.rows=[rExp,rDep,rGoalE,rGoalF,rRefund]; let mt=ctx.monthActualTotals(2026,8); eq('monthly income',mt.income,2000); eq('monthly net expense with refund',mt.expense,30); eq('goal company contribution found',ctx.goalContribMonth('Vacation',2026,8),1000);
let ie=ctx.actualIE(ctx.state.rows,2026); eq('actualIE ordinary expense',ie.ae[7],30); eq('actualIE goal movement',ie.ag[7],1000); eq('actualIE income',ie.ai[7],2000);

// Cashflow fixed-goal actual behavior
reset(); let goals=[{name:'Emergency',monthly:500,balance:0,target:0,category:'',residual:false,archived:false}];
let rows=[row(2026,1,'2026-01-05','Pay','Deposit','',2000),row(2026,1,'2026-01-06','','Living','Store',500),row(2026,1,'2026-01-07','','Emergency','Emergency',1000)];
let p=plan({inc:2000,exp:500,goals,rows}); let cf=ctx.computeCashflow(p,{mode:'actual'}); eq('completed month uses actual goal funding',cf.months[0].net,500);
rows=[row(2026,1,'2026-01-05','Pay','Deposit','',2000),row(2026,1,'2026-01-06','','Living','Store',500)]; p=plan({inc:2000,exp:500,goals,rows}); cf=ctx.computeCashflow(p,{mode:'actual'}); eq('completed skipped goal leaves more actual cash',cf.months[0].net,1500);

// Current-month linked goal: expected one budget allocation, not category plan + goal transfer twice.
reset(); goals=[{name:'Vacation',monthly:500,balance:500,target:5000,category:'Living',residual:false,archived:false}];
rows=[row(2026,8,'2026-08-05','Pay','Deposit','',2000),row(2026,8,'2026-08-06','','Living','Vacation',500)]; p=plan({inc:2000,exp:500,goals,rows}); cf=ctx.computeCashflow(p,{mode:'actual'}); eq('CURRENT linked goal is not double-counted',cf.months[7].net,1500);
// Completed linked goal should also consume cash once.
ctx.__month=9; cf=ctx.computeCashflow(p,{mode:'actual'}); eq('COMPLETED linked goal consumes cash once',cf.months[7].net,1500); ctx.__month=8;

// Annual Plan+Actual should preserve category-linked saving that consumes its category allocation.
reset(); goals=[{name:'Vacation',monthly:500,balance:1000,target:5000,category:'Living',residual:false,archived:false}];
rows=[row(2026,1,'2026-01-05','Pay','Deposit','',2000),row(2026,1,'2026-01-06','','Living','Vacation',500),row(2026,2,'2026-02-05','Pay','Deposit','',2000),row(2026,2,'2026-02-06','','Living','Vacation',500)];
ctx.__month=3;p=plan({inc:2000,exp:500,goals,rows}); let ap=ctx.computeAnnualPlan(p,{mode:'actual'}); eq('annual P+A keeps completed linked-goal allocation',ap.surplus,18000); ctx.__month=8;

// Net worth identity + projection current-month remainder
reset();ctx.state.assets=[{name:'Cash',bal:10000}];ctx.state.debts=[{name:'Loan',bal:3000}];ctx.state.goals=[{name:'Standalone',balance:1000,account:'',archived:false},{name:'Linked',balance:2000,account:'Cash',archived:false}]; eq('net worth anti-double-count linked goal',ctx.netWorthNow(),8000);
ctx.state.goalSet={}; p={cons:[{bud12:arr(2000)}],cats:[{bud12:arr(1000)}],rows:[row(2026,8,'2026-08-01','Pay','Deposit','',1500),row(2026,8,'2026-08-02','','Living','Store',700)],goals:[],startCash:0,goalMonthlyFixed:0,oneTime:null};
let nw=ctx.computeNetWorthTrajectory(p); eq('NW current month adds only remaining activity',nw.end-nw.now,4200); // current remainder 500 income - 300 expense + Sep-Dec 4*1000

// Goal timing
reset();ctx.__month=8; eq('goal Aug->Nov has 4 funding periods',ctx.goalFundMonths('2026-11'),4); eq('goal current month has 1 period',ctx.goalFundMonths('2026-08'),1); eq('overdue goal signals no future funding periods',ctx.goalFundMonths('2026-06'),0);

// Decision semantics
reset();ctx.state.assets=[];ctx.state.debts=[];ctx.state.meta={floor:0};ctx.state.goals=[];ctx.state.goalSet={};ctx.state.cons=[{name:'Income',bud12:arr(5000)}];ctx.state.cats=[{name:'Living',bud12:arr(3000)}];ctx.state.rows=[];
let res=ctx.evaluateDecision({type:'expenseMonthly',amount:700}); eq('ongoing payment steady-state annual impact',res.after.surplus-res.before.surplus,-8400);
res=ctx.evaluateDecision({type:'income',amount:500}); eq('ongoing income steady-state annual impact',res.after.surplus-res.before.surplus,6000);
// Scoped Sep-Dec should be 4 months.
res=ctx.evaluateDecision({type:'expenseMonthly',amount:700,months:[9,10,11,12]}); eq('Sep-Dec payment current-year impact',res.after.surplus-res.before.surplus,-2800);
// Linked goal monthly change should not become extra fixed commitment.
ctx.state.goals=[{name:'Vacation',monthly:500,balance:1000,target:5000,category:'Living',residual:false,archived:false}];ctx.state.goalSet={vacation:1};
res=ctx.evaluateDecision({type:'goalMonthly',goal:'Vacation',monthly:800}); eq('linked goal change not extra fixed annual outflow',res.after.surplus-res.before.surplus,0);
// Goal-funded purchase split.
ctx.state.goals=[{name:'Vacation',monthly:0,balance:3000,target:6000,category:'',residual:false,archived:false}];ctx.state.goalSet={vacation:1};ctx.state.assets=[];ctx.state.debts=[];
res=ctx.evaluateDecision({type:'purchase',amount:6000,month:8,from:'goal:Vacation'}); eq('goal purchase uses 3000 from goal',res.goal.fromGoal,3000); eq('goal purchase 3000 cash shortfall',res.goal.shortfall,3000); eq('goal purchase total NW reduction',res.after.netEnd-res.before.netEnd,-6000);

// Projection model sanity
reset();ctx.state.goalSet={};ctx.state.rows=[row(2026,8,'2026-08-01','','Food','Store',1000)];let yp=ctx.yearEndSpendProjection();eq('one active Aug month YTD',yp.ytd,1000);eq('one active Aug month projection',yp.proj,5000);

// Static source invariants: these intentionally detect architectural/security regressions.
function contains(re){return re.test(src)}
ok('source uses drive.file scope',contains(/var\s+SCOPE\s*=\s*["']https:\/\/www\.googleapis\.com\/auth\/drive\.file["']/));
ok('source labels nonce append non-atomic',contains(/NOT a true\s*\n?\s*\/\/\s*atomic reservation|NOT\s+truly\s+atomic/i));
ok('source has canonical company-or-category goal classifier',contains(/function\s+isGoalMovementRow[\s\S]{0,200}isGoalName\(\(r&&r\[5\]\)/));
ok('source live cashflow calls shared engine',contains(/function\s+renderStress[\s\S]{0,1500}computeCashflow\(/));
ok('source Wren year forecast calls shared projection',contains(/yearEndSpendProjection\(\)/));
// Security invariant: a raw spreadsheet-link action must NOT silently grant anyone-writer.
ok('raw spreadsheet link does not grant anyone-writer',!contains(/budgetShareLink[\s\S]{0,500}role\s*:\s*["']writer["'][\s\S]{0,100}type\s*:\s*["']anyone["']/));
// Data integrity: ledger user strings should not be globally written as USER_ENTERED without escaping/RAW path.
ok('user-entered ledger has a RAW/sanitized write path',contains(/valueInputOption\s*:\s*["']RAW["']|function\s+vBatchUpdateRaw|sanitize.*formula/i));
// Consistency: major historical/suggestion/insight calculations should use canonical goal-movement classifier.
ok('spending suggestions use canonical expense classifier',contains(/function\s+suggestFromSpending[\s\S]{0,900}isExpenseRow\(/));
ok('insights series uses canonical expense classifier',contains(/function\s+insSeries[\s\S]{0,700}isExpenseRow\(/));

// Cross-surface consistency: goal movements are promised not to count as spending. Any spending index must use the canonical classifier.
ok('category spend index excludes goal movements',contains(/function\s+buildIndexes[\s\S]{0,900}isGoalMovementRow\(|function\s+buildIndexes[\s\S]{0,900}isExpenseRow\(/));
// If spreadsheet formulas define Spent as <= as-of date, client actuals must use the same cutoff to avoid current-month future-dated disagreement.
const summaryHasAsOf=contains(/Account Ledger'!\$C:\$C,[^\n]{0,200}\$AC\$1/);
ok('client actuals share spreadsheet as-of cutoff',!summaryHasAsOf || contains(/function\s+actualIE[\s\S]{0,1200}(todayISO|asOf|serialToISO)/));
// Recovery marker must not create a goal withdrawal merely because an intent was saved; it should verify mutation phase/balances first.
ok('debt-payoff recovery verifies balance mutation before appending withdrawal',contains(/function\s+reconcilePending[\s\S]{0,1800}(phase|expectedDebt|beforeDebt|afterDebt|debt.*bal|vgetU\()/i));
ok('debt-payoff recovery preserves original operation date',contains(/function\s+reconcilePending[\s\S]{0,1400}mk\.date/));
// Multi-year budget analysis must use the viewed budget year or deliberately disable actual-mode analysis off-current-year.
ok('annual feasibility respects viewed budget year',contains(/function\s+renderFeas[\s\S]{0,500}(bYear\(\)|bYear\(\)!==curYear\(\))/));
ok('cash-flow analysis respects viewed budget year',contains(/function\s+renderStress[\s\S]{0,1400}(year\s*:\s*bYear\(\)|bYear\(\)!==curYear\(\))/));


console.log(JSON.stringify({file:path,pass,fail,total:pass+fail,failures},null,2));
process.exitCode=fail?1:0;
