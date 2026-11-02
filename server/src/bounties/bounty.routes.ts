import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { BountyController } from './bounty.controller';
import { authenticate } from '../auth/auth.middleware';

export const bountyRouter = Router();
export const milestoneRouter = Router();

const isTest = process.env.NODE_ENV === 'test';

// Rate limiter for write operations (publishing, creating bounties)
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 60,
  message: { error: 'Too many write requests, please slow down.', code: 'RATE_LIMIT_EXCEEDED' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest
});

// --- Public / Read Bounty Routes ---
bountyRouter.get('/', BountyController.list);
bountyRouter.get('/:id', BountyController.getById);
bountyRouter.get('/:id/milestones', BountyController.listMilestones);

// --- Authenticated Bounty Mutation Routes ---
bountyRouter.post('/', authenticate, writeLimiter, BountyController.create);
bountyRouter.patch('/:id', authenticate, BountyController.update);
bountyRouter.post('/:id/publish', authenticate, writeLimiter, BountyController.publish);
bountyRouter.post('/:id/cancel', authenticate, BountyController.cancel);
bountyRouter.post('/:id/accept', authenticate, BountyController.accept);
bountyRouter.post('/:id/start', authenticate, BountyController.start);
bountyRouter.post('/:id/submit', authenticate, BountyController.submit);

// --- Bounty-Scoped Milestone & Ledger Routes ---
bountyRouter.post('/:id/milestones', authenticate, writeLimiter, BountyController.createMilestone);
bountyRouter.get('/:id/ledger', authenticate, BountyController.getBountyLedger);

// --- Individual Milestone Routes ---
milestoneRouter.use(authenticate);
milestoneRouter.patch('/:id', BountyController.updateMilestone);
milestoneRouter.post('/:id/submit', BountyController.submitMilestone);
milestoneRouter.post('/:id/approve', BountyController.approveMilestone);
milestoneRouter.post('/:id/request-changes', BountyController.requestChangesMilestone);

