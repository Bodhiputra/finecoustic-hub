# Products department — MVP brief

*Fine Hub / Products · 2026*

## Decision locked

**Option B:** Dedicated **Products catalog** in Neon (or file fallback), keyed by **`sku`**. Ops inventory uses the same SKU strings (`FBS1`, `FBS2`, …) but stays in ops data — no PM fields mixed into ops JSON.

On first run / seed: copy `sku` + `name` from `ops.products` into `hub_products`. Ops is not the write surface for specs, images, or feedback.

---

## What Products owns vs other departments

| Domain | Department | Hub today |
|--------|------------|-----------|
| SKU catalog, specs, launch, images, refinements | **Products** | MVP |
| Product issues / questions (per SKU) | **Products** | MVP |
| Issue discussion (chat per issue) | **Products** | MVP (reuse `IssueChat`) |
| Warehouse qty, B2B shipments | **Operations** | `/ops` |
| B2B CRM / distributors | **Operations** | `/ops?tool=customers` |
| B2B + D2C **sales targets** | **Operations** | Later (D2C via Shopify API) |
| KOL records | **Marketing** | Later; link to product issue optional |
| Survey / ad feedback | **Marketing** | Later; link into product issue |
| Support routing / escalation | **Support** (future dept) | Out of MVP scope |
| Factory comms | **Products** (manual in issue chat) | No automation |

---

## URLs

| Page | Path |
|------|------|
| Product grid | `/products` |
| Product workspace | `/products?product={sku}` |
| Product tab (optional query) | `&tab=overview\|issues\|refinements\|discussion` |

Same pattern as Marketing campaigns (`?tool=campaigns&flow=…`).

---

## Screens (MVP)

### 1. Product grid (`/products`)

- Cards: hero image (or placeholder), **name**, **SKU**, launch date (if set), open issue count badge.
- **Add product** (manager) — SKU required, unique; name defaults from SKU.
- **Seed from Ops** button (manager, one-time / on demand) — inserts rows for ops SKUs not yet in catalog.

### 2. Product workspace (`?product=FBS1`)

Tabs:

| Tab | Content |
|-----|---------|
| **Overview** | Image, name, SKU, price (display), launch date, specs (markdown or structured fields), edit (manager / products-access users) |
| **Issues & questions** | Filterable list: source, status, assignee, title, updated. **Add issue** opens side panel. |
| **Refinements** | Short list of improvement ideas (title, status, optional link to issue). MVP can be same table with `kind=refinement` or separate — prefer **`kind` on one `product_items` table**. |
| **Discussion** | **Product thread** — ongoing chat per SKU for direct PM ↔ team sync (general notes, factory updates, quick questions). Issue-specific chat stays on each issue panel. |

**Communication model (locked):** thread-based, same **`IssueChat`** UI as Appdev / internal tasks.

| Thread | Where | Use for |
|--------|-------|---------|
| **Product thread** | Discussion tab on product workspace | You ↔ PM: specs questions, prioritization, “ask factory and report back” |
| **Issue thread** | Issue side panel | One KOL EQ report, one support ticket, etc. |

Both support text + image attachments. No real-time typing indicators in MVP — refresh or post to see new messages.

### 3. Issue panel (slide-over, like `TaskPanel`)

- Fields: title, description, **source** (`kol`, `team`, `survey`, `support`, `customer`, `other`), status, assignee (hub display name), product SKU (locked).
- **IssueChat** thread (comments + images) — same component as Appdev / internal tasks.
- Status flow: `open` → `investigating` → `resolved` | `wont_fix`.

---

## Data model

### `hub_products`

