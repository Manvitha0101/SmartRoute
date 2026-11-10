# SmartRoute — Delivery Route Optimization & Fleet Management

Full-stack fleet dispatch demo: optimize multi-stop delivery routes with a **capacity-aware nearest-neighbor VRP heuristic**, manage orders/drivers, and view routes on a map.

**Live demo:** [smartroute-app-v1.vercel.app](https://smartroute-app-v1.vercel.app)

---

## What it does

- **Dispatcher** — view pending orders, pick vehicles/drivers, run optimization, see distance savings vs a random baseline
- **Route map** — warehouse + numbered stops on OpenStreetMap (Leaflet)
- **Driver login** — `driver@smartroute.io` sees only their assigned routes and can start/complete trips
- **Admin** — KPI summary and warehouse load (admin-only analytics)

This is a **portfolio / campus project**, not a production TMS. Distance uses Haversine (crow-flies), not road networks.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite + Leaflet |
| Backend | Node.js + Express + TypeScript |
| Database | SQLite (created automatically, no separate server) |
| Auth | JWT, three demo roles |

---

## Try it

Open the app and choose **Dispatcher**, **Admin**, or **Driver**.

- **Dispatcher** — waiting Hyderabad orders, then Plan route
- **Driver** — Suresh Reddy’s current trip
- **Admin** — order and route counts

---

## Run locally

Node 18+ is enough. No Docker or Postgres.

```bash
cd backend
npm install
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5174  
API: http://localhost:3000

The first start creates `backend/data/smartroute.db` and loads the demo.

The hosted site at smartroute-app-v1.vercel.app still points at the old Render API. That API’s Postgres server is offline, so sign-in there fails until this backend is redeployed (`npm start` in `backend` on Render).

## Algorithm (honest)

**Nearest-neighbor VRP heuristic** with vehicle capacity:

1. Sort orders by priority, then earliest deadline  
2. For each vehicle, repeatedly pick the closest unassigned order that fits remaining kg  
3. ETA ≈ Haversine km ÷ 30 km/h  

Also reports **greedy vs random first-fit** average distance (25–50 trials) so you can quote a savings %.

Offline benchmark (no DB):

```bash
cd backend
npm run benchmark
```

---

## Key API endpoints
|---|---|---|
| POST | /api/v1/auth/login | Public |
| GET | /api/v1/orders | Admin, Dispatcher |
| POST | /api/v1/routes/optimize | Admin, Dispatcher |
| GET | /api/v1/routes | Admin, Dispatcher, Driver (own routes) |
| GET | /api/v1/drivers/me | Linked driver profile |
| GET | /api/v1/analytics/summary | Admin only |
| GET | /health | Public |

---

## Project structure

```
SmartRoute/
├── frontend/          # React + Vite + Leaflet
│   └── src/
│       ├── pages/     # Login, dashboards, Orders, Routes, Driver
│       ├── components/RouteMap.tsx
│       └── api/
└── backend/
    ├── src/modules/   # auth, order, route, driver, vehicle, warehouse, analytics
    ├── scripts/benchmark-optimizer.ts
    └── prisma/        # schema + seed
```

---
