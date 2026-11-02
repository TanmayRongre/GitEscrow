import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export class PasswordService {
  /**
   * Hashes a plaintext password using bcrypt with 12 salt rounds.
   */
  public static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Compares a candidate plaintext password with a bcrypt hash.
   */
  public static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

