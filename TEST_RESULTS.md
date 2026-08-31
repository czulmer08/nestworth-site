# NestWorth — executed test results

**Build under test:** v0.68.64 · Build 20260831.152
**app.html SHA-256:** `c010ced42f4caa7cb26358417cf32c44b5494b012fa6c9bc120492e707ea498b`
**Executed:** 2026-08-31 UTC
**Environment:** headless Chromium (Playwright) on Node v22.22.2, Linux cloud container.

## v0.68.64 — Guided Forecast Checkup, increment C: the wizard UI

- **The long scroll is replaced by one decision per screen**, reading the B engine directly (findings / preview / reasons / apply) — no classification or forecast logic in the UI. Each screen: a progress line ("2 of 6"), one question, the evidence in place, and choices that each show their **consequence in one sentence** before you tap.
- **Envelope purpose is its own step** (never mixed with an unusual-spend decision): Saving for a future bill → identify (Possible match → Link, or "haven't logged it yet" → set a target amount + due month, no dead-end); "A bit of both" adds a numerical split screen ("does not change your total budget").
- **Not sure and Skip for now are visibly distinct** — an answer that retains the current treatment vs. leaving it unanswered.
- **Stale links surface first** as their own "needs review" screen ("no longer in your ledger" / "changed from … to …"), feeding back into the resolver.
- **The review screen is the trust moment:** counts, "What will change" per item, "Your forecast" before→after for Safe to move / Reserved for what's ahead / Lowest projected cash, a "Why it changed" reason under a large move, and the explicit "No transactions, bank balances, or total budget amounts will be changed." above Apply.
- **New suite `verify-resolver-wizard.js` — 10/10 PASS**, including the load-bearing UI guarantee: **the "after" safe-to-move shown on the review equals the live figure immediately after Apply** (RES-APPLY at the UI layer). Plus navigation (Back / advance), Not-sure-vs-Skip distinction, the identify Possible-match sub-step, Save & finish later persistence, and the stale-link review→unlink.
- **Engine additions:** preview returns lowest-projected-cash before/after; `checkupFindings` surfaces `needsReview` and every unclassified envelope (candidate or not); `checkupLinkReviewInfo` gives the changed-from/to detail.
- **2 new mutations (66→68), both CAUGHT:** the wizard never advancing; a stale link never surfacing.
- **Results this build:** full functional sweep **125/125 suites pass** (the old `forecastCheckupHTML` kept for back-compat; `renderCheckup` now mounts the wizard); `verify-mutation.js` **68/68 caught, restored byte-exact**.

## v0.68.63 — Guided Forecast Checkup, increment B: the resolver engine (staged draft)

- **The checkup becomes a draft you build and Apply once** — not a long list that changes the forecast on every tap. `state.checkupDraft` (mirrored to `meta.checkupDraft`) persists the **answers, not the effects**, so Save & finish later restores your progress without moving the forecast.
- **`checkupFindings()`** enumerates what to review (unusual-budget + envelope-purpose, as separate items) with a stable id carrying an evidence **signature**. **`checkupAnswer` / `checkupSkip`** stage answers with the explicit taxonomy **resolved / notSure / suppressed / unresolved / skipped**.
- **`checkupPreview()`** runs the **real** production engine (`goalSafeToMove`) against the applied cfg vs a candidate built by applying the draft to a **clone** (restored byte-exact), returning before/after + per-answer deltas + **reason codes/text**. **`checkupApply()`** commits the same answers through the same `checkupSetEnvelope` path.
- **New suite `verify-resolver-engine.js` — 7/7 PASS**, including the three load-bearing invariants:
  - **RES-STAGE-001** — staged answers leave the live safe-to-move *and* the cfg untouched.
  - **RES-RESUME-001** — persist the draft → restore → same answers + step, forecast unchanged.
  - **RES-APPLY-001** — `checkupPreview().after` === live `goalSafeToMove()` immediately after commit, to the cent (and the preview leaves the cfg byte-exact).
  - plus the status taxonomy counted distinctly, **signature-scoped suppression** (a new-sized spike is a new finding), and **needsReview** flagging a linked obligation whose ledger row was deleted.
- **Latent bug fixed:** `meta.checkupDraft` persistence referenced `normMeta`'s *local* `isObj` out of scope — the draft would never have saved. Now inline object checks.
- **4 new mutations (62→66), all CAUGHT:** commit applies nothing; preview leaks its staged cfg; resume loses answers; needsReview never fires.
- **Results this build:** full functional sweep **124/124 suites pass** (meta/migration/write-contract green with the new field); `verify-mutation.js` **66/66 caught, restored byte-exact**.
- **Increment C (the wizard UI) renders on this engine next.**

## v0.68.62 — Centralize parent/child membership (one authoritative helper)

- **The architectural root of the v0.68.53 / .58 / .61 bug class.** "Does this transaction belong to this category?" had been answered independently in several scanners, and each isolated fix left the *next* scanner wrong (unbudgeted double-count → Wren's own set → the empty lumpy evidence table).
- **`catNameSet(name)` is now the one answer:** the parent name + every itemized child ("bill") name + its "↳ " form (children enumerated by `catBills`, which follows renames). Every forward-membership scanner derives from it — `catSpend12` (spend), `budgetedNameSet` (the used/unbudgeted partition), `catLinkedGoal12` (category-linked goal moves — a child-tagged goal move now correctly counts toward its parent), and `lumpyCategories` (the checkup evidence table). Plus `catMatchesRow(row, name)` for single-row checks.
- **Pure refactor — result-identical.** The full sweep is unchanged (every existing suite green), so no behavior moved; the win is structural: a future itemized bug can't arise from one scanner drifting from another.
- **New suite `verify-cat-membership.js` — 5/5 PASS:** the set contents; `catMatchesRow` (Baby Z / ↳ / parent belong, Parking/blank don't); `catSpend12` = $400 (parent + children + ↳, goal move excluded); `budgetedNameSet` includes the children; `catLinkedGoal12` counts a child-tagged goal move ($200) toward the parent.
- **1 new mutation (61→62), CAUGHT** (dropping the parent name from `catNameSet`); the lumpy break-audit was retargeted to its category filter and its suite hardened with an unrelated same-month row so the filter is genuinely exercised.
- **Results this build:** full functional sweep **123/123 suites pass**; `verify-mutation.js` **62/62 caught, restored byte-exact**. Hash stable across the mutation run and the sweep.
- **Foundation for the guided one-at-a-time Forecast Checkup** (resolver engine + wizard UI to follow).

## v0.68.61 — Forecast Checkup clarity (device feedback: "not enough information to decide the unusual activity")

- **Bug found on the user's phone.** The "Unusual budget" prompt for an **itemized** category (Children, Home Services) showed a big spike ($7,962.80) with an **empty** "What Jun was" transaction table — nothing to decide on. Same itemized-membership family as v0.68.53/58: the spike **amount** comes from `spentByMonth()` = `catSpend12` (which includes an itemized category's sub-item rows), but `lumpyCategories()`'s transaction scan matched the **parent name only**, and those rows are tagged with the sub-item name (Baby Z, …), so it found nothing.
- **Fix.** The scan now matches the same set as `catSpend12` — parent name + every itemized child ("bill") name + its "↳ " form — so the table fills with the real transactions that made the month unusual, each row showing the sub-item ("Baby Z · KinderCare").
- **"What this does" microcopy.** A one-line consequence hint now sits under both the Unusual-budget answers ("One-off opens this category so you can lower its budget · That's normal keeps it as is — nothing is spent either way") and the purpose answers ("this only sets how the money set aside here is treated in your forecast — reserved vs spendable — it never moves money").
- **New suite `verify-lumpy-itemized.js` — 6/6 PASS:** the itemized spike amount; the now-non-empty txn list summing to the spike ($5,000 + $3,000); the sub-item names shown; the rendered "What Jun was" table; and both hints.
- **1 new mutation (60→61), CAUGHT:** dropping child rows from the scan reproduces the empty-table-with-a-big-spike bug.
- **Results this build:** full functional sweep **122/122 suites pass**; `verify-mutation.js` **61/61 caught, restored byte-exact**. Hash stable across the mutation run and the sweep.
- *Deferred (offered separately):* a one-at-a-time click-through version of the whole checkup, instead of one long scroll — a larger UX redesign.

## v0.68.60 — #6 Floor-aware multi-month reconciliation (surface, increment 2)

- **The v0.68.59 engine is now visible and askable — both reading only `multiMonthReconciliation()`, so the card, Wren, and the engine can't disagree.**
- **Forward card (`multiMonthReconHTML`).** Renders under the "where this month's cash is going" recon card. Leads with the milestones — "Your $X contingency shortfall is repaired to $0 by **February**", "your $T cushion is built by **March**" (or "isn't reached by year-end" when the floor holds surplus back) — then lists each active future month's allocation (repair / build / goals / reserves) and the floor-held reserves note. Surfaces **only** when there's a forward story (a shortfall to repair, a target to build, or floor-held reserves); a healthy, target-less plan shows nothing.
- **Wren forward-timing answer.** "When will my contingency be repaired / rebuilt / reach its target?" / "how long until it's caught up?" answered from the same engine, with cues specific enough that a **backward** "when did it go negative / was it last positive?" question still routes to the existing history answer (verified — every Wren suite stays green).
- **New suite `verify-multimonth-surface.js` — 6/6 PASS:** the milestones and per-month rows; Wren's repaired-by/built-by months; the floor-constrained case (target not reached + floor note, in card and Wren); and the healthy case (card empty, Wren "nothing to rebuild").
- **2 new mutations (58→60), both CAUGHT:** the card showing with no forward story; the Wren forward route never firing.
- **Results this build:** full functional sweep **121/121 suites pass**; `verify-mutation.js` **60/60 caught, restored byte-exact**. Hash stable across the mutation run and the sweep.

## v0.68.59 — #6 Floor-aware multi-month reconciliation (engine core, increment 1)

- **What it is.** `monthlyCashReconciliation()` is single-month; new `multiMonthReconciliation()` rolls the same **repair → build → residual → reserves** hierarchy *forward* across the rest of the budget year, carrying the contingency pool month-to-month — so it can report **when** an overspent contingency is repaired to $0 (`repairedMonth`), **when** it reaches the target (`targetMonth`), and how much residual funding the plan supports over the horizon.
- **No duplicated math.** The current month IS the exact `monthlyCashReconciliation()` (agrees with the Contingency card); future months use planned income/expense from `_cfArrays` (the arrays `computeCashflow` forecasts from); the pool carries by the same hierarchy.
- **Floor-aware via the one existing source.** `goalSafeToMove().safeToGoal` is the total set-aside capacity today that keeps every forward month at/above the Nest Egg Floor. Cumulative **discretionary** set-asides (contingency build + residual funding — never the deficit **repair**, which is a priority) are capped at that headroom; the surplus the floor needs is reported as `floorHeld` reserves.
- **New suite `verify-multimonth-recon.js` — 8/8 PASS.** Per-month identity `max(0,preSurplus) === repair+build+residual+reserves`; the pool carry `pool_m === pool_(m-1)+repair+build`; a −$900 deficit repaired in Feb then $500 target built by Mar; residual absorbing surplus once built; the floor cap (only $300 headroom ⇒ build+residual capped at $300, rest `floorHeld`, target un-buildable under the tight floor) with **repair never capped**; and a null for a non-current budget year.
- **2 new mutations (56→58), both CAUGHT:** ignoring the floor cap; dropping `build` from the pool carry (contingency never reaches target).
- **Results this build:** full functional sweep **120/120 suites pass**; `verify-mutation.js` **58/58 caught, restored byte-exact**. Hash stable across the mutation run and the sweep.
- **Increment scope:** this is the computed engine. The Month/Contingency **UI surface + Wren narration** (and optional Decision-Engine tie-in) are the next increment — the engine is inert until surfaced, and fully proven.

## v0.68.58 — Budget-membership lockdown (one authoritative definition, shared by every surface)

- **Root problem.** v0.68.53 fixed the itemized double-count ("74% used yet over budget") for the Month headline and `unbudgetedConsumption`, but the *same class of bug still lived in two other surfaces* that kept their own top-level-only category set — the exact "one part of NestWorth knows Electricity belongs to Utilities; another part didn't" drift.
- **Real bug found & fixed — Wren.** `wrenAnalyze`'s unbudgeted-spending answer built `_known` from `state.cats` names only, so Wren would report itemized-child spend (the user's $3,103.43) as "unbudgeted," contradicting the fixed Month headline. Now routes through `budgetedNameSet()`.
- **Real bug found & fixed — `ledgerUnbudgeted`.** The "pull into budget" candidate set omitted the "↳ child" form, so a `↳`-tagged (already-budgeted) name could be offered as a pull-in candidate. Now routes through `budgetedNameSet()`.
- **The lockdown.** `budgetedNameSet()` is promoted to *the* authoritative "is this ledger row represented by the budget?" definition — top-level names, itemized child names, "↳ " forms; follows renames via `catBills`; **includes hidden-but-budgeted categories** (product decision: has a budget line ⇒ budgeted); blank/unknown ⇒ unbudgeted — with an `isBudgetedName()` predicate and an **enumerated consumer list** in the header comment so no surface re-implements membership again. Used ⇄ unbudgeted can no longer maintain separate logic.
- **New suite `verify-item-ub.js` — 11/11 PASS.** ITEM-UB-001 child counted once / 002 the ↳ form / 003 multi-child summed once / 004 unknown once / 005 blank once / 006 renamed child by current name (stale old name not budgeted) / 007 hidden-but-budgeted / **008 the exact-reconciliation identity: total consumption = budget-represented + genuinely-unbudgeted, mutually exclusive**; plus two cross-surface Wren checks ($0 when all budgeted; the real $55 when not); plus a **reproduction** that drives the *real* Month headline to the screenshot numbers — $9,824.50 budgeted · $7,270.96 used · **$2,553.54 left · 74% · not over**.
- **2 new mutations (54→56), both CAUGHT:** dropping child recognition reproduces the exact "74% used yet over budget" contradiction on the rendered headline (mapped to `verify-item-ub.js`); reverting Wren to its own set drifts it from the headline.
- **Results this build:** full functional sweep **119/119 suites pass** (every Wren suite green — the consolidation changed no correct behavior); `verify-mutation.js` **56/56 caught, restored byte-exact**. Hash stable across the mutation run and the sweep.

