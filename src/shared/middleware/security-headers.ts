import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';

/**
 * Standard HTTP security headers middleware for production hardening.
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent framing (clickjacking defense)
  res.setHeader('X-Frame-Options', 'DENY');

  // Modern browser XSS filtering
  res.setHeader('X-XSS-Protection', '0');

  // Strict referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy (CSP) compatible with Vite SPA frontend
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    "connect-src 'self' ws: wss: http: https:",
    "frame-ancestors 'none'",
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspDirectives);

  // Enable HTTP Strict Transport Security (HSTS) ONLY in production to avoid breaking HTTP local dev
  if (env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}
