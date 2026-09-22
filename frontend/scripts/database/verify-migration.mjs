#!/usr/bin/env node
// verify-migration.mjs
//
// Reconciliation audit between the legacy source's CANONICAL PROJECTION
// (highest scrape_run_id wins) and the target database. Runs the same
// dedupe/transform logic on both sides so the comparison is apples-to-apples,
// then compares aggregate stats and reports PASS/FAIL.
//
// Usage:
//   npm run db:verify-migration
//   npm run db:verify-migration -- --source-url ... --target-url ...
//   npm run db:verify-migration -- --json   # also writes reports/migration-verification-<date>.json
import { connect, assertDifferentDatabases, dbIdentity, flag,
  flagValue, getEnv, nowIso, printHeader, redactUrl, tableExists,
  writeJsonFile, REPORTS_DIR } from './lib/common.mjs';

const args = process.argv.slice(2);
const sourceUrl = flagValue(args, 'source-url') || getEnv('SOURCE_DATABASE_URL');
const targetUrl = flagValue(args, 'target-url') || getEnv('TARGET_DATABASE_URL');
const wantJson = flag(args, 'json');

async function main() {
  printHeader('MIGRATION VERIFICATION  (canonical source projection vs target)');
  console.log(`source: ${redactUrl(sourceUrl)}`);
  console.log(`target: ${redactUrl(targetUrl)}`);

  assertDifferentDatabases(sourceUrl, targetUrl);
  const src = connect(sourceUrl);
  const tgt = connect(targetUrl);
  try {
    const required = ['students', 'semesters', 'subjects', 'semester_results'];
    for (const t of required) {
      if (!(await tableExists(src, t))) throw new Error(`Source table missing: ${t}`);
      if (!(await tableExists(tgt, t))) throw new Error(`Target table missing: ${t}`);
    }

    const S = await canonicalStats(src);
    const T = await canonicalStats(tgt);

    const checks = [];
    const failures = [];
    const keys = [
      'students', 'semesters', 'subjects', 'results',
      'sgpaStoredAsDecimal', 'minSgpa', 'maxSgpa', 'avgSgpa',
      'nullSgpaSemesters', 'apr2026Semesters',
      'passCount', 'failCount', 'abCount',
      'gradeDistribution', 'programDistribution', 'monthYearSetRatio',
    ];
    for (const k of keys) {
      const ok = deepEqual(S[k], T[k]);
      checks.push({ name: k, source: S[k], target: T[k], ok });
      if (!ok) failures.push(`${k} (source=${JSON.stringify(S[k])} target=${JSON.stringify(T[k])})`);
    }

    console.log('\n-- individual checks --');
    for (const c of checks) {
      const mark = c.ok ? '✓' : '✗';
      const sv = summary(c.source);
      const tv = summary(c.target);
      console.log(`  ${mark} ${(c.name + ':').padEnd(24)} ${sv}  vs  ${tv}`);
    }

    const status = failures.length === 0 ? 'PASS' : 'FAIL';
    console.log(`\nOVERALL: ${status}`);
    if (failures.length) {
      console.error('\nMismatches:');
      for (const f of failures) console.error(`  - ${f}`);
    }

    if (wantJson) {
      const out = `${REPORTS_DIR}/migration-verification-${nowIso().slice(0, 10)}.json`;
      writeJsonFile(out, { generatedAt: nowIso(), status, source: dbIdentity(sourceUrl), target: dbIdentity(targetUrl), checks });
      console.log(`Report written to ${out}`);
    }

    process.exitCode = status === 'PASS' ? 0 : 1;
  } finally {
    await src.end();
    await tgt.end();
  }
}

