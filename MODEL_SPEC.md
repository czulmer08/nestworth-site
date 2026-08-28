# NestWorth Financial Model Specification

**Purpose.** This is the single source of truth for what every financial term in NestWorth *means* mathematically. The Google Sheet is the durable record; the deterministic JavaScript in `app.html` is the calculation engine; the UI and Wren only *interpret* these numbers. Keep this file in sync with the code so a change six versions from now can't quietly redefine "Available" or "Cash flow."

Applies to: **app.html v0.37.0** (build 20260828.53) and forward. When a formula here and the code disagree, that's a bug — fix one to match the other and note it in the changelog.

---

## 0. The three concepts, kept separate

NestWorth deliberately answers three *different* questions. Never conflate them; label each one.

| Concept | Question it answers | Time frame |
|---|---|---|
| **Annual plan** | Does the whole year balance? | Full calendar year |
| **Cash flow** | Does the timing work month to month? | Month-by-month running balance |
| **Net worth / position** | What do we own minus owe, right now? | A point-in-time snapshot |

A household can pass the **annual plan** and still fail **cash flow** (a $4,000 insurance bill lands in February before the money accumulates), and both are separate from **net worth**.

---

## 1. The ledger row

Every transaction is one row, columns A–I:

`[ A Year, B Month(1–12), C Date(YYYY-MM-DD), D Contributor, E Category, F Company, G Amount, H Description, I Reimbursed(Y/N) ]`

- **Expense row:** `Category ≠ "Deposit"` and Category/Company is not a goal name. `Amount > 0` reduces the category's remaining budget.
- **Credit / refund row:** an expense row with `Amount < 0`. It *lowers* spending in that category (money came in), it is **not** income.
- **Income (deposit) row:** `Category == "Deposit"`. `Amount > 0`.
- **Goal movement:** Category or Company equals a goal name — a savings earmark, **not** an expense and **not** income. Excluded from both.

`isExpenseRow(r)` = `E` non-empty AND `E ≠ "deposit"` AND not `isGoalName(E)` AND not `isGoalName(F)`.

---

## 2. Spent

- **Spent, category, month** = `Σ Amount` over expense rows for `(currentYear, currentMonth, thisCategory)`, folding itemized bills into their parent. In code: `catSpend12(name)[currentMonth-1]` (`state.spend` is the current-year 12-month index built by `buildIndexes()`).
- **Spent, category, year** = `Σ` of that category's 12 monthly values.
- **Spent, total, month/year** = `Σ Amount` over all expense rows in the period.

Credits (negative rows) net against spend, so "Spent" is spending **net of refunds**.

---

## 3. Budget

- **Category monthly budget** `mbud` = `bud12[currentMonth-1]` (a per-month array, so seasonal categories can vary).
- **Category annual budget** `annual` = `Σ bud12`.
- **Weekly income** is annualized as `weekly × 52 ÷ 12`; **biweekly** as `paycheck × 26 ÷ 12`. These are **planning averages**, not a real payday calendar — never call them an exact monthly cash forecast. (A real biweekly year has ten 2-paycheck months and two 3-paycheck months.)

**Over budget (this month)** = a category (excluding envelope-rolling ones) where `mbud > 0` and `Spent > mbud`. Amount over = `Spent − mbud`.

---

## 4. Plan + Actual (the current-month rule)

For any month `m` in "actual" mode:

- `m` **before** the current month → use **actual** logged values.
- `m` **is** the current month → use **`max(actual-to-date, plan)`** for both income and expense. Rationale: if you've already blown the budget this month, that overage shows up *now*; if you're under, assume you'll spend up to plan. This is the "so far + plan" blend.
- `m` **after** the current month → use **plan**.

Code: `renderStress()` (cash-flow grid) and `renderFeas()` (annual feasibility). Both use this identical rule.

---

## 5. Annual plan feasibility

```
surplus_or_shortfall = annualIncome − annualCategoryBudget − annualFixedGoalSavings
monthly_average      = surplus_or_shortfall ÷ 12
```

- `annualFixedGoalSavings` = `Σ (goal.monthly × 12)` over goals that are **not** category-linked and **not** residual (those are already represented elsewhere — no double counting).
- In "actual" mode, `annualIncome` / `annualCategoryBudget` use the Plan+Actual rule (§4).
- Verdict: `surplus ≥ 0` → "Feasible — $X/yr surplus"; else "Short — $X/yr gap." **This is the annual plan**, not "can I afford this right now." Point users to Cash flow for timing.

---

## 6. Cash flow through the year

Running balance, month by month:

```
gh           = Σ monthly of FIXED goals (non-category, non-residual, non-archived)   // leaves spendable cash
balance[0]   = startCash
balance[m]   = balance[m-1] + (income[m] − expense[m] − gh − oneTime[m])   // income/expense per §4
lowest point = min over m   → the month spendable cash dips the most
```

Fixed goal contributions **are** subtracted here: money moved into a savings goal stays in your net worth but is no longer *spendable cash*, so it must reduce the cash-flow balance (this matches the annual-plan feasibility in §5, which also subtracts goal savings — one model). `oneTime[m]` carries a one-off outflow (e.g. a modeled purchase) in its month.

Verdict: if the lowest balance `< 0`, savings run dry that month (warn); if a **Nest Egg Floor** is set (§7a) and the low falls below it, warn with the shortfall. Otherwise "Covered." This model — not the annual plan — answers "will a big bill land before I've saved for it?"

The live cash-flow screen and the Decision Engine (§12) share the exact same function (`computeCashflow(plan, opts)`), so a scenario's numbers can never disagree with what the screen shows.

---

## 7. Available / leftover cash

