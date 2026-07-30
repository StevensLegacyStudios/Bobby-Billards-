# Buddy Billiards 🎱

Enterprise-grade billiard routing and spatial intelligence: find pool rooms inside the
spatial corridor of any road trip, verify their real playing conditions, train shots on a
3D WebGL table, and analyze real frames with an AI shot engine.

## Stack

- **Frontend** — Next.js (App Router, TypeScript), Tailwind CSS, shadcn-style UI components
- **Backend / DB** — Supabase (Postgres + PostGIS), Deno edge functions
- **3D** — React Three Fiber + drei (`<BilliardCanvas />`)
- **Offline** — IndexedDB via `idb` (Premium corridor downloads)
- **Billing** — Stripe subscriptions (B2C Premium $4.99/mo, B2B Verified Venue $14.99/mo) + CPC ad auction

## Getting started

```bash
npm install
cp .env.example .env.local   # optional — the app runs fully in demo mode without env vars
npm run dev
```

Without Supabase/Stripe credentials the app falls back to seeded demo data and demo
entitlement grants, so every flow below is exercisable locally out of the box.

## Application map

| Route | What it does |
| --- | --- |
| `/trip-planner` | Corridor route planner. Calls the `get_venues_in_corridor` PostGIS RPC (WKT LINESTRING + buffer meters), renders venues sorted by distance-from-route with a live query-latency badge, shareable `?tripId=` collaboration links, and Premium offline downloads. |
| `/venues/[id]` | Venue detail: verified table specifications, community validation block (cloth quality / pocket widths / cue spacing) with gamification badges, published events, and an embedded 3D house-shot canvas. |
| `/rules` | 3D practice canvas (React Three Fiber) with preset layouts, the geometric trajectory solver (ghost-ball + mirror-law banks), and the AI camera-frame analysis flow. |
| `/upgrade` | Free vs Premium tiers; checkout via Stripe (or a demo grant without keys). |
| `/b2b/dashboard` | Merchant portal: Verified Venue Profile workflow, analytics control panel (page views, engagement, travel-log additions), and direct event publishing. |
| `/b2b/ads` | Self-serve contextual CPC bidding with a second-price auction and live click ledger. |

### API surface

| Endpoint | Purpose |
| --- | --- |
| `POST /api/cv/inference` | Multi-modal shot engine: accepts a 640×640 WebP frame, runs (mock) YOLOv8 detection, projects detections through a DLT homography onto the 2:1 slate canvas (X ∈ [0,200], Y ∈ [0,100]), returns the optimal trajectory payload. Free tier is metered to 3 uploads/month. |
| `POST /api/ads/click-track` | CPC charge calculator — second-price + 1¢ clearing, atomic via the `record_ad_click` Postgres function. |
| `POST /api/webhooks/stripe` | Subscription provisioning/cancellation for Premium and Verified Venue plans. |
| `POST /api/billing/checkout` | Creates Stripe Checkout sessions (demo grant fallback). |

### Core libraries

- `lib/engine/homography.ts` — 3×3 projective transform (OpenCV-style matrix, DLT + Gaussian elimination)
- `lib/engine/trajectory.ts` — vector trajectory generator (ghost-ball aiming, θᵢ = θᵣ bank reflections, best-shot search)
- `lib/geo.ts` — client-side corridor math mirroring the PostGIS path
- `lib/offline/db.ts` — IndexedDB corridor/tile synchronization manager
- `middleware.ts` — tier tracking (`x-bb-tier`) and Premium route gating

## Database

Migrations live in `supabase/migrations/` (PostGIS venues + GIST index + RLS, the
`get_venues_in_corridor` RPC, and monetization/B2B tables). See
[`supabase/README.md`](supabase/README.md) for local setup, seeding, the Google Places
sync edge function, and a verification query.
