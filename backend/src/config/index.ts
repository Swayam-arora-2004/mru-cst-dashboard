import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },
  
  cors: {
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  
  // Auth-specific rate limiting (more lenient in development)
  authRateLimit: {
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || (process.env.NODE_ENV === 'development' ? '100' : '10'), 10),
  },
};

// List of required environment variables
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
] as const;

// Optional but recommended
const optionalEnvVars = [
  'GEMINI_API_KEY',
  'FRONTEND_URL',
] as const;

export const validateConfig = (): void => {
  const missingRequired = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  const missingOptional = optionalEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingRequired.length > 0) {
    console.error(
      `❌ FATAL: Missing required environment variables: ${missingRequired.join(', ')}`
    );
    console.error('Please check your .env file and ensure all required variables are set.');
    process.exit(1);
  }

  if (missingOptional.length > 0) {
    console.warn(
      `⚠️  Warning: Missing optional environment variables: ${missingOptional.join(', ')}`
    );
    console.warn('Some features may not work correctly.');
  }

  // Validate JWT secret strength
  if (config.jwt.secret.length < 32) {
    console.warn('⚠️  Warning: JWT_SECRET should be at least 32 characters for security.');
  }

  // Validate Supabase URL format
  if (!config.supabase.url.includes('supabase.co')) {
    console.warn('⚠️  Warning: SUPABASE_URL does not appear to be a valid Supabase URL.');
  }

  console.log('✅ Environment configuration validated successfully');
};

export const isDevelopment = config.nodeEnv === 'development';
export const isProduction = config.nodeEnv === 'production';
