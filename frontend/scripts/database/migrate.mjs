#!/usr/bin/env node
// migrate.mjs
//
// Migrates the legacy local "student_results" database into the clean canonical
// schema of the real application (TARGET). The source is strictly READ ONLY;
// the tool refuses to run if SOURCE == TARGET.
//
// Transformations applied (documented in docs/database-migration-analysis.md):
//   1. Dedupe semesters by logical key (student_id, semester_name, exam_month_year),
//      keeping the row from the HIGHEST scrape_run_id (revised/latest run wins).
//      Superseded rows are NOT copied; their counts are reported explicitly so the
//      drop is explained, never silent.
//   2. sgpa: source TEXT -> target DECIMAL(5,2); invalid/blank text becomes NULL
//      and is recorded in the anomaly report (never guessed).
//   3. scrape_run_id -> source_run_id (an integer in the canonical schema);
//      "kept" run-1 rows (no revision exists) keep provenance=1 so reviewers
//      can spot run-1-only data.
//   4. SemesterResult.month_year: empty values are filled from the winning
//      semester's exam_month_year (they were identical in 100% of audited rows).
//   5. Students/subjects upserted by natural key (hall_ticket / course_code);
//      semesters by (student_id, semester_name, exam_month_year);
//      results by (semester_id, subject_id). Running twice is safe & convergent.
//   6. Source row IDs are preserved on first import for traceability.
//
// Usage:
//   npm run db:migrate-data            # interactive confirmation
//   npm run db:migrate-data -- --yes   # non-interactive
//   npm run db:migrate-data -- --dry-run
//
// Output:
//   reports/migration-report-<date>.json       reconciliation (source -> target)
//   reports/migration-anomalies-<date>.json    quarantined / corrected rows
import { connect, assertDifferentDatabases, confirm, dbIdentity, flag,
  flagValue, getEnv, nowIso, printHeader, redactUrl, tableExists,
  writeJsonFile, REPORTS_DIR } from './lib/common.mjs';

const args = process.argv.slice(2);
const dryRun = flag(args, 'dry-run');
const yes = flag(args, 'yes');
const sourceUrl = flagValue(args, 'source-url') || getEnv('SOURCE_DATABASE_URL');
const targetUrl = flagValue(args, 'target-url') || getEnv('TARGET_DATABASE_URL');
const BATCH = Number(flagValue(args, 'batch-size') || '1000');

