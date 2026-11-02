import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { UserRole } from '../models/User';
import { RefreshToken, IRefreshToken } from '../models/RefreshToken';

export interface AccessTokenPayload {
  sub: string; // User ID
  email: string;
  username: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string; // Token identifier
  familyId: string;
  iat?: number;
  exp?: number;
}

export class TokenError extends Error {
  public readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'TokenError';
    this.code = code;
  }
}

export class TokenService {
  private static getAccessSecret(): string {
    return process.env.JWT_ACCESS_SECRET || 'gitescrow_dev_access_secret_key_2026_default';
  }

  private static getRefreshSecret(): string {
    return process.env.JWT_REFRESH_SECRET || 'gitescrow_dev_refresh_secret_key_2026_default';
  }

  private static getAccessExpiresIn(): string {
    return process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  }

  private static getRefreshExpiresInDays(): number {
    const raw = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    const match = raw.match(/^(\d+)d$/);
    return match ? parseInt(match[1], 10) : 7;
  }

  /**
   * Hashes a refresh token string using SHA-256 for safe database storage.
   */
  public static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generates a short-lived signed JWT access token.
   */
  public static generateAccessToken(user: {
    id: string | mongoose.Types.ObjectId;
    email: string;
    username: string;
    role: UserRole;
  }): string {
    const payload: AccessTokenPayload = {
      sub: user.id.toString(),
      email: user.email,
      username: user.username,
      role: user.role
    };

    return jwt.sign(payload, this.getAccessSecret(), {
      expiresIn: this.getAccessExpiresIn() as any
    });
  }

  /**
   * Verifies an access token and returns its decoded payload.
   */
  public static verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return jwt.verify(token, this.getAccessSecret()) as AccessTokenPayload;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new TokenError('Access token has expired', 'TOKEN_EXPIRED');
      }
      throw new TokenError('Invalid access token', 'TOKEN_INVALID');
    }
  }

  /**
   * Generates and stores a new refresh token with rotation family tracking.
   */
  public static async createRefreshToken(
    userId: string | mongoose.Types.ObjectId,
    familyId?: string
  ): Promise<{ token: string; expiresAt: Date; familyId: string }> {
    const resolvedFamilyId = familyId || crypto.randomUUID();
    const tokenId = crypto.randomUUID();
    const expiresDays = this.getRefreshExpiresInDays();
    const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

    const payload: RefreshTokenPayload = {
      sub: userId.toString(),
      jti: tokenId,
      familyId: resolvedFamilyId
    };

    const token = jwt.sign(payload, this.getRefreshSecret(), {
      expiresIn: `${expiresDays}d`
    });

    const tokenHash = this.hashToken(token);

    await RefreshToken.create({
      userId: new mongoose.Types.ObjectId(userId),
      tokenHash,
      familyId: resolvedFamilyId,
      expiresAt
    });

    return { token, expiresAt, familyId: resolvedFamilyId };
  }

  /**
   * Rotates a refresh token: verifies signature, checks DB, detects reuse,
   * revokes previous token, and issues a new pair.
   */
  public static async rotateRefreshToken(
    rawToken: string
  ): Promise<{
    accessToken: string;
    newRefreshToken: string;
    userId: string;
  }> {
    let payload: RefreshTokenPayload;
    try {
      payload = jwt.verify(rawToken, this.getRefreshSecret()) as RefreshTokenPayload;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new TokenError('Refresh token has expired', 'REFRESH_TOKEN_EXPIRED');
      }
      throw new TokenError('Invalid refresh token signature', 'REFRESH_TOKEN_INVALID');
    }

    const tokenHash = this.hashToken(rawToken);
    const existingDoc = await RefreshToken.findOne({ tokenHash });

    if (!existingDoc) {
      throw new TokenError('Refresh token not found or already consumed', 'REFRESH_TOKEN_NOT_FOUND');
    }

    // Reuse detection: If token was already revoked/rotated, an attacker or compromised client is reusing it!
    if (existingDoc.revokedAt) {
      // Invalidate the ENTIRE family to prevent unauthorized session continuation
      console.warn(`[Security Alert] Refresh token reuse detected! Invalidating family: ${existingDoc.familyId}`);
      await RefreshToken.updateMany(
        { familyId: existingDoc.familyId },
        { revokedAt: new Date() }
      );
      throw new TokenError(
        'Refresh token reuse detected. All sessions in this family have been terminated.',
        'TOKEN_REUSE_DETECTED'
      );
    }

    // Check expiration
    if (existingDoc.expiresAt < new Date()) {
      throw new TokenError('Refresh token has expired', 'REFRESH_TOKEN_EXPIRED');
    }

    // Create rotated refresh token in the same family
    const nextToken = await this.createRefreshToken(payload.sub, existingDoc.familyId);
    const nextTokenHash = this.hashToken(nextToken.token);

    // Mark current token as revoked and replaced
    existingDoc.revokedAt = new Date();
    existingDoc.replacedByTokenHash = nextTokenHash;
    await existingDoc.save();

    return {
      accessToken: '', // To be filled by caller using fresh user data
      newRefreshToken: nextToken.token,
      userId: payload.sub
    };
  }

  /**
   * Revokes a specific refresh token (used on logout).
   */
  public static async revokeRefreshToken(rawToken: string): Promise<void> {
    try {
      const tokenHash = this.hashToken(rawToken);
      await RefreshToken.updateOne({ tokenHash }, { revokedAt: new Date() });
    } catch (err: any) {
      console.warn(`[TokenService] Warning revoking token: ${err.message}`);
    }
  }

  /**
   * Revokes all refresh tokens for a user (e.g., password reset or admin force logout).
   */
  public static async revokeAllUserTokens(userId: string | mongoose.Types.ObjectId): Promise<void> {
    await RefreshToken.updateMany(
      { userId: new mongoose.Types.ObjectId(userId) },
      { revokedAt: new Date() }
    );
  }
}

