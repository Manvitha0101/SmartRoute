/**
 * osrm.service.ts — Road-network routing service using OSRM Table Service.
 *
 * Responsibilities:
 * - Query OSRM (Open Source Routing Machine) Table API for road distance (meters) and travel duration (seconds).
 * - Validate geographic coordinates (latitude [-90, 90], longitude [-180, 180]).
 * - Format coordinates in OSRM order ({longitude},{latitude}).
 * - Maintain an in-memory LRU cache of pairwise distances and durations to avoid redundant calculations.
 * - Handle timeouts, network failures, unreachable destinations, and incomplete matrices.
 * - Provide a documented fallback mode with explicit warnings when OSRM is unreachable and fallback is enabled.
 * - Keep routing provider logic cleanly separated from the vehicle routing optimization heuristic.
 */

import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface DistanceDurationMatrix {
  distancesKm: number[][]; // [fromIndex][toIndex] in kilometers
  durationsMin: number[][]; // [fromIndex][toIndex] in minutes
  provider: "osrm" | "fallback_haversine";
  warning: string | null;
}

// ─── Coordinate Validation ───────────────────────────────────────────────────

export function validateCoordinate(coord: Coordinate, label?: string): void {
  const { latitude, longitude } = coord;
  const tag = label ? ` for ${label}` : "";

  if (typeof latitude !== "number" || isNaN(latitude) || latitude < -90 || latitude > 90) {
    throw AppError.badRequest(
      `Invalid latitude "${latitude}"${tag}. Must be a valid number between -90 and 90.`,
      "INVALID_COORDINATE"
    );
  }

  if (typeof longitude !== "number" || isNaN(longitude) || longitude < -180 || longitude > 180) {
    throw AppError.badRequest(
      `Invalid longitude "${longitude}"${tag}. Must be a valid number between -180 and 180.`,
      "INVALID_COORDINATE"
    );
  }
}

// ─── In-Memory Pairwise Cache ────────────────────────────────────────────────

interface CacheEntry {
  distanceKm: number;
  durationMin: number;
}

const matrixCache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 5000;

const makeCacheKey = (c1: Coordinate, c2: Coordinate): string =>
  `${c1.latitude.toFixed(5)},${c1.longitude.toFixed(5)}->${c2.latitude.toFixed(5)},${c2.longitude.toFixed(5)}`;

export const clearRoutingCache = (): void => {
  matrixCache.clear();
};

export const getRoutingCacheSize = (): number => {
  return matrixCache.size;
};

// ─── Haversine Fallback Helper ───────────────────────────────────────────────

const ROAD_CIRCUITY_FACTOR = 1.3; // Road distance is approx 1.3x straight-line in city networks
const FALLBACK_AVG_SPEED_KMH = 30; // 30 km/h baseline urban speed

export const haversineDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const buildFallbackMatrix = (
  locations: Coordinate[],
  reason: string
): DistanceDurationMatrix => {
  const n = locations.length;
  const distancesKm: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const durationsMin: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const straightLine = haversineDistanceKm(
        locations[i].latitude,
        locations[i].longitude,
        locations[j].latitude,
        locations[j].longitude
      );
      const roadDist = Math.round(straightLine * ROAD_CIRCUITY_FACTOR * 100) / 100;
      const travelTimeMin = Math.round((roadDist / FALLBACK_AVG_SPEED_KMH) * 60 * 10) / 10;
      distancesKm[i][j] = roadDist;
      durationsMin[i][j] = travelTimeMin;
    }
  }

  return {
    distancesKm,
    durationsMin,
    provider: "fallback_haversine",
    warning: `OSRM road network routing service unavailable (${reason}). Active fallback: straight-line estimation with 1.3x circuity factor.`,
  };
};

// ─── OSRM Table Service ──────────────────────────────────────────────────────

const OSRM_TIMEOUT_MS = 5000;
const MAX_COORDINATES_PER_TABLE_REQUEST = 80;

