import http from "http";
import { Registry, collectDefaultMetrics, Counter, Histogram } from "prom-client";

export const register = new Registry();
collectDefaultMetrics({ register });

export const documentsProcessedTotal = new Counter({
  name: "documents_processed_total",
  help: "Documents whose chunk/embedding pipeline completed successfully",
  registers: [register],
});

export const documentsFailedTotal = new Counter({
  name: "documents_failed_total",
  help: "Document processing failures, by stage",
  labelNames: ["stage"], // "retry" | "dlq"
  registers: [register],
});

export const documentProcessingDurationSeconds = new Histogram({
  name: "document_processing_duration_seconds",
  help: "Time spent in processDocument (hash + dedup + extract/chunk/embed)",
  registers: [register],
});

export function startMetricsServer(port: number) {
  const server = http.createServer(async (req, res) => {
    if (req.url === "/metrics") {
      res.setHeader("Content-Type", register.contentType);
      res.end(await register.metrics());
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[Worker] Metrics listening on :${port}/metrics`);
  });
}
