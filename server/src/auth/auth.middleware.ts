import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { User, IUser, UserRole } from '../models/User';
import { Organization, IOrganization, OrganizationRole } from '../models/Organization';
import { TokenService, TokenError } from './token.service';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
  organization?: IOrganization;
  orgRole?: OrganizationRole;
}

/**
 * Middleware: Verifies JWT access token from Authorization header or cookie.
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.cookies?.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    res.status(401).json({
      error: 'Authentication required. Please provide an access token.',
      code: 'AUTH_REQUIRED'
    });
    return;
  }

  try {
    const payload = TokenService.verifyAccessToken(token);
    const user = await User.findById(payload.sub);

    if (!user) {
      res.status(401).json({
        error: 'Authenticated user no longer exists.',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    if (user.accountStatus === 'SUSPENDED') {
      res.status(403).json({
        error: 'Account has been suspended.',
        code: 'ACCOUNT_SUSPENDED'
      });
      return;
    }

    if (user.accountStatus === 'DELETED') {
      res.status(401).json({
        error: 'Account has been deleted.',
        code: 'ACCOUNT_DELETED'
      });
      return;
    }

    req.user = user;
    next();
  } catch (err: any) {
    if (err instanceof TokenError) {
      res.status(401).json({ error: err.message, code: err.code });
      return;
    }
    res.status(401).json({ error: 'Invalid or expired access token', code: 'TOKEN_INVALID' });
  }
}

/**
 * Middleware: Requires the authenticated user to hold one of the specified global roles.
 */
export function requireGlobalRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Requires one of global roles: ${allowedRoles.join(', ')}`,
        code: 'FORBIDDEN_GLOBAL_ROLE'
      });
      return;
    }

    next();
  };
}

/**
 * Middleware: Requires the authenticated user to hold a permitted role within the target organization.
 */
export function requireOrganizationRole(...allowedRoles: OrganizationRole[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      return;
    }

    const orgId = req.params.id || req.params.orgId;
    if (!orgId || !mongoose.Types.ObjectId.isValid(orgId)) {
      res.status(400).json({ error: 'Invalid organization ID parameter', code: 'INVALID_ORG_ID' });
      return;
    }

    try {
      const organization = await Organization.findById(orgId);
      if (!organization) {
        res.status(404).json({ error: 'Organization not found', code: 'ORG_NOT_FOUND' });
        return;
      }

      // Check membership
      const userIdStr = req.user._id.toString();
      const isOwner = organization.ownerId.toString() === userIdStr;

      let memberRole: OrganizationRole | undefined;
      if (isOwner) {
        memberRole = 'OWNER';
      } else {
        const member = organization.members.find((m) => m.userId.toString() === userIdStr);
        memberRole = member?.role;
      }

      if (!memberRole) {
        res.status(403).json({
          error: 'Access denied: You are not a member of this organization',
          code: 'FORBIDDEN_NOT_ORG_MEMBER'
        });
        return;
      }

      // If user is OWNER, they satisfy all organization permission checks
      const hasPermission =
        memberRole === 'OWNER' || allowedRoles.includes(memberRole);

      if (!hasPermission) {
        res.status(403).json({
          error: `Access denied: Requires organization role ${allowedRoles.join(' or ')}`,
          code: 'FORBIDDEN_ORG_ROLE'
        });
        return;
      }

      req.organization = organization;
      req.orgRole = memberRole;
      next();
    } catch (err: any) {
      res.status(500).json({ error: `Internal organization auth error: ${err.message}` });
    }
  };
}