## v0.68.57 — Deferred reconciliation surfaces: Decision-Engine contingency (#5) + recon→cash-flow bridge (#7)

- **#5 Decision-Engine contingency surfacing:** when the contingency is currently **overspent and this month's surplus hasn't fully covered it**, the Decision result surfaces its reconciled status (`contingencyReconSentence` — the single cross-surface source) and says **directionally** whether the what-if gives more/less monthly room to rebuild it. The only added inference is the sign of the annual-surplus delta (÷12 → run-rate) the engine already computes — no new accounting. A fully-repaired or in-the-black contingency, and a null note, are not surfaced. (`decisionContingencyNote`/`decisionContingencyHTML`, rendered under the `decRenderResult` table.)
- **#7 recon → cash-flow bridge:** the "Where this month's cash is going" card now walks the exact dollars from cash-on-hand-today to the **Cash Flow projected month-end** — cash carried in + deposits so far − spending so far = today; then − the rest of the month's planned spending (+ any deposits still expected) = the month-end. `reconCashFlowBridge().end` **is** `computeCashflow(actual).months[thisMonth].bal` (single source, not re-derived); the walk reconciles to the cent. Answers "why isn't 'cash remaining after that' the same as my Cash Flow number?". Gated to the live budget year.
- **New suite `verify-decision-contingency.js` — 7/7 PASS:** helps/hurts/neutral direction from the surplus delta; the rendered single-source sentence + "Contingency to rebuild" head + "$X/mo → $Y still short" copy; and the three non-surfaced cases (fully-repaired, in-the-black, no-note).
- **New suite `verify-recon-bridge.js` — 6/6 PASS:** the bridge end equals `computeCashflow(actual)` month-end to the cent across three scenarios (mid-month with rest-of-month planned; January where entering = start cash; actual-exceeds-plan where restOut = $0); the walk reconciles; the card renders the block; and a non-current budget year yields a null bridge.
- **2 new mutations (52→54), both CAUGHT:** #5's direction collapsed to always-"neutral"; #7's "cash on hand today" thrown off by $1 (breaks the reconciliation).
- **Results this build:** full functional sweep **118/118 suites pass**; `verify-mutation.js` **54/54 caught, restored byte-exact**. Hash stable across the mutation run and the sweep.
- Both surfaces are display-only over already-tested engine helpers (`contingencyReconNote`, `computeCashflow`, `actualIE`) — the existing Decision-UI and cash-flow-presentation suites remain green, confirming no regression to those renders.

## v0.68.56 — Checkup continuations: at-log link suggestion (#2) + multi-bill (#4)

- **#2 at-log-time link suggestion:** when you log a save-ahead future bill in an envelope (next month onward, larger than that month's budget), the Add screen offers a **"Link it"** prompt inline — confirm only, never auto (`maybeSuggestLink`/`_logLinkCandidate`/`doCheckupLinkFromLog`).
- **#4 multi-bill:** a **linked** envelope with another unlinked future bill now shows an **"Also a match → Add this bill"** item; adding it uses `checkupAddObligation` (earliest-due-first), and "Not now" dismisses that bill.
- **#1** (new envelopes) needs no new code — an unclassified envelope automatically surfaces in the Checkup's "What is this for?" review.
- **New suite `verify-checkup-continuation.js` — 6/6 PASS:** save-ahead candidate detection (and the three non-candidate cases: current-month, within-budget, non-envelope); the inline "Link it" prompt without auto-linking; the multi-bill "also a match" item, its render, and adding it linking both bills earliest-due-first with the prompt clearing.
- **2 new mutations (50→52), both CAUGHT:** the at-log suggestion firing for within-budget bills; the multi-bill extra never surfacing.
- **Results this build:** full functional sweep **117/117 suites pass**; `verify-mutation.js` **52/52 caught, restored byte-exact**.

## v0.68.55 — Forecast Checkup: the three remaining pieces

Completes the review-and-confirm design: (1) **"What is this envelope for?"** — an unclassified envelope with no matching bill now gets an explicit purpose question with four answers (Saving for a bill → sinking, A bit of both → split, Ongoing spending, Not sure), persisted so it never re-asks; (2) **the split** — "A bit of both" prompts for how much of the monthly budget is saving and sets `purpose=split` + `contribution` without changing the total (a $900 Children line → $600 spend + $300 save); (3) **the completion summary** — once everything is reviewed, a wrap-up shows the counts (sinking funds linked / ongoing envelopes / Contingency preserved) and the **before → after safe-to-move** for the session (baseline captured when the checkup first has work), with a Done button. All cash-neutral and prospective.

- **New suite `verify-checkup-classify.js` — 7/7 PASS.** The purpose question appears for an unclassified no-bill envelope with all four answers wired to real handlers; answering drops it from the scan; the split gives $300 saving + $200 spend = the same $500; the completion summary renders "Your forecast is ready", the counts, Contingency preserved, and a +$1,500 before/after with a Done button; the handlers exist.
- **2 new mutations (48→50), both CAUGHT:** never asking an envelope its purpose; suppressing the completion summary.
- **Results this build:** full functional sweep **116/116 suites pass**; `verify-mutation.js` **50/50 caught, restored byte-exact**. Hash stable across the mutation run and the sweep.

## v0.68.54 — BUG FIX: Account Summary "Spent" blank for the whole year

