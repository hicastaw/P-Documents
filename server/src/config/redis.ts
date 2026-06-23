import { createClient } from "redis";
import { loadEnv } from "./env";

const env = loadEnv();

export const redis = createClient({ url: env.REDIS_URL });

redis.on("error", (err: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Redis error", err);
});

/**
 * Tạo một Redis client độc lập dùng làm subscriber cho Socket.IO Redis Adapter.
 * Socket.IO adapter yêu cầu 2 client riêng biệt (pub + sub) vì client ở chế độ
 * subscribe không thể dùng cho các lệnh thông thường khác.
 */
export function createRedisSubClient() {
  const sub = redis.duplicate();
  sub.on("error", (err: unknown) => {
    // eslint-disable-next-line no-console
    console.error("Redis sub-client error", err);
  });
  return sub;
}
