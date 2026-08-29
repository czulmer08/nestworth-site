# NestWorth — verified-write contract audit

**Build:** v0.68.11 · Build 20260829.99 · executed against source in headless Chromium (this environment).

**Invariant under audit:** *If NestWorth reports success, persistence was confirmed. If persistence is uncertain or failed, don't report success — preserve the user's input, stay recoverable, and surface an actionable error.*

Every user-triggered persistent mutation was inventoried and classified. Format: `trigger → write → verification/idempotency → failure behavior`.

## Root defect (fixed this pass)

`writeMeta()` — the single most important finding — previously wrapped its persisting `vBatchUpdate` in `try{}catch(e){}` (silent) **and** advanced the merge baseline `_metaBase` *before* the write. So a dropped connection (a) lost the change invisibly and (b) poisoned the next merge (the lost delta looked already-saved). Every metadata-backed operation inherited this.

**FIXED:** the baseline advances only after a confirmed write; a failed write shows a global **Retry banner** (`#metaSaveBar`), keeps the change in memory, and does not advance the baseline (so the delta is retried and reconciled). This closes the entire "silent" cluster below in one place.

## Write-surface matrix

### Ledger (financial) writes

| Operation | Mechanism | Status |
|---|---|---|
| Transaction create (`addEntry`) | **now `idempotentAppend`** (durable id, col J) | ✅ FIXED — was plain append; now reconciles an ambiguous write without duplicating, like deposits |
| Deposit create (`addDeposit`) | `idempotentAppend` | ✅ PASS |
| Recurring-bill log (`logRecur`) | **now `idempotentAppend`** | ✅ FIXED |
| Transaction edit (`saveEdit`) | `ledgerRowMatches` identity check | ✅ FIXED — **refuses** on mismatch (was "Save anyway") → TXN-EDIT-002 |
| Transaction delete (`deleteEdit`) | `ledgerRowMatches` + re-entry guard | ✅ FIXED — **refuses** on mismatch (was "Delete anyway") → TXN-DELETE-001 |
| Goal contribution / withdrawal (`logGoalContribution`, `gtxSubmit`) | append; surfaces errors | ✅ PASS |
| Goal→debt payoff (`applyGoalToDebt`) | 2 writes, guarded by `_pendKey` intent marker + `reconcilePending` | ✅ PASS (mitigated multi-stage) |
| Import (`impDoImport`) | batched append, tracks `committed`, reports partial | ✅ PASS |

### Metadata document (all via `writeMeta`)

Goals (create/edit/archive/delete), category type/rollover, hidden categories, income/source config, payees, start cash/month, account as-of links, contingency/rollover settings, residual %, `saveReconcile`, `setStartYM`, `setCatRoll`, `hideCat`/`unhideCat`, `addPayee`/`removePayee`.

**Status: ✅ FIXED as a class** by the `writeMeta` root fix — a failed save now surfaces (Retry banner) and can't silently lose data or poison the merge. (Individually these still update in-memory state optimistically, which is acceptable *because* the banner now guarantees the user learns if the persist didn't land.)

### Net-worth writes

| Operation | Status |
|---|---|
| Save balances (`applyNW`) | ✅ FIXED — single atomic write (used rows + blanked tail); no destructive clear-then-rewrite → NW-ATOMIC-001 |
| Add account (`addNW`) | ✅ PASS — `claimRow` (sanitized, fail-closed) + surfaced error |
| Remove account (`removeNW`) | ✅ FIXED — was empty `catch{}`; now surfaces failure |
| Reconcile (`saveReconcile`) | ✅ FIXED via `writeMeta` root fix |

### Config / summary-sheet writes

| Operation | Status |
|---|---|
| Add/remove category & source (`addCat`/`removeCat`/`addCon`/`removeCon`) | ✅ PASS — surface errors; names sanitized (v0.68.9) |
| Fold / combine into itemized parent (`foldCategory`, `doCombine`) | 🟡 PASS with note — surfaces errors; multi-stage (ledger retag + summary + meta) is **not atomic** |
| Rename category/source (inline retag helpers) | ✅ PASS — surface errors; names sanitized |

## Remaining architectural boundaries (documented, not silent)

1. **Multi-stage summary+ledger+meta writes** (`addCat`, `addCon`, `foldCategory`, `doCombine`, `addGoal` rename path). ✅ **CLOSED (v0.68.12)** for the meta half — the config commit is always `writeMeta`-last, and a `writeMeta` that can't be confirmed now persists a **durable pending doc** (`nw_meta_pending`) that `reconcilePendingMeta` re-applies on the next load, so the change can't be lost by closing the app. The sheet half still surfaces errors and is retried; a mid-sequence interruption leaves a recoverable (not silent, not lost) state.
2. **Multi-row goal-move batches** (`fundAllThisMonth`, goal contributions/withdrawals). ✅ **CLOSED (v0.68.12)** — now use `idempotentAppendRows`: each row carries its own durable id and is reconciled row-by-row, so an ambiguous failure never duplicates.
3. **Live two-device simultaneous writes** — the nonce reservation reduces collisions but is not a server-side compare-and-swap. Unchanged, documented boundary; needs the real-device drill, not a code change.

## Schema migration (v0.68.12)

The metadata document now carries `schemaVersion`. `migrateMeta()` runs registered migrations in order, is **idempotent**, **backs up** the pre-migration doc before transforming, and **fails safe** on a Nest newer than this build (refuses to open/overwrite — never downgrades or discards unknown fields). `CURRENT_SCHEMA_VERSION = 1`; the v0→1 migration is data-preserving. `verify-migration.js` (22 assertions) proves, across historical fixtures (pre-Meta, old goals without residual/cap/link, account-earmarked goals, old paycheck without per-check mode, old rollover, start-cash/YM combos, hand-edited meta), that migration **preserves financial meaning** — the authoritative engine computes identical household facts (net worth, monthly actuals, goal balances, contingency) before and after — plus idempotency, backup, fail-safe, and the mid-session newer-schema write-lock.

## Tests added

`verify-write-contract.js` (9 assertions): TXN-EDIT-002 (mismatch → no overwrite), TXN-DELETE-001 (unconfirmed → no delete), META-SAVE-001 (failed meta write fails closed + retry succeeds), NW-ATOMIC-001 (single atomic NW write), plus structural guards (idempotent append path, removeNW surfacing, writeMeta baseline discipline, no "Save/Delete anyway").

## Ordering (per the agreed release gate)

1. ✅ Verified-write audit (this document)
2. ✅ Fix + regression-test silent/ambiguous critical writes
3. ✅ Write-atomicity completion (multi-stage config + goal-move batches) — v0.68.12
4. ✅ Schema-version / migration compatibility suite — v0.68.12 (`verify-migration.js`)
5. ⏭️ Real-device / two-phone testing (requires hardware)
6. ⏭️ Unfamiliar-user beta
