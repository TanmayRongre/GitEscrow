import { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../auth/auth.middleware";
import { User } from "../models/User";
import { Milestone } from "../models/Milestone";
import { Bounty } from "../models/Bounty";
import { maskEmail, PayoutService } from "../paypal/payout.service";

const payoutProfileSchema = z.object({
  paypalEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "A valid PayPal email address is required." }),
});

export class UserController {
  /**
   * Retrieves the current user's payout configuration
   */
  public static async getMyPayoutProfile(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ error: "Authentication required", code: "UNAUTHORIZED" });
        return;
      }

      const user = await User.findById(req.user._id);
      if (!user) {
        res
          .status(404)
          .json({ error: "User not found", code: "USER_NOT_FOUND" });
        return;
      }

      res.status(200).json({
        payoutProfile: {
          configured: Boolean(user.paypalEmail),
          paypalEmail: user.paypalEmail || null,
          maskedEmail: user.paypalEmail ? maskEmail(user.paypalEmail) : null,
        },
      });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: `Failed to retrieve payout profile: ${err.message}` });
    }
  }

  /**
   * Updates the current user's PayPal payout recipient email
   */
  public static async updateMyPayoutProfile(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ error: "Authentication required", code: "UNAUTHORIZED" });
        return;
      }

      const parsed = payoutProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: parsed.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        });
        return;
      }

      const cleanEmail = parsed.data.paypalEmail;
      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { paypalEmail: cleanEmail } },
        { new: true },
      );

      if (!user) {
        res
          .status(404)
          .json({ error: "User not found", code: "USER_NOT_FOUND" });
        return;
      }

      // Check if contributor has any approved milestones waiting for payout info
      const pendingBounties = await Bounty.find({
        assignedContributorId: user._id,
        fundingStatus: { $in: ["FUNDED", "PARTIALLY_DISBURSED"] },
      });

      if (pendingBounties.length > 0) {
        const bountyIds = pendingBounties.map((b) => b._id);
        await Milestone.updateMany(
          {
            bountyId: { $in: bountyIds },
            status: "APPROVED",
            payoutStatus: "AWAITING_PAYOUT_INFO",
          },
          { $set: { payoutStatus: "QUEUED" } },
        );
      }

      res.status(200).json({
        message: "Payout profile updated successfully.",
        payoutProfile: {
          configured: true,
          paypalEmail: user.paypalEmail,
          maskedEmail: maskEmail(user.paypalEmail),
        },
      });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: `Failed to update payout profile: ${err.message}` });
    }
  }
}