Two distinct values; never present the average as "available this month":

- **Average free cash** (`residualPool()`) = `max(0, annualIncome − annualCategoryBudget − annualFixedGoalSavings) ÷ 12`. A conceptual monthly *average*. Wren phrases affordability from this and explicitly calls it an average, not a guarantee.
- **Uncommitted this month** (Wren's "find money") = `incomeReceivedThisMonth − spentThisMonth − Σ max(0, mbud − mspent)` (income in, minus spent, minus what's still earmarked for the rest of this month's budgeted categories).

The "bump this goal" nudge is gated on `residualPool()` (annual average), so its copy says **"your annual budget has room,"** not "you have room this month."

---

## 8. Envelopes / banked (contingency)

For an envelope-rolling category:

```
banked = carryIn + Σ over COMPLETED months (mbud − actualSpend)
```

The **current month is deliberately excluded** — its unused budget isn't banked until the month closes (otherwise "savings" would balloon on the 1st before expenses are incurred). Label it **"banked through <last completed month>,"** never just "banked." Overspent envelopes may go **negative** (overspending genuinely consumes the cushion); only "progress toward an upcoming save-up" floors at 0.

---

## 9. Goals

- **Balance** = `startBal + Σ` goal-movement amounts for the goal.
- **Funding months** `goalFundMonths(targetDate)` = `monthsUntil(targetDate) + 1` = the current month **through** the target month, inclusive ("due by end of the target month"). A goal set up this month counts this month.
- **Auto monthly** (when the user leaves it blank) = `target ÷ goalFundMonths`.
- **Pace** = `need ÷ goalFundMonths`, where `need = target − balance`. "Behind" if the planned monthly `<` pace.
- **Goal ETA** (Wren) = `ceil(need ÷ monthly)` months from now → projected month.
- **Anti-double-counting:** a goal whose money physically sits inside an asset account is *earmarked within that account*, never added on top. `AccountBalance = Available + Σ EarmarkedGoals`. Net worth uses the account balance once.

---

## 10. Net worth

```
netWorth = totalAssets − totalDebts
```

Snapshots (per month) store **net, total assets, total debts, as-of date, and per-account composition**. A snapshot is taken when *composition* changes even if net is flat (e.g., $500 cash → $500 debt payoff leaves net unchanged but the position changed).

- **Change attribution** = `ΔNet = ΔAssets − ΔDebts`, where debt *reduction* is a positive contributor. Report the split: "Net worth grew $1,840 — +$800 assets, +$640 from paying down debt, +$400 other assets."
- **Freshness:** the figure is only as current as the last balance update. Show "updated N days ago" in the headline; flag once it's been > 45 days. Precision like `$184,220.37` must not imply live accuracy the data doesn't have.

---

## 7a. Nest Egg Floor

An optional per-budget number (`meta.floor`): the lowest the user wants their available cash to fall. It has no effect on any calculation — it's a **judgment line**. The cash-flow verdict and every Decision (§12) compare the lowest projected cash against it and report the margin ("$2,300 above your floor") or the breach ("$386 below your floor"). Blank/0 = not set = skipped.

## 12. The Decision Engine (scenarios)

The point of the whole architecture: run a hypothetical against the *entire* model deterministically, so Wren can narrate consequences instead of guessing them. All of it is pure (state-in / numbers-out); nothing touches the DOM or live data.

**Plan object** — a snapshot the models read: `{cons, cats, rows, goals, startCash, goalMonthlyFixed, oneTime[12]}`. `currentPlan()` builds it from live state; `clonePlan()` forks it.

**Pure models** (the same ones the live screens call):
- `computeAnnualPlan(plan)` → `{income, budget, goalSave, surplus}` (§5).
- `computeCashflow(plan, opts)` → month-by-month balances, `low`, `lowMonth`, `end` (§6).
- `goalCompletion(goal)` → projected finish month from `ceil((target−balance)/monthly)`.
- `planMetrics(plan)` → `{surplus, low, lowMonth, end}` — the comparable summary.

**`evaluateDecision(change)`** clones the current plan, applies one `change`, reruns the models, and returns a structured before/after: `{feasible, before, after, goal?, floor, passesFloor}`. `feasible` = annual surplus ≥ 0 **and** the Nest Egg Floor holds.

**Change types (one engine, many entrances):**
- `{type:'purchase', amount, month}` — a one-time outflow. Reduces cash-flow low and year-end cash; annual surplus unchanged.
- `{type:'expenseMonthly', amount}` — a recurring cost (e.g. a car payment). Reduces surplus by `amount×12` and every month's cash.
- `{type:'goalMonthly', goal, monthly}` — set a goal's monthly contribution. Moves its finish date and adjusts surplus + cash.
- `{type:'income', amount}` — a recurring income change.

Every user-facing "decision" (afford a purchase, accelerate a goal, plan a life event) is just a friendly entrance that constructs one of these and narrates the diff. Wren **states its assumption** in one line ("assumes the rest of the year tracks your plan"), because a projection is only as good as that assumption.

## 11. Wren's contract (the whole point)

Wren is a **narrator, not a calculator.** She receives already-computed facts —
`spent_this_month`, `category_variance`, `annual_plan_surplus`, `net_worth_change`, `goal_pace`, historical averages — and turns them into conversation. She must **never** derive a dollar figure from raw transaction text herself. The deterministic engine produces the number; Wren produces the sentence. This is what keeps a financial app from inventing figures.

Layers she speaks to: **Ask** (navigation/how-to), **Analyze** (what happened / why), **Plan** (forecasts and what-ifs). All from the numbers above.

---

*Keep this current. If you change a formula in `app.html`, change it here in the same commit.*
