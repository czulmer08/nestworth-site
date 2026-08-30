# NestWorth — executed test results

**Build under test:** v0.68.47 · Build 20260830.135
**app.html SHA-256:** `4e5d9dea51f2916799cb5129f205ad103580949759c484bfc7afa57fa789113b`
**Executed:** 2026-08-30 UTC
**Environment:** headless Chromium (Playwright) on Node v22.22.2, Linux cloud container.

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