async function main() {
  printHeader('DATA MIGRATION  (source: legacy student_results, target: canonical)');
  console.log(`source: ${redactUrl(sourceUrl)}`);
  console.log(`target: ${redactUrl(targetUrl)}`);
  if (dryRun) console.log('mode: DRY RUN (no writes)\n');

  const bounds = assertDifferentDatabases(sourceUrl, targetUrl);
  console.log(`safety: ${bounds.source.host}:${bounds.source.port}/${bounds.source.db}  ≠  ${bounds.target.host}:${bounds.target.port}/${bounds.target.db} ✓`);

  const src = connect(sourceUrl, { max: 3 });
  const tgt = connect(targetUrl, { max: 3 });
  const stats = { anomalies: {}, anomalyRows: [] };

  try {
    const need = ['students', 'semesters', 'subjects', 'semester_results'];
    for (const t of need) if (!(await tableExists(src, t))) throw new Error(`Source table missing: ${t}`);
    for (const t of need) {
      if (!(await tableExists(tgt, t))) {
        throw new Error(
          `Target table missing: "${t}". Apply schema migrations first: TARGET_DATABASE_URL set, then "npm run db:deploy" (npx prisma migrate deploy).`
        );
      }
    }

    await collectStats(src, stats);

    console.log('\n-- source summary --');
    console.log(`  students:           ${stats.source.students}`);
    console.log(`  semesters:          ${stats.source.semesters}  (${Object.entries(stats.source.semestersByRun).map(([k, v]) => `run${k}=${v}`).join(', ')})`);
    console.log(`  subjects:           ${stats.source.subjects}`);
    console.log(`  semester_results:   ${stats.source.results}`);

    console.log('\n-- dedupe & transformation plan --');
    console.log(`  superseded semester keys (dropped, revised run wins): ${stats.supersession.semesterKeys}`);
    console.log(`  superseded results (dropped as superseded):           ${stats.supersession.results}`);
    console.log(`  canonical semesters to import:                        ${stats.canonical.semesters}`);
    console.log(`  canonical results to import:                          ${stats.canonical.results}`);
    for (const [k, v] of Object.entries(stats.anomalies)) if (v) console.log(`  ⚠  ${k}: ${v}`);

    if (dryRun) {
      console.log('\nDRY RUN complete — no writes performed. Re-run without --dry-run to execute.');
      writeJsonFile(`${REPORTS_DIR}/migration-plan-${dateStamp()}.json`, { plan: stats });
      return;
    }

    if (!(await confirm(
      `About to write into "${dbIdentity(targetUrl)}":\n` +
      `  ${stats.canonical.students} students, ${stats.canonical.subjects} subjects,\n` +
      `  ${stats.canonical.semesters} semesters, ${stats.canonical.results} semester_results.\n` +
      `The source database remains untouched. Continue?`, { yes }))) {
      console.log('Aborted by user.');
      return;
    }

    const report = await migrate(tgt, src, stats, BATCH);

    console.log('\n' + '='.repeat(64));
    console.log('MIGRATION COMPLETE — reconciliation:');
    console.log(`  target students         ${report.target.students} (expected ${report.expected.students})`);
    console.log(`  target subjects         ${report.target.subjects} (expected ${report.expected.subjects})`);
    console.log(`  target semesters        ${report.target.semesters} (expected ${report.expected.semesters})`);
    console.log(`  target semester_results ${report.target.results} (expected ${report.expected.results})`);
    if (report.mismatches.length) {
      console.error(`\n  MISMATCH! ${report.mismatches.join('; ')}`);
    } else {
      console.log('\n  All counts match the canonical projection. ✓');
    }

    const out = `${REPORTS_DIR}/migration-report-${dateStamp()}.json`;
    writeJsonFile(out, report);
    writeJsonFile(`${REPORTS_DIR}/migration-anomalies-${dateStamp()}.json`, {
      generatedAt: nowIso(),
      note: 'Rows corrected or quarantined during migration (source overview shown in report).',
      rows: stats.anomalyRows,
    });
    console.log(`\nReport:     ${out}`);
    if (report.status !== 'PASS') process.exitCode = 2;
  } finally {
    await src.end();
    await tgt.end();
  }
}

