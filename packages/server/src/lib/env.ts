import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters in production").optional()
    .default("dev-secret-change-me"),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  UPLOAD_DIR: z.string().optional(),
  DEFAULT_ADMIN_PASSWORD: z.string().optional(),
  DEFAULT_ADMIN_USERNAME: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    console.error("Invalid environment variables:\n" + formatted);
    process.exit(1);
  }

  // Enforce strong JWT_SECRET in production
  if (result.data.NODE_ENV === "production") {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
      console.error("FATAL: JWT_SECRET must be set and at least 16 characters in production");
      process.exit(1);
    }
  }

  return result.data;
}
