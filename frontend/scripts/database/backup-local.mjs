#!/usr/bin/env node
// backup-local.mjs
//
// Safely backs up the legacy local PostgreSQL "student_results" database
// (or any DATABASE_URL) using pg_dump. READ-ONLY against the source.
//
// Usage:
//   npm run db:backup
//   npm run db:backup -- --database student_results
//   npm run db:backup -- --url postgresql://...
//   npm run db:backup -- --out /abs/path
//
// Produces (in backups/ by default):
//   <db>_schema.sql            schema-only dump
//   <db>_data.sql              data-only dump
//   <db>_full_<ts>.dump        full custom-format dump
//   <db>_manifest.json         sizes + checksums (sha256)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  BACKUPS_DIR, dbIdentity, flag, flagValue, getEnv, nowIso, redactUrl, writeJsonFile,
} from './lib/common.mjs';

const args = process.argv.slice(2);
const dbName = flagValue(args, 'database');
const outDir = flagValue(args, 'out') || BACKUPS_DIR;
const connUrl = flagValue(args, 'url') || getEnv('DATABASE_URL', { required: false });

const url = connUrl ?? `postgresql://${dbName || 'student_results'}`;
const label = dbIdentity(url);
const ts = nowIso().replace(/[:.]/g, '-').slice(0, 19);
const base = `${(dbName || url.split('/').pop() || 'database')}_${ts}`;

const pgdump = (only) => {
  const out = join(outDir, `${base}${only === 'full' ? '.dump' : only === 'schema' ? '_schema.sql' : '_data.sql'}`);
  const cmd = ['pg_dump', '--no-owner', '--no-privileges'];
  if (only === 'schema') cmd.push('--schema-only');
  if (only === 'data') cmd.push('--data-only');
  if (only === 'full') cmd.push('--format=custom');
  cmd.push('--file', out, url);
  console.log(`> ${cmd.slice(0, 4).join(' ')} … (to ${out})`);
  execFileSync('pg_dump', cmd.slice(2), { stdio: ['ignore', 'inherit', 'inherit'] });
  return out;
};

try {
  if (!flag(args, 'skip-full')) pgdump('full');
  const schemaPath = pgdump('schema');
  const dataPath = pgdump('data');

  const manifest = {
    generatedAt: nowIso(),
    database: label,
    connection: redactUrl(url),
    files: [schemaPath, dataPath].map((p) => {
      const { size } = statSync(p);
      const sha = createHash('sha256').update(readFileSync(p)).digest('hex');
      return { path: p, sizeBytes: size, sizeHuman: `${(size / 1024).toFixed(1)} KB`, sha256: sha };
    }),
  };
  const manifestPath = join(outDir, `${base}_manifest.json`);
  writeJsonFile(manifestPath, manifest);

  let allOk = true;
  for (const f of [schemaPath, dataPath]) {
    const st = statSync(f);
    if (st.size <= 0) { console.error(`BACKUP IS EMPTY: ${f}`); allOk = false; }
  }
  console.log('\nBackup complete.', allOk ? '' : '\nWARNING: one or more backups are EMPTY.');
  console.log('Files:');
  manifest.files.forEach((f) => console.log(`  ${f.sizeHuman.padStart(12)}  ${f.path}`));
  if (!allOk) process.exitCode = 1;
} catch (e) {
  console.error('Backup failed:', e.message);
  // pg_dump prints pg_dump: error: connection to database ... failed: ... on stderr
  process.exitCode = 1;
}