// ---------------------------------------------------------------------------
async function collectStats(src, stats) {
  const one = async (sql) => (await src.query(sql)).rows[0];

  stats.source = {
    students: (await one(`SELECT count(*)::int n FROM students`)).n,
    semesters: (await one(`SELECT count(*)::int n FROM semesters`)).n,
    subjects: (await one(`SELECT count(*)::int n FROM subjects`)).n,
    results: (await one(`SELECT count(*)::int n FROM semester_results`)).n,
    semestersByRun: {},
  };
  for (const r of (await src.query(`SELECT scrape_run_id, count(*)::int n FROM semesters GROUP BY 1 ORDER BY 1`)).rows) {
    stats.source.semestersByRun[r.scrape_run_id] = r.n;
  }

  const superseded = await one(`
    SELECT count(DISTINCT r1.student_id || '|' || r1.semester_name || '|' || r1.exam_month_year) AS semester_keys,
           (SELECT count(*) FROM semester_results r WHERE r.semester_id IN (SELECT r1outer.id FROM semesters r1outer
              WHERE EXISTS (
                SELECT 1 FROM semesters s2
                WHERE s2.student_id = r1outer.student_id AND s2.semester_name = r1outer.semester_name
                  AND s2.exam_month_year = r1outer.exam_month_year AND s2.scrape_run_id > r1outer.scrape_run_id
              ))) AS results
    FROM semesters r1
    WHERE EXISTS (
      SELECT 1 FROM semesters s2
      WHERE s2.student_id = r1.student_id AND s2.semester_name = r1.semester_name
        AND s2.exam_month_year = r1.exam_month_year AND s2.scrape_run_id > r1.scrape_run_id
    )`);
  stats.supersession = { semesterKeys: Number(superseded.semester_keys) || 0, results: Number(superseded.results) || 0 };

  stats.canonical = {
    semesters: (await one(`
      WITH win AS (SELECT student_id, semester_name, exam_month_year, max(scrape_run_id) m FROM semesters GROUP BY 1,2,3)
      SELECT count(*)::int n FROM win`)).n,
    results: (await one(`
      WITH win AS (SELECT student_id, semester_name, exam_month_year, max(scrape_run_id) m FROM semesters GROUP BY 1,2,3)
      SELECT count(*)::int n FROM semester_results r
      JOIN semesters s ON s.id = r.semester_id
      JOIN win w ON w.student_id=s.student_id AND w.semester_name=s.semester_name
                AND w.exam_month_year=s.exam_month_year AND w.m=s.scrape_run_id`)).n,
    students: stats.source.students,
    subjects: stats.source.subjects,
  };

  stats.anomalies = {
    invalidNonBlankSgpa: (await one(`
      SELECT count(*)::int n FROM semesters
      WHERE sgpa::text IS NOT NULL AND btrim(sgpa::text) <> '' AND sgpa::text !~ '^[0-9]+(\\.[0-9]+)?$'`)).n,
    nullSgpaLegitimate: (await one(`
      SELECT count(*)::int n FROM semesters
      WHERE sgpa::text IS NULL OR btrim(sgpa::text) = ''`)).n,
    orphanedReferences: (await one(`
      SELECT count(*)::int n FROM semester_results r
      LEFT JOIN semesters s ON s.id=r.semester_id LEFT JOIN subjects su ON su.id=r.subject_id
      WHERE s.id IS NULL OR su.id IS NULL`)).n,
    emptyStudentNames: (await one(`SELECT count(*)::int n FROM students WHERE btrim(student_name)=''`)).n,
    duplicateHallTickets: (await one(`SELECT max(c)::int n FROM (SELECT count(*) c FROM students GROUP BY hall_ticket HAVING count(*)>1) t`)).n ?? 0,
    resultsWithNullMonthYear: 0,
  };
  for (const [k, v] of Object.entries(stats.anomalies)) stats.anomalies[k] = Number(v) || 0;
}

