# Finecoustic Ops Hub

**Repo:** [github.com/Bodhiputra/finecoustic-hub](https://github.com/Bodhiputra/finecoustic-hub)

Internal view-only dashboard. Code is public; brand data is not committed.

## Dev (local JSON)

```bash
npm install
cp .env.example .env.local   # set OPS_HUB_PASSWORD
npm run dev
```

Copy `brands/_template/ops-data.json` → `brands/finecoustic/ops-data.json` (gitignored). Edit that file yourself — the hub only displays it.

Without `DATABASE_URL`, the app reads JSON from disk. Fine for local use.

## Deploy so your boss can view (Vercel + Neon)

1. **Neon** — [neon.com](https://neon.com) → new project (free tier is fine). Copy the **connection string** (`DATABASE_URL`).
2. **Seed data** from your laptop (uses your local gitignored JSON):

   ```bash
   DATABASE_URL=postgres://... npm run db:seed
   ```

   Re-run after you update `brands/finecoustic/ops-data.json`.

3. **Vercel** — connect repo, set env vars:
   - `OPS_HUB_PASSWORD`
   - `DATABASE_URL`

   Or use Vercel's **Neon integration** (Storage → Connect Neon) — it injects `DATABASE_URL` automatically.

Boss opens the Vercel URL, enters the password, sees live data from Neon.

## Stack

Next.js · JavaScript (JSX) · local JSON (dev) · Neon Postgres (prod)
