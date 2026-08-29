# NestWorth Beta Readiness Study

This is the human-testing protocol for the next phase: **not** "is NestWorth correct" (the automated suites cover
that) but **"can NestWorth take care of someone who doesn't have the author there to explain it."** It defines the
synthetic households, the task battery with expected answers, the observer scoring sheet, the pass/fail scorecard, and a
blind head-to-head against an established product.

Three automated harnesses front-run this study so most problems surface before a person is involved:
`verify-new-user-journey.js` (H2 walked end-to-end from a clean start with the *user-sees = engine = persisted* write oracle),
`verify-household-journeys.js` (H1 and H3–H8 loaded into the real engine, each asserting its signature behavior — variable
income per month, tight-cash over-budget, high-debt net worth, refund netting, residual allocation, uncategorized-still-counts —
and that the number shows on the surface the user reads), and `verify-chaos-user.js` (misuse, malformed input, double-taps,
archive-with-money, delete-source). Run and trust those first (each is break-audited), then move the same scenarios onto a real
iPhone + a second phone, then hand NestWorth to five people.

---

## Part 1 — Stranger households

Stop using the author's household as the mental model. Each card is a **story**, not just data, so a tester can inhabit it.
Build one reference ("answer key") Nest per household *before* the study and record what a correctly-built Nest reports;
those recorded figures are the expected answers for the timing-sensitive tasks.

| # | Household | What it stresses |
|---|---|---|
| H1 | Salaried couple | Ordinary baseline |
| H2 | Biweekly + monthly couple | 3-paycheck months, mixed cadence |
| H3 | Hourly / variable income | Income uncertainty |
| H4 | Single parent | Tight cash flow, floor pressure |
| H5 | High-income / high-debt | Debt + affordability |
| H6 | Heavy credit-card user | Refunds / reimbursements / transfers |
| H7 | Goal-heavy saver | Residual + linked goals |
| H8 | Messy new user | Uncategorized spending, incomplete setup |

### H2 — the primary study household (fully specified)

> **The Okafor household.** Jordan is paid **$2,450 every other Friday** (first payday **Fri 2026-01-09**), and **$400 of
> every check** goes straight into a savings account they *don't* spend from. Sam earns a flat **$3,000/month** salary.
> Their monthly bills: **Rent $2,000, Groceries $600, Utilities $250, Transport $300, Subscriptions $80.** They keep a
> **$1,000 cash floor.** They want a **$3,000 emergency fund**, and **$5,000 for a June vacation** — but only from **20% of
> whatever's left each month, capped at $800/mo**, and only after the emergency fund is on track.

Deterministic facts a correct Nest must hold (verify these in the reference Nest):

- Jordan's **budgetable** pay per check = $2,450 − $400 = **$2,050**; the $400/check set-aside is **not** spending money.
- Jordan has **3-paycheck months** in 2026 (with the 2026-01-09 anchor): **July** and **December**. Those months receive an
  extra ~$2,050 of income — which is **not** automatically extra spending; it's what a lean month borrows against.
- Total monthly bills = **$3,230**.
- Moving money into the vacation goal is **savings, not spending**, and does **not** lower net worth.

*(Cards H1, H3–H8: build analogously — one story paragraph, explicit numbers, a cash floor, at least one goal, and the one
"stress" that makes the household different. Keep numbers round so the answer key is unambiguous.)*

---

## Part 2 — Task battery

Give the tester a phone and the household card. Say: **"You've decided to use this app to manage this household's money.
Get everything set up."** Then **stay quiet.** Do not teach. Then work the tasks in order.

