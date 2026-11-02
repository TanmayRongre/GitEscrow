import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters'),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().trim().email('Please provide a valid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password cannot exceed 100 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d|.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).+$/,
      'Password must include uppercase, lowercase, and at least one number or special character'
    ),
  role: z.string().optional() // Sanitized to 'USER' by AuthService
});

export const loginSchema = z.object({
  email: z.string().trim().email('Please provide a valid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required')
});

export const adminBootstrapSchema = z.object({
  setupSecret: z.string().min(1, 'Admin setup secret is required'),
  name: z.string().trim().min(1, 'Name is required').max(100),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().trim().email('Please provide a valid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d|.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).+$/,
      'Password must include uppercase, lowercase, and at least one number or special character'
    ),
  role: z.string().optional() // Sanitized to 'USER' by AuthService
});

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(50)
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  description: z.string().trim().max(500).optional(),
  website: z.string().trim().url('Website must be a valid URL').optional().or(z.literal('')),
  logoUrl: z.string().trim().url('Logo must be a valid URL').optional().or(z.literal(''))
});

export const addMemberSchema = z.object({
  userId: z.string().trim().min(1, 'User ID is required'),
  role: z.enum(['OWNER', 'SPONSOR', 'MEMBER'])
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['OWNER', 'SPONSOR', 'MEMBER'])
});
