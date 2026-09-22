#!/usr/bin/env node
// inspect-source.mjs
//
// READ-ONLY forensic introspection of the legacy local "student_results" database.
// Performs NO writes of any kind against the source. Emits statistics,
// anomaly counts and a JSON report into reports/.
//
// Usage:
//   npm run db:inspect
//   npm run db:inspect -- --url postgresql://...
import {
  connect, dbIdentity, flagValue, getEnv, nowIso, printHeader,
  redactUrl, writeJsonFile, REPORTS_DIR,
} from './lib/common.mjs';

const args = process.argv.slice(2);
const sourceUrl = flagValue(args, 'url') || getEnv('SOURCE_DATABASE_URL', { required: false })
  || getEnv('DATABASE_URL');
const pool = connect(sourceUrl);

const q = async (label, sql) => {
  try {
    const { rows } = await pool.query(sql);
    return rows;
  } catch (e) {
    return [{ error: e.message }];
  }
};

const report = {
  generatedAt: nowIso(),
  source: dbIdentity(sourceUrl),
  connection: redactUrl(sourceUrl),
  isReadOnly: true,
  tables: {},
  anomalies: {},
  revisedRunNote: undefined,
};

async function rowCount(table) {
  const { rows } = await pool.query(`SELECT count(*)::int AS c FROM "${table}"`);
  return rows[0].c;
}

