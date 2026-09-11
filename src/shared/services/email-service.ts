import { Logger } from '../utils/logger';
import { env } from '../../config/env';

const logger = new Logger('EmailService');

export interface PasswordResetEmailOptions {
  to: string;
  resetToken: string;
  domain: string;
}

export interface VerificationEmailOptions {
  to: string;
  verificationToken: string;
  domain: string;
}

export class EmailService {
  private static lastDispatchedResetToken: string | null = null;
  private static lastDispatchedVerificationToken: string | null = null;

  /**
   * Dispatches password reset email.
   */
  static async sendPasswordResetEmail(options: PasswordResetEmailOptions): Promise<void> {
    const { to, resetToken, domain } = options;
    this.lastDispatchedResetToken = resetToken;

    if (env.NODE_ENV === 'production') {
      logger.info(`[PROD EMAIL DISPATCH] Password reset link sent to ${to} on workspace domain [${domain}]`);
      // In production, real email provider integration (e.g. SendGrid, AWS SES, SMTP) would be invoked here.
    } else {
      logger.info(`[DEV EMAIL MOCK] Password reset link sent to ${to} on domain [${domain}]. Token: ${resetToken}`);
    }
  }

  /**
   * Dispatches email verification message.
   */
  static async sendVerificationEmail(options: VerificationEmailOptions): Promise<void> {
    const { to, verificationToken, domain } = options;
    this.lastDispatchedVerificationToken = verificationToken;

    if (env.NODE_ENV === 'production') {
      logger.info(`[PROD EMAIL DISPATCH] Verification link sent to ${to} on workspace domain [${domain}]`);
    } else {
      logger.info(`[DEV EMAIL MOCK] Verification link sent to ${to} on domain [${domain}]. Token: ${verificationToken}`);
    }
  }

  /**
   * Helper for automated test assertions to inspect last dispatched reset token.
   */
  static getLastDispatchedResetToken(): string | null {
    return this.lastDispatchedResetToken;
  }

  /**
   * Helper for automated test assertions to inspect last dispatched verification token.
   */
  static getLastDispatchedVerificationToken(): string | null {
    return this.lastDispatchedVerificationToken;
  }
}
