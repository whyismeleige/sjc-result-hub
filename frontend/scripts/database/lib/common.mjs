// Shared helpers for database tooling in /scripts/database.
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';

const REPO_ROOT = new URL('../../../../', import.meta.url).pathname;

export const REPORTS_DIR = `${REPO_ROOT}reports`;
export const BACKUPS_DIR = `${REPO_ROOT}backups`;

export function getEnv(name, { required = true } = {}) {
  const v = process.env[name];
  if (required && !v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

/** Redact a connection URL for safe logging (never print passwords). */
export function redactUrl(url) {
  if (!url) return '(unset)';
  try {
    const u = new URL(url);
    u.password = '';
    return u.href.replace('://', '://***@');
  } catch {
    return '<unparseable-connection-string>';
  }
}

/** Render a concise, safe identity of a database for report headers. */
export function dbIdentity(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || 5432}/${u.pathname.split('/').filter(Boolean)[0] || '(default)'}`;
  } catch {
    return '<unknown>';
  }
}

/**
 * Guard: confirm SOURCE and TARGET point at different databases.
 * Throws if they resolve to the same host+port+database.
 */
export function assertDifferentDatabases(sourceUrl, targetUrl) {
  const norm = (u) => {
    const url = new URL(u);
    const host = decodeURIComponent(url.hostname) || 'localhost';
    const db = (url.pathname || '/').split('/').filter(Boolean)[0];
    return {
      host: host.replace(/\.$/, '').toLowerCase(),
      db: db.toLowerCase(),
      port: url.port || '5432',
    };
  };
  const s = norm(sourceUrl);
  const t = norm(targetUrl);
  if (s.host === t.host && s.db === t.db && s.port === t.port) {
    throw new Error(
      `Refusing to run migration: SOURCE and TARGET resolve to the same database ` +
        `(${s.host}:${s.port}/${s.db}). This tool must never write to the source.`
    );
  }
  return { source: s, target: t };
}

/** Create a connected pg Pool. */
export function connect(url, { max = 4 } = {}) {
  return new pg.Pool({ connectionString: url, max });
}

export async function ping(pool, label) {
  const { rows } = await pool.query('SELECT current_database() AS db, version() AS v');
  console.log(`  connected: ${rows[0].db} (${label})`);
}

/** Interactive (or --yes bypassed) confirmation. */
export async function confirm(message, { yes = false } = {}) {
  if (yes) return true;
  const readline = (await import('node:readline/promises')).default;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\n${message} [y/N] `);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

export function printHeader(title) {
  console.log('\n' + '='.repeat(64));
  console.log(title);
  console.log('='.repeat(64));
}

export async function tableExists(pool, name) {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [name]
  );
  return rows.length > 0;
}

export function writeJsonFile(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

export function nowIso() {
  return new Date().toISOString();
}

export function flag(args, name) {
  return args.includes(`--${name}`);
}

export function flagValue(args, name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}