import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config, validateConfig, isDevelopment } from './config';
import { errorHandler, notFoundHandler } from './middleware/error';
import { 
  sanitizeInput, 
  securityHeaders, 
  requestSizeLimiter, 
  preventParameterPollution 
} from './middleware/security';
import logger from './lib/logger';

// Import routes
import authRoutes from './routes/auth';
import studentRoutes from './routes/students';
import courseRoutes from './routes/courses';
import faceRecognitionRoutes from './routes/faceRecognition';
import generalRoutes from './routes/general';

// Validate environment variables
validateConfig();

const app = express();

// Request logging middleware
const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    if (isDevelopment || res.statusCode >= 400) {
      logger[logLevel](`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    }
  });
  
  next();
};

app.use(requestLogger);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));

// Additional security headers
app.use(securityHeaders);

// Input sanitization
app.use(sanitizeInput);

// Prevent parameter pollution
app.use(preventParameterPollution);

// Request size limiter (10MB max)
app.use(requestSizeLimiter(10 * 1024 * 1024));

// CORS configuration
app.use(cors({
  origin: config.cors.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for auth routes (prevent brute force)
const authLimiter = rateLimit({
  windowMs: config.authRateLimit.windowMs,
  max: config.authRateLimit.maxRequests,
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

app.use('/api/', generalLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  });
});

// API routes with auth-specific rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/face', faceRecognitionRoutes);
app.use('/api', generalRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  console.log(`\n📴 ${signal} received. Shutting down gracefully...`);
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled rejection handler
process.on('unhandledRejection', (reason: Error) => {
  console.error('❌ Unhandled Rejection:', reason);
  if (!isDevelopment) {
    process.exit(1);
  }
});

// Start server
const PORT = config.port;

app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('═══════════════════════════════════════');
  console.log('');
});

export default app;
