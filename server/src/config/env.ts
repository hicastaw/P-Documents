import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),

  API_PORT: z.coerce.number().default(3000),
  API_CORS_ORIGIN: z.string().default("http://localhost:8888"),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().default(604800),

  POSTGRES_HOST: z.string().default("postgres"),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_DB: z.string().default("pdocs"),
  POSTGRES_USER: z.string().default("pdocs"),
  POSTGRES_PASSWORD: z.string().default("pdocs_dev_password"),

  REDIS_URL: z.string().default("redis://redis:6379"),

  MINIO_ENDPOINT: z.string().default("minio"),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_PUBLIC_URL: z.string().default("http://localhost:9000"),
  MINIO_ACCESS_KEY: z.string().default("minioadmin"),
  MINIO_SECRET_KEY: z.string().default("minioadmin"),
  MINIO_BUCKET: z.string().default("pdocs"),
  MINIO_USE_SSL: z
    .string()
    .transform((v) => v === "true")
    .default("false"),

  RABBITMQ_URL: z.string().default("amqp://guest:guest@rabbitmq:5672"),

  // AI keys (optional)
  FPT_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  // eslint-disable-next-line no-process-env
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables:\n${parsed.error.issues
        .map((i) => `- ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`,
    );
  }
  return parsed.data;
}

