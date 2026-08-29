# NestWorth schema migrations — contract for future versions

The metadata document carries an integer `schemaVersion`. `CURRENT_SCHEMA_VERSION` is the shape the
running build writes. `migrateMeta()` runs the registered migrations in order (`META_MIGRATIONS`),
stamps the current version, backs up the pre-migration doc, and **fails safe** on a document newer
than the build understands (it refuses and locks writes rather than downgrading or discarding fields).

Historical unversioned Nests are treated as **v0**. The current build is **v1**; the v0→1 migration is
data-preserving (it formalizes the pre-versioned shape; `normMeta` already coerces every field safely).

## Requirements for every new migration (N → N+1)

Before `CURRENT_SCHEMA_VERSION` is bumped to `N+1`, the migration `META_MIGRATIONS[N+1]` MUST ship with:

1. **A targeted fixture + test.** A checked-in `fixtures/meta/*.json` document in the vN shape, plus a
   test asserting the specific transformation vN→vN+1 does what it intends.
2. **Whole-chain migration tests.** Every supported older version → current must migrate cleanly:
   v0→…→N+1, v1→…→N+1, … not just N→N+1. A vN-shaped fixture must arrive at the current shape.
3. **Idempotency.** `migrateMeta(migrateMeta(x))` deep-equals `migrateMeta(x)`. Running twice equals once.
4. **Financial-fingerprint preservation _or_ a documented intentional change.** The authoritative engine
   must compute identical household facts (net worth, monthly income/spending, goal balances,
   contingency state) before and after — UNLESS the migration deliberately changes financial semantics,
   in which case the change must be documented here and the test must assert the new expected facts, not
   silently accept a drift.
5. **Interruption / restart recovery.** A migration interrupted mid-way (or whose post-migration write is
   lost) must, on the next load, either resume safely or leave the prior schema intact — never a
   half-migrated document that reads as successful. (The pre-migration `nw_meta_backup` supports this.)
6. **Fail-safe for future schemas.** A document whose `schemaVersion` exceeds `CURRENT_SCHEMA_VERSION`
   must still throw `NEWER_SCHEMA`, lock writes, and never be downgraded or have unknown fields dropped.

`verify-migration.js` already enforces 1 (corpus-driven), 3, 4, and 6 for v0→1, plus backup creation and
the mid-session newer-schema write-lock. When a v2 migration is added, extend it to cover 2 and 5 for the
new step. Keep the destructive-migration backup and the fail-safe behavior for every version.

## Live two-device atomicity — unchanged boundary

None of the above addresses **simultaneous writes from two live devices to one Nest.** Client-side Google
Sheets row reservation reduces collisions but is not a true compare-and-swap; a genuine guarantee needs a
server-side coordinator. This remains a documented architectural boundary requiring real-device / backend
validation — it is **not** something the automated harness claims to prove.
