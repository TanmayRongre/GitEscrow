import mongoose from 'mongoose';
import { Organization, IOrganization, OrganizationRole } from '../models/Organization';
import { User } from '../models/User';
import { AuthError } from '../auth/auth.service';

export class OrganizationService {
  /**
   * Creates a new organization with the creating user as OWNER.
   */
  public static async create(
    userId: mongoose.Types.ObjectId | string,
    data: {
      name: string;
      slug: string;
      description?: string;
      website?: string;
      logoUrl?: string;
    }
  ): Promise<IOrganization> {
    const slug = data.slug.toLowerCase().trim();

    // Check slug uniqueness
    const existing = await Organization.findOne({ slug });
    if (existing) {
      throw new AuthError(`Organization slug '${slug}' is already in use`, 409, 'SLUG_TAKEN');
    }

    const org = await Organization.create({
      name: data.name.trim(),
      slug,
      description: data.description?.trim(),
      website: data.website?.trim(),
      logoUrl: data.logoUrl?.trim(),
      ownerId: new mongoose.Types.ObjectId(userId),
      members: [
        {
          userId: new mongoose.Types.ObjectId(userId),
          role: 'OWNER',
          joinedAt: new Date()
        }
      ],
      organizationStatus: 'ACTIVE'
    });

    return org;
  }

  /**
   * Lists all organizations the user is a member of.
   */
  public static async listForUser(userId: mongoose.Types.ObjectId | string): Promise<IOrganization[]> {
    const orgs = await Organization.find({
      'members.userId': new mongoose.Types.ObjectId(userId)
    })
      .populate('ownerId', 'name username email')
      .populate('members.userId', 'name username email avatarUrl')
      .sort({ createdAt: -1 });

    return orgs;
  }

  /**
   * Retrieves an organization by ID.
   */
  public static async getById(orgId: string): Promise<IOrganization> {
    const org = await Organization.findById(orgId)
      .populate('ownerId', 'name username email')
      .populate('members.userId', 'name username email avatarUrl');

    if (!org) {
      throw new AuthError('Organization not found', 404, 'ORG_NOT_FOUND');
    }

    return org;
  }

  /**
   * Adds a member to an organization.
   */
  public static async addMember(
    orgId: string,
    targetUserId: string,
    role: OrganizationRole
  ): Promise<IOrganization> {
    const org = await Organization.findById(orgId);
    if (!org) {
      throw new AuthError('Organization not found', 404, 'ORG_NOT_FOUND');
    }

    // Verify target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      throw new AuthError('User to add was not found', 404, 'USER_NOT_FOUND');
    }

    const alreadyMember = org.members.some(
      (m) => m.userId.toString() === targetUserId
    );
    if (alreadyMember) {
      throw new AuthError('User is already a member of this organization', 409, 'ALREADY_MEMBER');
    }

    org.members.push({
      userId: new mongoose.Types.ObjectId(targetUserId),
      role,
      joinedAt: new Date()
    });

    await org.save();
    return org;
  }

  /**
   * Updates a member's role or handles ownership transfer.
   */
  public static async updateMemberRole(
    orgId: string,
    targetUserId: string,
    newRole: OrganizationRole,
    requestingUserId: string
  ): Promise<IOrganization> {
    const org = await Organization.findById(orgId);
    if (!org) {
      throw new AuthError('Organization not found', 404, 'ORG_NOT_FOUND');
    }

    // Only OWNER can modify member roles
    const isOwner = org.ownerId.toString() === requestingUserId;
    if (!isOwner) {
      throw new AuthError(
        'Forbidden: Only the organization OWNER can modify member roles or transfer ownership',
        403,
        'FORBIDDEN_NOT_OWNER'
      );
    }

    const member = org.members.find((m) => m.userId.toString() === targetUserId);
    if (!member) {
      throw new AuthError('Target user is not a member of this organization', 404, 'MEMBER_NOT_FOUND');
    }

    // If transferring ownership:
    if (newRole === 'OWNER') {
      org.ownerId = new mongoose.Types.ObjectId(targetUserId);
      member.role = 'OWNER';
      const prevOwnerMember = org.members.find((m) => m.userId.toString() === requestingUserId);
      if (prevOwnerMember && prevOwnerMember.userId.toString() !== targetUserId) {
        prevOwnerMember.role = 'SPONSOR';
      }
    } else {
      // Prevent removing/demoting the primary owner without transferring ownership first
      if (org.ownerId.toString() === targetUserId) {
        throw new AuthError(
          'Cannot demote primary organization owner. Transfer ownership first.',
          400,
          'CANNOT_DEMOTE_OWNER'
        );
      }
      member.role = newRole;
    }

    await org.save();
    return org;
  }
}
