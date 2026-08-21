/**
 * env.ts — reads and validates all environment variables at startup.
 *
 * WHY: If JWT_SECRET is undefined and you sign tokens with it, jsonwebtoken
 * will use the string "undefined" as the secret. Every token becomes trivially
 * forgeable. Failing loudly at startup catches this before any request is served.
 *
 * PATTERN: Read once, export a typed object. The rest of the codebase imports
 * from here — never from process.env directly. One place to change, one place
 * to validate.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    // Crash the process intentionally — a missing secret is not recoverable
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  DATABASE_URL: requireEnv("DATABASE_URL"),
  JWT_SECRET: requireEnv("JWT_SECRET"),
  JWT_REFRESH_SECRET: requireEnv("JWT_REFRESH_SECRET"),
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY ?? "15m",
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY ?? "7d",
  PORT: parseInt(process.env.PORT ?? "3000", 10),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  ETA_SERVICE_URL: process.env.ETA_SERVICE_URL ?? "http://localhost:8000",
  isProduction: process.env.NODE_ENV === "production",
};
