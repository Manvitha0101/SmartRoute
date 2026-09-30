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
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT access tokens + httpOnly refresh cookies, role RBAC |
| Deploy | Vercel (frontend) · Render (backend + DB) |

---

## Try the live app

1. Open [smartroute-app-v1.vercel.app](https://smartroute-app-v1.vercel.app)
2. **Login as Dispatcher** → pending Hyderabad orders → Run Optimization → Map & Stops
3. **Login as Driver** → Suresh Reddy's assigned routes
4. **Login as Admin** → KPIs

---

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Dispatcher | dispatcher@smartroute.io | Password@123 |
| Admin | admin@smartroute.io | Password@123 |
| Driver | driver@smartroute.io | Password@123 |

---

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

## Run locally

**Prerequisites:** Node 18+, PostgreSQL (or `docker compose up -d` for PostGIS on port 5433)

### Backend

```bash
cd backend
npm install
cp .env.example .env      # DATABASE_URL, JWT secrets
npx prisma migrate deploy
npm run db:seed
npm run dev               # http://localhost:3000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:3000/api/v1
npm run dev               # http://localhost:5173
```

---

## Key API endpoints

| Method | Endpoint | Who |
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

## Resume one-liner

> Full-stack fleet dispatch system with capacity-aware nearest-neighbor VRP, JWT role RBAC (Admin / Dispatcher / Driver), Leaflet route maps, and measured distance savings vs random assignment (React, Node, Prisma, Postgres).
