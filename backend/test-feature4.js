/**
 * test-feature4.js — Feature 4: Route Optimization tests
 *
 * WHAT WE TEST:
 * 1. Full optimization flow (create orders → optimize → verify routes created)
 * 2. Business rules (no pending orders, invalid vehicles, vehicle already active)
 * 3. Route status transitions (start → complete, cancel → orders revert)
 * 4. Get route with stops
 */

const BASE = "http://localhost:3000/api/v1";
let token = "";
const RUN_ID = Date.now().toString().slice(-4);

let warehouseId = "";
let vehicleId = "";
let driverId = "";
let routeId = "";

let passed = 0;
let failed = 0;

const req = async (method, path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return { status: 204, body: null };
  const data = await res.json();
  return { status: res.status, body: data };
};

const check = (label, condition, got) => {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.log(`  ❌ ${label}`); console.log(`     Got:`, JSON.stringify(got, null, 2)); failed++; }
};

async function run() {
  // ── SETUP ──────────────────────────────────────────────────────────────────
  console.log("\n━━━ SETUP: Login + seed data ━━━");

  const loginRes = await req("POST", "/auth/login", {
    email: "admin@smartroute.com", password: "admin1234",
  });
  check("Login succeeds", loginRes.status === 200, loginRes.body);
  token = loginRes.body?.data?.accessToken;

  // Create warehouse
  const whRes = await req("POST", "/warehouses", {
    name: `Optimizer Hub ${RUN_ID}`,
    address: "LBS Road, Mumbai",
    latitude: 19.0728,
    longitude: 72.8826,
  });
  check("Create warehouse → 201", whRes.status === 201, whRes.body);
  warehouseId = whRes.body?.data?.id;

  // Create vehicle
  const vhRes = await req("POST", "/vehicles", {
    plateNumber: `OPT${RUN_ID}XX`,
    type: "VAN",
    capacityKg: 500,
    fuelType: "DIESEL",
  });
  check("Create vehicle → 201", vhRes.status === 201, vhRes.body);
  vehicleId = vhRes.body?.data?.id;

  // Create driver
  const drRes = await req("POST", "/drivers", {
    name: `Optimizer Driver ${RUN_ID}`,
    phone: `+91-777${RUN_ID}0000`,
    licenseNumber: `OPT${RUN_ID}DR`,
    vehicleId,
  });
  check("Create driver → 201", drRes.status === 201, drRes.body);
  driverId = drRes.body?.data?.id;

  // Create 3 pending orders for this warehouse
  const orderData = [
    { customerName: `Customer A ${RUN_ID}`, address: "Bandra West", latitude: 19.0596, longitude: 72.8295, priority: "HIGH",   weightKg: 50,  warehouseId },
    { customerName: `Customer B ${RUN_ID}`, address: "Andheri East", latitude: 19.1136, longitude: 72.8697, priority: "MEDIUM", weightKg: 80,  warehouseId },
    { customerName: `Customer C ${RUN_ID}`, address: "Kurla West",   latitude: 19.0728, longitude: 72.8826, priority: "LOW",    weightKg: 30,  warehouseId },
  ];

  const orderIds = [];
  for (const od of orderData) {
    const r = await req("POST", "/orders", od);
    check(`Create order (${od.priority}) → 201`, r.status === 201, r.body);
    orderIds.push(r.body?.data?.id);
  }

  // ── OPTIMIZATION BUSINESS RULES ────────────────────────────────────────────
  console.log("\n━━━ OPTIMIZATION RULES ━━━");

  // No pending orders for a different warehouse
  const whRes2 = await req("POST", "/warehouses", {
    name: `Empty Hub ${RUN_ID}`, address: "Delhi", latitude: 28.6139, longitude: 77.2090,
  });
  const emptyWarehouseId = whRes2.body?.data?.id;

  const noOrders = await req("POST", "/routes/optimize", {
    warehouseId: emptyWarehouseId,
    vehicleIds: [vehicleId],
    driverIds: [driverId],
  });
  check("No pending orders → 400", noOrders.status === 400, noOrders.body);
  check("Error code NO_PENDING_ORDERS", noOrders.body?.error?.code === "NO_PENDING_ORDERS", noOrders.body);

  // Mismatched vehicleIds/driverIds length
  const mismatch = await req("POST", "/routes/optimize", {
    warehouseId,
    vehicleIds: [vehicleId],
    driverIds: [], // empty — doesn't match vehicleIds.length
  });
  check("Mismatched vehicle/driver count → 400", mismatch.status === 400, mismatch.body);

  // Invalid vehicleId
  const badVehicle = await req("POST", "/routes/optimize", {
    warehouseId,
    vehicleIds: ["00000000-0000-0000-0000-000000000000"],
    driverIds: [driverId],
  });
  check("Invalid vehicleId → 400", badVehicle.status === 400, badVehicle.body);
  check("Error code INVALID_VEHICLES", badVehicle.body?.error?.code === "INVALID_VEHICLES", badVehicle.body);

  // ── RUN OPTIMIZATION ───────────────────────────────────────────────────────
  console.log("\n━━━ RUN OPTIMIZATION ━━━");

  const optRes = await req("POST", "/routes/optimize", {
    warehouseId,
    vehicleIds: [vehicleId],
    driverIds: [driverId],
  });
  check("Optimize → 201", optRes.status === 201, optRes.body);
  check("Routes created", optRes.body?.data?.routesCreated >= 1, optRes.body);
  check("Unassigned orders = 0", optRes.body?.data?.unassignedOrderCount === 0, optRes.body);

  routeId = optRes.body?.data?.routes?.[0]?.id;
  check("Got route ID", !!routeId, optRes.body);

  // Verify orders are now ASSIGNED
  const order1 = await req("GET", `/orders/${orderIds[0]}`);
  check("Order 1 is now ASSIGNED", order1.body?.data?.status === "ASSIGNED", order1.body);

  // ── GET ROUTE WITH STOPS ───────────────────────────────────────────────────
  console.log("\n━━━ GET ROUTE WITH STOPS ━━━");

  const routeDetail = await req("GET", `/routes/${routeId}`);
  check("Get route by ID → 200", routeDetail.status === 200, routeDetail.body);
  check("Route has stops array", Array.isArray(routeDetail.body?.data?.stops), routeDetail.body);
  check("Route has 3 stops", routeDetail.body?.data?.stops?.length === 3, routeDetail.body);
  // Nearest-neighbor picks the CLOSEST order first — not necessarily the highest priority.
  // If a LOW priority order is nearest to the warehouse, it goes first. That's correct.
  // We verify all 3 orders are present in the route instead.
  const stopOrderIds = routeDetail.body?.data?.stops?.map(s => s.orderId) ?? [];
  check("All 3 orders are in the route", 
    orderIds.every(id => stopOrderIds.includes(id)), 
    stopOrderIds
  );
  check("Stops are ordered by sequence", routeDetail.body?.data?.stops?.[0]?.stopSequence === 1, routeDetail.body);
  check("totalDistanceKm is set", typeof routeDetail.body?.data?.totalDistanceKm === "number", routeDetail.body);

  // ── STATUS TRANSITIONS ─────────────────────────────────────────────────────
  console.log("\n━━━ STATUS TRANSITIONS ━━━");

  // Can't complete before starting
  const earlyComplete = await req("PATCH", `/routes/${routeId}/complete`);
  check("Complete PLANNED route → 400", earlyComplete.status === 400, earlyComplete.body);
  check("Error code INVALID_STATUS_TRANSITION", earlyComplete.body?.error?.code === "INVALID_STATUS_TRANSITION", earlyComplete.body);

  // Start the route
  const startRes = await req("PATCH", `/routes/${routeId}/start`);
  check("Start route → 200", startRes.status === 200, startRes.body);
  check("Status is now IN_PROGRESS", startRes.body?.data?.status === "IN_PROGRESS", startRes.body);
  check("actualDepartureAt is set", !!startRes.body?.data?.actualDepartureAt, startRes.body);

  // Can't start again
  const startAgain = await req("PATCH", `/routes/${routeId}/start`);
  check("Start IN_PROGRESS route → 400", startAgain.status === 400, startAgain.body);

  // Can't cancel IN_PROGRESS route
  const cancelActive = await req("PATCH", `/routes/${routeId}/cancel`);
  check("Cancel IN_PROGRESS route → 400", cancelActive.status === 400, cancelActive.body);

  // Complete the route
  const completeRes = await req("PATCH", `/routes/${routeId}/complete`);
  check("Complete IN_PROGRESS route → 200", completeRes.status === 200, completeRes.body);
  check("Status is now COMPLETED", completeRes.body?.data?.status === "COMPLETED", completeRes.body);
  check("completedAt is set", !!completeRes.body?.data?.completedAt, completeRes.body);

  // ── CANCEL + REVERT TEST ───────────────────────────────────────────────────
  console.log("\n━━━ CANCEL ROUTE + ORDER REVERT ━━━");

  // Create fresh orders and a second route to test cancel
  const freshOrder = await req("POST", "/orders", {
    customerName: `Cancel Test ${RUN_ID}`,
    address: "Dadar, Mumbai",
    latitude: 19.018,
    longitude: 72.847,
    warehouseId,
  });
  const freshOrderId = freshOrder.body?.data?.id;

  // Create a new vehicle/driver pair for second route
  const v2 = await req("POST", "/vehicles", {
    plateNumber: `CAN${RUN_ID}ZZ`,
    type: "CAR",
    capacityKg: 200,
    fuelType: "PETROL",
  });
  const d2 = await req("POST", "/drivers", {
    name: `Cancel Driver ${RUN_ID}`,
    phone: `+91-888${RUN_ID}0000`,
    licenseNumber: `CAN${RUN_ID}DL`,
  });

  const opt2 = await req("POST", "/routes/optimize", {
    warehouseId,
    vehicleIds: [v2.body?.data?.id],
    driverIds: [d2.body?.data?.id],
  });
  check("Second optimization → 201", opt2.status === 201, opt2.body);

  const routeId2 = opt2.body?.data?.routes?.[0]?.id;

  // Verify order is ASSIGNED
  const assignedOrder = await req("GET", `/orders/${freshOrderId}`);
  check("Fresh order is ASSIGNED", assignedOrder.body?.data?.status === "ASSIGNED", assignedOrder.body);

  // Cancel the route
  const cancelRes = await req("PATCH", `/routes/${routeId2}/cancel`);
  check("Cancel PLANNED route → 200", cancelRes.status === 200, cancelRes.body);

  // Verify order reverted to PENDING
  const revertedOrder = await req("GET", `/orders/${freshOrderId}`);
  check("Order reverted to PENDING after route cancel", revertedOrder.body?.data?.status === "PENDING", revertedOrder.body);

  // ── GET ALL ROUTES ─────────────────────────────────────────────────────────
  console.log("\n━━━ GET ALL ROUTES ━━━");
  const allRoutes = await req("GET", "/routes");
  check("Get all routes → 200", allRoutes.status === 200, allRoutes.body);
  check("Returns array", Array.isArray(allRoutes.body?.data), allRoutes.body);

  // ── RESULTS ────────────────────────────────────────────────────────────────
  console.log(`\n━━━ RESULTS ━━━`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);
  if (failed === 0) console.log("\n  🎉 All tests passing — Feature 4 complete.\n");
  else console.log("\n  ⚠️  Some tests failed — check output above.\n");
}

run().catch(console.error);
