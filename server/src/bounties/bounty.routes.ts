import { Router } from "express";
import rateLimit from "express-rate-limit";
import { BountyController } from "./bounty.controller";
import { authenticate, optionalAuthenticate } from "../auth/auth.middleware";

export const bountyRouter = Router();
export const milestoneRouter = Router();

const isTest = process.env.NODE_ENV === "test";

// Rate limiter for write operations (publishing, creating bounties)
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 60,
  message: {
    error: "Too many write requests, please slow down.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
});

// --- Public / Read Bounty Routes ---
bountyRouter.get("/summary", optionalAuthenticate, BountyController.getSummary);
bountyRouter.get("/paypal/config", BountyController.getPayPalConfig);
bountyRouter.get("/", optionalAuthenticate, BountyController.list);
bountyRouter.get("/:id", BountyController.getById);
bountyRouter.get("/:id/milestones", BountyController.listMilestones);

// --- Authenticated Bounty Mutation Routes ---
bountyRouter.post("/", authenticate, writeLimiter, BountyController.create);
bountyRouter.patch("/:id", authenticate, BountyController.update);
bountyRouter.post(
  "/:id/publish",
  authenticate,
  writeLimiter,
  BountyController.publish,
);
bountyRouter.post(
  "/:id/fund",
  authenticate,
  writeLimiter,
  BountyController.fundBounty,
);
bountyRouter.post(
  "/:id/create-paypal-order",
  authenticate,
  writeLimiter,
  BountyController.createPayPalOrder,
);
bountyRouter.post(
  "/:id/capture-paypal-order",
  authenticate,
  writeLimiter,
  BountyController.capturePayPalOrder,
);
bountyRouter.post("/:id/cancel", authenticate, BountyController.cancel);
bountyRouter.post("/:id/accept", authenticate, BountyController.accept);
bountyRouter.post("/:id/start", authenticate, BountyController.start);
bountyRouter.post("/:id/submit", authenticate, BountyController.submit);

// --- Bounty-Scoped Milestone & Ledger Routes ---
bountyRouter.post(
  "/:id/milestones",
  authenticate,
  writeLimiter,
  BountyController.createMilestone,
);
bountyRouter.get("/:id/ledger", authenticate, BountyController.getBountyLedger);
bountyRouter.post(
  "/:id/milestones/:milestoneId/submit-pr",
  authenticate,
  writeLimiter,
  BountyController.submitMilestonePR,
);
bountyRouter.post(
  "/:id/milestones/:milestoneId/review",
  authenticate,
  writeLimiter,
  BountyController.reviewMilestonePR,
);
bountyRouter.get(
  "/:id/milestones/:milestoneId/verification",
  authenticate,
  BountyController.getMilestoneVerification,
);

// --- Individual Milestone Routes ---
milestoneRouter.use(authenticate);
milestoneRouter.patch("/:id", BountyController.updateMilestone);
milestoneRouter.post("/:id/submit", BountyController.submitMilestone);
milestoneRouter.post(
  "/:id/submit-pr",
  writeLimiter,
  BountyController.submitMilestonePR,
);
milestoneRouter.post(
  "/:id/review",
  writeLimiter,
  BountyController.reviewMilestonePR,
);
milestoneRouter.get(
  "/:id/verification",
  BountyController.getMilestoneVerification,
);
milestoneRouter.post("/:id/approve", BountyController.approveMilestone);
milestoneRouter.post(
  "/:id/request-changes",
  BountyController.requestChangesMilestone,
);
milestoneRouter.post(
  "/:id/payout/retry",
  writeLimiter,
  BountyController.retryMilestonePayout,
);
milestoneRouter.get(
  "/:id/payout/status",
  BountyController.getMilestonePayoutStatus,
);

bountyRouter.post(
  "/:id/milestones/:milestoneId/payout/retry",
  authenticate,
  writeLimiter,
  BountyController.retryMilestonePayout,
);
bountyRouter.get(
  "/:id/milestones/:milestoneId/payout/status",
  authenticate,
  BountyController.getMilestonePayoutStatus,
);
