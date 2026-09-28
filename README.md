# 🚛 SmartRoute —  Delivery Route Optimization and Fleet Management

SmartRoute is a full-stack web application that helps logistics companies **optimize delivery routes**, **manage drivers**, and **track orders** in real time.

🔗 **Live Demo:** [smartroute-app-v1.vercel.app](https://smartroute-app-v1.vercel.app)

---

## ✨ Features

- **One-click demo login** — Instantly access Dispatcher or Admin view
- **Dispatcher Dashboard** — View incoming orders, assign drivers, and optimize routes
- **Route Optimization Engine** — Automatically assigns orders to drivers using a nearest-neighbor algorithm
- **Driver Portal** — Drivers see their assigned routes with stop-by-stop timelines
- **Admin Dashboard** — Executive KPIs, fleet analytics, and warehouse performance
- **Real-time order tracking** — Order statuses update as routes progress

---

## 🖥️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Deployment | Vercel (frontend) · Render (backend + DB) |

---

## 🚀 Try the Live App

1. Go to **[smartroute-app-v1.vercel.app](https://smartroute-app-v1.vercel.app)**
2. Click **🚚 Login as Dispatcher** to manage orders and optimize routes
3. Click **⚡ Login as Admin** to see KPIs and analytics

> No sign-up needed. Demo accounts are pre-loaded with realistic data.

---

## 🔄 Demo Workflow

```
Login as Dispatcher
  → View Pending Orders (Hyderabad warehouse)
  → Select vehicles + drivers
  → Click "Run Optimization"
  → See optimized routes with stop sequence and ETAs
  → Go to Driver Portal → See Suresh Reddy's active route
```

---

## 🏗️ Project Structure

```
SmartRoute/
├── frontend/          # React app (Vite + TypeScript)
│   └── src/
│       ├── pages/     # LoginPage, DispatcherDashboard, AdminDashboard, DriverPage
│       ├── api/       # API client functions
│       └── types/     # Shared TypeScript interfaces
│
└── backend/           # Express API (TypeScript)
    ├── src/
    │   ├── modules/   # auth, order, route, driver, vehicle, warehouse, analytics
    │   └── prisma/    # DB client
    └── prisma/
        ├── schema.prisma   # Database schema
        └── seed.ts         # Demo data seeder
```

---

## 🛠️ Run Locally

### Prerequisites
- Node.js 18+
- PostgreSQL running on port 5433

### Backend
```bash
cd backend
npm install
cp .env.example .env      # fill in your DATABASE_URL and JWT secrets
npx prisma migrate dev    # run migrations
npm run db:seed           # load demo data
npm run dev               # starts on http://localhost:3000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env      # set VITE_API_URL=http://localhost:3000/api/v1
npm run dev               # starts on http://localhost:5173
```

---

## 👤 Demo Accounts

| Role | Email | Password |
|---|---|---|
| Dispatcher | dispatcher@smartroute.io | Password@123 |
| Admin | admin@smartroute.io | Password@123 |

---

## 📦 Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/auth/login` | Login with email + password |
| GET | `/api/v1/orders` | List all orders (filter by status) |
| POST | `/api/v1/routes/optimize` | Run route optimization |
| GET | `/api/v1/drivers` | List all drivers with their routes |
| GET | `/api/v1/analytics/summary` | Admin KPI summary |
| GET | `/health` | Backend health check |

---


## 🗄️ Database Schema (Key Models)

- **User** — Admin or Dispatcher login
- **Warehouse** — Origin hub for deliveries (7 South Indian cities)
- **Vehicle** — Trucks, vans, motorcycles with capacity
- **Driver** — Assigned to vehicles, owns routes
- **Order** — Customer delivery with address, weight, priority, time window
- **Route** — Optimized path assigned to a driver + vehicle
- **RouteStop** — Individual delivery stop within a route


