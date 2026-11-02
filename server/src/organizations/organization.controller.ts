import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../auth/auth.middleware';
import { OrganizationService } from './organization.service';
import { AuthError } from '../auth/auth.service';
import {
  createOrganizationSchema,
  addMemberSchema,
  updateMemberRoleSchema
} from '../auth/auth.validation';

export class OrganizationController {
  public static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const validated = createOrganizationSchema.parse(req.body);
      const org = await OrganizationService.create(req.user._id, validated);
      res.status(201).json({ message: 'Organization created successfully', organization: org });
    } catch (err: any) {
      if (err instanceof ZodError) {
        const issues = (err as any).issues || (err as any).errors || [];
        res.status(400).json({
          error: 'Validation failed',
          details: issues.map((e: any) => ({ field: e.path.join('.'), message: e.message }))
        });
        return;
      }
      if (err instanceof AuthError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ error: `Create organization error: ${err.message}` });
    }
  }

  public static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const orgs = await OrganizationService.listForUser(req.user._id);
      res.status(200).json({ organizations: orgs });
    } catch (err: any) {
      res.status(500).json({ error: `List organizations error: ${err.message}` });
    }
  }

  public static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const org = await OrganizationService.getById(req.params.id);
      res.status(200).json({ organization: org });
    } catch (err: any) {
      if (err instanceof AuthError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ error: `Get organization error: ${err.message}` });
    }
  }

  public static async addMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validated = addMemberSchema.parse(req.body);
      const org = await OrganizationService.addMember(req.params.id, validated.userId, validated.role);
      res.status(200).json({ message: 'Member added successfully', organization: org });
    } catch (err: any) {
      if (err instanceof ZodError) {
        const issues = (err as any).issues || (err as any).errors || [];
        res.status(400).json({
          error: 'Validation failed',
          details: issues.map((e: any) => ({ field: e.path.join('.'), message: e.message }))
        });
        return;
      }
      if (err instanceof AuthError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ error: `Add member error: ${err.message}` });
    }
  }

  public static async updateMemberRole(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const validated = updateMemberRoleSchema.parse(req.body);
      const org = await OrganizationService.updateMemberRole(
        req.params.id,
        req.params.userId,
        validated.role,
        req.user._id.toString()
      );
      res.status(200).json({ message: 'Member role updated successfully', organization: org });
    } catch (err: any) {
      if (err instanceof ZodError) {
        const issues = (err as any).issues || (err as any).errors || [];
        res.status(400).json({
          error: 'Validation failed',
          details: issues.map((e: any) => ({ field: e.path.join('.'), message: e.message }))
        });
        return;
      }
      if (err instanceof AuthError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ error: `Update member role error: ${err.message}` });
    }
  }
}
