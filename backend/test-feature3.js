/**
 * test-feature3.js — Feature 3: Order CRUD + business rule tests
 *
 * WHAT WE TEST:
 * 1. Create orders (valid and invalid inputs)
 * 2. Get all orders (with and without filters)
 * 3. Get single order
 * 4. Update order (only PENDING allowed)
 * 5. Cancel order (PENDING and DELIVERED blocking)
 * 6. Delete order (only PENDING/CANCELLED allowed)
 * 7. Auth guard (no token → 401)
 */

const BASE = "http://localhost:3000/api/v1";
let token = "";
let warehouseId = "";
let orderId = "";
const RUN_ID = Date.now().toString().slice(-4);

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
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    console.log(`     Got:`, JSON.stringify(got, null, 2));
    failed++;
  }
};

async function run() {
  // ── SETUP ──────────────────────────────────────────────────────────────────
  console.log("\n━━━ SETUP: Login + get warehouse ━━━");

  const loginRes = await req("POST", "/auth/login", {
    email: "admin@smartroute.com",
    password: "admin1234",
  });
  check("Login succeeds", loginRes.status === 200, loginRes.body);
  token = loginRes.body?.data?.accessToken;

  // Get any existing warehouse to use as warehouseId
  const whRes = await req("GET", "/warehouses");
  check("Got warehouses", whRes.status === 200, whRes.body);
  warehouseId = whRes.body?.data?.[0]?.id;
  check("Has at least one warehouse", !!warehouseId, whRes.body);

  if (!warehouseId) {
    console.log("\n  ⛔ No warehouse found — create one first with test-feature2.js\n");
    return;
  }

  // ── CREATE ─────────────────────────────────────────────────────────────────
  console.log("\n━━━ ORDER CREATION ━━━");

  // Valid order
  const oCreate = await req("POST", "/orders", {
    customerName: `Customer ${RUN_ID}`,
    address: `123 Main Street, Bandra, Mumbai ${RUN_ID}`,
    latitude: 19.0596,
    longitude: 72.8295,
    priority: "HIGH",
    latestDelivery: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hrs from now
    weightKg: 25.5,
    warehouseId,
  });
  check("Create order → 201", oCreate.status === 201, oCreate.body);
  check("Status defaults to PENDING", oCreate.body?.data?.status === "PENDING", oCreate.body);
  check("Priority is HIGH", oCreate.body?.data?.priority === "HIGH", oCreate.body);
  check("weightKg saved correctly", oCreate.body?.data?.weightKg === 25.5, oCreate.body);
  orderId = oCreate.body?.data?.id;

  // Invalid warehouseId
  const oInvalidWh = await req("POST", "/orders", {
    customerName: "Ghost Customer",
    address: "Nowhere Street",
    latitude: 19.05,
    longitude: 72.88,
    warehouseId: "00000000-0000-0000-0000-000000000000",
  });
  check("Non-existent warehouseId → 400", oInvalidWh.status === 400, oInvalidWh.body);
  check("Error code WAREHOUSE_NOT_FOUND", oInvalidWh.body?.error?.code === "WAREHOUSE_NOT_FOUND", oInvalidWh.body);

  // Invalid: latestDelivery in the past
  const oPastDate = await req("POST", "/orders", {
    customerName: "Time Traveler",
    address: "Past Address",
    latitude: 19.05,
    longitude: 72.88,
    warehouseId,
    latestDelivery: new Date(Date.now() - 1000).toISOString(), // 1 second ago
  });
  check("Past latestDelivery → 400", oPastDate.status === 400, oPastDate.body);

  // Invalid: latestDelivery before earliestDelivery
  const oInvalidWindow = await req("POST", "/orders", {
    customerName: "Window Error",
    address: "Some Address",
    latitude: 19.05,
    longitude: 72.88,
    warehouseId,
    earliestDelivery: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), // 5 hrs from now
    latestDelivery: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),   // 2 hrs from now (BEFORE earliest)
  });
  check("latestDelivery before earliestDelivery → 400", oInvalidWindow.status === 400, oInvalidWindow.body);

  // Invalid priority
  const oBadPriority = await req("POST", "/orders", {
    customerName: "Bad Priority",
    address: "Some address",
    latitude: 19.05,
    longitude: 72.88,
    warehouseId,
    priority: "CRITICAL", // not in enum
  });
  check("Invalid priority → 400", oBadPriority.status === 400, oBadPriority.body);

  // ── READ ───────────────────────────────────────────────────────────────────
  console.log("\n━━━ ORDER RETRIEVAL ━━━");

  // Get all
  const oAll = await req("GET", "/orders");
  check("Get all orders → 200", oAll.status === 200, oAll.body);
  check("Returns array", Array.isArray(oAll.body?.data), oAll.body);

  // Filter by status
  const oPending = await req("GET", "/orders?status=PENDING");
  check("Filter by status=PENDING → 200", oPending.status === 200, oPending.body);
  check("All returned orders are PENDING",
    (oPending.body?.data || []).every(o => o.status === "PENDING"),
    oPending.body
  );

  // Filter by priority
  const oHigh = await req("GET", "/orders?priority=HIGH");
  check("Filter by priority=HIGH → 200", oHigh.status === 200, oHigh.body);

  // Invalid status filter
  const oBadFilter = await req("GET", "/orders?status=SHIPPED");
  check("Invalid status filter → 400", oBadFilter.status === 400, oBadFilter.body);

  // Filter by warehouseId
  const oByWarehouse = await req("GET", `/orders?warehouseId=${warehouseId}`);
  check("Filter by warehouseId → 200", oByWarehouse.status === 200, oByWarehouse.body);

  // Get by ID
  const oOne = await req("GET", `/orders/${orderId}`);
  check("Get order by ID → 200", oOne.status === 200, oOne.body);
  check("Correct order returned", oOne.body?.data?.id === orderId, oOne.body);

  // Non-existent order
  const oMissing = await req("GET", "/orders/00000000-0000-0000-0000-000000000000");
  check("Non-existent order → 404", oMissing.status === 404, oMissing.body);

  // ── UPDATE ─────────────────────────────────────────────────────────────────
  console.log("\n━━━ ORDER UPDATE ━━━");

  // Valid update (order is still PENDING)
  const oUpdate = await req("PATCH", `/orders/${orderId}`, {
    customerName: `Updated Customer ${RUN_ID}`,
    priority: "LOW",
  });
  check("Update PENDING order → 200", oUpdate.status === 200, oUpdate.body);
  check("customerName updated", oUpdate.body?.data?.customerName === `Updated Customer ${RUN_ID}`, oUpdate.body);
  check("priority updated to LOW", oUpdate.body?.data?.priority === "LOW", oUpdate.body);

  // Empty update
  const oEmptyUpdate = await req("PATCH", `/orders/${orderId}`, {});
  check("Empty PATCH body → 400", oEmptyUpdate.status === 400, oEmptyUpdate.body);

  // ── CANCEL ─────────────────────────────────────────────────────────────────
  console.log("\n━━━ ORDER CANCEL ━━━");

  // Create a second order to test cancel
  const oCreate2 = await req("POST", "/orders", {
    customerName: `Cancel Test ${RUN_ID}`,
    address: "Cancel Street, Mumbai",
    latitude: 19.07,
    longitude: 72.87,
    warehouseId,
  });
  const orderId2 = oCreate2.body?.data?.id;

  const oCancel = await req("PATCH", `/orders/${orderId2}/cancel`);
  check("Cancel PENDING order → 200", oCancel.status === 200, oCancel.body);
  check("Status is now CANCELLED", oCancel.body?.data?.status === "CANCELLED", oCancel.body);

  // Try to cancel again (already cancelled)
  const oCancelAgain = await req("PATCH", `/orders/${orderId2}/cancel`);
  check("Cancel already-cancelled order → 400", oCancelAgain.status === 400, oCancelAgain.body);
  check("Error code ORDER_ALREADY_CANCELLED", oCancelAgain.body?.error?.code === "ORDER_ALREADY_CANCELLED", oCancelAgain.body);

  // Try to update a cancelled order
  const oUpdateCancelled = await req("PATCH", `/orders/${orderId2}`, { priority: "HIGH" });
  check("Update CANCELLED order → 400", oUpdateCancelled.status === 400, oUpdateCancelled.body);
  check("Error code ORDER_NOT_EDITABLE", oUpdateCancelled.body?.error?.code === "ORDER_NOT_EDITABLE", oUpdateCancelled.body);

  // ── DELETE ─────────────────────────────────────────────────────────────────
  console.log("\n━━━ ORDER DELETE ━━━");

  // Delete the cancelled order (should work)
  const oDelete = await req("DELETE", `/orders/${orderId2}`);
  check("Delete CANCELLED order → 204", oDelete.status === 204, oDelete);

  // Confirm deleted
  const oDeleted = await req("GET", `/orders/${orderId2}`);
  check("Deleted order → 404", oDeleted.status === 404, oDeleted.body);

  // Try to delete the first order (still PENDING → should work)
  const oDeletePending = await req("DELETE", `/orders/${orderId}`);
  check("Delete PENDING order → 204", oDeletePending.status === 204, oDeletePending);

  // ── AUTH ───────────────────────────────────────────────────────────────────
  console.log("\n━━━ AUTH GUARD ━━━");
  const savedToken = token;
  token = "";
  const oUnauth = await req("GET", "/orders");
  check("No token → 401", oUnauth.status === 401, oUnauth.body);
  token = savedToken;

  // ── RESULTS ────────────────────────────────────────────────────────────────
  console.log(`\n━━━ RESULTS ━━━`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);
  if (failed === 0) {
    console.log("\n  🎉 All tests passing — Feature 3 complete.\n");
  } else {
    console.log("\n  ⚠️  Some tests failed — check output above.\n");
  }
}

run().catch(console.error);
