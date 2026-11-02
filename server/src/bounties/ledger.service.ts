import mongoose from 'mongoose';
import { EscrowLedger, IEscrowLedger, LedgerEventType, LedgerDirection, LedgerEventStatus } from '../models/EscrowLedger';
import { IUser } from '../models/User';
import { OrganizationRole } from '../models/Organization';

export class LedgerError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(message: string, status = 400, code = 'LEDGER_ERROR') {
    super(message);
    this.name = 'LedgerError';
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, LedgerError.prototype);
  }
}

export interface RecordLedgerEventParams {
  bountyId: string | mongoose.Types.ObjectId;
  organizationId: string | mongoose.Types.ObjectId;
  eventType: LedgerEventType;
  amount: number | string | mongoose.Types.Decimal128;
  currency?: 'USD';
  direction: LedgerDirection;
  status?: LedgerEventStatus;
  paypalOrderId?: string;
  paypalCaptureId?: string;
  paypalRefundId?: string;
  relatedMilestoneId?: string | mongoose.Types.ObjectId;
  idempotencyKey: string;
  description: string;
  metadata?: Record<string, any>;
  createdBy?: mongoose.Types.ObjectId;
}

export class LedgerService {
  /**
   * Appends an immutable financial event to the internal escrow ledger.
   * Enforces idempotency, non-negative amounts, and USD currency.
   */
  public static async recordEvent(params: RecordLedgerEventParams): Promise<IEscrowLedger> {
    const {
      bountyId,
      organizationId,
      eventType,
      amount,
      currency = 'USD',
      direction,
      status = 'COMPLETED',
      paypalOrderId,
      paypalCaptureId,
      paypalRefundId,
      relatedMilestoneId,
      idempotencyKey,
      description,
      metadata = {},
      createdBy
    } = params;

    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
      throw new LedgerError('A valid, non-empty idempotencyKey is required for all ledger records.', 400, 'IDEMPOTENCY_KEY_REQUIRED');
    }

    const cleanIdempotencyKey = idempotencyKey.trim();

    // Check for duplicate idempotency key
    const existing = await EscrowLedger.findOne({ idempotencyKey: cleanIdempotencyKey });
    if (existing) {
      throw new LedgerError(
        `Duplicate ledger event detected with idempotency key: ${cleanIdempotencyKey}`,
        409,
        'DUPLICATE_IDEMPOTENCY_KEY'
      );
    }

    const numAmount = typeof amount === 'number'
      ? amount
      : parseFloat(amount.toString());

    if (isNaN(numAmount) || numAmount < 0) {
      throw new LedgerError('Ledger event amount must be a non-negative number.', 400, 'INVALID_AMOUNT');
    }

    if (currency !== 'USD') {
      throw new LedgerError('Only USD currency is supported in the ledger for this prototype.', 400, 'UNSUPPORTED_CURRENCY');
    }

    const entry = new EscrowLedger({
      bountyId: new mongoose.Types.ObjectId(bountyId),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      eventType,
      amount: mongoose.Types.Decimal128.fromString(numAmount.toFixed(2)),
      currency,
      direction,
      status,
      paypalOrderId: paypalOrderId?.trim() || undefined,
      paypalCaptureId: paypalCaptureId?.trim() || undefined,
      paypalRefundId: paypalRefundId?.trim() || undefined,
      relatedMilestoneId: relatedMilestoneId ? new mongoose.Types.ObjectId(relatedMilestoneId) : undefined,
      idempotencyKey: cleanIdempotencyKey,
      description: description.trim(),
      metadata,
      createdBy: createdBy || undefined
    });

    await entry.save();
    return entry;
  }

  /**
   * Retrieves ledger event history for a bounty.
   * Access restricted to organization OWNER, SPONSOR, or global ADMIN.
   */
  public static async getByBounty(
    bountyId: string,
    user: IUser,
    orgRole?: OrganizationRole
  ): Promise<IEscrowLedger[]> {
    const isGlobalAdmin = user.role === 'ADMIN';
    const isOrgSponsorOrOwner = orgRole === 'OWNER' || orgRole === 'SPONSOR';

    if (!isGlobalAdmin && !isOrgSponsorOrOwner) {
      throw new LedgerError(
        'Access Denied: Only organization sponsors, owners, or administrators can view financial ledger records.',
        403,
        'FORBIDDEN_LEDGER_ACCESS'
      );
    }

    return EscrowLedger.find({ bountyId: new mongoose.Types.ObjectId(bountyId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Retrieves organization-level ledger history.
   * Access restricted to organization OWNER, SPONSOR, or global ADMIN.
   */
  public static async getByOrganization(
    orgId: string,
    user: IUser,
    orgRole?: OrganizationRole
  ): Promise<IEscrowLedger[]> {
    const isGlobalAdmin = user.role === 'ADMIN';
    const isOrgSponsorOrOwner = orgRole === 'OWNER' || orgRole === 'SPONSOR';

    if (!isGlobalAdmin && !isOrgSponsorOrOwner) {
      throw new LedgerError(
        'Access Denied: You do not have permission to view organization financial ledger records.',
        403,
        'FORBIDDEN_LEDGER_ACCESS'
      );
    }

    return EscrowLedger.find({ organizationId: new mongoose.Types.ObjectId(orgId) })
      .sort({ createdAt: -1 })
      .exec();
  }
}

