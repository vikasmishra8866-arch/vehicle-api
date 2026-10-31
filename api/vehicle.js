// api/vehicle.js

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import {
  isVehicleValid,
  buildNotFoundResponse,
  buildSuccessResponse,
  errorResponse,
} from "../lib/transform.js";

export const maxDuration = 60;

const redis = Redis.fromEnv();

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "100 s"),
  analytics: true,
  prefix: "ratelimit:vehicle_v2",
});

const UPSTREAM = "https://hideme.eu.org/lookup";
const SOURCE_KEY = process.env.SOURCE_API_KEY;
const OUR_KEY = process.env.OUR_API_KEY;
const CACHE_TTL_SUCCESS = 60 * 60 * 24;
const CACHE_TTL_NOT_FOUND = 60 * 60;
const UPSTREAM_TIMEOUT_MS = 25_000;
const MOBILE_MASK_MODE = process.env.MASK_MOBILE || "none";

function normalizeRegNo(raw) {
  return String(raw || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}
function isValidRegNo(r) {
  return /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/.test(r);
}

async function fetchUpstream(regNo) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const url = `${UPSTREAM}?api=mvahan&key=${encodeURIComponent(SOURCE_KEY)}&number=${encodeURIComponent(regNo)}`;
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  const start = Date.now();

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-api-key");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET")
    return res.status(405).json(errorResponse("METHOD_NOT_ALLOWED", "Only GET", Date.now() - start));

  if (OUR_KEY && req.headers["x-api-key"] !== OUR_KEY)
    return res.status(401).json(errorResponse("UNAUTHORIZED", "Invalid x-api-key", Date.now() - start));

  const regNo = normalizeRegNo(req.query.number);
  if (!isValidRegNo(regNo))
    return res.status(400).json(
      errorResponse("INVALID_REGISTRATION_NUMBER", "Format: GJ05MS9717", Date.now() - start)
    );

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "office";
  const rl = await ratelimit.limit(ip);
  res.setHeader("X-RateLimit-Limit", String(rl.limit));
  res.setHeader("X-RateLimit-Remaining", String(rl.remaining));
  res.setHeader("X-RateLimit-Reset", String(rl.reset));
  if (!rl.success)
    return res.status(429).json(
      errorResponse("RATE_LIMITED", "10 requests per 100 seconds", Date.now() - start)
    );

  const cacheKey = `vehicle_v2:${regNo}`;

  try {
    let upstream = await redis.get(cacheKey);

    if (!upstream) {
      upstream = await fetchUpstream(regNo);
      const ttl = isVehicleValid(upstream) ? CACHE_TTL_SUCCESS : CACHE_TTL_NOT_FOUND;
      if (upstream) await redis.setex(cacheKey, ttl, upstream);
    }

    const elapsed = Date.now() - start;

    if (!isVehicleValid(upstream)) {
      const payload = buildNotFoundResponse(elapsed);
      if (req.query.debug === "1") payload._raw_upstream = upstream;
      return res.status(200).json(payload);
    }

    const payload = buildSuccessResponse(upstream, elapsed, MOBILE_MASK_MODE);
    if (req.query.debug === "1") payload._raw_upstream = upstream;
    return res.status(200).json(payload);

  } catch (err) {
    const isAbort = err.name === "AbortError" || String(err).toLowerCase().includes("abort");
    return res.status(isAbort ? 504 : 502).json(
      errorResponse(
        isAbort ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR",
        isAbort
          ? `Upstream timeout after ${UPSTREAM_TIMEOUT_MS / 1000}s`
          : "Upstream service failed",
        Date.now() - start
      )
    );
  }
}
