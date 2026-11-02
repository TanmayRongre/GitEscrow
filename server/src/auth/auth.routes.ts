import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './auth.controller';
import { authenticate } from './auth.middleware';

export const authRouter = Router();

// Rate limiters (disabled during unit/automated test execution)
const isTest = process.env.NODE_ENV === 'test';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 1000 : 20, // 20 requests per IP per 15 minutes
  message: { error: 'Too many requests from this IP, please try again later.', code: 'RATE_LIMIT_EXCEEDED' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 1000 : 10, // 10 login attempts per IP per 15 minutes
  message: { error: 'Too many failed login attempts, please try again in 15 minutes.', code: 'LOGIN_RATE_LIMIT_EXCEEDED' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest
});

// Authentication endpoints
authRouter.post('/register', authLimiter, AuthController.register);
authRouter.post('/login', loginLimiter, AuthController.login);
authRouter.post('/refresh', AuthController.refresh);
authRouter.post('/logout', AuthController.logout);
authRouter.get('/me', authenticate, AuthController.me);
authRouter.post('/bootstrap-admin', authLimiter, AuthController.bootstrapAdmin);

// Dedicated rate limiting verification endpoint
const testRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  message: { error: 'Too many requests, rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' },
  standardHeaders: true,
  legacyHeaders: false
});
authRouter.get('/test-rate-limit', testRateLimiter, (_req, res) => {
  res.status(200).json({ ok: true, message: 'Under rate limit threshold' });
});
