import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file during local development
dotenv.config();

const INSECURE_DEFAULT_JWT_SECRETS = [
  'super-secret-jwt-key-change-in-production',
  'secret',
  'jwt-secret',
  'change-me',
];

const DEV_FALLBACK_JWT_SECRET = 'dev-only-secret-do-not-use-in-production-32-bytes-minimum!';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GEMINI_API_KEY: z.string().optional(),
  APP_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z
    .string()
    .default('postgresql://postgres:postgres@localhost:5432/business_suite'),
  DB_MODE: z.enum(['postgres', 'mock', 'auto']).default('auto'),
  JWT_SECRET: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000), // 15 mins default
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(30), // 30 auth requests per window
});

const nodeEnv = process.env.NODE_ENV || 'development';
const rawResult = envSchema.safeParse(process.env);

if (!rawResult.success) {
  console.error('❌ Invalid environment configuration:', JSON.stringify(rawResult.error.format(), null, 2));
  if (nodeEnv === 'production') {
    process.exit(1);
  }
}

const parsedData = rawResult.success
  ? rawResult.data
  : {
      NODE_ENV: 'development' as const,
      APP_URL: 'http://localhost:3000',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/business_suite',
      DB_MODE: 'auto' as const,
      JWT_SECRET: DEV_FALLBACK_JWT_SECRET,
      RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
      RATE_LIMIT_MAX_REQUESTS: 30,
    };

// Strict production validation rules
let jwtSecret = parsedData.JWT_SECRET;

if (nodeEnv === 'production') {
  if (!jwtSecret) {
    console.error('❌ CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing in production!');
    process.exit(1);
  }

  if (INSECURE_DEFAULT_JWT_SECRETS.includes(jwtSecret)) {
    console.error('❌ CRITICAL SECURITY ERROR: Insecure default JWT_SECRET cannot be used in production!');
    process.exit(1);
  }

  if (jwtSecret.length < 32) {
    console.error('❌ CRITICAL SECURITY ERROR: JWT_SECRET must be at least 32 characters (256 bits) in production!');
    process.exit(1);
  }
} else {
  // In development/test mode, fall back to dev-only secret if missing or insecure
  if (!jwtSecret || INSECURE_DEFAULT_JWT_SECRETS.includes(jwtSecret)) {
    jwtSecret = DEV_FALLBACK_JWT_SECRET;
  }
}

export const env = {
  PORT: 3000,
  NODE_ENV: parsedData.NODE_ENV,
  GEMINI_API_KEY: parsedData.GEMINI_API_KEY,
  APP_URL: parsedData.APP_URL,
  DATABASE_URL: parsedData.DATABASE_URL,
  DB_MODE: parsedData.DB_MODE,
  JWT_SECRET: jwtSecret,
  RATE_LIMIT_WINDOW_MS: parsedData.RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS: parsedData.RATE_LIMIT_MAX_REQUESTS,
};
