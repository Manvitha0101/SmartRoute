/**
 * test-feature5.js — Feature 5: Analytics tests
 */

const BASE = "http://localhost:3000/api/v1";
let token = "";
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
  const data = await res.json();
  return { status: res.status, body: data };
};

const check = (label, condition, got) => {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.log(`  ❌ ${label}`); console.log(`     Got:`, JSON.stringify(got, null, 2)); failed++; }
};

async function run() {
  console.log("\n━━━ SETUP ━━━");
  const loginRes = await req("POST", "/auth/login", {
    email: "admin@smartroute.com", password: "admin1234",
  });
  check("Login succeeds", loginRes.status === 200, loginRes.body);
  token = loginRes.body?.data?.accessToken;

  console.log("\n━━━ ANALYTICS SUMMARY ━━━");

  const res = await req("GET", "/analytics/summary");
  check("Summary → 200", res.status === 200, res.body);

  const data = res.body?.data;

  // Shape checks — all fields must be present
  check("Has orders object",    typeof data?.orders === "object",  data);
  check("Has routes object",    typeof data?.routes === "object",  data);
  check("Has busyWarehouses",   Array.isArray(data?.busyWarehouses), data);

  // Order fields
  check("orders.total is number",     typeof data?.orders?.total === "number",     data?.orders);
  check("orders.pending is number",   typeof data?.orders?.pending === "number",   data?.orders);
  check("orders.delivered is number", typeof data?.orders?.delivered === "number", data?.orders);
  check("orders.failed is number",    typeof data?.orders?.failed === "number",    data?.orders);
  check("orders.cancelled is number", typeof data?.orders?.cancelled === "number", data?.orders);

  // totals add up
  const { pending, assigned, delivered, failed: f, cancelled } = data?.orders ?? {};
  check(
    "orders.total = sum of all statuses",
    data?.orders?.total === pending + assigned + delivered + f + cancelled,
    data?.orders
  );

  // Route fields
  check("routes.total is number",       typeof data?.routes?.total === "number",       data?.routes);
  check("routes.completed is number",   typeof data?.routes?.completed === "number",   data?.routes);
  check("routes.avgDistanceKm is number", typeof data?.routes?.avgDistanceKm === "number", data?.routes);

  // Success rate: null (no deliveries) or a number between 0-100
  const rate = data?.deliverySuccessRate;
  check(
    "deliverySuccessRate is null or 0-100",
    rate === null || (typeof rate === "number" && rate >= 0 && rate <= 100),
    rate
  );

  // busyWarehouses entries have the right shape
  if (data?.busyWarehouses?.length > 0) {
    const first = data.busyWarehouses[0];
    check("busyWarehouse has warehouseId", typeof first.warehouseId === "string", first);
    check("busyWarehouse has name",        typeof first.name === "string",        first);
    check("busyWarehouse has orderCount",  typeof first.orderCount === "number",  first);
    check("busyWarehouses ordered desc",
      data.busyWarehouses.every((w, i, arr) =>
        i === 0 || arr[i - 1].orderCount >= w.orderCount
      ),
      data.busyWarehouses
    );
  }

  console.log("\n━━━ AUTH GUARD ━━━");
  const savedToken = token;
  token = "";
  const unauth = await req("GET", "/analytics/summary");
  check("No token → 401", unauth.status === 401, unauth.body);
  token = savedToken;

  console.log("\n━━━ LIVE DATA CHECK ━━━");
  console.log("  Current system state:");
  console.log(`    Orders:  total=${data?.orders?.total}, pending=${data?.orders?.pending}, delivered=${data?.orders?.delivered}`);
  console.log(`    Routes:  total=${data?.routes?.total}, completed=${data?.routes?.completed}, avgKm=${data?.routes?.avgDistanceKm}`);
  console.log(`    Success rate: ${data?.deliverySuccessRate ?? "N/A (no deliveries yet)"}%`);
  console.log(`    Top warehouse: ${data?.busyWarehouses?.[0]?.name ?? "none"} (${data?.busyWarehouses?.[0]?.orderCount ?? 0} orders)`);

  console.log(`\n━━━ RESULTS ━━━`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);
  if (failed === 0) console.log("\n  🎉 All tests passing — Feature 5 complete.\n");
  else console.log("\n  ⚠️  Some tests failed.\n");
}

run().catch(console.error);
