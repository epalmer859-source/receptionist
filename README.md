# Aigent OS — Mobile Mechanic Receptionist + Dashboard

One Next.js app: an AI receptionist "brain" that captures inbound service
requests for a **mobile mechanic** (a tech who drives to the customer's
vehicle), and the **dispatch dashboard** that shows those leads live on a board
and a map. Captured leads persist to Postgres (Railway) and appear on the
dashboard.

- **Receptionist brain** — one system prompt + one tool (`capture_lead`) behind
  `POST /api/chat`. Reusable across web/SMS/voice transports.
- **Dashboard** — the AigentOS app (login + leads board + map) mounted at `/`.

## Stack

- **Next.js + TypeScript**, **Tailwind CSS**
- **Anthropic API** — Claude `claude-sonnet-4-6`, thinking disabled (intake is
  customer conversation, not hard reasoning)
- **Prisma + PostgreSQL (Railway)** — lead persistence
- **Google Maps / Geocoding** — map pins for the vehicle's current location

## Endpoints

```
POST /api/chat        { messages:[{role,content}], channel? } → { ok, reply, lead }
GET  /api/leads       → { ok, leads: Lead[] }            (newest first, this tenant)
PATCH /api/leads/:id  { status } | { dismissedAt, dismissedBy } | { dismissedAt: null }
```

On `capture_lead`, `/api/chat` geocodes the vehicle's location and writes a
`Lead` (best-effort: a geocode/DB failure never drops the customer's reply). The
dashboard fetches `GET /api/leads` on mount and persists dismiss/restore/status
via `PATCH`.

### Lead shape (the dashboard contract)

```ts
Lead {
  id; businessSlug; name; phone?;
  address;                       // the vehicle's CURRENT location, not a home address
  lat?; lng?;                    // null until geocoded; null leads list but skip the map
  channel;                       // "web" | "sms" | "voice"
  urgency;                       // "emergency" | "soon" | "flexible"  (inferred by the brain)
  status;                        // "new" | "contacted" | "scheduled"
  callback?; summary;
  vehicleYear?; vehicleMake?; vehicleModel?;
  needsReview;                   // true when captured with a gap a human must close
  convo;                         // [{ who: "cust" | "ai", text }]
  createdAt; dismissedAt?; dismissedBy?;
}
```

## Local development

```bash
npm install
cp .env.example .env.local      # set ANTHROPIC_API_KEY (DATABASE_URL optional locally)
npm run dev                     # http://localhost:3000
```

- Without `DATABASE_URL`, the brain still runs and `/api/chat` returns the
  captured lead — it just skips persistence (so the dashboard list will be
  empty). Point `DATABASE_URL` at any Postgres and run
  `npx prisma migrate deploy` to persist locally.
- `npm run build` runs `prisma migrate deploy` and therefore needs a real
  `DATABASE_URL`. To build the app without a database (e.g. CI smoke test) use
  `npm run build:app` (`prisma generate && next build`).

### Prove the flow

```bash
npm run test:chat               # requires a running dev server + ANTHROPIC_API_KEY
```

Drives a **real** Claude conversation (no mocks): an I‑575 / 2014 Silverado
breakdown where the customer never says "urgent", and asserts the lead is
captured with urgency **inferred** as `emergency` plus vehicle + location. Then
runs four unhappy-path probes (bare "hey", a customer who won't share a
location, a pricing question, an unknown vehicle) and prints how the brain
handles each.

## Database (Railway Postgres)

Single connection string — `datasource db { url = env("DATABASE_URL") }`, no
pooler/direct split, no `DIRECT_URL`. The migration is committed under
`prisma/migrations/` and applied on deploy with `prisma migrate deploy` (not
`db push`).

## Deploy to Railway

1. **Create the service** from this repo, and add the **PostgreSQL** plugin.
2. **Environment variables** (Service → Variables):

   | Variable | Required | What it is |
   |---|---|---|
   | `DATABASE_URL` | ✅ | Reference the Postgres plugin's `DATABASE_URL`. |
   | `ANTHROPIC_API_KEY` | ✅ | Server-side Claude key for the brain. |
   | `GOOGLE_GEOCODING_KEY` | ➖ | Server key with the **Geocoding API** enabled (map pins). Without it, leads still save and list — they just won't get a pin. |
   | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | ➖ | Browser key with the **Maps JavaScript API** enabled, restricted by HTTP referrer. Falls back to the demo key baked into the dashboard if unset. |

   Keep the two Google keys separate: the browser Maps key is referrer-restricted
   and must NOT be reused for server-side geocoding.
3. **Build** runs `npm run build` → `prisma generate && prisma migrate deploy &&
   next build`, so the committed migration is applied to the Railway database at
   build time. **Start**: `npm run start`.
4. First deploy creates the `Lead` table from `prisma/migrations/*_init`.

## Configure the tenant

Edit `src/config/business.ts` — name, `slug` (scopes leads in the DB), service
area, hours, phone, one-line description. The values ship as clearly-marked
`TODO(tenant)` placeholders; fill them with verified info before going live.

## Auth (demo only)

Login / roles / team management in `AigentOS.jsx` are the **in-memory demo** from
the handoff (no server, plaintext passwords). This pass did not touch auth — wire
it to real endpoints + hashed passwords + an httpOnly session cookie before
production.

## Layout

```
prisma/
  schema.prisma                 # Lead model (Railway Postgres, single DATABASE_URL)
  migrations/*_init/            # committed SQL, applied via `prisma migrate deploy`
src/
  config/business.ts            # tenant context (TODO placeholders)
  lib/receptionist.ts           # brain: system prompt + capture_lead + runReceptionist()
  lib/geocode.ts                # vehicle location → {lat,lng} (Google Geocoding)
  lib/prisma.ts                 # Prisma client singleton
  lib/leadShape.ts              # Lead row → dashboard lead shape
  app/api/chat/route.ts         # POST /api/chat  (capture → geocode → persist)
  app/api/leads/route.ts        # GET /api/leads
  app/api/leads/[id]/route.ts   # PATCH dismiss/restore/status
  app/AigentOS.jsx              # the dashboard (client component), mounted at /
  app/{layout,page}.tsx         # shell + mount
scripts/test-chat.mjs           # end-to-end proof (npm run test:chat)
```

## Not in this pass

Real auth, SMS/voice transports, and any lead field beyond what the dashboard
renders. The brain captures partial leads with `needsReview` so dispatch can
follow up rather than dropping a stranded customer.
