import { z } from "zod";

const EnvSchema = z.object({
  POSTGRES_HOST: z.string().default("postgres"),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_DB: z.string().default("pdocs"),
  POSTGRES_USER: z.string().default("pdocs"),
  POSTGRES_PASSWORD: z.string().default("pdocs_dev_password"),

  REDIS_URL: z.string().default("redis://redis:6379"),

  MINIO_ENDPOINT: z.string().default("minio"),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().default("minioadmin"),
  MINIO_SECRET_KEY: z.string().default("minioadmin"),
  MINIO_BUCKET: z.string().default("pdocs"),
  MINIO_USE_SSL: z
    .string()
    .transform((v) => v === "true")
    .default("false"),

  RABBITMQ_URL: z.string().default("amqp://guest:guest@rabbitmq:5672"),

  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  FPT_API_KEY: z.string().optional(),

  METRICS_PORT: z.coerce.number().default(9100),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  // eslint-disable-next-line no-process-env
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) throw new Error("Invalid worker env");
  return parsed.data;
}

