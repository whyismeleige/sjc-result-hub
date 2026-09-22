# SJC Result Hub

A Next.js app that serves student results for St. Joseph's College and spans the
**full data path for the daily linked-list scrape → Postgres → API → UI**.
Result data is stored in Postgres via Prisma. There is no input UI yet; a CLI
scraper owns data intake.

## Repository layout

```
frontend/   Next.js 16 (App Router) + TypeScript + Prisma + Tailwind
  prisma/             schema.prisma + migrations (single init migration)
  scripts/database/   backup / inspect / migrate / verify pipeline
  src/app/api/        REST endpoints (students, analytics, leaderboard, export)
  src/app/            admin & student pages
includes: GraphQL? No. Plain JSON REST.
docs/       deployment run book + database migration analysis
backups/    pg_dump artifacts (gitignored)
reports/    migration/verification reports (gitignored)
```

## Quick start (local)

```sh
cd frontend
npm ci
cp .env.example .env            # point DATABASE_URL at a local/dev Postgres
npx prisma migrate deploy       # or: npx prisma migrate dev
npm run dev                     # http://localhost:3000
```

Onboarding the legacy `student_results` database (2,311 students, 33,746 graded
rows) is fully scripted and read-only-safe:

```sh
npm run db:backup               # pg_dump -> backups/
npm run db:inspect              # forensics + anomalies -> reports/
npm run db:migrate-data -- --dry-run   # plan only
npm run db:migrate-data -- --yes       # transactional migrate
npm run db:verify-migration -- --json  # reconciliation
```

See `docs/database-migration-analysis.md` for the deduplication rule and the
verified counts, and `docs/DEPLOYMENT.md` for the Supabase + Vercel run book.

## Checks

`npm run typecheck` · `npm run lint` · `npm test` (vitest) · `npm run build`
(CI: `.github/workflows/ci.yml` runs all of them on every push).

## Scripts

| Script                       | Purpose                                        |
|------------------------------|------------------------------------------------|
| `dev` / `build` / `start`    | Next.js                                       |
| `typecheck` / `lint` / `test`| static checks + vitest                         |
| `db:backup`                  | `pg_dump` source/target                       |
| `db:inspect`                 | read-only source forensics                    |
| `db:migrate-data`            | source → target migration (transactional)     |
| `db:verify-migration`        | canonical-projection reconciliation           |