/**
 * Secure logging utility
 * Prevents sensitive information from being logged
 */

const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /api[_-]?key/i,
  /bearer/i,
  /authorization/i,
  /credit[_-]?card/i,
  /ssn/i,
  /social[_-]?security/i,
];

const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'Authorization',
  'authorization',
  'creditCard',
  'ssn',
];

/**
 * Sanitize sensitive data before logging
 */
const sanitizeData = (data: any): any => {
  if (typeof data === 'string') {
    // Check if string contains sensitive patterns
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(data)) {
        return '[REDACTED]';
      }
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  if (data && typeof data === 'object') {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Check if key is sensitive
      if (SENSITIVE_KEYS.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeData(value);
      }
    }
    
    return sanitized;
  }

  return data;
};

/**
 * Safe logger that prevents logging sensitive information
 */
export const logger = {
  info: (...args: any[]) => {
    const sanitized = args.map(sanitizeData);
    console.log('[INFO]', new Date().toISOString(), ...sanitized);
  },

  error: (...args: any[]) => {
    const sanitized = args.map(sanitizeData);
    console.error('[ERROR]', new Date().toISOString(), ...sanitized);
  },

  warn: (...args: any[]) => {
    const sanitized = args.map(sanitizeData);
    console.warn('[WARN]', new Date().toISOString(), ...sanitized);
  },

  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      const sanitized = args.map(sanitizeData);
      console.debug('[DEBUG]', new Date().toISOString(), ...sanitized);
    }
  },

  // For logging errors with stack traces
  exception: (error: Error, context?: any) => {
    const sanitizedContext = context ? sanitizeData(context) : undefined;
    console.error('[EXCEPTION]', new Date().toISOString(), {
      message: error.message,
      stack: error.stack,
      context: sanitizedContext,
    });
  },
};

/**
 * Create a child logger with a specific prefix
 */
export const createLogger = (prefix: string) => {
  return {
    info: (...args: any[]) => logger.info(`[${prefix}]`, ...args),
    error: (...args: any[]) => logger.error(`[${prefix}]`, ...args),
    warn: (...args: any[]) => logger.warn(`[${prefix}]`, ...args),
    debug: (...args: any[]) => logger.debug(`[${prefix}]`, ...args),
    exception: (error: Error, context?: any) => logger.exception(error, { prefix, ...context }),
  };
};

export default logger;