| # | Task | Expected outcome |
|---|---|---|
| 1 | Create the budget | A private Nest exists; onboarding completed |
| 2 | Add both incomes (Jordan biweekly + $400/check set-aside; Sam monthly) | Two income sources; Jordan's per-check set-aside recorded so it's excluded from spendable pay |
| 3 | Set up the five expenses | Rent/Groceries/Utilities/Transport/Subs budgeted = **$3,230/mo** total |
| 4 | Create the $3,000 emergency goal | Goal exists, target $3,000 |
| 5 | Record a **$184.72** grocery purchase at Costco | One grocery expense of $184.72 |
| 6 | Record a **$42.19** refund of that purchase | Grocery net for the month = **$142.53** (NOT $226.91) |
| 7 | Find how much money is available this month | *Answer key from reference Nest* — must match the app's Month figure |
| 8 | Determine whether **next** month will be tight | *Answer key* — and note whether they can explain *why* (paycheck timing / goal) |
| 9 | Ask Wren why spending increased | Wren cites the **same** month figure the app shows, not a different number |
| 10 | Figure out whether they can afford a **$6,000** purchase in **November** | *Answer key* — the decision model's verdict; watch if the tester trusts it |
| 11 | Correct a transaction entered incorrectly | Amount fixed; exactly one row; no duplicate |
| 12 | Invite a spouse to the Nest | A share/invite completed (or the tester finds the path) |

**Refunds, timing, and goals are the traps.** A tester who reads task 6 as "+$42.19 spent," or reads the vacation transfer
in task 4/goal setup as "we got poorer," or reads a 3-paycheck month as "free spending money," has hit the exact
misconceptions this study exists to find. Record every one.

---

## Part 3 — Observer sheet (one row per task, per tester)

For each task record:

- **Outcome:** ✅ completed unaided · ◑ completed with difficulty · ❌ failed / gave up / needed rescue.
- **Time** to complete (seconds).
- **Wrong turns / backtracks** (count).
- **Confusing terms** — write the exact word they stumbled on ("residual", "budget used", "envelope", "contingency", "as-of").
- **Accidental actions** (deleted the wrong thing, double-logged, archived with money, etc.).
- **Verbatim quotes**, especially **"I don't know what this means"** — every occurrence is product research. Also capture
  any moment they reach a real *insight* ("oh — October's tight because of the vacation goal and the paycheck timing").

Do **not** ask "Do you like it?" — that is weak research. Behavior and task outcomes are the data.

### Misconception watch-list (tally each occurrence)
- Thinks **"budget used" = money spent** (it includes money moved to goals).
- Thinks a **goal transfer made them poorer** (net worth is unchanged).
- Thinks a **3-paycheck month = extra spending money**.
- Doesn't understand **"residual goal"** funding.
- Can't tell **available-this-month** from **account balance**.
- Trusts / distrusts the **affordability verdict** without understanding it.

---

## Part 4 — Beta scorecard (gates)

Decide readiness by measurement, not feel. Establish a baseline first, then require improvement across v0.69 → v0.70 → v0.80.
Do **not** tune the product to hit a number at the expense of honesty.

| Measure | Family-beta target | Public-beta target |
|---|---|---|
| Critical financial correctness | 100% | 100% |
| Critical write recovery | 100% | 100% |
| Core-task completion **without help** | ≥ 80% | ≥ 90% |
| Median setup completion time | < 15 min | < 10 min |
| Wrong financial interpretation (misconception rate) | < 10% | < 5% |
| Critical user-data loss | 0 | 0 |
| Duplicate transaction after recovery | 0 | 0 |
| Wren factual correctness | ≥ 95% | ≥ 98% |
| Mobile task completion | ≥ 85% | ≥ 95% |
| Accessibility critical failures | 0 | 0 |

The first three rows and the two zeros are **hard gates** — a build that misses any of them is not beta-ready regardless of
the rest. The automated suites already evidence "financial correctness," "write recovery," "duplicate after recovery," and
much of "Wren factual correctness"; the human study supplies the completion, time, misconception, and accessibility numbers.

---

## Part 5 — The blind head-to-head (the proposition test)

Give five unfamiliar people **NestWorth** and one **established budgeting product**, each loaded with the **same** fictional
household. **Don't tell them which one you built.** Ask each person, in each app, to answer:

1. How much can this household **safely spend this month**?
2. Are there any **cash-tight months** ahead?
3. How much are they **actually saving**?
4. Can they **afford a $6,000 purchase in November**?
5. **Why is August different from July**?
6. What happens if they **increase their vacation savings**?

