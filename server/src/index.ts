import "dotenv/config";
import http from "http";
import { createApp } from "./app";
import { loadEnv } from "./config/env";
import { redis } from "./config/redis";
import { initializeSockets } from "./sockets";

async function main() {
  const env = loadEnv();
  const app = createApp();
  const server = http.createServer(app);

  const io = initializeSockets(server);
  app.set("io", io);

  await redis.connect();

  server.listen(env.API_PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on :${env.API_PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

