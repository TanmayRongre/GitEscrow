import { z } from "zod";
import mongoose from "mongoose";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z
  .string()
  .regex(objectIdRegex, "Invalid ObjectId format");

export const createBountySchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title cannot exceed 200 characters"),
  slug: z
    .string()
    .trim()
    .min(3, "Slug must be at least 3 characters")
    .max(100, "Slug cannot exceed 100 characters")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug can only contain lowercase letters, numbers, and hyphens",
    )
    .optional(),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters")
    .max(10000, "Description cannot exceed 10000 characters"),
  organizationId: objectIdSchema,
  repositoryOwner: z.string().trim().min(1, "Repository owner is required"),
  repositoryName: z.string().trim().min(1, "Repository name is required"),
  issueNumber: z
    .number()
    .int()
    .positive("Issue number must be a positive integer"),
  rewardAmount: z.number().positive("Reward amount must be a positive number"),
  currency: z.literal("USD").default("USD"),
  rewardDescription: z.string().trim().max(500).optional(),
  expiresAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().optional()),
});

export const updateBountySchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title cannot exceed 200 characters")
    .optional(),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters")
    .max(10000, "Description cannot exceed 10000 characters")
    .optional(),
  rewardAmount: z
    .number()
    .positive("Reward amount must be a positive number")
    .optional(),
  rewardDescription: z.string().trim().max(500).optional(),
  expiresAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().optional()),
});

export const createMilestoneSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Title must be at least 2 characters")
    .max(200, "Title cannot exceed 200 characters"),
  description: z
    .string()
    .trim()
    .max(5000, "Description cannot exceed 5000 characters")
    .default(""),
  order: z.number().int().min(1, "Order must be 1 or greater"),
  rewardAmount: z
    .number()
    .positive("Milestone reward amount must be a positive number"),
  currency: z.literal("USD").default("USD"),
  acceptanceCriteria: z
    .array(z.string().trim().min(1, "Criterion cannot be empty"))
    .min(1, "At least one acceptance criterion is required"),
  dueDate: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().optional()),
});

export const updateMilestoneSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Title must be at least 2 characters")
    .max(200, "Title cannot exceed 200 characters")
    .optional(),
  description: z
    .string()
    .trim()
    .max(5000, "Description cannot exceed 5000 characters")
    .optional(),
  order: z.number().int().min(1).optional(),
  rewardAmount: z
    .number()
    .positive("Milestone reward amount must be a positive number")
    .optional(),
  acceptanceCriteria: z
    .array(z.string().trim().min(1, "Criterion cannot be empty"))
    .min(1, "At least one acceptance criterion is required")
    .optional(),
  dueDate: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().optional()),
});

export const submitBountySchema = z.object({
  prUrl: z.string().url("Invalid GitHub Pull Request URL").optional(),
  prNumber: z.number().int().positive("PR number must be positive").optional(),
  submissionNotes: z
    .string()
    .trim()
    .max(2000, "Submission notes cannot exceed 2000 characters")
    .optional(),
});

export const submitMilestoneSchema = z.object({
  submissionDetails: z
    .string()
    .trim()
    .min(3, "Submission details must be at least 3 characters")
    .max(2000, "Submission details cannot exceed 2000 characters"),
});

export const milestoneDecisionSchema = z.object({
  decisionNotes: z
    .string()
    .trim()
    .max(2000, "Decision notes cannot exceed 2000 characters")
    .optional(),
});

export const bountyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum([
      "DRAFT",
      "OPEN",
      "ASSIGNED",
      "IN_PROGRESS",
      "SUBMITTED",
      "UNDER_REVIEW",
      "COMPLETED",
      "CANCELLED",
      "EXPIRED",
    ])
    .optional(),
  repository: z.string().trim().optional(),
  organization: z.string().trim().optional(),
  minReward: z.coerce.number().min(0).optional(),
  maxReward: z.coerce.number().min(0).optional(),
  currency: z.literal("USD").optional(),
});

export const fundBountySchema = z.object({
  paypalCaptureId: z.string().trim().min(3, "PayPal capture ID is required"),
  paypalOrderId: z.string().trim().optional(),
  amount: z.number().positive("Funded amount must be a positive number")
});
