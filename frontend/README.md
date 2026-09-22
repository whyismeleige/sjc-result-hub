# sjc-result-hub · frontend

The Next.js application code for SJC Result Hub. See the repository root
`README.md` for the full project overview, and `../docs/` for the deployment run
book (`DEPLOYMENT.md`) and the database migration analysis.

## Local development

```sh
npm ci
cp .env.example .env            # DATABASE_URL / DIRECT_URL at minimum
npx prisma migrate deploy
npm run dev                     # http://localhost:3000
```

Escapes: keep the following in `src/`, outside the Next.js `app/` folder:

- `src/lib/api.ts` — Postgres-backed rate limiting, IP hardening, Zod schemas
- `src/lib/sgpa.ts`, `src/lib/export-metrics.ts` — pure, unit-tested helpers
- `src/utils/` — formatting/sanitisation helpers (unit-tested)

Bridge artifacts are gitignored: `../backups/`, `../reports/`, and any local
`.env*` except the committed `.env.example`.

## Checks

`npm run typecheck` · `npm run lint` · `npm test` · `npm run build`