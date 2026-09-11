/**
 * test-feature2.js — Feature 2: Warehouse, Vehicle, Driver CRUD tests
 *
 * HOW THIS WORKS:
 * 1. We first log in to get a JWT access token (reusing auth from Feature 1)
 * 2. Every request after that sends: Authorization: Bearer <token>
 * 3. We test: create → read → update → delete for each resource
 * 4. We also test the BUSINESS RULES (duplicate names, invalid vehicleId, etc.)
 *
 * Run with: node test-feature2.js
 */

const BASE = "http://localhost:3000/api/v1";
let token = "";
let warehouseId = "";
let vehicleId = "";
let driverId = "";

// Unique suffix per run — prevents data collision when tests run multiple times
// e.g. "Hub-1234", plate "MH12AB1234" → "MH-1234"
const RUN_ID = Date.now().toString().slice(-4);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const req = async (method, path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // 204 has no body
  if (res.status === 204) return { status: 204, body: null };

  const data = await res.json();
  return { status: res.status, body: data };
};

let passed = 0;
let failed = 0;

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

// ─── Tests ────────────────────────────────────────────────────────────────────

async function run() {
  console.log("\n━━━ SETUP: Login ━━━");

  // Login with the admin user created in Feature 1
  const loginRes = await req("POST", "/auth/login", {
    email: "admin@smartroute.com",
    password: "admin1234",
  });

  check("Login succeeds", loginRes.status === 200, loginRes.body);
  token = loginRes.body?.data?.accessToken;
  check("Got access token", !!token, loginRes.body);

  // ─────────────────────────────────────────────────────────────
  console.log("\n━━━ WAREHOUSE TESTS ━━━");

  // --- Create
  const wCreate = await req("POST", "/warehouses", {
    name: `Mumbai Central Hub ${RUN_ID}`,
    address: "LBS Road, Kurla West, Mumbai 400070",
    latitude: 19.0728,
    longitude: 72.8826,
  });
  check("Create warehouse → 201", wCreate.status === 201, wCreate.body);
  check("Response has id", !!wCreate.body?.data?.id, wCreate.body);
  warehouseId = wCreate.body?.data?.id;

  // --- Duplicate name blocked
  const wDuplicate = await req("POST", "/warehouses", {
    name: `Mumbai Central Hub ${RUN_ID}`, // same name
    address: "Different address",
    latitude: 19.08,
    longitude: 72.88,
  });
  check("Duplicate warehouse name → 409", wDuplicate.status === 409, wDuplicate.body);
  check("Error code WAREHOUSE_NAME_TAKEN", wDuplicate.body?.error?.code === "WAREHOUSE_NAME_TAKEN", wDuplicate.body);

  // --- Invalid coordinates
  const wBadCoords = await req("POST", "/warehouses", {
    name: "Bad Warehouse",
    address: "Somewhere",
    latitude: 999, // Invalid — > 90
    longitude: 72.88,
  });
  check("Invalid latitude → 400", wBadCoords.status === 400, wBadCoords.body);

  // --- Get all
  const wAll = await req("GET", "/warehouses");
  check("Get all warehouses → 200", wAll.status === 200, wAll.body);
  check("Returns array", Array.isArray(wAll.body?.data), wAll.body);

  // --- Get by ID
  const wOne = await req("GET", `/warehouses/${warehouseId}`);
  check("Get warehouse by ID → 200", wOne.status === 200, wOne.body);
  check("Correct warehouse returned", wOne.body?.data?.name === `Mumbai Central Hub ${RUN_ID}`, wOne.body);

  // --- Non-existent
  const wMissing = await req("GET", "/warehouses/00000000-0000-0000-0000-000000000000");
  check("Non-existent warehouse → 404", wMissing.status === 404, wMissing.body);

  // --- Update
  const wUpdate = await req("PATCH", `/warehouses/${warehouseId}`, {
    name: `Mumbai North Hub ${RUN_ID}`,
  });
  check("Update warehouse → 200", wUpdate.status === 200, wUpdate.body);
  check("Name updated correctly", wUpdate.body?.data?.name === `Mumbai North Hub ${RUN_ID}`, wUpdate.body);

  // --- Empty update blocked
  const wEmptyUpdate = await req("PATCH", `/warehouses/${warehouseId}`, {});
  check("Empty PATCH body → 400", wEmptyUpdate.status === 400, wEmptyUpdate.body);

  // --- Unauthenticated request
  const savedToken = token;
  token = "";
  const wUnauth = await req("GET", "/warehouses");
  check("No token → 401", wUnauth.status === 401, wUnauth.body);
  token = savedToken;

  // ─────────────────────────────────────────────────────────────
  console.log("\n━━━ VEHICLE TESTS ━━━");

  // --- Create
  const vCreate = await req("POST", "/vehicles", {
    plateNumber: `mh${RUN_ID}ab1234`, // lowercase — schema normalizes to uppercase
    type: "VAN",
    capacityKg: 800,
    fuelType: "DIESEL",
  });
  check("Create vehicle → 201", vCreate.status === 201, vCreate.body);
  check("Plate normalized to uppercase", vCreate.body?.data?.plateNumber === `MH${RUN_ID.toUpperCase()}AB1234`, vCreate.body);
  vehicleId = vCreate.body?.data?.id;

  // --- Duplicate plate
  const vDuplicate = await req("POST", "/vehicles", {
    plateNumber: `MH${RUN_ID.toUpperCase()}AB1234`,
    type: "TRUCK",
    capacityKg: 2000,
    fuelType: "PETROL",
  });
  check("Duplicate plate → 409", vDuplicate.status === 409, vDuplicate.body);

  // --- Invalid type
  const vBadType = await req("POST", "/vehicles", {
    plateNumber: "DL01XY9999",
    type: "BICYCLE", // not in enum
    capacityKg: 10,
    fuelType: "PETROL",
  });
  check("Invalid vehicle type → 400", vBadType.status === 400, vBadType.body);

  // --- Get all
  const vAll = await req("GET", "/vehicles");
  check("Get all vehicles → 200", vAll.status === 200, vAll.body);

  // --- Update
  const vUpdate = await req("PATCH", `/vehicles/${vehicleId}`, { capacityKg: 1000 });
  check("Update vehicle capacity → 200", vUpdate.status === 200, vUpdate.body);
  check("Capacity updated", vUpdate.body?.data?.capacityKg === 1000, vUpdate.body);

  // ─────────────────────────────────────────────────────────────
  console.log("\n━━━ DRIVER TESTS ━━━");

  // --- Create (with vehicle assignment)
  const dCreate = await req("POST", "/drivers", {
    name: "Rajesh Kumar",
    phone: `+91-98765${RUN_ID}`,
    licenseNumber: `mh${RUN_ID}20240001`, // lowercase — normalized
    vehicleId: vehicleId,
  });
  check("Create driver with vehicle → 201", dCreate.status === 201, dCreate.body);
  check("License normalized to uppercase", dCreate.body?.data?.licenseNumber === `MH${RUN_ID.toUpperCase()}20240001`, dCreate.body);
  check("vehicleId set correctly", dCreate.body?.data?.vehicleId === vehicleId, dCreate.body);
  driverId = dCreate.body?.data?.id;

  // --- Duplicate phone
  const dDupPhone = await req("POST", "/drivers", {
    name: "Another Person",
    phone: `+91-98765${RUN_ID}`, // same phone
    licenseNumber: "DL9999992024",
  });
  check("Duplicate phone → 409", dDupPhone.status === 409, dDupPhone.body);

  // --- Invalid vehicleId
  const dBadVehicle = await req("POST", "/drivers", {
    name: "Ghost Driver",
    phone: "+91-1111111111",
    licenseNumber: "KA0120240099",
    vehicleId: "00000000-0000-0000-0000-000000000000", // doesn't exist
  });
  check("Non-existent vehicleId → 400", dBadVehicle.status === 400, dBadVehicle.body);

  // --- Get all
  const dAll = await req("GET", "/drivers");
  check("Get all drivers → 200", dAll.status === 200, dAll.body);

  // --- Update
  const dUpdate = await req("PATCH", `/drivers/${driverId}`, { name: "Rajesh K. Kumar" });
  check("Update driver name → 200", dUpdate.status === 200, dUpdate.body);
  check("Name updated", dUpdate.body?.data?.name === "Rajesh K. Kumar", dUpdate.body);

  // --- Delete
  const dDelete = await req("DELETE", `/drivers/${driverId}`);
  check("Delete driver → 204", dDelete.status === 204, dDelete);

  // --- Confirm deleted driver not returned
  const dMissing = await req("GET", `/drivers/${driverId}`);
  check("Deleted driver → 404", dMissing.status === 404, dMissing.body);

  // ─────────────────────────────────────────────────────────────
  console.log(`\n━━━ RESULTS ━━━`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);

  if (failed === 0) {
    console.log("\n  🎉 All tests passing — Feature 2 complete.\n");
  } else {
    console.log("\n  ⚠️  Some tests failed — check output above.\n");
  }
}

run().catch(console.error);
