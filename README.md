# Fine Hub

**Repo:** [github.com/Bodhiputra/finecoustic-hub](https://github.com/Bodhiputra/finecoustic-hub)

Internal workspace with isolated access realms. Code is public; brand data is not committed.

## Access model

| URL | Password env | Who |
|---|---|---|
| `/` (hub home) | `OPS_HUB_PASSWORD` | Internal team |
| `/ops`, `/customers`, `/stock` | same hub session | Internal — operations |
| `/marketing`, `/preorder-survey` | same hub session | Internal — marketing |
| `/appdev` | `APPDEV_PASSWORD` | External app dev partners (isolated) |

### Isolation

- **Hub password alone does not grant `/appdev`.** Devs must sign up / sign in on the appdev login screen (name + shared team password).
- **Admin (you):** master password `HUB_MASTER_PASSWORD` on the appdev login — full board + user admin.
- Realms share the site origin but use **separate signed cookies** (see below).

### Session cookies

All cookies are `httpOnly`, `path: /`, 30-day signed tokens (`SESSION_SECRET`):

| Cookie | Realm | Set when |
|---|---|---|
| `finehub_session` | Hub | Hub password login |
| `appdev_session` | Appdev | Appdev sign-in / sign-up (includes password-version stamp) |
| `finehub_admin` | Admin | Master password login |

Changing `APPDEV_PASSWORD` invalidates all appdev sessions (new team password required). Appdev logout clears only `appdev_session` on **that device** — it does not delete the account. **One active session per registered name:** signing in again (or signing up) on another device signs the previous session out.

## Dev (local JSON)

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set in `.env.local`:

- `OPS_HUB_PASSWORD` — hub login
- `APPDEV_PASSWORD` — shared team password for appdev (e.g. `yscoco_app321`)
- `HUB_MASTER_PASSWORD` — your admin master password
- `SESSION_SECRET` — `openssl rand -base64 32`

Copy `brands/_template/ops-data.json` → `brands/finecoustic/ops-data.json` (gitignored). Edit that file yourself — the hub only displays it.

Without `DATABASE_URL`, the app reads JSON from disk. Fine for local use.

### Auth smoke tests

With dev server running (`npm run dev`):

```bash
npm run test:auth
# optional: npm run test:auth -- http://localhost:3000
```

## Deploy (Vercel + Neon)

1. **Neon** — [neon.com](https://neon.com) → new project. Copy `DATABASE_URL`.
2. **Seed data** from your laptop:

   ```bash
   DATABASE_URL=postgres://... npm run db:seed
   ```

3. **Vercel** — connect repo, set env vars:
   - `OPS_HUB_PASSWORD`
   - `APPDEV_PASSWORD`
   - `HUB_MASTER_PASSWORD`
   - `SESSION_SECRET` (required in production)
   - `DATABASE_URL`
   - `PREORDER_SURVEY_SECRET` — shared with Shopify theme (questionnaire webhook)
   - `SHOPIFY_STORE` — e.g. `j5gawi-vu.myshopify.com`
   - `SHOPIFY_ADMIN_TOKEN` — Admin API token with `read_customers`
   - **Media uploads (pick one):**
     - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (preferred — files go to `finehub/appdev` in your Cloudinary account)
     - `BLOB_READ_WRITE_TOKEN` (fallback — public Vercel Blob URLs)
     - If neither is set, uploads only work locally (`data/appdev-uploads/`).

## Appdev field names

Persisted JSON uses legacy keys (see `lib/appdev.js` header):

- `issue.assignee` → UI **Task assigner** (who created the task; owns metadata)
- `issue.workers` → UI **Assignees** (one or more people doing the work)
- `issue.worker` → legacy first assignee (kept in sync on save)

**Permissions:** Only the logged-in assigner (or admin) can edit title, description, type, priority, attachments, dates, Done, and delete. Others can update Todo/In Progress/In Review, add themselves as assignee, and use Discussion.

## Preorder survey (Shopify → Neon)

Storefront questionnaire POSTs to a **public** hub endpoint (no hub login required):

- `POST /api/public/preorder-survey` — validate `PREORDER_SURVEY_SECRET` in JSON body (`secret` field). **One response per email per intent** (`reserve` and `decline` tracked separately); duplicates return `409` with `{ error: "duplicate" }`.
- `GET /api/preorder-survey` — hub-authenticated list (for analysis / export)
- Hub UI: **Marketing** → `/marketing` overview, **Preorder survey** → `/preorder-survey` (table, filters, answer breakdown, CSV export)

Table `preorder_survey_responses` is created automatically on first insert. Local dev without `DATABASE_URL` writes to `data/preorder-survey-responses.json`.

Shopify theme: **Preorder Questionnaire** section → webhook URL + same secret.

## Preorder reserved lookup (guest tag check)

When a guest enters their email on the homepage hero, the offers page checks whether that email already has the `nomadpreorder` tag (paid $2 reservation).

**Do not call `finehub.vercel.app` directly from the browser** — Vercel’s Security Checkpoint blocks cross-origin fetch with 403. Use a **Shopify App Proxy** so the storefront calls your shop domain (same-origin), and Shopify forwards server-side to finehub.

### 1. Vercel env (finehub project)

- `PREORDER_SURVEY_SECRET` — same value as theme `reserved_check_secret`
- `SHOPIFY_STORE` — e.g. `j5gawi-vu.myshopify.com`
- `SHOPIFY_ADMIN_TOKEN` — Admin API token with `read_customers`

If finehub still returns 403 to Shopify’s proxy servers, disable **Attack Challenge Mode** under Vercel → Project → Firewall, or append your [Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation) secret to the proxy URL in Shopify (admin-only, not in theme code):

`https://finehub.vercel.app/api/shopify-proxy?x-vercel-protection-bypass=YOUR_SECRET`

### 2. Shopify App Proxy (required once)

Shopify Admin → **Settings → Apps and sales channels → Develop apps** → your custom app → **Configuration → App proxy**:

| Field | Value |
|---|---|
| Subpath prefix | `apps` |
| Subpath | `fc-preorder` |
| Proxy URL | `https://finehub.vercel.app/api/shopify-proxy` |

Save. The theme default check URL is `/apps/fc-preorder/reserved` (GET with `email`, `tag`, `secret` query params).

### 3. Verify

```bash
# Direct hub API (may 403 from datacenter IPs — that is expected)
curl "https://finehub.vercel.app/api/shopify-proxy/reserved?email=test@example.com&tag=nomadpreorder&secret=YOUR_SECRET"

# After app proxy is configured, from the storefront (replace with your shop domain):
curl "https://YOUR-SHOP-DOMAIN/apps/fc-preorder/reserved?email=test@example.com&tag=nomadpreorder&secret=YOUR_SECRET"
```

Expected: `{"ok":true,"reserved":true}` or `{"ok":true,"reserved":false}`.

## Stack

Next.js · JavaScript (JSX) · local JSON (dev) · Neon Postgres (prod)
