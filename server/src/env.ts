import { z } from "zod";

/**
 * Centralised, validated configuration.
 * Every secret / tunable comes from an environment variable — nothing is
 * hardcoded. If a required variable is missing the process exits immediately
 * with a clear message instead of failing mysteriously later.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z
    .string()
    .min(16, "JWT_SECRET must be at least 16 characters — set a long random value"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CLIENT_ORIGIN: z.string().default("http://localhost:8080"),
  SEED_DEMO_EMAIL: z.string().email().default("demo@example.com"),
  SEED_DEMO_PASSWORD: z.string().min(6).default("demo1234"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("\nInvalid environment configuration:\n");
  for (const issue of parsed.error.issues) {
    // eslint-disable-next-line no-console
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  console.error("\nCopy .env.example to .env and fill in the values.\n");
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