| Column | Type | Notes |
|--------|------|-------|
| `sku` | TEXT PK | Matches ops / Shopify variant SKU |
| `name` | TEXT | Display name |
| `description` | TEXT | Short blurb |
| `specs` | JSONB | Flexible key/value or markdown in `specs_md` |
| `price_display` | TEXT | e.g. `$199` — not financial source of truth |
| `image_url` | TEXT | Hub upload or external URL |
| `launched_at` | DATE nullable | |
| `status` | TEXT | `active`, `discontinued`, `npd` (pre-launch) |
| `sort_order` | INT | Grid order |
| `created_by` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `hub_product_items` (issues + refinements)

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `product_sku` | TEXT FK → `hub_products.sku` | |
| `kind` | TEXT | `issue` \| `refinement` |
| `title` | TEXT | |
| `body` | TEXT | Description |
| `source` | TEXT | `kol`, `team`, `survey`, `support`, `customer`, `other` |
| `status` | TEXT | issue: open/investigating/resolved/wont_fix; refinement: idea/planned/done |
| `assignee` | TEXT | Hub display name |
| `source_ref` | TEXT nullable | Future: KOL id, survey response id |
| `comments` | JSONB | Same shape as appdev/issue comments |
| `created_by` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `hub_product_threads` (product-level chat — MVP)

| Column | Type | Notes |
|--------|------|-------|
| `product_sku` | TEXT PK | One thread per product |
| `comments` | JSONB | IssueChat payload (author, body, images, timestamps) |

Product thread = your direct line to PM on that SKU. Issue threads = separate tickets under **Issues & questions**.

---

## API (REST, `/api/v1/products/…`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/products` | List catalog (+ open issue counts) |
| POST | `/api/v1/products` | Create product (manager) |
| GET | `/api/v1/products/{sku}` | One product + summary counts |
| PATCH | `/api/v1/products/{sku}` | Update overview fields |
| POST | `/api/v1/products/seed-from-ops` | Insert missing SKUs from ops data |
| GET | `/api/v1/products/{sku}/items` | List issues/refinements (`?kind=issue`) |
| POST | `/api/v1/products/{sku}/items` | Create issue/refinement |
| GET/PATCH/DELETE | `/api/v1/products/items/{id}` | Item CRUD |
| POST | `/api/v1/products/{sku}/comments` | Post to **product thread** |
| POST | `/api/v1/products/items/{id}/comments` | Post to **issue thread** |

Auth: same hub session as internal tasks. Visibility: all hub users with **products department access** (see below).

---

## Access control (phase 1.5 — after catalog shell)

Extend `hub_users` (or JSON column `department_access`):

```json
{
  "operations": true,
  "marketing": true,
  "products": true,
  "creatives": false,
  "branding": false,
  "admin": false
}
```

- **FCS-建宏** (master) — all departments + admin.
- Manager UI at `/hub/admin` — toggles per user (already creates accounts; add department matrix).
- Middleware / page loader checks department flag before rendering `/products`.

Default for new users: `products: false` until admin enables.

---

## Seed from Ops

1. Load ops snapshot (`getOpsData()` / brand ops JSON).
2. For each `ops.products[]` entry with `sku`, `INSERT … ON CONFLICT DO NOTHING` into `hub_products` with `name` from ops.
3. PM enriches image, specs, launch date in Products UI — ops unchanged.

---

## Out of MVP (explicit)

- Notifications / badges (discuss later)
- KOL / survey auto-link (`source_ref` column reserved)
- Support department + escalation rules
- NPD pipeline kanban (use `status=npd` on product + issues for now)
- Shopify write-back
- ERP / factory integrations

---

## Build order

1. DB tables + file fallback + seed-from-ops script
2. Product grid page + overview edit
3. **Product Discussion tab** (product thread — you ↔ PM)
4. Issues list + issue panel + issue thread (IssueChat)
5. Refinements tab (same `product_items` table, `kind=refinement`)
6. Department access on `hub_users` + admin UI toggles

---

## Open questions (when building)

- Image upload: reuse internal task media upload (`/api/v1/internal/upload`) or product-specific path?
- Specs: markdown textarea vs fixed fields (driver size, impedance, …) — start markdown.