Found by reading the user's live sheet. The per-month **Spent** SUMIFS gate their date range on an "as of" helper cell `$AC$1`. A new year tab is created by **duplicating** the nearest year (`ensureYearTabFor`), which inherits the source's `$AC$1` — often **blank** — and it wasn't being re-set (and `refreshAsOf`'s per-day guard could skip a tab created after it stamped). With `$AC$1` blank, `"<="&$AC$1` matches nothing → **every Spent cell reads 0** across the year, while Budgeted/Remaining (which don't use it) look fine. The app itself was unaffected (it reads the Year/Month columns, not the Spent formulas).

Two fixes: (1) `sumifTerm` degrades gracefully — `"<="&IF($AC$1="",EOMONTH(month),$AC$1)` — so a blank helper falls back to end-of-month and can never blank the year, while still using `$AC$1` as the "spent so far" cutoff when set; (2) `ensureYearTabFor` now writes `$AC$1=today` on tab creation and resets the refresh guard.

- **New suite `verify-summary-spent.js` — 5/5 PASS.** The Spent formula still sums Amount by Category within month bounds; the cutoff is graceful (blank `$AC$1` → end-of-month, no bare `"<="&$AC$1)`); it still references `$AC$1` when set; bill and parent formulas carry the guard on every term.
- **1 new mutation (47→48), CAUGHT:** removing the graceful fallback (a blank helper re-zeroes the year).
- **No regression:** `verify-optimize` (annual formula), `verify-adopt-itemized`, `verify-breakdown-sync` all still pass.
- **Results this build:** full functional sweep **115/115 suites pass**; `verify-mutation.js` **48/48 caught, restored byte-exact**. Hash stable across the mutation run and the sweep.
- **To repair an already-affected sheet:** reopen the app (rewrites `$AC$1`), or Settings → Optimize / Build itemized breakdown (rewrites the formulas + sets the date).

## v0.68.53 — BUG FIX: itemized sub-items double-counted as "outside budget"

Found by reading the user's live sheet (Google Drive connector): the Holland budget uses **itemized** categories (Utilities → Electricity/Water/Gas/…; Children → Baby Z/Baby B; Subscriptions/Home Services/Membership), and the ledger tags many rows with the **sub-item** names the app's own dropdown offers. `catSpend12`/`catBills` already count a row tagged "Electricity" toward Utilities' **spend** — but `unbudgetedConsumption()` and the Add-screen `renderS2S` banner built their budgeted-name set from **top-level names only**, so that same row was counted **twice**: once in its parent's "used", and again as "spent outside budget". With itemized budgets this inflates the total — reading **"$X over budget" even below 100% used**, plus a large phantom "unbudgeted" figure.

Fix: `budgetedNameSet()` includes every top-level name **plus** every itemized sub-item name (and its "↳ " form), mirroring `catSpend12`; both unbudgeted paths use it.

- **New suite `verify-itemized-unbudgeted.js` — 5/5 PASS.** `budgetedNameSet` contains parents *and* sub-items; `unbudgetedConsumption()` returns only the genuinely-outside rows ($2,050 Mortgage+blank, not the $310 of sub-item rows — it was $2,360 before); the banner shows "$2,050.00 spent outside budget"; the breakdown excludes the sub-item rows and keeps the real one.
- **1 new mutation (46→47), CAUGHT:** omitting sub-items from the budgeted set (the double-count returns).
- **No regression:** `verify-goal-funding`, `verify-goal-funding-reconcile`, `verify-unbudgeted-label`, `verify-cash-allocation`, `verify-contingency-goals` all still pass (they use non-itemized categories, so the set is unchanged for them).
- **Results this build:** full functional sweep **114/114 suites pass**; `verify-mutation.js` **47/47 caught, restored byte-exact**. Hash stable across the mutation run and the sweep.

## v0.68.52 — Forecast Checkup "Unusual budget" made a real yes/no, with evidence

Device feedback: the "Unusual budget" prompt reads as a yes/no ("is this normal, or was it a one-off?") but its buttons were "Adjust budget" (an action) + "That's normal" (an answer) — a mismatch; and unlike the "Possible match" items, it showed no transactions behind the spike. Fixed both. The buttons are now the two **answers** — **"It was a one-off"** (green → opens the category to lower the budget) and **"That's normal"** (keep) — and each item shows a **"What &lt;month&gt; was"** transaction table (the spike month's actual transactions, largest first, date · payee · amount) so "was it a one-off?" is a look, not a guess. `lumpyCategories()` now returns the spike month's `txns` (scanned from the ledger); the question was reworded ("In Jun you spent $X here — a typical month is about $Y. Was that a one-off, or your normal?").

- **`verify-forecast-checkup.js` — 14/14 PASS** (added a June Home spike with real transactions): the reworded prompt, the "What Jun was" table (Roof repair $11,200), and the two answer buttons ("It was a one-off" → adjust, "That's normal").
- **1 new mutation (45→46), CAUGHT:** reverting the lumpy button to the action label instead of the yes/no answer.
- **Results this build:** full functional sweep **113/113 suites pass**; `verify-mutation.js` **46/46 caught, restored byte-exact**. Hash stable across the mutation run and the sweep.

## v0.68.51 — Add-screen "spent outside budget" clarity + breakdown

Device confusion: the banner fragment "+$3,103.43 unbudgeted" read like a *count of entries*. It's a **dollar total** of this month's spending in categories that aren't budget lines. Relabeled to **"$3,103.43 spent outside budget"** and made **tappable** — "See the $X spent outside your budget" opens a per-category breakdown (largest first; blank category → "Uncategorized") so you can see exactly which transactions fell outside the budget, e.g. to confirm a ledger re-categorization took effect. A transaction is "budgeted" only when its category matches a **budget** category name (trimmed/case-insensitive); a category that exists in the ledger but isn't a budget line, or a blank category, is "outside budget". Display-only — the total is unchanged and still reduces "left in this month's budget".

- **New suite `verify-unbudgeted-label.js` — 5/5 PASS.** The relabel ("$X spent outside budget"; the count-like "+$X unbudgeted" is gone); the tappable summary; the per-category breakdown (Mortgage / Uncategorized / PetSmart · Dog Food with their totals); a budgeted category's spend stays out of the breakdown; and largest-first ordering.
- **1 new mutation (44→45), CAUGHT:** relabeling back to the count-like "unbudgeted".
- **Results this build:** full functional sweep **113/113 suites pass**; `verify-mutation.js` **45/45 caught, restored byte-exact**. Hash stable across the mutation run and the sweep.

## v0.68.50 — envelope coverage: upcoming bills with a covered/short indicator

Requested from the device: "View envelopes" now lists each envelope's **upcoming bills** with a covered (✓) / short (⚠ "$X to go") indicator. `envelopeUpcoming(name)` gathers the bills an envelope is covering — its linked obligations if any, else the upcoming logged expenses in that category (this month forward) — and allocates the **current banked balance earliest-due-first** (a banked dollar covers the nearest bill first, never double-counted), marking each covered or short and rolling up "$X still needed across N upcoming bills" / "all N covered". A negative/overspent envelope honestly shows its bills unfunded. Read-only over tested pieces (`catObligations`/`catBalance`) — no engine change.

- **New suite `verify-envelope-bills.js` — 6/6 PASS.** Bills listed earliest-due-first; earliest-due-first coverage (first bills covered, last short); the shortfall equals total upcoming − banked (no dollar funds two bills); an overspent envelope's bills are unfunded; a linked envelope uses its curated obligations rather than raw rows; and the money card's "View envelopes" renders the ✓/short marks and the roll-up.
- **1 new mutation (43→44), CAUGHT:** marking every bill covered (ignoring the shortfall). *(While adding it, the harness caught that my new pool line collided with the multi-obligation mutation's find string — fixed by making `envelopeUpcoming`'s line textually distinct, restoring per-mutation uniqueness.)*
- **Results this build:** full functional sweep **112/112 suites pass**; `verify-mutation.js` **44/44 caught, restored byte-exact**. Hash stable across the mutation run and the sweep.

## v0.68.49 — Goals page shows what's available to appropriate

Device feedback: the Month tab says "$X safe to move to your goals," but the Goals page — where you actually allocate it — never showed that number. `renderGoals()` now **leads with a "Safe to move to your goals now" banner** carrying the exact `goalSafeToMove().safeToGoal` figure (the same one the Month card shows), with guidance to put it toward any goal via **Add money** or split it. A breach shows **$0 with the reason**, never a misleading positive. Display-only — it reads the existing engine and changes nothing.

- **New suite `verify-goals-safe-banner.js` — 5/5 PASS.** The Goals list leads with the banner; it shows the exact `goalSafeToMove` figure and it appears above the saved/committed summary; the guidance text is present; and a breach renders $0 with the floor reason (no positive number).
- **1 new mutation (42→43), CAUGHT:** dropping the banner from `renderGoals`.
- The audit suite caught a real omission during this build — VERSION bumped without a matching CHANGELOG line — which was then added (that's `verify-audit-v56.js`'s "inline changelog includes the current VERSION" check doing its job).
- **Results this build:** full functional sweep **111/111 suites pass**; `verify-mutation.js` **43/43 caught, restored byte-exact**. Hash stable across the mutation run and the sweep.

## v0.68.48 — Forecast Checkup fixes from real-device feedback

Three concrete issues from a phone screenshot, all fixed:

1. **Next month and beyond, and only real lumps.** A candidate is now a bill due in a *future* month (`mo > cm`) that also *exceeds that month's budget* — the current month's bills are covered by the current budget, and a bill within the monthly budget is ordinary spend, not a save-ahead lump. This kills the noisy false matches (an $87.75 bill against a ~$441 Travel budget).
2. **The buttons now work, and answers persist.** The old `onclick` inlined `JSON.stringify(...)` with double quotes inside a double-quoted attribute — malformed HTML, so "Link them" silently did nothing. Every action is now stashed by integer index (`ckLink`/`ckDismiss`/`ckAdjust`). "Not now", plus the new lumpy responses ("Adjust budget" opens the category; "That's normal" dismisses), persist via a new top-level `meta.checkupDone` (threaded through `normMeta`/`_metaBase`/`writeMeta`) so an answered prompt never returns.
3. **Transaction summary.** Each match now shows a "The bill" table — Due date, Payee, Category, Amount — so the bill is identifiable without a look-up.

- **`verify-forecast-checkup.js` — 13/13 PASS** (was 10): added the timing+budget filter (current-month and within-budget bills excluded), candidate metadata (date + payee captured), persistence (answering drops it from the scan and survives a `normMeta` round-trip), the registered handlers exist, and the render now includes the transaction table and buttons on both item types.
- **2 new mutations (40→42), both CAUGHT:** suggesting current-month bills (`mo<=cm` → `mo<cm`); re-nagging an answered prompt (ignoring `checkupDone`).
- **Results this build:** full functional sweep **110/110 suites pass**; `verify-mutation.js` **42/42 caught, restored byte-exact**. Hash stable across the mutation run and the sweep.

## v0.68.47 — multi-obligation sinking funds (final increment) + pop-up formatting audit

One envelope can now fund several future bills. The link stores `obligations[]` (`catObligations()` normalizes single-or-array, earliest-due-first; `catSinking` accepts either shape). The forecast engine `_cfSinkFree` is generalized: a month's contribution is freed as a reservation **iff** some linked bill is still due later **and** the month isn't itself a bill's due month (there the bill is the outflow and `max(bud,bill)` subsumes the contribution). `sinkingAllocation()` shows per-bill funding (banked + planned contributions flow to the nearest bill first; each dollar funds at most one bill). `checkupAddObligation()` / `checkupSetEnvelope({obligations})` write multi-bill links, cash-neutral.

- **New suite `verify-multi-obligation.js` — 7/7 PASS.** ENV-FC-004 (two bills each funded once, earliest-due-first, nothing double-counted; total funded never exceeds banked + contributions); ENV-FC-005 (an earlier bill consumes part of the fund, a later one sees only the remainder — $500 banked → Tires $500/short $400, Service $0); engine (safe-to-move rises by exactly the saving-months contributions, due months not freed); **every bill lands at full at its own due month** (Nov $900, Dec $1,200; a pure saving month frees the contribution → $0); single-bill back-compat (`obligations:[one]` ≡ legacy `obligation:{}`); `checkupAddObligation` converts single→multi sorted earliest-due-first.
- **2 new mutations (38→40), both CAUGHT:** allocation double-funding (pool not consumed by the earlier bill); freeing a contribution on a bill's own due month (understates the bill).
- **Formatting audit:** screenshotted the main pop-ups/tools with the app's real styles — the money card ("Your money right now"), the Decision Engine what-if picker, and the Ask Wren assistant all read cleanly (clear hierarchy, adequate spacing); no changes needed. The Forecast Checkup, the one crowded surface, was reworked in v0.68.46.
- **Results this build:** full functional sweep **110/110 suites pass**; `verify-mutation.js` **40/40 caught, restored byte-exact**; `verify-multi-obligation.js` 7/7; all single-obligation suites byte-identical. Hash stable across the mutation run and the sweep.

## v0.68.46 — Forecast Checkup formatting pass (display-only)

The review card was crowded and uniform in size. Reworked for hierarchy and breathing room: an eyebrow title + a **"N things worth a look"** headline; each item is a distinct block with an eyebrow tag (Possible match / Unusual budget), a bold category name, and a concise question; the before/after safe-to-move now sits in a **soft highlighted box on its own line** (large after-figure + green delta) instead of buried in a sentence; the oversized full-width green buttons are replaced by a compact **"Link them"** (`gbtn gprimary`) plus a **"Not now"** text link that dismisses the item in place. **No logic changed** — `forecastCheckup`/`checkupLinkDiff`/`checkupSetEnvelope` and every invariant are untouched; `verify-forecast-checkup.js` (10/10) render assertions were updated to the new copy. Full sweep **109/109**, `verify-mutation.js` **38/38 caught, byte-exact**.

## v0.68.45 — Forecast Checkup (increment 3 of 3): review-and-confirm migration

The migration surface for existing users — **nothing is auto-converted**. `forecastCheckup()` scans envelopes and flags: ones that may be saving for a specific future bill (a matching future logged bill exists), budgets that look unusually lumpy (`lumpyCategories()` — a one-time historical spike that would distort an average baseline, the −$36K guard), and ongoing spending envelopes. `checkupBillCandidates()` suggests matches (earliest-due, expenses only, never goal moves/deposits — ENV-FC-007) but never auto-links. `checkupLinkDiff()` shows the before/after safe-to-move a link would produce via a **dry run that reverts the cfg exactly**. `checkupSetEnvelope()`/`checkupUnlink()` write the classification (purpose/contribution/link, capturing the opening-funded balance at link time) and **move no cash**. `forecastCheckupHTML()` renders the review card; `renderCheckup()` mounts it on the Budget tab.

- **New suite `verify-forecast-checkup.js` — 10/10 PASS.** The scan is read-only (state.meta, ledger, net worth byte-identical after a full scan + dry-run diff); counts correct; the $6,000 Dec Tuition bill surfaced as the earliest-due candidate; lumpy flags the June $12,000 Home spike but NOT flat Groceries; the link diff reverts exactly; **classifying moves no cash** (net worth, envelope balance, ledger unchanged; opening-funded $1,500 captured) **while changing the forecast — and the committed result equals the diff the user was shown** ($34,700 → $36,200); unlinking reverts the forecast and keeps the balance; the card mounts into `#checkupSlot`.
- **2 new mutations (36→38), both CAUGHT:** the dry-run diff failing to revert (scan mutates state); the lumpy threshold gutted (flags ordinary flat budgets).
- **Results this build:** full functional sweep **109/109 suites pass** (incl. `verify-tab-layout` with the new Budget-tab slot); `verify-mutation.js` **38/38 caught, restored byte-exact**; `verify-forecast-checkup.js` 10/10. Hash stable across the mutation run and the sweep.

## v0.68.44 — sinking-fund forecast engine (increment 2 of 3)

The forward projection now reinterprets a **linked** sinking/split category's monthly `contribution` as a **reservation of existing cash**, not recurring spend, in the months from now up to (not including) the obligation's due month — so the money set aside monthly and the bill it funds are never double-counted. `_cfSinkFree(plan,m)` computes that per-month reservation; `computeCashflow` subtracts it from the current-month plan (via `max()`, so real actual spending still wins) and from each future month's baseline (`_cfFutureOut`). `goalSafeToMove` reads it.

- **New suite `verify-sinking-engine.js` — 7/7 PASS.** P1: a linked fund raises safe-to-move by **exactly the freed contributions** ($6,000 vs $4,500 = +$1,500 = `plannedContributionsBeforeDueDate`), bill still binds in December. P2: the **operational boundary** holds on the higher figure — move exactly safe → forward low lands on the floor; +$1 breaches. P3: **never inferred** — purpose "sinking" with no link, and "ongoing" with a link, both stay at the ordinary $4,500. P4 (ENV-FC-006): removing the link reverts to ordinary treatment. P5: a later due date frees more months (monotonic). P6 (ENV-FC-002): a bill small enough to be absorbed leaves safe unchanged. P7: a contribution above budget can't drive a month below zero outflow.
- **Strictly gated → zero regression:** `_cfSinkFree` returns 0 for any legacy/unlinked category, so the whole forecast is byte-identical without a real link — re-proven by the unchanged `verify-goal-safe`, `verify-hybrid-forecast`, `verify-money-now`, `verify-cashflow-current-month`, and the isolated-eval `golden-suite`/`golden-invariants` (kept green by `typeof` guards, no whitelist churn).
- **2 new mutations (34→36), both CAUGHT:** reinterpretation firing without the purpose gate (inferred); future contribution not freed from the baseline (double-count returns).
- **Results this build:** full functional sweep **108/108 suites pass**; `verify-mutation.js` **36/36 caught, restored byte-exact**; `verify-sinking-engine.js` 7/7. Hash stable across the mutation run and the sweep.

## v0.68.43 — sinking-fund data model (foundation, provably inert)

First slice of the sinking-fund/Forecast-Checkup work (build order: **data model → forecast engine → checkup UI**). Adds optional, prospective per-category semantics on `state.meta.cats[k]` — `purpose` ("ongoing"/"sinking"/"split"), `contribution` (monthly $ assigned to a linked obligation), and a `sinking` LINK (`{id, obligation:{id,name,amount,dueYear,dueMonth,source}, openingFunded, openingISO}`) tying an envelope to a specific future bill by **stable id**, capturing the banked balance **at link time** (no fabricated history). Read helpers clamp defensively; `sinkingSummary()` is the review read-model (already-banked / planned-before-due / expected-funded / remaining-unfunded).

- **New suite `verify-sinking-foundation.js` — 9/9 PASS.** Legacy defaults (no fields → purpose "ongoing", contribution $0, consumption = full budget, no link); defensive coercion (bogus purpose → "ongoing"; contribution above budget clamps to budget); split budget ($200 contribution → $300 consumption, total unchanged); `sinkingSummary` numbers ($1,500 banked + 3×$500 planned = expected $3,000 / remaining $3,000 on a $6,000 Dec bill); stable-id generator + opening-funded capture; **the load-bearing invariant — adding purpose + contribution + sinking to a category is byte-identical across safe-to-move, cash flow (end/low), net worth, envelope balance, and the reserve** (no engine reads these yet); and `normMeta` preserves the new fields verbatim through the save/load round-trip.
- **2 new mutations (32→34), both CAUGHT:** contribution not clamped to budget; split-consumption ignoring the contribution carve-out. Break-audited.
- **Results this build:** full functional sweep **107/107 suites pass**; `verify-mutation.js` **34/34 caught, restored byte-exact**; `verify-sinking-foundation.js` 9/9. app.html hash stable across the mutation run and the sweep.

## v0.68.42 — sinking-fund transparency (display-only) + test-harness repairs

- **New feature — sinking-fund transparency.** In "What's ahead," each logged known bill in an ENVELOPE category now shows how much of it is already banked in that envelope: *"$1,500.00 already banked in your Tuition envelope — already part of your available cash above; $4,500.00 of this bill isn't set aside yet."* The banked balance is attributed to a category's upcoming bills earliest-due first, so a banked dollar is never shown funding two bills. **Display-only:** it never touches `computeCashflow`, the reserve, or safe-to-move — the banked dollars are already inside "available cash now" and the bill draws them through the projection; crediting them against the bill again would double-count (the exact error this session set out to avoid).
- **New suite `verify-sinking-transparency.js` — 7/7 PASS.** Proves: banked = $1,500 exactly; December bill attributed $1,500 banked + $4,500 not-set-aside; the note renders with all three parts; **the invariant that matters — `goalSafeToMove().safeToGoal` is byte-identical envelope-vs-plain** (the note explains cash, never manufactures or destroys it); no note on a plain category; and no double-allocation when two bills share one envelope (total shown ≤ the balance).
- **2 new mutations (30→32), both CAUGHT:** over-attributing (shows the whole bill as banked) and reusing a banked dollar for two bills (no-consume). Break-audited.
- **Two pre-existing test-harness repairs discovered during the sweep** (neither an app-logic change): `golden-suite.js` extracted `computeCashflow` without the v0.68.40 hybrid helpers `_cfCatExp`/`_cfFutureOut` (same fix already applied to `verify-golden-invariants`) — added them to its extraction list; now 64/64. *(Also logged for honesty: an earlier in-session background run of the full sweep that INCLUDED `verify-mutation.js` was interrupted mid-mutation and left the `return r2(ta)` net-worth mutation applied, which transiently failed 10 net-worth suites; the harness's byte-exact restore was verified and app.html is clean — final hash matches above. The mutation harness is never again run inside a batch sweep.)*
- **Results this build:** full functional sweep **106/106 suites pass**; `golden-suite.js` 64/64; `verify-mutation.js` **32/32 caught, restored byte-exact**; `verify-sinking-transparency.js` 7/7.

**Environment:** headless Chromium (Playwright) on Node v22.22.2, Linux cloud container.

## Execution provenance (read this first)

These are **actual run results** from executing the suites against the exact build above (verify the hash against `app.html`). Not a design review.

- ✅ Every suite below ran to completion and reported the pass/fail counts shown.
- ✅ `verify-mutation.js` ran with its **validity gate**: baseline clean → mutant fails **by assertion** → restored clean; a missing-dependency / browser-launch / syntax / timeout crash is reported INVALID, never "caught."
- ⚠️ These ran in **headless Chromium in a Linux cloud container** — NOT on Safari/iPhone, Chrome/Android, or any physical device.
- ⚠️ `verify-perf.js` numbers are a **relative regression baseline**, not device timings.
- ⚠️ **No suite here proves live two-device simultaneous-write atomicity or real-device UX.** Client-side Google Sheets row reservation is not a server-side compare-and-swap; that remains a documented architectural boundary requiring real-device / backend validation. It is not something this harness claims to prove.

## Headline

| | |
|---|---|
| Test files | **105** (104 functional suites + mutation) |
| Functional suites | **104 / 104 pass**, 0 failed |
| Total assertions | **~1,015** (819 `passed`-style + 64 golden invariants + 133 Wren-golden) |
| Randomized households (fuzz) | **9,000**, 9/9 identity invariants |
| Beta-readiness harnesses | new-user journey **6/6**, household journeys (H1,H3–H8) **8/8**, chaos-user **9/9**, first-run tour timing **5/5** — each break-audited |
| Goal-funding (planned vs supportable) | helper golden **18/18** (incl. GF-007…GF-012 cross-category offset and GF-013…GF-018 unbudgeted consumption), engine reconciliation **8/8**, contingency↔goals narration **8/8** (incl. CASE 7 coverage↔goal consistency) — full cash identity reconciles; each break-audited |
| Safe-to-move-to-goal (the answer panel) | helper suite **9/9** — binding-boundary **simulation** (move it → forward low lands exactly on the floor; +$1 breaches), floor-awareness, single-source/no-double-count, breach, extra-income, sensitivity, Wren-same-helper — break-audited |
| Information architecture (Plan / Outlook split) | tab-layout **7/7** — tab-bar order + labels, each card in the correct view (setup on Plan, answers on Outlook), the split is clean (answers not on Plan), and the legacy "budget" nav target still lands on Plan — break-audited |
| Information architecture (six-tab consolidation) | tab-layout **9/9** — Budget=setup, Month=the safe-to-move answer + buffer + this-month, Worth=net worth + cash-flow forecast + feasibility; each card verified in its home, the safe-to-move answer proven to render on Month, and the retired plan/outlook targets still resolve — break-audited |
| Add-screen deposit progress (income vs plan) | deposit-progress **7/7** — received/planned shown, "+$X above plan ✓" / "$Y still expected" / "right on plan ✓", the above-plan amount is never called surplus/free/available/left over, and the top card says "left in this month's budget" — break-audited |
| "Your money right now" (whole-cash reconciliation) | money-now **8/8** — the provable identity available === reserve + floor + safe, the safe figure single-sourced from goalSafeToMove, reserve = available − forwardLow (no double-count), the breach path, and the expandable as explanation-only — break-audited |
| Hybrid forecast (recurring baseline + known dated bills) | hybrid **8/8** — logged==budget counts once, larger adds only the increment, smaller never below baseline, multiple bills, no-baseline full-add, reschedule moves safe-to-move, envelope no double-reserve, unlogged categories keep baseline — break-audited |
| Mutation (validity-gated, run alone) | **30 / 30 CAUGHT by genuine assertion failure**; app.html restored byte-exact |

## The requested release-artifact suites (explicit)

| Suite | Result |
|---|---|
| `verify-write-contract.js` | **10 / 10** — TXN-EDIT-002, TXN-DELETE-001, META-SAVE-001, META-PEND-001, NW-ATOMIC-001 + structural guards |
| `verify-migration.js` | **22 / 22** — corpus-driven (8 checked-in fixtures), financial-fingerprint preservation, idempotency, backup, fail-safe, mid-session write-lock |
| `verify-idempotent.js` | **8 / 8** — single + **multi-row** durable-id append, ambiguous-write reconcile, PERSIST-IDEMP-002 (fail-closed marker) |
| pending-meta reconciliation | covered in `verify-write-contract.js` (META-PEND-001) + `verify-migration.js` |
| `verify-golden-invariants.js` | **64 / 64**, 0 fail |
| `verify-property.js` | **8 / 8** |
| `verify-goal-safe.js` | **9 / 9** — operational proof of "safe to move to goal" (simulate the move, re-run the full projection, forward low lands on the Nest Egg Floor; $1 more breaches) |
| `verify-money-now.js` | **23 / 23** — the one consolidated card: identity available = reserve + floor + safe, **floor-independence proof** (reserve unchanged as the floor varies), single hero, This-month + Protection from the canonical helpers, no "surplus"/"cash remaining", breach path |
| `verify-tab-layout.js` | **9 / 9** — six-tab layout: Budget=setup + "does this budget work?" at top, Month=safe-to-move + buffer + this-month, Worth=net worth + cash-flow forecast; card homes verified, plan/outlook aliases |
| `verify-deposit-progress.js` | **7 / 7** — Add-screen deposit progress: received vs planned, above/below/exact wording, forbidden-words rule, budget-capacity relabel |
| `verify-fuzz.js` | **9 / 9** over **9,000** randomized households |
| `verify-wren-golden.js` | **122 / 122 cases · 133 / 133 assertions** |
| `verify-mutation.js` (validity gate) | **25 / 25 CAUGHT**, byte-exact restore |
| `verify-chaos.js` | **9 / 9** (single-client fault injection) |
| `verify-security.js` | **18 / 18** |
| `verify-starter-share.js` | **20 / 20** (fail-closed sharing) |
| `verify-pullin.js` | **33 / 33** (incl. PULL-RECOVERY-001 + `= + - @` tab/CR sanitation table) |
| `verify-a11y.js` | **10 / 10** (code-level; NOT a screen-reader certification) |
| `verify-perf.js` | **5 / 5** (headless baseline, 1k–100k rows) |
| `verify-new-user-journey.js` | **6 / 6** — clean-start journey, *user-sees = engine = persisted* oracle |
| `verify-household-journeys.js` | **8 / 8** — stranger households H1, H3–H8 (variable income, tight cash, high debt, refunds, residual, uncategorized) |
| `verify-chaos-user.js` | **9 / 9** — misuse / malformed input / double-tap / archive-with-money / delete-source |
| `verify-firstrun-tour.js` | **5 / 5** — the auto-tour defers past the first-run choice (v0.68.13 fix) |
| `verify-goal-funding.js` | **18 / 18** — planned vs supportable residual: under/on-plan, envelope-self, shared-contingency, uncovered, floor + **GF-007…GF-012 cross-category offset** + **GF-013…GF-018 unbudgeted/uncategorized consumption** (reduces residual, partial offset by under-room, exceeds→$0+overflow, uncategorized≡named, refund restores, goal-move-not-consumption); reconciliation invariants |
| `verify-goal-funding-reconcile.js` | **8 / 8** — engine-level cash identity across every goal type (fixed, category-linked, residual, capped) + coverage layer + floor + **unbudgeted consumption** (C = canonical actual consumption) |
| `verify-contingency-goals.js` | **8 / 8** — Review + Wren narrate planned-vs-supported honestly; order fix, no vacuous $0.00 line, buffer-over contingency-buffer note, **CASE 7 coverage↔goal consistency on an offset month** |
| `verify-contingency-history.js` | **11 / 11** — Wren TEMPORAL contingency questions + the CAUSAL "despite my deposit, why no contingency?" (a deposit doesn't build the pool — only unspent buffer budget does; with a non-hijack control): `getContingencyFacts()` month-by-month history + firstNegativeMonth/lastPositiveMonth; "when did it become overspent?" names the month (≠ the current-state answer); "how much is in my contingency after my bills?" is a clean balance/available/why answer (no uncovered-envelope or year-end over-answer) |
| `verify-cashflow-current-month.js` | **5 / 5** — proves the "so far + plan" current-month net does NOT double-count income or produce a catch-up artifact: income = max(actual, plan) counted once, outflow = max(actual, plan), net only SHRINKS as spending is logged |
| `verify-cashflow-presentation.js` | **5 / 5** — column reads "Projected cash" (not "Balance"); a $0 Starting savings shows a trend-not-cash note; an overspent contingency is surfaced alongside so a positive projected total isn't misread as "all covered" |
| `verify-cash-allocation.js` | **14 / 14** — (incl. CASH-ALLOC-013/014 the optional contingency TARGET: repair → build toward target → residual) SURPLUS ALLOCATION: monthlyCashReconciliation() (income → consumption → protected goals → REPAIR entering contingency deficit → residual → reserves); CASH-ALLOC-001…012 incl. the exact identity, refund/goal-move/three-paycheck, and the no-double-count (only the ENTERING deficit is repairable) |
| `verify-wren-cash-alloc.js` | **8 / 8** — Wren routes "projected cash" to the cash-flow projection (not spending pace) and answers the allocation follow-up "will it go into contingency or fund my goals?" from the reconciliation — resolving "it" to the prior fact, both halves, direct answer first |
| `verify-cash-recon-card.js` | **6 / 6** — the surplus reconciliation is VISIBLE: the Contingency card draws a "where this month's cash is going" waterfall + the raw/repaired/effective contingency distinction, straight from monthlyCashReconciliation() (no duplicated math); no-surplus month shows the reserve draw; no card until a deposit lands. Rendered-screenshot check |
| `verify-cross-surface-recon.js` | **5 / 5** — cross-surface reconciliation language: when a month's surplus can repair an overspent contingency, the Cash-Flow verdict, the Month buffer-over line, and Wren's deposit answer ALL say so (from one shared helper) and none keeps the old "comes out of cash / doesn't refill it / won't move it" contradiction |
| `verify-contingency-trend.js` | **6 / 6** — the contingency history is now VISIBLE: the Contingency card draws a month-by-month bar sparkline (green above / red below the zero line) with the crossing month highlighted and a caption naming it; healthy buffer reads "in the black"; no chart when there's no buffer |

**All requested suites executed on v0.68.41 and passed.**

## Full per-suite output (all 93 files)

```
verify-a11y.js                   10 passed, 0 failed   (code-level; not a screen-reader cert)
verify-adopt-itemized.js         4 passed, 0 failed
verify-adversarial.js            26 passed, 0 failed
verify-append-concurrency.js     3 passed, 0 failed
verify-audit-v56.js              12 passed, 0 failed
verify-audit2.js                 4 passed, 0 failed
verify-audit3.js                 6 passed, 0 failed
verify-audit4.js                 5 passed, 0 failed
verify-audit5.js                 6 passed, 0 failed
verify-backup.js                 3 passed, 0 failed
verify-bill-breakdown.js         3 passed, 0 failed
verify-breakdown-sync.js         8 passed, 0 failed
verify-carry.js                  6 passed, 0 failed
verify-catyear.js                4 passed, 0 failed
verify-chaos.js                  9 passed, 0 failed
verify-chaos-user.js             9 passed, 0 failed   (misuse / malformed input)
verify-contingency-coverage.js   25 passed, 0 failed
verify-contingency-goals.js      8 passed, 0 failed   (narration + order + buffer-note + coverage↔goal consistency)
verify-coverage.js               12 passed, 0 failed
verify-decisions-ui.js           13 passed, 0 failed
verify-decisions.js              7 passed, 0 failed
verify-discover.js               4 passed, 0 failed
verify-dropdowns.js              13 passed, 0 failed
verify-effortless.js             4 passed, 0 failed
verify-engine-invariants.js      3 passed, 0 failed   (FIN-ASOF-001/002, FIN-NW-001)
verify-erase-key.js              4 passed, 0 failed
verify-fixes.js                  6 passed, 0 failed
verify-firstrun-tour.js          5 passed, 0 failed   (auto-tour defers past first-run)
verify-fold.js                   5 passed, 0 failed
verify-formpref-profile.js       6 passed, 0 failed
verify-freshness.js              4 passed, 0 failed
verify-fuzz.js                   9 passed, 0 failed   (9,000 randomized households)
verify-gemini-share.js           4 passed, 0 failed
verify-goal-cap.js               9 passed, 0 failed
verify-golden-invariants.js      64 total, 0 fail
verify-golden.js                 12 passed, 0 failed
verify-goal-funding.js          12 passed, 0 failed   (planned vs supportable + GF-007…012 cross-category offset)
verify-goal-funding-reconcile.js 7 passed, 0 failed   (engine cash identity, all goal types)
verify-grow.js                   7 passed, 0 failed
verify-hidecat.js                8 passed, 0 failed
verify-household-journeys.js      8 passed, 0 failed   (stranger households H1,H3-H8)
verify-idempotent.js             8 passed, 0 failed
verify-import-income.js          4 passed, 0 failed
verify-income-calendar.js        13 passed, 0 failed
verify-income-direct.js          4 passed, 0 failed
verify-income-freq.js            6 passed, 0 failed
verify-income-suggest.js         4 passed, 0 failed
verify-income.js                 5 passed, 0 failed
verify-itemized-tag.js           6 passed, 0 failed
verify-lastpick.js               9 passed, 0 failed
verify-ledger-norm.js            5 passed, 0 failed
verify-ledger.js                 4 passed, 0 failed
verify-life-changes.js           7 passed, 0 failed
verify-manualupd.js              6 passed, 0 failed
verify-midyear-pay.js            13 passed, 0 failed
verify-migration.js              22 passed, 0 failed
verify-model.js                  4 passed, 0 failed
verify-nest-review.js            14 passed, 0 failed
verify-new-user-journey.js       6 passed, 0 failed   (clean-start 3-way oracle)
verify-optimize.js               8 passed, 0 failed
verify-overbudget-sign.js        3 passed, 0 failed
verify-parent-chip.js            7 passed, 0 failed
verify-percheck-chain.js         23 passed, 0 failed
verify-percheck.js               8 passed, 0 failed
verify-perf.js                   5 passed, 0 failed   (relative baseline)
verify-property.js               8 passed, 0 failed
verify-pullin.js                 33 passed, 0 failed
verify-recent-monthscope.js      2 passed, 0 failed
verify-recent-sort.js            3 passed, 0 failed
verify-recent-switch.js          6 passed, 0 failed
verify-reconcile.js              5 passed, 0 failed
verify-scan-fallback.js          4 passed, 0 failed
verify-search-type.js            3 passed, 0 failed
verify-security.js               18 passed, 0 failed
verify-session.js                5 passed, 0 failed
verify-sharewiz.js               6 passed, 0 failed
verify-starter-share.js          20 passed, 0 failed
verify-tabbar.js                 8 passed, 0 failed
verify-table-grow.js             3 passed, 0 failed
verify-tour.js                   15 passed, 0 failed
verify-trim.js                   5 passed, 0 failed
verify-update.js                 6 passed, 0 failed
verify-version.js                9 passed, 0 failed   (version-format & update-comparison logic; not tied to a specific build)
verify-wizard-preserve.js        8 passed, 0 failed
verify-wren-analyze.js           8 passed, 0 failed
verify-wren-analyze2.js          8 passed, 0 failed
verify-wren-analyze3.js          19 passed, 0 failed
verify-wren-golden.js            122/122 cases · 133/133 assertions
verify-wren-residual.js          6 passed, 0 failed
verify-wren-unified.js           5 passed, 0 failed
verify-wren.js                   20 passed, 0 failed
verify-write-contract.js         10 passed, 0 failed
verify-mutation.js               12/12 CAUGHT (run alone) · app.html restored byte-exact
```

## What's new since the prior report (v0.68.10 → v0.68.41)
- **Hybrid forward forecast (v0.68.40–41)** — the projection no longer treats the budget as if it already held every future one-time bill, nor ignores bills you’ve logged. Future months = **recurring baseline (budget) + incremental known dated bills**, deduplicated per category (`max(baseline, Σ logged bills)`): logged==budget counts once; larger adds only the increment above baseline; smaller never drops below baseline (unlogged groceries never vanish); no-baseline adds in full. `goalSafeToMove()` reads it, so safe-to-move tracks your real upcoming calendar and moves when you schedule/remove a bill. The “What’s ahead” breakdown shows each month as *recurring · known bills · income* with a “See [month]’s known bills” expander listing the scheduled transactions (and a note when a category’s baseline already covers part of a bill, so the increment is never mistaken for the whole). New `verify-hybrid-forecast.js` (8), break-audited; run through the real Holland ledger, which surfaces December’s logged tuition as a *known bill* on top of the recurring baseline.
- **Multiple goals handled honestly (v0.68.39)** — the safe-to-move figure is goal-*agnostic* (the total household cash you can move to any savings/goal today, not a per-goal amount), but the card and Wren were naming the first goal even when several existed. New `goalMoveName()` (one source): one goal → names it; several → "your goals"; none → "savings". With 2+ goals the card adds "…put it toward any one goal, or split it across them." `verify-money-now.js` → 23.
- **Money-card layout tidy (v0.68.38)** — money values on the right hold on one line (`white-space:nowrap`, tabular figures, no shrink), so a long label can no longer split "−$3,800.00" across rows or run into the amount; the label wraps on its own side instead. Dropped "· through Dec" from the collapsed "Reserved for what's ahead" row (it already heads the expansion), keeping the waterfall one clean line per row. Layout-only — no number or logic changes; all suites unchanged and green.
- **Money card refinements (v0.68.37)** — residual goal funding moves out of *Your protection* into a new *Your goals* section (it's savings capacity, not a reserve); *Available cash now* and *Nest Egg Floor* become tappable for provenance/definition; contingency and envelopes gain one-line descriptors; the redundant "stay protected" subtext is removed so the collapsed waterfall reads like a calculator; "Where did the extra go?" → "Where is my extra going?" with plain-English forward wording. Crucially, `verify-money-now.js` now **proves contingency/envelopes are not double-reserved**: the safe figure is *identical* whether a category is plain, an envelope, or a buffer — roll designations are labels on cash already in the projection, never extra deductions. (17 → 19.)
- **"Reserved for what's ahead" now shows what IS ahead (v0.68.36)** — tapping the reserve row opens a month-by-month reconciliation instead of a methodology paragraph. New `reserveBreakdown()` attributes to each future month (through the tightest month) the amount that drives your projected cash to a NEW LOW below today; those "cash needed from today" figures are non-negative and **sum EXACTLY to the displayed reserve** (proven — a break-audited mutation fails if they don't). Each month shows its planned expenses & commitments and the income arriving; the methodology paragraph is demoted behind a secondary "How is this calculated?" disclosure, giving the hierarchy *what's ahead → why today's cash covers it → how it's computed*. Wording changed from "bills" to "planned expenses and commitments" since the forward model includes variable spending, envelopes and goal commitments. `verify-money-now.js` → 17.
- **Money card: single answer + inline reserve disclosure (v0.68.35)** — the floating hero safe-number at the top is removed; the one answer is now the conclusion of the waterfall ("Safe to move to [goal]" in large green), shown once where the math earns it. The "Reserved for what's ahead" row *is* the dropdown now — tapping it opens, right there, what the reserve protects: of your available cash, how much must stay for upcoming bills and the floor, and whether anything more needs to be set aside before your tightest month (nothing, when covered). `verify-money-now.js` → 12 (adds the inline-reserve-disclosure guard).
- **One consolidated "Your money right now" card on Month (v0.68.34)** — the safe-to-move card and the separate "Contingency & envelopes" card are merged into a single card that tells one financial story with progressive disclosure, so the screen never shows four competing "money remaining" numbers. Order: (1) the answer — one hero "$X safe to move to [goal]"; (2) why — the AUTHORITATIVE, floor-INDEPENDENT waterfall *available → reserved for what's ahead → Nest Egg Floor → safe* (proven: as the floor varies, the reserve and forward-low are unchanged — only safe moves — so the floor is never double-counted, and every figure comes straight from goalSafeToMove); (3) *This month* — deposits, actual spending, **Cash not yet spent** (the misleading "Surplus to allocate" is gone); (4) *Your protection* — contingency available, banked in envelopes, residual goals supportable (from computeRollover / goalFundingStatus). The contingency trend chart, per-envelope balances, "what the reserve protects" and "where did the extra go" move behind expandables — **nothing removed, just disclosed progressively**. No duplicate safe figure; no "cash remaining" competing with the safe number. The standalone Contingency card and the old "where this month's cash is going" waterfall are retired (its reconciliation math stays covered by `verify-cash-allocation.js`); `verify-money-now.js` grew to 11 (incl. the floor-independence proof) and `verify-contingency-trend.js` now verifies the chart both as produced and as embedded in the money card.
- **"Does this budget work?" moves back to the top of Budget (v0.68.33)** — the annual-feasibility verdict (Feasible / deficit, the yearly surplus, income − budget − goals) plus Run-a-what-if now sit at the TOP of the Budget tab, right above your categories — so the moment you set the plan you see whether it balances. The month-by-month cash-flow FORECAST stays on Worth (the forward/big-picture tab), and the feasibility copy now points there ("see Cash flow through the year on the Worth tab"). Pure IA move: `renderFeas` and every handler are unchanged (same `#feasBody` / `#decOpenBtn`). `verify-tab-layout.js` updated to assert feasibility on Budget and the clean split.
- **"Your money right now" — whole-cash reconciliation on Month (v0.68.32)** — the Month tab now answers *"where is my money committed, and what is safe to move?"* by reconciling your WHOLE available-cash position, not just this month's above-plan income. The primary panel is a provable identity read straight from the forward projection: **available cash === must-stay-for-what's-ahead (reserve) + Nest Egg Floor + safe-to-move**. It cannot double-count — upcoming bills, envelope set-asides and goal holds are already inside the projection (hence inside the reserve), so they're named there, never subtracted again — and the safe figure is the exact same `goalSafeToMove` number. The above-plan deposit is shown as CONTEXT ("you brought in $X more than planned"), and an expandable *"Where did the extra $X go?"* traces this month's income through `monthlyCashReconciliation` as EXPLANATION only, never the source of the safe number — so there's no false one-to-one attribution. New `moneyRightNow()`/`moneyNowHTML()`; `verify-money-now.js` (8) proves the identity, single-source safe, no-double-count, breach, and explanation-separation, break-audited.
- **Tabs consolidated — no new tab (v0.68.31)** — the v0.68.29 "Outlook" tab is retired; NestWorth reuses the six tabs it had, each mapped to what it answers. **Budget** = the plan you set (the "Plan" label reverts to Budget). **Month** = the current outlook — it now leads with the one answer that matters, *"how much is safe to move to your goal today,"* plus the contingency buffer, above the usual this-month spending. **Worth** = the forecast / big picture — net worth over time PLUS cash flow through the year, "does this budget work?", and run-a-what-if. Tab bar back to six: Add · Month · Budget · Goals · Worth · Settings. Wren's "Show me" re-points accordingly (setup→Budget, buffer/this-month/safe-to-move→Month, cash-flow/afford/decision/feasibility→Worth); `switchView` keeps "plan"/"outlook" as back-compat aliases. Card IDs and every render/handler are unchanged — pure information architecture, engines untouched. `verify-tab-layout.js` rewritten (9) and break-audited by a mutation that stops the safe-to-move answer rendering on Month; tour/pull-in/model/wren tests updated for the six-tab layout.
- **Add-screen deposit clarity (v0.68.30)** — deposit progress now says what happened vs the plan instead of just "met target." A source reads "$9,797.11 received / $8,297.73 planned" then, explicitly, "+$1,499.38 above plan ✓" (or "$797.73 still expected" when short, "right on plan ✓" when exact). "Target" is gone — it read like a savings minimum; the plan-expected income is now "planned." The above-plan amount is deliberately NOT called surplus / free / available / left over: it means only that more income arrived than planned; whether any is safe to move to a goal is the forward projection's job (Month tab). The top card tightened to "$X left in this month's budget" (spending-budget capacity, not cash on hand). Three concepts kept strictly separate: budget-remaining ≠ income-above-plan ≠ safe-to-move. New verify-deposit-progress.js (7), break-audited.
- **Information architecture: the Budget tab is split into Plan + Outlook (v0.68.29)** — the single "Budget" tab had been doing four jobs in one scroll (feasibility, cash-flow projection, category setup, income setup), with the setup sandwiched in the middle, so a non-expert scrolled past the answers to reach the setup and vice-versa. It's now two tabs organized by what a person walks in to do. **Plan** = the inputs you set rarely: categories, expected income, contingency/envelope rules, quick setup, the year picker. **Outlook** = the answers you check often, answer-first: the intro states the three questions, then cash flow through the year with the *safe-to-move-to-goal* panel and bills-covered verdict, the contingency buffer, and "does this budget work?" + run-a-what-if. Tab bar is now Add · Month · Plan · Outlook · Goals · Worth · Settings; Month stays the rear-view mirror. Wren's "Show me" was reclassified across 77 answer targets so it lands on the right tab (setup → Plan, cash/buffer/goal/decision → Outlook), and `switchView` keeps "budget" as a back-compat alias for Plan. New `verify-tab-layout.js` (7) proves each card's home and the tab-bar structure, break-audited; tour/pull-in tests updated for the extra tab.
- **The answer panel — "safe to move to goal" (v0.68.28)** — NestWorth now answers one question directly: *how much can I move to my goal account today without any future month's projected cash falling below my Nest Egg Floor?* New `goalSafeToMove()` reads the EXISTING forward cash-flow projection (`computeCashflow`, single source of truth) and returns `safe = max(0, forwardLow − floor)` where `forwardLow` is the lowest projected balance from the current month forward and `floor` is the configured Nest Egg Floor (not $0). Because the number is read straight off the projection — which already contains future bills, envelope set-asides, banked balances, contingency effects, protected/linked/residual goals and future income on real timing — nothing is subtracted twice. Proven **operationally** in `verify-goal-safe.js`: move exactly the safe amount as a one-time outflow, re-run the full projection, and the forward low lands **exactly on the floor**; one dollar more breaches it. Rendered at the top of the Cash Flow card (bills covered ✓ · lowest projected cash after today · your floor · Safe to move to [goal]) with a plain sentence and a $0-starting-savings caveat. Wren answers "how much can I safely move to my car fund?" from the SAME helper. New mutation (safe-to-goal ignores the floor → uses $0) break-audited, caught by `verify-goal-safe.js`.
- **Contingency state-model + language finish (v0.68.27)** — a product pass (no accounting rewrite). The Contingency card leads with **"Contingency available now $0"** and shows RAW (history) vs "Covered by this month's surplus" vs "Effective balance" beneath (replacing "Effective if applied"), explaining the surplus covers the shortfall *for planning* without rewriting history and saying plainly when a month got you out of the hole but hasn't built a cushion above $0. Month reminders stop repeating the whole deficit per category (short "covered by this month's cash surplus" + one household line); the Cash-Flow verdict uses the reconciled sentence; the recon card's intermediate total is renamed "Cash remaining after that" with a note that it's NOT the Cash-Flow projected month-end figure. NEW optional **contingency target**: after repairing to $0, surplus builds a positive cushion toward the target before residual goals (identity preserved; target 0 = unchanged). CASH-ALLOC-013/014 + cross-surface/recon-card cases, break-audited.
- **Cross-surface reconciliation language (v0.68.26)** — after the engine learned a month's surplus can repair an overspent contingency, several surfaces still contradicted the Contingency card by saying "overspent, $0 available, comes out of cash / doesn't refill it / the deposit won't move it". No engine change: new single-source helpers `contingencyReconNote()`/`contingencyReconSentence()` describe the reconciled reality once, and the Cash-Flow verdict, the Month buffer-over coverage line, and Wren's deposit answer all speak from it — surplus-can-repair when there's a surplus, the old language only when there genuinely isn't. `verify-cross-surface-recon.js`, break-audited.
- **Surplus reconciliation is now visible (v0.68.25)** — the product step after v0.68.24's engine. The Contingency card draws a "where this month's cash is going" waterfall (deposits → spending → protected goals → surplus → contingency repaired → residual → remaining) with a one-line interpretation, and distinguishes RAW contingency, what this month's surplus can repair, and the EFFECTIVE position if applied — so a historical negative buffer no longer reads as "the surplus didn't matter". It renders straight from `monthlyCashReconciliation()` — the same helper Wren narrates, no duplicated math. `verify-cash-recon-card.js` (6 cases, break-audited, rendered-screenshot check).
- **Surplus allocation — the missing inverse of expense coverage (v0.68.24)** — NestWorth modelled where an overage comes from, but had no authoritative answer to where excess cash goes when actual income exceeds the month's requirements. New computed (non-writing) `monthlyCashReconciliation()`: income → consumption → protected fixed/linked goals → repair the contingency deficit → residual → reserves, with an exact identity. Correctness point caught while building: only the deficit ENTERING the month is repairable from that month's surplus — the current month's own buffer overspend is already in consumption, so repairing the current end-of-month deficit would double-count it (the auditor's example used the entering position, which is what `rawBuffer` is). Wren now routes "projected cash" to the cash-flow projection and answers the allocation follow-up from the reconciliation (resolving "it" to the prior figure, both halves, direct answer first). `verify-cash-allocation.js` (CASH-ALLOC-001…012) + `verify-wren-cash-alloc.js` (WREN-CASH-001…008), break-audited. Deferred: surfacing this in the Contingency card / Decision Engine UI, and floor-aware multi-month reconciliation.
- **Wren answers the causal deposit↔contingency question (v0.68.23)** — "despite the large deposit in July, why do I still have no contingency?" used to get the generic overspent-state answer, which never addressed the premise. A deposit doesn't build the contingency pool — only unspent buffer-category budget does (income/deposits go to cash and net worth). Wren now corrects that directly and, when overspent, says rebuilding needs buffer categories under budget, not another deposit. Guarded so a plain "will my paycheck cover the overage?" still routes to coverage. `verify-contingency-history.js` +2 cases, break-audited.
- **Unbudgeted/uncategorized consumption now reduces supportable residual (v0.68.22, adversarial audit)** — `goalFundingStatus()`'s inputs were all budget-line based, so a transaction in a category with no budget line, or an uncategorized expense, was real cash consumption (canonical `monthActualTotals` includes it) that never reduced residual capacity. New `unbudgetedConsumption()` sums this month's expense rows not in any budgeted category (uncategorized included; refunds net down; goal movements excluded), folded into the no-cushion cash pressure net of plain under-budget room — budgeted categories skipped so nothing double-charges, and the full cash identity still reconciles. `verify-goal-funding.js` GF-013…GF-018 + a reconcile identity case, mutation-audited.
- **Contingency history is now VISIBLE on the card (v0.68.21)** — v0.68.19 gave Wren the month-by-month history to narrate, but there was nowhere to *see* it. The Contingency card now draws a compact bar sparkline of the pooled buffer's month-end balance across the completed months (green above the zero line, red below), highlights the month it first crossed negative, and captions it in plain language. It reads from the same `getContingencyFacts()` history Wren narrates, so the picture and Wren's answer can't disagree. `verify-contingency-trend.js` (6 cases, break-audited, with a rendered screenshot check).
- **Cash-flow clarity + a decomposition proof (v0.68.20, from real-use confusion)** — a user asked how the cash-flow BALANCE could be positive while contingency is overspent. Two different pools: the running total is projected *cash*, the contingency is a budget buffer. The column is renamed **"Projected cash"**, a **$0-Starting-savings** note flags that the figures are a trend from an artificial $0 baseline (not cash on hand), and an overspent contingency is now surfaced beside the projection so a positive trend isn't read as "all covered". Crucially, before assuming it was only labeling, the large recovering month (July −$20k → August +$20.5k) was **investigated**: `verify-cashflow-current-month.js` proves the current-month "so far + plan" net does NOT double-count income and is NOT a catch-up artifact — income = max(actual, plan) counted once, and the net only shrinks as real spending is logged. It's a real deposit already received; the math is correct, the ambiguity was the label. Both new suites break-audited with permanent `verify-mutation.js` entries.
- **Wren temporal-contingency routing (v0.68.19, found by ordinary use)** — "When did my contingency become overspent?" is a TIME question and was being answered as the STATE question "IS it overspent?" (repeating the current −$X balance). New engine helper `getContingencyFacts()` exposes the month-by-month pool history + `firstNegativeMonth`/`lastPositiveMonth`/carry-in/biggest-drop; Wren narrates it (narrator-not-calculator) so a temporal question names the month it first crossed negative, and the state question "how much is in my contingency after my bills?" gives a clean balance/$0-available/why answer instead of dumping uncovered-envelope and year-end lines. Break-audited: `verify-contingency-history.js` (9 cases) + a permanent `verify-mutation.js` entry (removing the temporal route makes it fail). This closes a Wren golden-test gap: current-state contingency was heavily tested, but historical-transition questions were not.
- **Cross-category offset fix in `goalFundingStatus()` (v0.68.18)** — an adversarial audit found a seventh scenario the six goal-funding tests missed: one category over budget while another is under by an offsetting amount (Living +$100 / Dining −$100 → the household spent exactly its plan, `coverageReport().monthLeft = $0`). The model was charging the **gross** $100 overage to cash and wrongly reporting residual saving as reduced ($1,000 planned → $900 supported). It now nets a plain category's overage against genuine under-budget slack in **other plain categories** (`cr.fixedTot − cr.underRoom`) before deciding what truly hits cash, and the "Can you cover it?" coverage line was made consistent so coverage and goal-funding can no longer contradict each other on an offset month. Envelope self-coverage and shared contingency stay distinct and non-double-counted, and the household cash identity still reconciles. Break-audited: `verify-goal-funding.js` GF-007…GF-012, `verify-contingency-goals.js` CASE 7, and a permanent entry in `verify-mutation.js` (restoring the gross behavior makes GF-007/008 and CASE 7 fail). Whether plain slack should also offset an **envelope/buffer deficit** is deliberately left to future reconciliation work.

- **Application-wide verified-write contract** — `writeMeta` root fix (baseline advances only on confirmed persistence; failures surface a retry banner and are durably recoverable), transaction edit/delete refuse on unverified row identity, atomic net-worth save, expense/recurring writes on the durable-id path. (`verify-write-contract.js`.)
- **Formal schema migration** — `schemaVersion`, ordered idempotent migrations, pre-migration backup, fail-safe + write-lock on a newer schema, financial-fingerprint preservation across a **checked-in fixture corpus** (`fixtures/meta/`). (`verify-migration.js`.)
- **Beta-readiness harnesses** — clean-start new-user journey with the *user-sees = engine = persisted* oracle, stranger-household journeys (H1, H3–H8), and a chaos-user misuse suite; each break-audited. (`verify-new-user-journey.js`, `verify-household-journeys.js`, `verify-chaos-user.js`.)
- **Month "Can you cover it?" clarity (v0.68.16 → v0.68.17)** — from real-use feedback: over-budget list renders before the coverage assessment; the vacuous "planned $0.00 of residual saving is fully supported" line is suppressed when there's no leftover pool; and a buffer category over its monthly budget is shown in the assessment with a "covered by your shared contingency buffer" note (option B) instead of a bare alarm — so every over-budget row now has a matching coverage answer. (`verify-contingency-goals.js`.)
- **Onboarding fix (v0.68.13)** — the auto-tour no longer launches over the first-run choice; it waits for the user to pick a path and land on a clear screen. (`verify-firstrun-tour.js`.)
- **Contingency ↔ goals clarity, then a real model distinction (v0.68.14 → v0.68.15)** — the "Can you cover it?" block and Wren now answer whether an over-budget month touches goals. The blanket "goals are unaffected" was corrected: new authoritative `goalFundingStatus()` distinguishes **planned** from **currently-supportable** residual funding (only the cash-absorbed slice of an overage erodes residual; fixed and category-linked goals are reserved before the leftover; envelope self-coverage and shared contingency kept distinct). Proven at the engine level with the full cash-reconciliation identity across every goal type + coverage layer + the floor. (`verify-goal-funding.js`, `verify-goal-funding-reconcile.js`, `verify-contingency-goals.js`.) Floor-aware multi-month cash-flow reconciliation is deliberately deferred as future work (see `BETA_STUDY.md` Part 7).

## Still owed before public 1.0 (NOT covered by the above — needs real hardware/people)

1. **Two real phones on one shared Nest** — simultaneous adds; the documented client-only reservation boundary needs a live check, not a claim.
2. **Safari / installed-PWA behavior on iPhone**, then Chrome/Android and desktop Chrome.
3. **App-kill / reopen during a write**; expired-OAuth transitions; account switching.
4. **VoiceOver, Dynamic Type, 320px reflow, real contrast** — on-device accessibility.
5. **Live Google Drive sharing drill** (starter-copy) on a populated dummy household.
6. **Hostile-text dataset** through the full lifecycle (import → Wren → search → edit → share → receipt scan → reload).
7. **Unfamiliar-user beta.**
