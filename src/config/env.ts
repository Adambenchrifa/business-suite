import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file during local development
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GEMINI_API_KEY: z.string().optional(),
  APP_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z
    .string()
    .default('postgresql://postgres:postgres@localhost:5432/business_suite'),
  JWT_SECRET: z.string().default('super-secret-jwt-key-change-in-production'),
});

// Safely parse environment variables
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Invalid environment configuration:', JSON.stringify(parseResult.error.format(), null, 2));
  // In production we want to crash early. In dev, we can print warning and use defaults.
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

export const env = {
  PORT: 3000,
  ...(parseResult.success 
    ? parseResult.data 
    : {
        NODE_ENV: 'development' as const,
        APP_URL: 'http://localhost:3000',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/business_suite',
        JWT_SECRET: 'super-secret-jwt-key-change-in-production',
      })
};
