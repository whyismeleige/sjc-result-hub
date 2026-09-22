# Deployment (Vercel + Supabase)

The app is a Next.js 16 app server-rendered against Postgres. Live data access
requires a Postgres server, so we deploy the app on Vercel and host the database
on Supabase, then run the proven data-migration pipeline once.

> Verify with: `npm run typecheck && npm run lint && npm test && npm run build`
> (CI does the same on every push to `main`).

## 1. Local prerequisites

- Node 22+ (CI uses 22; dev uses 26)
- Local PostgreSQL with the source database `student_results`
- Supabase account (for production hosting)

Verify the tooling up front:

```sh
cd frontend && npm ci
npx prisma validate && npx prisma generate
npm run typecheck && npm run lint && npm test && npm run build
```

## 2. Supabase project

1. Create a Supabase project; note the **Project Settings → Database →
   Connection string**.
2. Run the schema (idempotent, transactional):

```sh
# point DATABASE_URL at Supabase, then:
npx prisma migrate deploy      # applies prisma/migrations/20260922093514_init
```

3. Copy these into the env file / Vercel:

| Env var                | Value (source of truth)   |
|------------------------|---------------------------|
| `DATABASE_URL`         | Supabase pooler `:6543`   |
| `DIRECT_URL`           | Supabase direct `:5432`   |

Notes:
- `DATABASE_URL` is what the app uses at runtime; **prefer the pooler**.
- `DIRECT_URL` is only for `prisma migrate deploy` and long transactions.
- Next.js stores both plain; they are standard Prisma vars.

## 3. Data migration run book (production)

The pipeline never touches the source DB with writes; it is read-only there.
Guards fail if source and target resolve to the same `host:port:db`.

```sh
cd frontend
cat > .env <<'EOF'
DATABASE_URL="postgresql://<pooler-user>@...:6543/sjc_result_hub"  # Target (Supabase)
DIRECT_URL="postgresql://<direct-user>@...:5432/sjc_result_hub"
SOURCE_DATABASE_URL="postgresql://.../student_results"             # Legacy read-only
TARGET_DATABASE_URL="postgresql://.../sjc_result_hub"
ADMIN_SECRET="<choose-a-long-random-value>"
NEXT_PUBLIC_APP_NAME="SJC Result Hub"
NEXT_PUBLIC_APP_URL="https://<your-vercel-domain>"
EOF

npm run db:backup               # pg_dump -> backups/
npm run db:inspect              # forensics + anomaly report -> reports/
npm run db:migrate-data -- --dry-run   # plan only (no writes)
npm run db:migrate-data -- --yes       # transactional migrate
npm run db:verify-migration -- --json  # apples-to-apples reconciliation
```

Read `docs/database-migration-analysis.md` for the canonical deduplication rule
and the verification numbers (2,311 / 4,934 / 387 / 33,746).

If a migration fails mid-transaction, the whole batch rolls back; re-running is
safe because upserts are keyed on natural keys (`hall_ticket`, `course_code`,
logical key) and re-imports converge to the same rows.

## 4. Vercel

1. Import the GitHub repo. **Root Directory = `frontend`** (Vercel will detect
   Next.js, current build command is `npm run build`).
2. In **Settings → Environment Variables**, add:
   `DATABASE_URL`, `DIRECT_URL`, `ADMIN_SECRET` (and optionally
   `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`).
3. Deploy. The route logs will show `/api/analytics` etc. as `ƒ Dynamic`.

## 5. Post-deploy smoke test

```sh
curl -s "https://<domain>/api/leaderboard?type=sgpa&limit=5"   # numeric SGPA
curl -s "https://<domain>/api/students?limit=2"                # no father_name (PII)
curl -s "https://<domain>/api/analytics?type=grade-distribution&program=B.COM&semester=IV"
curl -s -o /dev/null -w '%{http_code}\n' "https://<domain>/students/ANYHALLTICKET"  # 200
```

Rate limiting: per-IP windows per endpoint (e.g. `/api/analytics` = 30 req/min).
A request carrying the `ADMIN_SECRET` (via the `x-admin-secret` header or the
`admin_secret` query param, e.g. `?admin_secret=...`) bypasses rate limits.

## 6. Maintenance

- Schema change: edit `schema.prisma`, then
  `npx prisma migrate dev --name <name>` locally, commit the migration, and in
  production run `npx prisma migrate deploy`.
- Rotating secrets: update Vercel env vars (no redeploy needed for env-only
  changes) and regenerate the DB password.
- Backups are manual artifacts under `backups/` (gitignored); schedule `db:backup`
  against Supabase if you want a cron-based safety net.