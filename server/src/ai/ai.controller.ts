import { Request, Response } from "express";
import { ZodError } from "zod";
import { IssueAnalysisRequestSchema } from "./types";
import { AIService } from "./ai.service";

export class AIController {
  /**
   * POST /api/ai/analyze-issue
   * Analyzes a GitHub issue and generates structured milestone suggestions with acceptance criteria.
   * Does NOT create bounties, milestones, or payments in the database.
   */
  public static async analyzeIssue(req: Request, res: Response): Promise<void> {
    try {
      const validatedInput = IssueAnalysisRequestSchema.parse(req.body);
      const analysis = await AIService.analyzeGitHubIssue(validatedInput);

      res.status(200).json({
        success: true,
        message: "GitHub issue analyzed successfully",
        analysis,
      });
    } catch (err: any) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: err.flatten().fieldErrors,
        });
        return;
      }

      if (
        err.status === 404 ||
        (err.message && err.message.includes("not found"))
      ) {
        res.status(404).json({
          error: err.message,
          code: "GITHUB_ISSUE_NOT_FOUND",
        });
        return;
      }

      if (
        err.status === 429 ||
        (err.message && err.message.includes("rate limit"))
      ) {
        res.status(429).json({
          error: err.message,
          code: "GITHUB_RATE_LIMIT_EXCEEDED",
        });
        return;
      }

      res.status(500).json({
        error:
          err.message ||
          "An unexpected error occurred during AI issue analysis",
        code: "AI_ANALYSIS_FAILED",
      });
    }
  }
}