function summary(v) {
  if (typeof v !== 'object' || v === null) return v === null ? 'null' : String(v);
  return JSON.stringify(v).slice(0, 120);
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function canonicalStats(pool) {
  const one = async (sql) => (await pool.query(sql)).rows[0];

  const counts = {
    students: (await one(`SELECT count(*)::int n FROM students`)).n,
    semesters: (await one(`SELECT count(*)::int n FROM semesters`)).n,
    subjects: (await one(`SELECT count(*)::int n FROM subjects`)).n,
    results: (await one(`SELECT count(*)::int n FROM semester_results`)).n,
  };

  // What column name does this database use for run provenance?
  const col = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='semesters'
       AND column_name IN ('scrape_run_id','source_run_id')`);
  const runCol = col.rows[0]?.column_name || 'scrape_run_id';

  // Canonical: highest run wins per (student_id, semester_name, exam_month_year).
  const semesters = (await one(`
    WITH win AS (SELECT student_id, semester_name, exam_month_year, max(${runCol}) m
                 FROM semesters GROUP BY 1,2,3)
    SELECT count(*)::int n FROM win`)).n;

  // Results belonging to the canonical (winning) semesters.
  const results = (await one(`
    WITH win AS (SELECT student_id, semester_name, exam_month_year, max(${runCol}) m
                 FROM semesters GROUP BY 1,2,3)
    SELECT count(*)::int n FROM semester_results r
    JOIN semesters s ON s.id=r.semester_id
    JOIN win w ON w.student_id=s.student_id AND w.semester_name=s.semester_name
              AND w.exam_month_year=s.exam_month_year AND w.m=s.${runCol}`)).n;

  // SGPA numeric stats (source may store TEXT, target stores DECIMAL; compare numerically).
  const sgpaExpr = `CASE WHEN sgpa::text ~ '^[0-9]+(\\.[0-9]+)?$' THEN sgpa::numeric ELSE NULL END`;
  const sgpa = await one(`
    WITH win AS (SELECT student_id, semester_name, exam_month_year, max(${runCol}) m FROM semesters GROUP BY 1,2,3)
    SELECT
      count(*) FILTER (WHERE ${sgpaExpr} IS NOT NULL)::int  AS "sgpaStoredAsDecimal",
      min(${sgpaExpr})::numeric(5,2) AS "minSgpa",
      max(${sgpaExpr})::numeric(5,2) AS "maxSgpa",
      round(avg(${sgpaExpr}), 2)::numeric(5,2) AS "avgSgpa",
      count(*) FILTER (WHERE ${sgpaExpr} IS NULL)::int AS "nullSgpaSemesters",
      count(*) FILTER (WHERE s.exam_month_year = 'APRIL-2026')::int AS "apr2026Semesters"
    FROM semesters s
    JOIN win w ON w.student_id=s.student_id AND w.semester_name=s.semester_name
              AND w.exam_month_year=s.exam_month_year AND w.m=s.${runCol}`);

  const statusDist = await one(`
    WITH win AS (SELECT student_id, semester_name, exam_month_year, max(${runCol}) m FROM semesters GROUP BY 1,2,3)
    SELECT
      count(*) FILTER (WHERE r.subject_result='PASS')::int AS "passCount",
      count(*) FILTER (WHERE r.subject_result='FAIL')::int AS "failCount",
      count(*) FILTER (WHERE r.subject_result='AB')::int  AS "abCount"
    FROM semester_results r
    JOIN semesters s ON s.id=r.semester_id
    JOIN win w ON w.student_id=s.student_id AND w.semester_name=s.semester_name
              AND w.exam_month_year=s.exam_month_year AND w.m=s.${runCol}`);

  const gradeDist = await one(`
    WITH win AS (SELECT student_id, semester_name, exam_month_year, max(${runCol}) m FROM semesters GROUP BY 1,2,3)
    SELECT COALESCE(jsonb_object_agg(grade, n), '{}'::jsonb) AS "gradeDistribution" FROM (
      SELECT r.grade grade, count(*)::int n
      FROM semester_results r
      JOIN semesters s ON s.id=r.semester_id
      JOIN win w ON w.student_id=s.student_id AND w.semester_name=s.semester_name
                AND w.exam_month_year=s.exam_month_year AND w.m=s.${runCol}
      GROUP BY 1) t`);

  const programDist = await one(`
    SELECT COALESCE(jsonb_object_agg(program, n), '{}'::jsonb) AS "programDistribution" FROM (
      SELECT COALESCE(program,'(none)') program, count(*)::int n FROM students GROUP BY 1) t`);

  const monthYear = await one(`
    WITH win AS (SELECT student_id, semester_name, exam_month_year, max(${runCol}) m FROM semesters GROUP BY 1,2,3)
    SELECT count(*) FILTER (WHERE r.month_year IS NULL)::int AS "monthYearSetRatio"
    FROM semester_results r
    JOIN semesters s ON s.id=r.semester_id
    JOIN win w ON w.student_id=s.student_id AND w.semester_name=s.semester_name
              AND w.exam_month_year=s.exam_month_year AND w.m=s.${runCol}`);

  return {
    ...counts,
    semesters,
    results,
    ...sgpa,
    ...statusDist,
    gradeDistribution: gradeDist.gradeDistribution,
    programDistribution: programDist.programDistribution,
    monthYearSetRatio: monthYear.monthYearSetRatio,
  };
}

main().catch((e) => {
  console.error('\nVerification failed:', e.message);
  process.exitCode = 1;
});