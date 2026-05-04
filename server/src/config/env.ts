import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),
  JWT_EXPIRES_IN: z.string().default("24h"),
  JWT_RESET_EXPIRES_IN: z.string().default("15m"),
  MARKET_PROVIDER: z.enum(["yahoo", "alphavantage", "twelvedata"]).default("yahoo"),
  ALPHA_VANTAGE_KEY: z.string().optional(),
  TWELVE_DATA_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional()
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
