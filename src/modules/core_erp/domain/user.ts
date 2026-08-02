import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../../config/env';

export interface UserEntity {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Native Node scrypt-based password hashing (Zero binary compilation dependencies, 100% stable)
 */
export class PasswordHasher {
  private static readonly SALT_LENGTH = 16;
  private static readonly KEY_LENGTH = 64;

  /**
   * Hashes a password with scrypt and a cryptographically secure random salt.
   */
  static async hash(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(this.SALT_LENGTH).toString('hex');
      crypto.scrypt(password, salt, this.KEY_LENGTH, (err, derivedKey) => {
        if (err) reject(err);
        resolve(`${salt}:${derivedKey.toString('hex')}`);
      });
    });
  }

  /**
   * Verifies a password hash.
   */
  static async verify(password: string, storedHash: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const [salt, key] = storedHash.split(':');
      if (!salt || !key) {
        resolve(false);
        return;
      }
      crypto.scrypt(password, salt, this.KEY_LENGTH, (err, derivedKey) => {
        if (err) reject(err);
        resolve(crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey));
      });
    });
  }
}

/**
 * JWT authentication utility helper
 */
export class JwtProvider {
  /**
   * Generates a signed access token for a user session (short-lived, e.g. 15 minutes).
   */
  static signAccessToken(payload: { id: string; email: string; role: string; tenantId: string }): string {
    return jwt.sign({ ...payload, jti: crypto.randomUUID() }, env.JWT_SECRET, {
      expiresIn: '15m', // Fast expiration for improved security
    });
  }

  /**
   * Verifies an access token signature and parses the claims.
   */
  static verifyAccessToken(token: string): { id: string; email: string; role: string; tenantId: string } {
    return jwt.verify(token, env.JWT_SECRET) as { id: string; email: string; role: string; tenantId: string };
  }

  /**
   * Generates a signed refresh token for persistent sessions (long-lived, e.g. 7 days).
   */
  static signRefreshToken(payload: { id: string; email: string; role: string; tenantId: string }): string {
    return jwt.sign({ ...payload, jti: crypto.randomUUID() }, env.JWT_SECRET, {
      expiresIn: '7d', // Generous session life rotated securely
    });
  }

  /**
   * Verifies a refresh token signature and parses the claims.
   */
  static verifyRefreshToken(token: string): { id: string; email: string; role: string; tenantId: string } {
    return jwt.verify(token, env.JWT_SECRET) as { id: string; email: string; role: string; tenantId: string };
  }
}
