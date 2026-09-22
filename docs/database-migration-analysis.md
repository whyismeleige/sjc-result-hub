# Database Migration Analysis

This document records exactly what we did to move the legacy dataset into the
canonical application schema, what we found in the source, which rows were
changed/dropped during the move, and how we proved the move was lossless.

Audit date: 2026-09-22 · Source DB: `student_results` (local PostgreSQL 18)

## 1. Source database inventory

| Table             | Rows    | Notes                                        |
|-------------------|---------|----------------------------------------------|
| `students`        | 2,311   | one row per student                          |
| `semesters`       | 6,808   | two scrape runs overlap for APRIL-2026       |
| `subjects`        | 387     | course catalogue                             |
| `semester_results`| 47,403  | subject-level grades per semester            |
| `scrape_runs`     | 2       | id 1 = `ORIGINAL` (APRIL-2026), id 4 = `REVISED_JUN2026` (APRIL-2026); ids 2 & 3 were later deleted |

### Scrape-run layout

```
run 1 ORIGINAL          -> OCT/NOV-2025 (2,311 semesters) + APRIL-2026 (2,261 semesters)
run 4 REVISED_JUN2026   -> APRIL-2026 (2,236 semesters)
```

`semesters` and `semester_results` carry a `scrape_run_id` column that did not
exist in the original Prisma schema. Because the two APRIL-2026 runs overlap for
the same students/semesters, the logical key
`(student_id, semester_name, exam_month_year)` is **not unique** in the source:
**1,874 logical semester keys appear in both runs.**

## 2. Data quality audit (read-only, before any writes)

| Check                          | Result                  |
|--------------------------------|-------------------------|
| Orphaned `semesters`           | 0 (foreign keys clean)  |
| Orphaned `semester_results`    | 0 (FKs to sem+subject OK)|
| Duplicate students by hall_ticket | 0                     |
| Duplicate subjects by course_code | 0                     |
| Invalid grade values           | 0 (only O,A+,A,B+,B,C,D,F,AB) |
| Invalid `subject_result`       | 0 (only PASS, FAIL, AB) |
| Unparseable SGPA text          | 0                       |
| SGPA out of range (0–10)       | 0 (min 4.56, max 10.00) |
| Blank `semester_results.month_year` | 0 (always matches owning semester) |
| Null SGPA (legitimate)         | 1,523 (failed/promoted students) |

No records had to be repaired for the move apart from the two documented
transforms below.

## 3. Schema drift (source vs old app schema)

The checked-in `schema.prisma` did **not** match the real database:

| Problem | Old schema | Reality (source) | Canonical schema |
|---------|-----------|-------------------|------------------|
| Run provenance ignored | nothing | `semesters.scrape_run_id`, `semester_results.scrape_run_id` | `semesters.source_run_id` |
| Duplicate protection wrong | `@@unique([semester_id, subject_id])` (no run) | 1,874 superseded keys would collide | unique on logical key, migrations enforce it |
| SGPA text sorting bug | `sgpa String` stored as TEXT | TEXT column `sgpa` | `DECIMAL(5,2)` |

Keeping SGPA as TEXT caused alphabetical ordering (`"9.9" < "10.0"`) anywhere the
app sorted or ranked by SGPA; `DECIMAL(5,2)` fixes this for leaderboards and
program ranks.

## 4. Canonical deduplication rule

For `(student_id, semester_name, exam_month_year)`, **keep the row from the highest
`scrape_run_id`** (i.e. the June 2026 revised run wins over the original run).

Rationale: `REVISED_JUN2026` is the newer scrape of the same published results,
so its SGPA/grades supersede the original run. Original-run APRIL-2026 rows not
present in the revision (387 semesters) are kept and flagged with
`source_run_id = 1` so a reviewer can re-check that revision intentionally
dropped them.

### Resulting projection

```
raw semesters:          6,808
superseded keys:        1,874  (kept the revised copy instead)
superseded results:    13,657  (the stale copies, explained & dropped)
canonical semesters:    4,934  (= 2,311 OCT/NOV + 2,236 APRIL rev + 387 APRIL orig-only)
canonical results:     33,746  (= 14,439 OCT/NOV + 16,382 APRIL rev + 2,925 APRIL orig-only)
```

The drop is never silent: `migrate.mjs` reports `supersession` counts in the
migration report.

## 5. Transformations applied during migration

1. **Deduplication** — rule above.
2. **SGPA** — source `TEXT` → canonical `DECIMAL(5,2)` via a validated cast;
   blank/invalid text would become `NULL` and be recorded in the anomaly report
   (none occurred; 1,523 legitimate `NULL`s are preserved as `NULL`).
3. **Run provenance** — `scrape_run_id` → `semesters.source_run_id`.
4. **`month_year`** — empty values filled from the owning semester's
   `exam_month_year` (0 rows needed this).
5. **Upserts by natural key** — students by `hall_ticket`, subjects by
   `course_code`, semesters by `(student_id, semester_name, exam_month_year)`,
   results by `(semester_id, subject_id)`; re-running is safe and convergent.
6. **IDs preserved** on first import for source-to-target traceability.

## 6. Verification (proven against local target `sjc_result_hub_dev`)

`verify-migration.mjs` recomputes the canonical projection **on both sides**
using identical SQL, then compares:

```
students              2,311 = 2,311      subjects  387 = 387
semesters             4,934 = 4,934      results  33,746 = 33,746
SGPA min 4.56 = 4.56  max 10.00 = 10.00 avg 8.20 = 8.20
null SGPA 1,115 = 1,115   APRIL-2026 semesters 2,623 = 2,623
PASS 31,290 = 31,290    FAIL 2,080 = 2,080    AB 376 = 376
grade distribution     identical JSON
program distribution   identical JSON
results with null month_year: 0 = 0
OVERALL: PASS
```

Full artifact: `reports/migration-verification-2026-09-22.json`,
`reports/migration-report-2026-09-22.json`.

## 7. Reproducibility

The whole pipeline is scripted and read-only-safe:

```
npm run db:backup             # pg_dump schema/data/full + sha256 manifest -> backups/
npm run db:inspect            # forensics, anomalies, canonical projection -> reports/
npm run db:migrate-data -- --dry-run   # plan only
npm run db:migrate-data -- --yes       # migrate source -> target (guards source != target)
npm run db:verify-migration -- --json  # apples-to-apples reconciliation
```

See `docs/DEPLOYMENT.md` for the production (Supabase) run book.