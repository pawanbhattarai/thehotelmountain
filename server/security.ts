import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import rateLimit from 'express-rate-limit';

// Create a JSDOM window for server-side DOMPurify
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') return '';
  return purify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [], // No attributes allowed
    STRIP_TAGS: true, // Strip all tags
    STRIP_COMMENTS: true // Strip comments
  });
}

/**
 * Sanitize user input object recursively
 */
export function sanitizeInput(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeHtml(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeInput);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Rate limiting configurations
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many login attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Progressive delay
  skipSuccessfulRequests: true,
});

export const generalRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // Increased limit for development
  message: {
    error: 'Too many requests, please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for static assets and development
    return req.path.includes('/assets/') || 
           req.path.includes('/src/') || 
           req.path.includes('/@') ||
           process.env.NODE_ENV === 'development';
  }
});

export const strictRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // Increased for development
  message: {
    error: 'Rate limit exceeded for sensitive operations.',
  },
  skip: (req) => process.env.NODE_ENV === 'development'
});

/**
 * Input validation helpers
 */
export function validateStringLength(input: string, maxLength: number = 255): boolean {
  return typeof input === 'string' && input.length <= maxLength;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

export function validatePhone(phone: string): boolean {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone) && phone.length <= 20;
}