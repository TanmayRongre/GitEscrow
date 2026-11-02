import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { AuthService, AuthError } from './auth.service';
import {
  registerSchema,
  loginSchema,
  adminBootstrapSchema
} from './auth.validation';
import { AuthenticatedRequest } from './auth.middleware';

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const isProd = process.env.NODE_ENV === 'production';

  // Access token cookie (short-lived 15m)
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 15 * 60 * 1000 // 15 mins
  });

  // Refresh token cookie (7 days, path restricted to /api/auth)
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

function clearAuthCookies(res: Response) {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax'
  });
  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/api/auth'
  });
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/api/auth'
  });
}

export class AuthController {
  public static async register(req: Request, res: Response): Promise<void> {
    try {
      const validated = registerSchema.parse(req.body);
      const result = await AuthService.register(validated);

      setAuthCookies(res, result.accessToken, result.refreshToken);

      res.status(201).json({
        message: 'Account registered successfully',
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });
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
      res.status(500).json({ error: `Registration error: ${err.message}` });
    }
  }

  public static async login(req: Request, res: Response): Promise<void> {
    try {
      const validated = loginSchema.parse(req.body);
      const result = await AuthService.login(validated.email, validated.password);

      setAuthCookies(res, result.accessToken, result.refreshToken);

      res.status(200).json({
        message: 'Login successful',
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });
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
      res.status(500).json({ error: `Login error: ${err.message}` });
    }
  }

  public static async refresh(req: Request, res: Response): Promise<void> {
    try {
      // Refresh token can come from request body or HttpOnly cookie (refresh_token or refreshToken)
      const rawToken = req.body?.refreshToken || req.cookies?.refresh_token || req.cookies?.refreshToken;

      if (!rawToken) {
        res.status(400).json({ error: 'Refresh token is required', code: 'REFRESH_TOKEN_REQUIRED' });
        return;
      }

      const result = await AuthService.refresh(rawToken);

      setAuthCookies(res, result.accessToken, result.newRefreshToken);

      res.status(200).json({
        message: 'Token refreshed successfully',
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.newRefreshToken
      });
    } catch (err: any) {
      clearAuthCookies(res);
      if (err instanceof AuthError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(401).json({ error: err.message || 'Token refresh failed', code: 'REFRESH_FAILED' });
    }
  }

  public static async logout(req: Request, res: Response): Promise<void> {
    const rawToken = req.body?.refreshToken || req.cookies?.refresh_token;
    await AuthService.logout(rawToken);
    clearAuthCookies(res);
    res.status(200).json({ message: 'Logged out successfully' });
  }

  public static async me(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    res.status(200).json({ user: req.user });
  }

  public static async bootstrapAdmin(req: Request, res: Response): Promise<void> {
    try {
      const validated = adminBootstrapSchema.parse(req.body);
      const result = await AuthService.bootstrapAdmin(validated);

      setAuthCookies(res, result.accessToken, result.refreshToken);

      res.status(201).json({
        message: 'Administrator account bootstrapped successfully',
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });
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
      res.status(500).json({ error: `Admin bootstrap error: ${err.message}` });
    }
  }
}