For each question × app, record: **could they get an answer? was it correct? how long? how confident (1–5)?**

The proposition we're testing is not "add a grocery three seconds faster." It's whether an ordinary person can reach an
understanding like:

> *"We're financially okay for the year, but October is going to be tight because of paycheck timing and our vacation goal —
> so making this purchase in September would push our cash below the floor."*

If people reach that understanding **more easily in NestWorth**, we've demonstrated something far more important than feature
parity. If they can't, that's the most valuable finding this study can produce.

---

## Part 5.5 — Cognitive walkthrough (current build, v0.68.13)

A predicted-discoverability pass done *before* the human study — a cheap way to spot where a stranger is likely to stall, so
the observers know what to watch. Test every prediction with real people; do not treat these as conclusions.

| User task | Predicted discoverability | Notes |
|---|---|---|
| Start own Nest | High | First-run chooser is explicit. |
| Join a shared Nest | High | Separate first-run action; no forced personal Nest. |
| Build first budget | High | First-run card offers Set up / Import / Just log expenses. |
| Log an ordinary expense | High | Add is the home tab; the form is explicit. |
| Correct a mistake | High | Recent entries sit right under Add and are editable. |
| Record a refund | Medium-high | Clear label + hint, but a novice may reach for Deposit first. |
| Create a goal | High | Dedicated Goals tab, explicit Add Goal. |
| Find "how much can I still spend?" | Medium | Safe-to-spend is prominent on **Add**; some users will look on **Month**. |
| Find a future tight month | Medium | Cash-flow-through-the-year lives under **Budget**, not its own destination. |
| Run a major what-if | High | Prominent button on Budget; Wren can also route. |
| Invite a spouse | Medium-high | Clear Settings section, but off the main navigation loop. |
| Goal money vs net worth | Medium-high | Strong inline copy, but a concept-comprehension item that needs human testing. |

**Predicted score:** ~8 tasks high-discoverability, ~4 medium; no core task appears fundamentally inaccessible. The medium
risks are comprehension/discoverability (refund-vs-deposit, remaining-spendable location, future-low-cash location,
savings-vs-net-worth), **not** calculation problems.

### UX risk found and fixed
- **The guided tour arrived too early (fixed in v0.68.13).** The 60-second tour auto-launched ~800 ms after entering the app,
  guarded only against open overlays — so it could take over while a brand-new person was still reading the first-run card. It
  now waits until they've chosen a path (Set up / Import / Just log) and landed on a clear screen, and gives up quietly rather
  than interrupt a long setup. Regression-tested in `verify-firstrun-tour.js`. **Still worth confirming with real users** that
  the post-choice timing feels right.

### Discoverability hypotheses to test (do NOT pre-emptively build)
- **Remaining-spendable location.** The "left this month" headline is on **Add**; users may go to **Month**. Test the task
  uncoached. If **more than 1 in 5** look in Month and stall, mirror a compact safe-to-spend number there (or add a clear link).
- **Future tight month.** Cash-flow-through-the-year is under **Budget**. Test "Which month will be tightest?" If people don't
  find it, surface a small "lowest projected month" card on Month/Review, or a direct Wren prompt.

These are deliberately *hypotheses*, not changes — the point of the study is to let real behavior decide, not to redesign the
information architecture on a hunch.

---

## Part 6 — Sequence

1. Run `verify-new-user-journey.js`, `verify-household-journeys.js` and `verify-chaos-user.js`; **audit** them (confirm each
   catches a deliberate break) before trusting results — exactly as the financial suite is mutation-audited.
2. Run the same household scenarios by hand on a **real iPhone (Safari + installed PWA)** and a **second phone** on one
   shared Nest: offline/online, app-kill immediately after Add, expired OAuth, reopen/recover.
3. Build the reference "answer key" Nest for each household.
4. Recruit **five** people who are **not** finance experts and were **not** taught NestWorth. Run Parts 2–3.
5. Score against Part 4. Run Part 5 with whoever's available.
6. Fix, re-baseline, repeat at the next version.
