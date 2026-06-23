import "dotenv/config";
import http from "http";
import { createApp } from "./app";
import { loadEnv } from "./config/env";
import { redis, createRedisSubClient } from "./config/redis";
import { initializeSockets } from "./sockets";

async function main() {
  const env = loadEnv();
  const app = createApp();
  const server = http.createServer(app);

  // Cần connect pub client và sub client trước khi gắn adapter vào Socket.IO.
  // Sub client là bản duplicate của pub client, dùng riêng cho pub/sub channel.
  const subClient = createRedisSubClient();
  await redis.connect();
  await subClient.connect();

  const io = initializeSockets(server, redis as never, subClient as never);
  app.set("io", io);

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