try {
  printHeader('SOURCE DATABASE INSPECTION (read-only)');
  console.log(`source: ${report.connection}\n`);

  const tables = ['students', 'semesters', 'subjects', 'semester_results', 'scrape_runs'];
  for (const t of tables) {
    const exists = (await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`, [t]
    )).rowCount;
    if (!exists) { report.tables[t] = { exists: false }; logMissing(t); continue; }
    const count = await rowCount(t);
    report.tables[t] = { exists: true, rows: count };
    console.log(`  ${t.padEnd(18)} ${String(count).padStart(7)} rows`);
  }

  console.log('\n-- schema columns --');
  const cols = await q('cols', `
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('students','semesters','subjects','semester_results','scrape_runs')
    ORDER BY table_name, ordinal_position`);
  report.columns = cols;
  for (const c of cols) {
    console.log(`  ${c.table_name}.${c.column_name} ${c.data_type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
  }

  console.log('\n-- indexes & constraints --');
  const idx = await q('idx', `
    SELECT tc.table_name, tc.constraint_type,
           CASE WHEN tc.constraint_type='FOREIGN KEY' THEN kcu.column_name || ' -> ' || ccu.table_name || '.' || ccu.column_name
                ELSE string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) END AS detail
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name AND kcu.table_schema=tc.table_schema
    LEFT JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema
    WHERE tc.table_schema='public' AND tc.table_name IN ('students','semesters','subjects','semester_results','scrape_runs')
    GROUP BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.column_name, ccu.table_name, ccu.column_name
    ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name`);
  report.constraints = idx;
  for (const c of idx) console.log(`  ${c.table_name}: ${c.constraint_type}${c.detail ? ` (${c.detail})` : ''}`);

  console.log('\n-- anomaly checks --');
  const checks = {
    students_null_program: 'students', students_hallticket_dup: 'students',
    students_empty_name: 'students',
    semesters_orphan: 'semesters', sem_results_orphan_semester: 'semester_results',
    sem_results_orphan_subject: 'semester_results',
    sgpa_not_clean_decimal: 'semesters', sgpa_out_of_range: 'semesters',
    semester_dup_logical_keys: 'semesters', subject_dup_codes: 'subjects',
    results_flagged: 'semester_results', result_no_grade: 'semester_results',
  };
  const sqls = {
    students_null_program: `SELECT count(*)::int AS n FROM students WHERE program IS NULL`,
    students_hallticket_dup: `SELECT max(c)::int AS n FROM (SELECT count(*) c FROM students GROUP BY hall_ticket HAVING count(*)>1) t`,
    students_empty_name: `SELECT count(*)::int AS n FROM students WHERE btrim(student_name)=''`,
    semesters_orphan: `SELECT count(*)::int AS n FROM semesters s LEFT JOIN students st ON st.id=s.student_id WHERE st.id IS NULL`,
    sem_results_orphan_semester: `SELECT count(*)::int AS n FROM semester_results r LEFT JOIN semesters s ON s.id=r.semester_id WHERE s.id IS NULL`,
    sem_results_orphan_subject: `SELECT count(*)::int AS n FROM semester_results r LEFT JOIN subjects sub ON sub.id=r.subject_id WHERE sub.id IS NULL`,
    sgpa_not_clean_decimal: `SELECT count(*)::int AS n FROM semesters WHERE sgpa IS NOT NULL AND btrim(sgpa)='' OR (sgpa IS NOT NULL AND sgpa !~ '^[0-9]+(\\.[0-9]+)?$')`,
    sgpa_out_of_range: `SELECT count(*)::int AS n FROM semesters WHERE sgpa IS NOT NULL AND btrim(sgpa)<>'' AND (sgpa::numeric < 0 OR sgpa::numeric > 10)`,
    semester_dup_logical_keys: `SELECT count(*)::int AS n FROM (SELECT student_id, semester_name, exam_month_year FROM semesters GROUP BY 1,2,3 HAVING count(*)>1) t`,
    subject_dup_codes: `SELECT max(c)::int AS n FROM (SELECT count(*) c FROM subjects GROUP BY course_code HAVING count(*)>1) t`,
    results_flagged: `SELECT count(*)::int AS n FROM semester_results WHERE subject_result NOT IN ('PASS','FAIL','AB') OR subject_result IS NULL`,
    result_no_grade: `SELECT count(*)::int AS n FROM semester_results WHERE grade IS NULL`,
  };
  for (const [name, table] of Object.entries(checks)) {
    const res = await pool.query(sqls[name]);
    const n = Number(res.rows[0].n || 0);
    report.anomalies[name] = n;
    const tableRows = report.tables[table]?.rows ?? 0;
    const severity = n === 0 ? 'ok' : n > Math.max(1, tableRows * 0.01) ? 'high' : 'warn';
    console.log(`  ${severity === 'ok' ? '✓' : severity === 'high' ? '✗' : '!'} ${name}: ${n}`);
    report.anomalies[`${name}_severity`] = severity;
  }

  console.log('\n-- scrape run overview --');
  const runs = await q('runs', `SELECT id, label, exam_month_year, scraped_at FROM scrape_runs ORDER BY id`);
  report.scrapeRuns = runs;
  for (const r of runs) console.log(`  run ${r.id}: ${r.label} (${r.exam_month_year}) @ ${r.scraped_at}`);
  const semRuns = await q('semruns', `SELECT scrape_run_id, exam_month_year, count(*)::int AS n FROM semesters GROUP BY 1,2 ORDER BY 1,2`);
  report.semestersByRun = semRuns;
  for (const r of semRuns) console.log(`  semesters in run ${r.scrape_run_id} [${r.exam_month_year}]: ${r.n}`);

  console.log('\n-- canonical (deduped) projection --');
  const canonSem = await pool.query(`
    SELECT count(*)::int AS n FROM (
      SELECT student_id, semester_name, exam_month_year, max(scrape_run_id) m FROM semesters GROUP BY 1,2,3
    ) t`);
  const canonRes = await pool.query(`
    SELECT count(*)::int AS n FROM semester_results r JOIN semesters s ON s.id=r.semester_id
    JOIN (SELECT student_id, semester_name, exam_month_year, max(scrape_run_id) m FROM semesters GROUP BY 1,2,3) w
      ON w.student_id=s.student_id AND w.semester_name=s.semester_name AND w.exam_month_year=s.exam_month_year AND w.m=s.scrape_run_id`);
  report.canonicalProjection = {
    semesters: canonSem.rows[0].n,
    semesterResults: canonRes.rows[0].n,
    rule: 'keep the row with the highest scrape_run_id per (student_id, semester_name, exam_month_year)',
  };
  console.log(`  semesters (after dedupe, highest run wins): ${canonSem.rows[0].n}`);
  console.log(`  semester_results (after dedupe):           ${canonRes.rows[0].n}`);

  const out = `${REPORTS_DIR}/source-inspection-${nowIso().slice(0, 10)}.json`;
  writeJsonFile(out, report);

  const sgpa = await q('sgpa', `SELECT sgpa, count(*)::int n FROM semesters WHERE sgpa IS NOT NULL GROUP BY 1 ORDER BY 1 DESC LIMIT 8`);
  report.sgpaSamples = sgpa;
  console.log('\n-- SGPA sanity --');
  for (const g of sgpa) console.log(`  ${g.sgpa} (×${g.n})`);

  console.log(`\nReport written to ${out}`);
} finally {
  await pool.end();
}

function logMissing(t) {
  console.log(`  ${t.padEnd(18)} MISSING (not present)`);
}