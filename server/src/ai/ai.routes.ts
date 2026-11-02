import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AIController } from './ai.controller';
import { authenticate } from '../auth/auth.middleware';

export const aiRouter = Router();

const isTest = process.env.NODE_ENV === 'test';

const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 30, // 30 AI requests per 15 minutes per IP
  message: {
    error: 'Too many AI analysis requests. Please try again later.',
    code: 'AI_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest
});

// Authenticated AI Analysis Route
aiRouter.post('/analyze-issue', authenticate, aiRateLimiter, AIController.analyzeIssue);

