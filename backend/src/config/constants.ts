/**
 * constants.ts — named constants used throughout the backend.
 *
 * WHY: Magic numbers (12, 100, 50) scattered in code are unreadable and
 * unmaintainable. If you hardcode bcrypt cost factor as 12 in the service,
 * and someone searches for "bcrypt" to understand the security level, they
 * find nothing. A named constant makes the intent explicit.
 */

export const BCRYPT_SALT_ROUNDS = 12;
// Cost factor of 12 means 2^12 = 4096 iterations. At this level, a modern
// GPU takes ~100ms to hash one password — fast enough for a user, slow enough
// to make brute-force attacks infeasible. Do not go below 10.

export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;

export const ROUTE_MAX_STOPS = 50;
// Above 50 stops, the nearest-neighbour heuristic runs noticeably slow in
// the request cycle. Flag as a known limitation — async job queue is the fix.

export const AVERAGE_SPEED_KMH = 30;
// Used by the optimizer to estimate travel time between stops.
// 30 km/h is a reasonable city average. In production, this comes from
// the ETA model or live traffic data.
