import { Registry, collectDefaultMetrics, Counter, Histogram } from "prom-client";

export const register = new Registry();
collectDefaultMetrics({ register });

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests handled by this api instance",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

export const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route"],
  registers: [register],
});

export const searchCacheTotal = new Counter({
  name: "search_cache_total",
  help: "Document search Redis cache hits/misses",
  labelNames: ["result"],
  registers: [register],
});
