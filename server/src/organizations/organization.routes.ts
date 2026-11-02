import { Router } from 'express';
import { OrganizationController } from './organization.controller';
import { BountyController } from '../bounties/bounty.controller';
import { authenticate, requireOrganizationRole } from '../auth/auth.middleware';

export const organizationRouter = Router();

// All organization routes require authentication
organizationRouter.use(authenticate);

// List user's organizations and create new organization
organizationRouter.post('/', OrganizationController.create);
organizationRouter.get('/', OrganizationController.list);

// View organization details (requires any member role)
organizationRouter.get(
  '/:id',
  requireOrganizationRole('OWNER', 'SPONSOR', 'MEMBER'),
  OrganizationController.getById
);

// View organization ledger (requires OWNER or SPONSOR role)
organizationRouter.get(
  '/:id/ledger',
  requireOrganizationRole('OWNER', 'SPONSOR'),
  BountyController.getOrgLedger
);

// Add member (requires OWNER or SPONSOR role)
organizationRouter.post(
  '/:id/members',
  requireOrganizationRole('OWNER', 'SPONSOR'),
  OrganizationController.addMember
);

// Update member role or transfer ownership (requires OWNER role)
organizationRouter.patch(
  '/:id/members/:userId/role',
  requireOrganizationRole('OWNER'),
  OrganizationController.updateMemberRole
);

