import { User, IUser, UserRole } from '../models/User';
import { PasswordService } from './password.service';
import { TokenService, TokenError } from './token.service';

export class AuthError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
  }
}

export class AuthService {
  /**
   * Registers a new user. Role is strictly assigned as USER (preventing role escalation).
   */
  public static async register(data: {
    name: string;
    username: string;
    email: string;
    password: string;
  }): Promise<{ user: IUser; accessToken: string; refreshToken: string }> {
    const normalizedEmail = data.email.toLowerCase().trim();
    const normalizedUsername = data.username.toLowerCase().trim();

    // Check duplicate email
    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      throw new AuthError('An account with this email address already exists', 409, 'EMAIL_EXISTS');
    }

    // Check duplicate username
    const existingUsername = await User.findOne({ username: normalizedUsername });
    if (existingUsername) {
      throw new AuthError('Username is already taken', 409, 'USERNAME_TAKEN');
    }

    // Hash password with bcrypt work factor 12
    const passwordHash = await PasswordService.hashPassword(data.password);

    // Enforce role: USER
    const user = await User.create({
      name: data.name.trim(),
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      role: 'USER',
      accountStatus: 'ACTIVE',
      emailVerified: false
    });

    const accessToken = TokenService.generateAccessToken({
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role
    });

    const { token: refreshToken } = await TokenService.createRefreshToken(user._id);

    return { user, accessToken, refreshToken };
  }

  /**
   * Authenticates user credentials and issues tokens. Uses generic errors to prevent user enumeration.
   */
  public static async login(
    email: string,
    password: string
  ): Promise<{ user: IUser; accessToken: string; refreshToken: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    // Fetch user including the hidden passwordHash
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    if (!user) {
      throw new AuthError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (user.accountStatus === 'SUSPENDED') {
      throw new AuthError(
        'Your account has been suspended. Please contact platform administrators.',
        403,
        'ACCOUNT_SUSPENDED'
      );
    }

    if (user.accountStatus === 'DELETED') {
      throw new AuthError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await PasswordService.verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      throw new AuthError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Update lastLoginAt
    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = TokenService.generateAccessToken({
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role
    });

    const { token: refreshToken } = await TokenService.createRefreshToken(user._id);

    return { user, accessToken, refreshToken };
  }

  /**
   * Refreshes access token and rotates refresh token.
   */
  public static async refresh(
    rawRefreshToken: string
  ): Promise<{ user: IUser; accessToken: string; newRefreshToken: string }> {
    try {
      const rotation = await TokenService.rotateRefreshToken(rawRefreshToken);
      const user = await User.findById(rotation.userId);

      if (!user) {
        throw new AuthError('User account associated with token no longer exists', 404, 'USER_NOT_FOUND');
      }

      if (user.accountStatus === 'SUSPENDED') {
        throw new AuthError('Account is suspended', 403, 'ACCOUNT_SUSPENDED');
      }

      const accessToken = TokenService.generateAccessToken({
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role
      });

      return {
        user,
        accessToken,
        newRefreshToken: rotation.newRefreshToken
      };
    } catch (err: any) {
      if (err instanceof TokenError) {
        throw new AuthError(err.message, 401, err.code);
      }
      throw err;
    }
  }

  /**
   * Revokes refresh token on user logout.
   */
  public static async logout(rawRefreshToken?: string): Promise<void> {
    if (rawRefreshToken) {
      await TokenService.revokeRefreshToken(rawRefreshToken);
    }
  }

  /**
   * Retrieves safe profile for currently authenticated user.
   */
  public static async getCurrentUser(userId: string): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AuthError('User not found', 404, 'USER_NOT_FOUND');
    }
    return user;
  }

  /**
   * One-time secure administrator bootstrap mechanism.
   * Requires ADMIN_SETUP_SECRET and strictly verifies that NO admin exists yet.
   */
  public static async bootstrapAdmin(data: {
    setupSecret: string;
    name: string;
    username: string;
    email: string;
    password: string;
  }): Promise<{ user: IUser; accessToken: string; refreshToken: string }> {
    const configuredSecret = process.env.ADMIN_SETUP_SECRET?.trim();
    if (!configuredSecret || data.setupSecret.trim() !== configuredSecret) {
      throw new AuthError('Invalid administrator setup secret', 403, 'INVALID_SETUP_SECRET');
    }

    // Only allowed if zero administrators currently exist
    const adminCount = await User.countDocuments({ role: 'ADMIN' });
    if (adminCount > 0) {
      throw new AuthError(
        'Administrator account already exists. Bootstrap mechanism is permanently locked.',
        409,
        'ADMIN_ALREADY_EXISTS'
      );
    }

    const normalizedEmail = data.email.toLowerCase().trim();
    const normalizedUsername = data.username.toLowerCase().trim();

    // Check duplicate
    const existing = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
    });
    if (existing) {
      throw new AuthError('Email or username is already taken', 409, 'USER_EXISTS');
    }

    const passwordHash = await PasswordService.hashPassword(data.password);

    const user = await User.create({
      name: data.name.trim(),
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      emailVerified: true
    });

    const accessToken = TokenService.generateAccessToken({
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role
    });

    const { token: refreshToken } = await TokenService.createRefreshToken(user._id);

    console.log(`[Security Audit] Initial administrator @${user.username} bootstrapped successfully.`);
    return { user, accessToken, refreshToken };
  }
}

