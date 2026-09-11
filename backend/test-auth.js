/**
 * test-auth.js — manual integration test for Feature 1 (Auth)
 *
 * Run with: node test-auth.js
 * Requires Node 18+ (uses built-in fetch)
 * Server must be running: npm run dev
 */

const BASE_URL = "http://localhost:3000/api/v1";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const post = async (path, body, token) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, body: json };
};

const printResult = (testName, passed, details) => {
  const icon = passed ? "✅" : "❌";
  console.log(`\n${icon}  ${testName}`);
  if (!passed || process.argv.includes("--verbose")) {
    console.log("   ", JSON.stringify(details, null, 2).replace(/\n/g, "\n    "));
  }
};

// ─── Tests ────────────────────────────────────────────────────────────────────

const runTests = async () => {
  console.log("═══════════════════════════════════════════");
  console.log("  SmartRoute — Feature 1: Auth Tests");
  console.log("═══════════════════════════════════════════");

  let accessToken = null;
  let passed = 0;
  let failed = 0;

  // Unique email per run — so tests pass even if run multiple times
  const TEST_EMAIL = `test_${Date.now()}@smartroute.com`;
  const TEST_PASSWORD = "test1234";

  // ── Test 1: Health check ────────────────────────────────────────────────────
  try {
    const res = await fetch("http://localhost:3000/health");
    const json = await res.json();
    const ok = res.status === 200 && json.status === "ok";
    printResult("GET /health — server is running", ok, json);
    ok ? passed++ : failed++;
  } catch {
    printResult("GET /health — server is running", false, {
      error: "Cannot connect. Is 'npm run dev' running?",
    });
    failed++;
    console.log("\n⚠️  Server not reachable. Start it with: npm run dev");
    process.exit(1);
  }

  // ── Test 2: Register a new admin user ───────────────────────────────────────
  {
    const r = await post("/auth/register", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      role: "ADMIN",
    });
    const ok =
      r.status === 201 &&
      r.body.success === true &&
      r.body.data.email === TEST_EMAIL &&
      r.body.data.passwordHash === undefined;

    printResult("POST /auth/register — creates user, no passwordHash in response", ok, r.body);
    ok ? passed++ : failed++;
  }

  // ── Test 3: Duplicate email → 409 Conflict ──────────────────────────────────
  {
    const r = await post("/auth/register", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      role: "ADMIN",
    });
    const ok = r.status === 409 && r.body.error?.code === "CONFLICT";
    printResult("POST /auth/register — duplicate email → 409 CONFLICT", ok, r.body);
    ok ? passed++ : failed++;
  }

  // ── Test 4: Validation — bad email format → 400 ─────────────────────────────
  {
    const r = await post("/auth/register", {
      email: "not-an-email",
      password: "test1234",
      role: "ADMIN",
    });
    const ok =
      r.status === 400 &&
      r.body.error?.code === "VALIDATION_ERROR" &&
      Array.isArray(r.body.error?.details);
    printResult("POST /auth/register — invalid email → 400 VALIDATION_ERROR with field details", ok, r.body);
    ok ? passed++ : failed++;
  }

  // ── Test 5: Validation — weak password → 400 ────────────────────────────────
  {
    const r = await post("/auth/register", {
      email: "new@smartroute.com",
      password: "short",   // too short, no number
      role: "ADMIN",
    });
    const ok = r.status === 400 && r.body.error?.code === "VALIDATION_ERROR";
    printResult("POST /auth/register — weak password → 400 VALIDATION_ERROR", ok, r.body);
    ok ? passed++ : failed++;
  }

  // ── Test 6: Login with correct credentials ───────────────────────────────────
  {
    const r = await post("/auth/login", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    const ok =
      r.status === 200 &&
      r.body.success === true &&
      typeof r.body.data?.accessToken === "string" &&
      r.body.data?.user?.passwordHash === undefined;

    if (ok) accessToken = r.body.data.accessToken;

    printResult("POST /auth/login — returns JWT access token, no passwordHash", ok, {
      status: r.status,
      hasToken: !!r.body.data?.accessToken,
      tokenPreview: r.body.data?.accessToken?.substring(0, 40) + "...",
      user: r.body.data?.user,
    });
    ok ? passed++ : failed++;
  }

  // ── Test 7: Login with wrong password → 401 ──────────────────────────────────
  {
    const r = await post("/auth/login", {
      email: TEST_EMAIL,
      password: "wrongpassword1",
    });
    const ok =
      r.status === 401 &&
      r.body.error?.code === "UNAUTHORIZED" &&
      r.body.error?.message?.toLowerCase().includes("email or password");
    printResult("POST /auth/login — wrong password → 401, no field hint", ok, r.body);
    ok ? passed++ : failed++;
  }

  // ── Test 8: Login with non-existent email → 401 (same response as wrong pw) ──
  {
    const r = await post("/auth/login", {
      email: "doesnotexist@smartroute.com",
      password: "test1234",
    });
    const ok = r.status === 401 && r.body.error?.code === "UNAUTHORIZED";
    printResult("POST /auth/login — unknown email → 401 (same as wrong password, no enumeration)", ok, r.body);
    ok ? passed++ : failed++;
  }

  // ── Test 9: Access protected route WITHOUT token → 401 ───────────────────────
  {
    const res = await fetch(`${BASE_URL}/auth/logout`, { method: "POST" });
    const json = await res.json();
    const ok = res.status === 401 && json.error?.code === "UNAUTHORIZED";
    printResult("POST /auth/logout (no token) → 401 UNAUTHORIZED", ok, json);
    ok ? passed++ : failed++;
  }

  // ── Test 10: Logout with valid token ─────────────────────────────────────────
  {
    if (!accessToken) {
      printResult("POST /auth/logout (with token) — skipped (no token from login)", false, {});
      failed++;
    } else {
      const res = await fetch(`${BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      const ok = res.status === 200 && json.success === true;
      printResult("POST /auth/logout (with token) → 200 success", ok, json);
      ok ? passed++ : failed++;
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════\n");

  if (failed > 0) {
    console.log("Run with --verbose to see full response bodies for passing tests.");
    process.exit(1);
  }
};

runTests().catch((err) => {
  console.error("Test runner error:", err.message);
  process.exit(1);
});
