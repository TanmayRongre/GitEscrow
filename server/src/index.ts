import express, { Router } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { webhookRouter } from './github/webhook-router';
import { authRouter } from './auth/auth.routes';
import { organizationRouter } from './organizations/organization.routes';
import { bountyRouter, milestoneRouter } from './bounties/bounty.routes';
import { aiRouter } from './ai/ai.routes';
import { userRouter } from './users/user.routes';
import { paypalWebhookRouter } from './paypal/webhook.routes';
import { authenticate, requireGlobalRole } from './auth/auth.middleware';

// Load environment variables from server/.env and root .env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gitescrow';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Credentialed CORS configured for explicit frontend origin
app.use(
  cors({
    origin: [FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-GitHub-Event', 'X-GitHub-Delivery', 'X-Hub-Signature-256']
  })
);

// Cookie parser for HttpOnly refresh and access tokens
app.use(cookieParser());

// Configure JSON body parser with rawBody capture for webhook signature verification
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'GitEscrow Server',
    timestamp: new Date().toISOString(),
    paypalConfigured: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    githubConfigured: Boolean(process.env.GITHUB_TOKEN),
    dbConnected: mongoose.connection.readyState === 1
  });
});

// Root welcome endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'Welcome to GitEscrow API - Open-Source Escrow Bounties with PayPal and AI',
    version: '1.0.0',
    documentation: '/health'
  });
});

// Authentication routes
app.use('/api/auth', authRouter);

// User profile and payout routes (Task 2D)
app.use('/api/users', userRouter);

// Organization management routes
app.use('/api/organizations', organizationRouter);

// Bounty and milestone management routes (Task 2B.1)
app.use('/api/bounties', bountyRouter);
app.use('/api/milestones', milestoneRouter);

// AI-powered issue analysis and milestone decomposition (Task 2B.2)
app.use('/api/ai', aiRouter);

// Protected Admin Test Endpoint
const adminRouter = Router();
adminRouter.get('/test', authenticate, requireGlobalRole('ADMIN'), (req: any, res) => {
  res.status(200).json({
    message: 'Admin access verified successfully',
    admin: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role
    }
  });
});
app.use('/api/admin', adminRouter);

// PayPal Webhooks Route (Task 2D)
app.use('/api/webhooks/paypal', paypalWebhookRouter);

// GitHub Webhooks Route
app.use('/api/webhooks', webhookRouter);

// Database connection helper
export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState >= 1) return;
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`[GitEscrow DB] Connected to MongoDB at ${MONGODB_URI.replace(/\/\/[^@]+@/, '//***:***@')}`);
  } catch (err: any) {
    console.warn(`[GitEscrow DB] Warning: MongoDB connection failed (${err.message}). Continuing in offline mode.`);
  }
}

// Server startup (only when executed directly as main module)
if (require.main === module && process.env.NODE_ENV !== 'test') {
  connectDB().finally(() => {
    app.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(`  GitEscrow Server listening on port ${PORT}`);
      console.log(`  Health Check: http://localhost:${PORT}/health`);
      console.log(`  GitHub Webhook: http://localhost:${PORT}/api/webhooks/github`);
      console.log(`  CORS Allowed Origin: ${FRONTEND_URL}`);
      console.log(`=========================================`);
    });
  });
}

export default app;