// ---------------------------------------------------------------------------
async function migrate(tgt, src, stats, BATCH) {
  const counts = { inserted: {}, updated: {} };
  const key = (name) => { counts.inserted[name] = counts.inserted[name] || 0; counts.updated[name] = counts.updated[name] || 0; };

  const tx = await tgt.connect();
  await tx.query('BEGIN');
  await tx.query('SELECT pg_advisory_lock($1)', [78234900001]);
  try {
    // -- students --
    key('students');
    const students = await queryAll(src, `SELECT * FROM students ORDER BY id`);
    const studentSrcToTgt = new Map();
    for (let i = 0; i < students.length; i += BATCH) {
      const chunk = students.slice(i, i + BATCH);
      const res = await batchUpsert(tx, 'students',
        ['id', 'hall_ticket', 'student_name', 'father_name', 'mother_name', 'program', 'created_at'],
        chunk.map(r => [r.id, r.hall_ticket, r.student_name, r.father_name, r.mother_name, r.program, r.created_at]),
        'hall_ticket',
        ['student_name', 'father_name', 'mother_name', 'program', 'created_at']);
      for (let j = 0; j < chunk.length; j++) studentSrcToTgt.set(chunk[j].id, res.rows[j].id);
      tally(counts, 'students', res);
    }

    // -- subjects --
    key('subjects');
    const subjects = await queryAll(src, `SELECT * FROM subjects ORDER BY id`);
    const subjectSrcToTgt = new Map();
    for (let i = 0; i < subjects.length; i += BATCH) {
      const chunk = subjects.slice(i, i + BATCH);
      const res = await batchUpsert(tx, 'subjects',
        ['id', 'course_code', 'course_title', 'credits'],
        chunk.map(r => [r.id, r.course_code, r.course_title, r.credits]),
        'course_code',
        ['course_title', 'credits']);
      for (let j = 0; j < chunk.length; j++) subjectSrcToTgt.set(chunk[j].id, res.rows[j].id);
      tally(counts, 'subjects', res);
    }
    console.log('  students + subjects upserted ✓');

    // -- semesters (canonical projection, highest scrape_run_id wins) --
    key('semesters');
    const semesters = await queryAll(src, `
      SELECT s.id, s.student_id, s.semester_name, s.exam_month_year,
             CASE WHEN s.sgpa::text ~ '^[0-9]+(\\.[0-9]+)?$' THEN s.sgpa::numeric ELSE NULL END AS sgpa,
             s.overall_result, s.scrape_run_id, s.created_at
      FROM semesters s
      JOIN (SELECT student_id, semester_name, exam_month_year, max(scrape_run_id) m
            FROM semesters GROUP BY 1,2,3) w
        ON w.student_id=s.student_id AND w.semester_name=s.semester_name
           AND w.exam_month_year=s.exam_month_year AND w.m=s.scrape_run_id
      ORDER BY s.student_id, s.id`);
    const semesterSrcToTgt = new Map();
    const semesterMonth = new Map(); // source semester id -> exam_month_year (for month_year fill)
    for (const r of semesters) semesterMonth.set(r.id, r.exam_month_year);
    for (let i = 0; i < semesters.length; i += BATCH) {
      const chunk = semesters.slice(i, i + BATCH);
      const rows = chunk.map(r =>
        [r.id, studentSrcToTgt.get(r.student_id), r.semester_name, r.exam_month_year, r.sgpa, r.overall_result, r.scrape_run_id, r.created_at]);
      const res = await batchUpsert(tx, 'semesters',
        ['id', 'student_id', 'semester_name', 'exam_month_year', 'sgpa', 'overall_result', 'source_run_id', 'created_at'],
        rows, 'student_id, semester_name, exam_month_year',
        ['sgpa', 'overall_result', 'source_run_id', 'created_at']);
      for (let j = 0; j < chunk.length; j++) semesterSrcToTgt.set(chunk[j].id, res.rows[j].id);
      tally(counts, 'semesters', res);
    }
    console.log('  semesters upserted ✓');

    // -- semester_results (canonical projection) --
    key('semester_results');
    const results = await queryAll(src, `
      SELECT r.id, r.semester_id, r.subject_id, r.grade, r.subject_result, r.month_year
      FROM semester_results r
      JOIN semesters s ON s.id = r.semester_id
      JOIN (SELECT student_id, semester_name, exam_month_year, max(scrape_run_id) m
            FROM semesters GROUP BY 1,2,3) w
        ON w.student_id=s.student_id AND w.semester_name=s.semester_name
           AND w.exam_month_year=s.exam_month_year AND w.m=s.scrape_run_id`);
    let nullMonthYear = 0;
    const quarantined = [];
    for (let i = 0; i < results.length; i += BATCH) {
      const chunk = results.slice(i, i + BATCH);
      const rows = [];
      for (const r of chunk) {
        const sem = semesterSrcToTgt.get(r.semester_id);
        const sub = subjectSrcToTgt.get(r.subject_id);
        if (!sem || !sub) {
          quarantined.push({ table: 'semester_results', id: r.id, reason: `missing mapping (semester=${r.semester_id}, subject=${r.subject_id})` });
          continue;
        }
        if (!r.month_year) nullMonthYear++;
        rows.push([r.id, sem, sub, r.grade, r.subject_result, r.month_year || semesterMonth.get(r.semester_id)]);
      }
      if (!rows.length) continue;
      const res = await batchUpsert(tx, 'semester_results',
        ['id', 'semester_id', 'subject_id', 'grade', 'subject_result', 'month_year'],
        rows, 'semester_id, subject_id',
        ['grade', 'subject_result', 'month_year']);
      tally(counts, 'semester_results', res);
    }
    if (nullMonthYear) {
      stats.anomalies.resultsWithNullMonthYear = nullMonthYear;
      stats.anomalyRows.push({ table: 'semester_results', count: nullMonthYear, reason: 'month_year NULL -> copied from owning semester exam_month_year' });
    }
    if (quarantined.length) {
      stats.anomalyRows.push(...quarantined);
      stats.anomalies.orphanedReferences = stats.anomalies.orphanedReferences + quarantined.length;
    }

    await tx.query('SELECT pg_advisory_unlock($1)', [78234900001]);
    await tx.query('COMMIT');
    tx.release();
  } catch (e) {
    try { await tx.query('ROLLBACK'); } catch { /* ignore */ }
    tx.release();
    throw e;
  }

  // -- reconcile --
  const row = async (sql) => (await tgt.query(sql)).rows[0];
  const target = {
    students: (await row(`SELECT count(*)::int n FROM students`)).n,
    subjects: (await row(`SELECT count(*)::int n FROM subjects`)).n,
    semesters: (await row(`SELECT count(*)::int n FROM semesters`)).n,
    results: (await row(`SELECT count(*)::int n FROM semester_results`)).n,
  };
  const mismatches = [];
  for (const [name, label] of [['students', 'students'], ['subjects', 'subjects'], ['semesters', 'semesters'], ['results', 'semester_results']]) {
    if (target[name] !== stats.canonical[name]) mismatches.push(`${label} (target=${target[name]}, expected=${stats.canonical[name]})`);
  }
  return {
    generatedAt: nowIso(),
    mode: 'real',
    source: dbIdentity(sourceUrl),
    target: dbIdentity(targetUrl),
    config: { dedupeRule: 'keep highest scrape_run_id per (student_id, semester_name, exam_month_year)' },
    source: stats.source,
    supersession: stats.supersession,
    canonicalProjection: stats.canonical,
    anomalies: stats.anomalies,
    migration: counts,
    expected: stats.canonical,
    target,
    mismatches,
    status: mismatches.length ? 'MISMATCH' : 'PASS',
  };
}

