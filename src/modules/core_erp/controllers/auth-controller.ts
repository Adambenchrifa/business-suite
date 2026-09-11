import { Request, Response, NextFunction } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import { tenants, users, sessions } from '../infrastructure/db-schemas';
import { PasswordHasher, JwtProvider } from '../domain/user';
import { publicDb, getTenantDrizzleClient } from '../../../config/database';
import { ConflictError, ValidationError, UnauthorizedError, NotFoundError } from '../../../shared/utils/errors';
import { Logger } from '../../../shared/utils/logger';
import { env } from '../../../config/env';
import { EmailService } from '../../../shared/services/email-service';

const logger = new Logger('AuthController');

const getCookieOptions = (isRefresh = false) => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: isRefresh ? '/api/v1/auth/refresh' : '/',
  maxAge: isRefresh ? 7 * 24 * 3600 * 1000 : 15 * 60 * 1000,
});

// Validation schemas using Zod
const registerSchema = z.object({
  companyName: z.string().min(2).max(100),
  domain: z.string().min(3).max(32).regex(/^[a-z0-9\-]+$/, {
    message: 'Domain must contain only lowercase letters, numbers, and hyphens',
  }),
  ownerName: z.string().min(2).max(100),
  ownerEmail: z.string().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8).max(128),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export class AuthController {
  /**
   * Provision a brand new tenant workspace and owner user account.
   * Runs the DDL table-definitions to build the new tenant database schema.
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = registerSchema.safeParse(req.body);
      if (!parsedBody.success) {
        next(new ValidationError('Registration payload validation failed', parsedBody.error.format()));
        return;
      }

      const { companyName, domain, ownerName, ownerEmail, password } = parsedBody.data;
      const sanitizedDomain = domain.toLowerCase();

      // 1. Check if domain is already registered in our global registry
      const existingTenant = await publicDb
        .select()
        .from(tenants)
        .where(eq(tenants.domain, sanitizedDomain))
        .limit(1);

      if (existingTenant.length > 0) {
        next(new ConflictError(`The workspace URL [${sanitizedDomain}.apps.com] is already taken`));
        return;
      }

      const schemaName = `tenant_${sanitizedDomain.replace(/-/g, '_')}`;
      logger.info(`Provisioning workspace [${sanitizedDomain}] inside PostgreSQL schema [${schemaName}]`);

      // 2. Perform Dynamic Schema & Database Provisioning
      // Run raw PostgreSQL DDL instructions to isolate this tenant physically
      await publicDb.execute(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      
      // Build tenant-specific users table
      await publicDb.execute(`
        CREATE TABLE IF NOT EXISTS "${schemaName}"."users" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "email" varchar(256) NOT NULL UNIQUE,
          "password_hash" text NOT NULL,
          "name" varchar(256) NOT NULL,
          "role" varchar(64) NOT NULL DEFAULT 'member',
          "status" varchar(32) NOT NULL DEFAULT 'active',
          "is_verified" boolean NOT NULL DEFAULT false,
          "verification_token" varchar(256),
          "reset_token" varchar(256),
          "reset_token_expires_at" timestamp,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        );
      `);

      // Build tenant-specific session table
      await publicDb.execute(`
        CREATE TABLE IF NOT EXISTS "${schemaName}"."sessions" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "user_id" uuid NOT NULL REFERENCES "${schemaName}"."users"("id") ON DELETE CASCADE,
          "token" varchar(512) NOT NULL UNIQUE,
          "expires_at" timestamp NOT NULL,
          "created_at" timestamp NOT NULL DEFAULT now()
        );
      `);

      // 3. Register the tenant workspace metadata in global tenants table
      const [newTenant] = await publicDb
        .insert(tenants)
        .values({
          name: companyName,
          domain: sanitizedDomain,
          schema: schemaName,
          status: 'active',
        })
        .returning();

      // 4. Hash the corporate owner password using scrypt
      const passwordHash = await PasswordHasher.hash(password);

      // Generate verification token for email verification requirement
      const verificationToken = crypto.randomBytes(32).toString('hex');

      // 5. Seed the default company administrator account in the isolated schema context
      // Note: We seed them as unverified so they can test the email verification endpoint if they choose,
      // or we can seed them as verified if we want instant onboarding. Let's seed as unverified (is_verified = false)
      // but let's return the token clearly so it can be verified with a single click or API call.
      await publicDb.execute(sql`
        INSERT INTO ${sql.raw(`"${schemaName}"."users"`)} (email, password_hash, name, role, is_verified, verification_token)
        VALUES (${ownerEmail.toLowerCase()}, ${passwordHash}, ${ownerName}, ${'owner'}, ${false}, ${verificationToken})
      `);

      const ownerResult = await publicDb.execute(sql`
        SELECT id, email, name, role, is_verified, verification_token FROM ${sql.raw(`"${schemaName}"."users"`)} WHERE email = ${ownerEmail.toLowerCase()} LIMIT 1
      `);
      const createdOwner = (ownerResult.rows as any[])[0];

      // 6. Generate authenticated access token and refresh token
      const accessToken = JwtProvider.signAccessToken({
        id: createdOwner.id,
        email: createdOwner.email,
        role: createdOwner.role,
        tenantId: newTenant.id,
      });

      const refreshToken = JwtProvider.signRefreshToken({
        id: createdOwner.id,
        email: createdOwner.email,
        role: createdOwner.role,
        tenantId: newTenant.id,
      });

      // 7. Save refresh token inside the newly created sessions table
      const tenantDbInfo = await getTenantDrizzleClient(schemaName);
      await tenantDbInfo.db.insert(sessions).values({
        userId: createdOwner.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000), // 7 days
      });
      tenantDbInfo.release();

      // Set cookie headers for secure sessions
      res.cookie('accessToken', accessToken, getCookieOptions(false));
      res.cookie('refreshToken', refreshToken, getCookieOptions(true));

      logger.info(`Successfully provisioned tenant workspace [${companyName}] with admin user [${ownerEmail}]`);

      res.status(201).json({
        success: true,
        message: 'Tenant workspace successfully provisioned and configured. Email verification token dispatched.',
        data: {
          tenant: {
            id: newTenant.id,
            name: newTenant.name,
            domain: newTenant.domain,
          },
          user: {
            id: createdOwner.id,
            email: createdOwner.email,
            name: createdOwner.name,
            role: createdOwner.role,
            isVerified: createdOwner.is_verified,
            verificationToken: createdOwner.verification_token,
          },
          token: accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      logger.error('Workspace provisioning failed unexpectedly', error);
      next(error);
    }
  }

  /**
   * Log in credentials inside the current workspace tenant domain.
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = loginSchema.safeParse(req.body);
      if (!parsedBody.success) {
        next(new ValidationError('Login validation failed', parsedBody.error.format()));
        return;
      }

      const { email, password } = parsedBody.data;

      // Ensure req.db has been correctly configured by tenant resolver
      if (!req.db || !req.tenantId) {
        next(new ValidationError('Workspace resolver mismatch. Please verify tenant subdomain headers'));
        return;
      }

      // Query database bound to the active schema context
      const tenantUsers = await req.db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      const activeUser = tenantUsers[0];

      if (!activeUser || activeUser.status === 'suspended') {
        next(new UnauthorizedError('Invalid email credentials or account is suspended'));
        return;
      }

      // Enforce email verification check for secure production access
      if (!activeUser.isVerified) {
        next(new UnauthorizedError('Please verify your email address before logging in.'));
        return;
      }

      // Cryptographically timing-safe password verification
      const isCorrectPassword = await PasswordHasher.verify(password, activeUser.passwordHash);
      if (!isCorrectPassword) {
        next(new UnauthorizedError('Invalid email credentials or account is suspended'));
        return;
      }

      // Generate short-lived access token and long-lived refresh token
      const accessToken = JwtProvider.signAccessToken({
        id: activeUser.id,
        email: activeUser.email,
        role: activeUser.role,
        tenantId: req.tenantId,
      });

      const refreshToken = JwtProvider.signRefreshToken({
        id: activeUser.id,
        email: activeUser.email,
        role: activeUser.role,
        tenantId: req.tenantId,
      });

      // Save refresh token in tenant sessions table
      await req.db.insert(sessions).values({
        userId: activeUser.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000), // 7 days
      });

      // Set cookie headers for secure environments
      res.cookie('accessToken', accessToken, getCookieOptions(false));
      res.cookie('refreshToken', refreshToken, getCookieOptions(true));

      logger.info(`User [${email}] successfully authenticated on tenant workspace [${req.tenantDomain}]`);

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: activeUser.id,
            email: activeUser.email,
            name: activeUser.name,
            role: activeUser.role,
            isVerified: activeUser.isVerified,
          },
          token: accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      logger.error('Login action encountered an issue', error);
      next(error);
    }
  }

  /**
   * Fetch details of currently authenticated user session.
   */
  static async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !req.db) {
        next(new UnauthorizedError('Unauthenticated request context'));
        return;
      }

      const tenantUsers = await req.db
        .select()
        .from(users)
        .where(eq(users.id, req.user.id))
        .limit(1);

      const activeUser = tenantUsers[0];

      if (!activeUser) {
        next(new UnauthorizedError('Active session user not found'));
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: activeUser.id,
            email: activeUser.email,
            name: activeUser.name,
            role: activeUser.role,
            isVerified: activeUser.isVerified,
          },
          workspace: {
            id: req.tenantId,
            domain: req.tenantDomain,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Log out of current session, revoking and removing the active refresh token.
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.db) {
        next(new ValidationError('Workspace resolver mismatch. Please verify tenant subdomain headers'));
        return;
      }

      let tokenToDelete = req.body.refreshToken;
      if (!tokenToDelete && req.cookies && req.cookies.refreshToken) {
        tokenToDelete = req.cookies.refreshToken;
      }

      if (tokenToDelete) {
        // Delete refresh token from DB
        await req.db
          .delete(sessions)
          .where(eq(sessions.token, tokenToDelete));
      }

      // Clear cookies
      res.clearCookie('accessToken', { path: '/' });
      res.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' });

      res.status(200).json({
        success: true,
        message: 'Successfully logged out and session revoked',
      });
    } catch (error) {
      logger.error('Logout failed', error);
      next(error);
    }
  }

  /**
   * Refresh access token using secure Refresh Token Rotation (RTR).
   */
  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.db || !req.tenantId) {
        next(new ValidationError('Workspace resolver mismatch. Please verify tenant subdomain headers'));
        return;
      }

      let refreshToken = req.body.refreshToken;
      if (!refreshToken && req.cookies && req.cookies.refreshToken) {
        refreshToken = req.cookies.refreshToken;
      }

      if (!refreshToken) {
        next(new ValidationError('Refresh token is required'));
        return;
      }

      // 1. Verify token signature and claims
      let decoded;
      try {
        decoded = JwtProvider.verifyRefreshToken(refreshToken);
      } catch (err) {
        next(new UnauthorizedError('Invalid or expired refresh token. Please sign in again.'));
        return;
      }

      // 2. Check if this refresh token exists in DB
      const activeSessions = await req.db
        .select()
        .from(sessions)
        .where(eq(sessions.token, refreshToken))
        .limit(1);

      const sessionRecord = activeSessions[0];

      if (!sessionRecord) {
        // REUSE DETECTION / BREACH MITIGATION:
        // If a refresh token is valid but doesn't exist in the DB, it has either been revoked,
        // or has already been used. This suggests potential token theft.
        // As a strict security measure, we invalidate all active sessions for this user.
        await req.db
          .delete(sessions)
          .where(eq(sessions.userId, decoded.id));

        res.clearCookie('accessToken', { path: '/' });
        res.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' });

        next(new UnauthorizedError('Session compromise detected. Invalidation triggered. Please log in again.'));
        return;
      }

      // 3. Check token expiration
      if (new Date() > new Date(sessionRecord.expiresAt)) {
        await req.db
          .delete(sessions)
          .where(eq(sessions.token, refreshToken));

        next(new UnauthorizedError('Refresh token has expired. Please sign in again.'));
        return;
      }

      // 4. Generate NEW Access Token and NEW Refresh Token (Rotation)
      const newAccessToken = JwtProvider.signAccessToken({
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        tenantId: req.tenantId,
      });

      const newRefreshToken = JwtProvider.signRefreshToken({
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        tenantId: req.tenantId,
      });

      // 5. Atomic DB Swap (Delete old session and insert new session within transaction)
      const performRotation = async (tx: any) => {
        await tx
          .delete(sessions)
          .where(eq(sessions.token, refreshToken));

        await tx.insert(sessions).values({
          userId: decoded.id,
          token: newRefreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000), // 7 days
        });
      };

      if (typeof req.db.transaction === 'function') {
        await req.db.transaction(performRotation);
      } else {
        await performRotation(req.db);
      }

      // Update cookies
      res.cookie('accessToken', newAccessToken, getCookieOptions(false));
      res.cookie('refreshToken', newRefreshToken, getCookieOptions(true));

      res.status(200).json({
        success: true,
        data: {
          token: newAccessToken,
          refreshToken: newRefreshToken,
        },
      });
    } catch (error) {
      logger.error('Token refresh rotation failed', error);
      next(error);
    }
  }

  /**
   * Initiate password reset process by generating reset token and dispatching verification payload.
   */
  static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = forgotPasswordSchema.safeParse(req.body);
      if (!parsedBody.success) {
        next(new ValidationError('Invalid email parameter', parsedBody.error.format()));
        return;
      }

      if (!req.db) {
        next(new ValidationError('Workspace resolver mismatch. Please verify tenant subdomain headers'));
        return;
      }

      const { email } = parsedBody.data;

      const tenantUsers = await req.db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      const activeUser = tenantUsers[0];

      if (!activeUser) {
        // Security best practice: Do not leak account existence. Return success.
        res.status(200).json({
          success: true,
          message: 'If the email is registered, a password reset link has been dispatched.',
        });
        return;
      }

      // Generate cryptographically secure token
      const rawResetToken = crypto.randomBytes(32).toString('hex');
      const hashedResetToken = crypto.createHash('sha256').update(rawResetToken).digest('hex');
      const resetTokenExpiresAt = new Date(Date.now() + 1 * 3600 * 1000); // 1 hour lifetime

      // Save hashed token representation to DB
      await req.db
        .update(users)
        .set({
          resetToken: hashedResetToken,
          resetTokenExpiresAt,
        })
        .where(eq(users.id, activeUser.id));

      // Dispatch token via EmailService abstraction
      await EmailService.sendPasswordResetEmail({
        to: email,
        resetToken: rawResetToken,
        domain: req.tenantDomain || 'default',
      });

      logger.info(`Dispatched password reset token to User [${email}] on domain [${req.tenantDomain}]`);

      res.status(200).json({
        success: true,
        message: 'If the email is registered, a password reset link has been dispatched.',
        // Reset token is NEVER exposed in production response payloads
        ...(env.NODE_ENV !== 'production' ? { data: { resetToken: rawResetToken } } : {}),
      });
    } catch (error) {
      logger.error('Forgot password handler failed', error);
      next(error);
    }
  }

  /**
   * Complete password reset process using validated token context.
   */
  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = resetPasswordSchema.safeParse(req.body);
      if (!parsedBody.success) {
        next(new ValidationError('Password reset validation failed', parsedBody.error.format()));
        return;
      }

      if (!req.db) {
        next(new ValidationError('Workspace resolver mismatch. Please verify tenant subdomain headers'));
        return;
      }

      const { token, newPassword } = parsedBody.data;

      // Compute SHA-256 hash of provided token to compare against stored token hash
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      // Find user with active token hash (or fallback raw token)
      let matchedUsers = await req.db
        .select()
        .from(users)
        .where(eq(users.resetToken, hashedToken))
        .limit(1);

      if (matchedUsers.length === 0) {
        matchedUsers = await req.db
          .select()
          .from(users)
          .where(eq(users.resetToken, token))
          .limit(1);
      }

      const activeUser = matchedUsers[0];

      if (!activeUser || !activeUser.resetTokenExpiresAt || new Date() > new Date(activeUser.resetTokenExpiresAt)) {
        next(new ValidationError('Invalid or expired password reset token'));
        return;
      }

      // Hash new password and update user record
      const passwordHash = await PasswordHasher.hash(newPassword);

      await req.db
        .update(users)
        .set({
          passwordHash,
          resetToken: null,
          resetTokenExpiresAt: null,
        })
        .where(eq(users.id, activeUser.id));

      // Force-revoke all active sessions to secure user identity after credential change
      await req.db
        .delete(sessions)
        .where(eq(sessions.userId, activeUser.id));

      logger.info(`Successfully reset password and revoked all active sessions for User [${activeUser.email}]`);

      res.status(200).json({
        success: true,
        message: 'Your password has been successfully reset. All active sessions have been securely terminated.',
      });
    } catch (error) {
      logger.error('Password reset handler failed', error);
      next(error);
    }
  }

  /**
   * Complete email verification process.
   */
  static async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = verifyEmailSchema.safeParse(req.body);
      if (!parsedBody.success) {
        next(new ValidationError('Email verification validation failed', parsedBody.error.format()));
        return;
      }

      if (!req.db) {
        next(new ValidationError('Workspace resolver mismatch. Please verify tenant subdomain headers'));
        return;
      }

      const { token } = parsedBody.data;

      const matchedUsers = await req.db
        .select()
        .from(users)
        .where(eq(users.verificationToken, token))
        .limit(1);

      const activeUser = matchedUsers[0];

      if (!activeUser) {
        next(new ValidationError('Invalid or expired verification token'));
        return;
      }

      // Mark user as verified
      await req.db
        .update(users)
        .set({
          isVerified: true,
          verificationToken: null,
        })
        .where(eq(users.id, activeUser.id));

      logger.info(`User [${activeUser.email}] successfully verified their email address`);

      res.status(200).json({
        success: true,
        message: 'Your email address has been successfully verified. You may now log in.',
      });
    } catch (error) {
      logger.error('Email verification handler failed', error);
      next(error);
    }
  }
}
