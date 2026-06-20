import { createClient } from "redis";
import { loadEnv } from "./env";

const env = loadEnv();

export const redis = createClient({ url: env.REDIS_URL });

redis.on("error", (err: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Redis error", err);
});