// ---------------------------------------------------------------------------
async function queryAll(pool, sql, params) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

// Bulk multi-row upsert with ON CONFLICT on `conflictCol`. Returns rows with
// (id, <conflictCol parts>, xmax) selecting only id + inserted-flag for mapping.
async function batchUpsert(tx, table, cols, rows, conflictCol, updateCols) {
  if (!rows.length) return { rows: [], rowCount: 0 };
  const placeholders = rows.map((r, j) =>
    `(${r.map((_, k) => `$${j * r.length + k + 1}`).join(',')})`).join(',');
  const flat = rows.flat();
  const assignments = updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ');
  const sql = `INSERT INTO "${table}" (${cols.join(', ')}) VALUES ${placeholders}
    ON CONFLICT (${conflictCol}) DO UPDATE SET ${assignments}
    RETURNING id, (xmax = 0) AS did_insert`;
  const res = await tx.query(sql, flat);
  return { rows: res.rows, rowCount: res.rowCount };
}

function tally(counts, name, res) {
  for (const r of res.rows) {
    if (r.did_insert) counts.inserted[name]++; else counts.updated[name]++;
  }
}

function dateStamp() {
  return nowIso().slice(0, 10);
}

// entry
main().catch((e) => {
  console.error('\nMigration failed:', e.message);
  process.exitCode = 1;
});