/**
 * Fetch a distance and travel duration matrix for the given locations using OSRM Table API.
 * Location index 0 is typically the warehouse depot, followed by order locations.
 */
export async function getDistanceMatrix(
  locations: Coordinate[],
  options?: { allowFallback?: boolean }
): Promise<DistanceDurationMatrix> {
  if (locations.length < 2) {
    return {
      distancesKm: [[0]],
      durationsMin: [[0]],
      provider: "osrm",
      warning: null,
    };
  }

  // 1. Validate all coordinates upfront
  locations.forEach((loc, idx) => validateCoordinate(loc, `Location #${idx}`));

  // 2. Check request size limits
  if (locations.length > MAX_COORDINATES_PER_TABLE_REQUEST) {
    throw AppError.badRequest(
      `Matrix request exceeds maximum coordinate batch size of ${MAX_COORDINATES_PER_TABLE_REQUEST} locations.`,
      "COORDINATE_LIMIT_EXCEEDED"
    );
  }

  const allowFallback = options?.allowFallback ?? env.OSRM_FALLBACK_ALLOWED;

  // 3. Format coordinates for OSRM: {longitude},{latitude};{longitude},{latitude}
  const coordsParam = locations
    .map((loc) => `${loc.longitude.toFixed(6)},${loc.latitude.toFixed(6)}`)
    .join(";");

  const baseUrl = env.OSRM_URL.replace(/\/+$/, "");
  const url = `${baseUrl}/table/v1/driving/${coordsParam}?annotations=distance,duration`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`OSRM HTTP error ${response.status}: ${errorText || response.statusText}`);
    }

    const data = (await response.json()) as {
      code?: string;
      message?: string;
      distances?: (number | null)[][];
      durations?: (number | null)[][];
    };

    if (data.code !== "Ok" || !data.distances || !data.durations) {
      throw new Error(`OSRM returned code "${data.code}": ${data.message || "Incomplete matrix"}`);
    }

    const n = locations.length;
    const distancesKm: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    const durationsMin: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

    let hasUnreachable = false;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          distancesKm[i][j] = 0;
          durationsMin[i][j] = 0;
          continue;
        }

        const distMeters = data.distances[i]?.[j];
        const durSecs = data.durations[i]?.[j];

        if (distMeters === null || distMeters === undefined || durSecs === null || durSecs === undefined) {
          // Unreachable route (e.g. disconnected road, island, pedestrian-only)
          distancesKm[i][j] = Infinity;
          durationsMin[i][j] = Infinity;
          hasUnreachable = true;
        } else {
          const distKm = Math.round((distMeters / 1000) * 100) / 100;
          const durMin = Math.round((durSecs / 60) * 10) / 10;
          distancesKm[i][j] = distKm;
          durationsMin[i][j] = durMin;

          // Cache valid pairwise values
          if (matrixCache.size >= MAX_CACHE_SIZE) {
            const firstKey = matrixCache.keys().next().value;
            if (firstKey) matrixCache.delete(firstKey);
          }
          matrixCache.set(makeCacheKey(locations[i], locations[j]), {
            distanceKm: distKm,
            durationMin: durMin,
          });
        }
      }
    }

    return {
      distancesKm,
      durationsMin,
      provider: "osrm",
      warning: hasUnreachable
        ? "One or more destination pairs are unreachable on the road network (marked with infinite distance)."
        : null,
    };
  } catch (err: any) {
    const reason = err?.name === "AbortError" ? "Request timeout after 5000ms" : err?.message || "Connection refused";

    if (allowFallback) {
      return buildFallbackMatrix(locations, reason);
    }

    throw new AppError(
      `OSRM road routing service failure at ${env.OSRM_URL}: ${reason}. Start OSRM or enable OSRM_FALLBACK_ALLOWED=true.`,
      502,
      "OSRM_SERVICE_UNAVAILABLE"
    );
  }
}
