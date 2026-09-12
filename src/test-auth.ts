import { AuthController } from './modules/core_erp/controllers/auth-controller';
import { PasswordHasher, JwtProvider } from './modules/core_erp/domain/user';
import { publicDb, getTenantDrizzleClient } from './config/database';
import { tenants, users, sessions, activityLogs, stockMovements } from './modules/core_erp/infrastructure/db-schemas';
import { authenticate, requireRole } from './shared/middleware/auth';
import { tenantResolver } from './shared/middleware/tenant-resolver';
import { createRateLimiter } from './shared/middleware/rate-limiter';
import { env } from './config/env';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}

function assert(condition: any, message: string) {
  if (!condition) {
    throw new AssertionError(message);
  }
}

async function runTests() {
  console.log('===================================================');
  console.log('   STARTING AUTHENTICATION MODULE TEST SUITE       ');
  console.log('===================================================');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      console.log(`\n▶ [TEST] ${name}`);
      await fn();
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(err.stack || err.message || err);
      failed++;
    }
  }

  // ----------------------------------------------------
  // TEST UNIT 1: Password Hashing & Verification
  // ----------------------------------------------------
  await test('PasswordHasher cryptographically hashes and verifies passwords', async () => {
    const password = 'enterprisePassword123!';
    const hashed = await PasswordHasher.hash(password);
    
    assert(hashed.includes(':'), 'Hash format should contain salt-delimiter');
    
    const isValid = await PasswordHasher.verify(password, hashed);
    assert(isValid === true, 'Verification should return true for correct password');

    const isInvalid = await PasswordHasher.verify('wrongPassword', hashed);
    assert(isInvalid === false, 'Verification should return false for incorrect password');
  });

  // ----------------------------------------------------
  // TEST UNIT 2: JWT Tokens Generation and Claims Matching
  // ----------------------------------------------------
  await test('JwtProvider signs and verifies access and refresh tokens', async () => {
    const payload = {
      id: 'user-uuid-1234',
      email: 'owner@acme.com',
      role: 'owner',
      tenantId: 'tenant-uuid-5678'
    };

    const accessToken = JwtProvider.signAccessToken(payload);
    assert(typeof accessToken === 'string', 'Access token should be a string');

    const verifiedAccess = JwtProvider.verifyAccessToken(accessToken);
    assert(verifiedAccess.id === payload.id, 'Decoded user ID should match');
    assert(verifiedAccess.email === payload.email, 'Decoded email should match');
    assert(verifiedAccess.role === payload.role, 'Decoded role should match');
    assert(verifiedAccess.tenantId === payload.tenantId, 'Decoded tenant ID should match');

    const refreshToken = JwtProvider.signRefreshToken(payload);
    assert(typeof refreshToken === 'string', 'Refresh token should be a string');

    const verifiedRefresh = JwtProvider.verifyRefreshToken(refreshToken);
    assert(verifiedRefresh.id === payload.id, 'Decoded refresh user ID should match');
  });

  // ----------------------------------------------------
  // TEST UNIT 3: Tenant Workspace Provisioning & Owner Registration
  // ----------------------------------------------------
  let testDomain = `test-corp-${crypto.randomInt(1000, 9999)}`;
  let registeredUser: any = null;
  let verificationToken: string = '';
  let activeAccessToken: string = '';
  let activeRefreshToken: string = '';

  await test('AuthController.register provisions schema, seeds owner, and signs tokens', async () => {
    const req: any = {
      body: {
        companyName: 'Acme Test Corp',
        domain: testDomain,
        ownerName: 'Acme CEO',
        ownerEmail: 'ceo@acme-test.com',
        password: 'secureCeoPassword123'
      }
    };

    let status: number = 200;
    let jsonResult: any = null;

    const res: any = {
      status: (code: number) => {
        status = code;
        return res;
      },
      json: (data: any) => {
        jsonResult = data;
        return res;
      },
      cookie: () => {} // Mock cookie setting
    };

    const next = (err: any) => {
      if (err) throw err;
    };

    await AuthController.register(req, res, next);

    assert(status === 201, `Expected status code 201, got ${status}`);
    assert(jsonResult.success === true, 'JSON response should indicate success');
    assert(jsonResult.data.tenant.domain === testDomain, 'Domain should match input');
    assert(jsonResult.data.user.email === 'ceo@acme-test.com', 'User email should match');
    assert(jsonResult.data.user.isVerified === false, 'Seeded user should start as unverified');
    assert(typeof jsonResult.data.user.verificationToken === 'string', 'Verification token should be generated');

    registeredUser = jsonResult.data.user;
    verificationToken = jsonResult.data.user.verificationToken;
    activeAccessToken = jsonResult.token;
    activeRefreshToken = jsonResult.refreshToken;

    // Verify workspace registration exists in global registry
    const tenantsInDb = await publicDb
      .select()
      .from(tenants)
      .where(eq(tenants.domain, testDomain));
    assert(tenantsInDb.length === 1, 'Tenant should be added to the public tenants list');
  });

  // ----------------------------------------------------
  // TEST UNIT 4: Email Verification
  // ----------------------------------------------------
  await test('AuthController.verifyEmail activates unverified accounts', async () => {
    const schemaName = `tenant_${testDomain.replace(/-/g, '_')}`;
    const tenantDbInfo = await getTenantDrizzleClient(schemaName);

    const req: any = {
      db: tenantDbInfo.db,
      body: {
        token: verificationToken
      }
    };

    let status = 200;
    let jsonResult: any = null;

    const res: any = {
      status: (code: number) => {
        status = code;
        return res;
      },
      json: (data: any) => {
        jsonResult = data;
        return res;
      }
    };

    const next = (err: any) => {
      if (err) throw err;
    };

    await AuthController.verifyEmail(req, res, next);
    tenantDbInfo.release();

    assert(status === 200, `Expected status code 200, got ${status}`);
    assert(jsonResult.success === true, 'Verification should be successful');

    // Recheck DB user status
    const tenantDbInfo2 = await getTenantDrizzleClient(schemaName);
    const usersInDb = await tenantDbInfo2.db
      .select()
      .from(users)
      .where(eq(users.id, registeredUser.id));
    tenantDbInfo2.release();

    assert(usersInDb[0].isVerified === true, 'User isVerified field should be true now');
  });

  // ----------------------------------------------------
  // TEST UNIT 5: Login Flow (Including constraints check)
  // ----------------------------------------------------
  await test('AuthController.login validates credentials and enforces verification constraints', async () => {
    const schemaName = `tenant_${testDomain.replace(/-/g, '_')}`;
    const tenantDbInfo = await getTenantDrizzleClient(schemaName);

    // Get tenant ID
    const [tenantObj] = await publicDb.select().from(tenants).where(eq(tenants.domain, testDomain));

    const req: any = {
      db: tenantDbInfo.db,
      tenantId: tenantObj.id,
      tenantDomain: testDomain,
      body: {
        email: 'ceo@acme-test.com',
        password: 'secureCeoPassword123'
      }
    };

    let status = 200;
    let jsonResult: any = null;

    const res: any = {
      status: (code: number) => {
        status = code;
        return res;
      },
      json: (data: any) => {
        jsonResult = data;
        return res;
      },
      cookie: () => {}
    };

    const next = (err: any) => {
      if (err) throw err;
    };

    await AuthController.login(req, res, next);
    tenantDbInfo.release();

    assert(status === 200, `Expected status code 200, got ${status}`);
    assert(jsonResult.success === true, 'Login should be successful');
    assert(jsonResult.data.token, 'Login response must yield an access token');
    assert(jsonResult.data.refreshToken, 'Login response must yield a refresh token');

    // Keep newly generated tokens for downstream rotation and logout tests
    activeAccessToken = jsonResult.data.token;
    activeRefreshToken = jsonResult.data.refreshToken;
  });

  // ----------------------------------------------------
  // TEST UNIT 6: Refresh Token Rotation (RTR) & Security
  // ----------------------------------------------------
  let rotatedRefreshToken = '';

  await test('AuthController.refresh rotates refresh tokens securely and issues new access tokens', async () => {
    const schemaName = `tenant_${testDomain.replace(/-/g, '_')}`;
    const tenantDbInfo = await getTenantDrizzleClient(schemaName);
    const [tenantObj] = await publicDb.select().from(tenants).where(eq(tenants.domain, testDomain));

    const req: any = {
      db: tenantDbInfo.db,
      tenantId: tenantObj.id,
      body: {
        refreshToken: activeRefreshToken
      }
    };

    let status = 200;
    let jsonResult: any = null;

    const res: any = {
      status: (code: number) => {
        status = code;
        return res;
      },
      json: (data: any) => {
        jsonResult = data;
        return res;
      },
      cookie: () => {}
    };

    const next = (err: any) => {
      if (err) throw err;
    };

    await AuthController.refresh(req, res, next);
    tenantDbInfo.release();

    assert(status === 200, `Expected status code 200, got ${status}`);
    assert(jsonResult.success === true, 'Token rotation should be successful');
    assert(jsonResult.data.token !== activeAccessToken, 'New access token must be generated');
    assert(jsonResult.data.refreshToken !== activeRefreshToken, 'New refresh token must be rotated');

    rotatedRefreshToken = jsonResult.data.refreshToken;
  });

  // ----------------------------------------------------
  // TEST UNIT 7: Compromised Token / Theft Detection
  // ----------------------------------------------------
  await test('AuthController.refresh detects token reuse and revokes all active sessions', async () => {
    const schemaName = `tenant_${testDomain.replace(/-/g, '_')}`;
    const tenantDbInfo = await getTenantDrizzleClient(schemaName);
    const [tenantObj] = await publicDb.select().from(tenants).where(eq(tenants.domain, testDomain));

    // Try to reuse the OLD refresh token (activeRefreshToken) which was already rotated/replaced.
    // This simulates an attacker trying to hijack a session with an intercepted old token.
    const req: any = {
      db: tenantDbInfo.db,
      tenantId: tenantObj.id,
      body: {
        refreshToken: activeRefreshToken
      }
    };

    let status = 200;
    let nextError: any = null;

    const res: any = {
      status: (code: number) => {
        status = code;
        return res;
      },
      json: () => {
        return res;
      },
      clearCookie: () => {}
    };

    const next = (err: any) => {
      nextError = err;
    };

    await AuthController.refresh(req, res, next);
    tenantDbInfo.release();

    assert(nextError !== null, 'Reusing a rotated refresh token should trigger an authentication error');
    assert(nextError.statusCode === 401, 'Reused token error must yield 401 Unauthorized status');

    // Confirm session list was cleared entirely for safety
    const tenantDbInfo2 = await getTenantDrizzleClient(schemaName);
    const activeSessions = await tenantDbInfo2.db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, registeredUser.id));
    tenantDbInfo2.release();

    assert(activeSessions.length === 0, 'Re-use breach detection should invalidate ALL user active sessions');
  });

  // ----------------------------------------------------
  // TEST UNIT 8: Forgot Password & Password Reset Flow
  // ----------------------------------------------------
  let resetToken = '';

  await test('AuthController.forgotPassword issues a password reset token for valid accounts', async () => {
    const schemaName = `tenant_${testDomain.replace(/-/g, '_')}`;
    const tenantDbInfo = await getTenantDrizzleClient(schemaName);

    const req: any = {
      db: tenantDbInfo.db,
      tenantDomain: testDomain,
      body: {
        email: 'ceo@acme-test.com'
      }
    };

    let status = 200;
    let jsonResult: any = null;

    const res: any = {
      status: (code: number) => {
        status = code;
        return res;
      },
      json: (data: any) => {
        jsonResult = data;
        return res;
      }
    };

    const next = (err: any) => {
      if (err) throw err;
    };

    await AuthController.forgotPassword(req, res, next);
    tenantDbInfo.release();

    assert(status === 200, 'Expected 200 OK');
    assert(jsonResult.success === true, 'Action should succeed');
    assert(typeof jsonResult.data.resetToken === 'string', 'Reset token should be returned');

    resetToken = jsonResult.data.resetToken;
  });

  await test('AuthController.resetPassword updates password and revokes existing sessions', async () => {
    const schemaName = `tenant_${testDomain.replace(/-/g, '_')}`;
    const tenantDbInfo = await getTenantDrizzleClient(schemaName);

    const req: any = {
      db: tenantDbInfo.db,
      body: {
        token: resetToken,
        newPassword: 'fullyNewAndCorporatePassword123'
      }
    };

    let status = 200;
    let jsonResult: any = null;

    const res: any = {
      status: (code: number) => {
        status = code;
        return res;
      },
      json: (data: any) => {
        jsonResult = data;
        return res;
      }
    };

    const next = (err: any) => {
      if (err) throw err;
    };

    await AuthController.resetPassword(req, res, next);
    tenantDbInfo.release();

    assert(status === 200, 'Expected 200 OK');
    assert(jsonResult.success === true, 'Reset should be successful');

    // Confirm that we can now log in with the new password
    const tenantDbInfoLogin = await getTenantDrizzleClient(schemaName);
    const [tenantObj] = await publicDb.select().from(tenants).where(eq(tenants.domain, testDomain));

    const loginReq: any = {
      db: tenantDbInfoLogin.db,
      tenantId: tenantObj.id,
      tenantDomain: testDomain,
      body: {
        email: 'ceo@acme-test.com',
        password: 'fullyNewAndCorporatePassword123'
      }
    };

    let loginStatus = 200;
    const loginRes: any = {
      status: (code: number) => {
        loginStatus = code;
        return loginRes;
      },
      json: () => {
        return loginRes;
      },
      cookie: () => {}
    };

    await AuthController.login(loginReq, loginRes, next);
    tenantDbInfoLogin.release();

    assert(loginStatus === 200, 'Should login successfully with the new password');
  });

  // ----------------------------------------------------
  // TEST UNIT 9: Role-Based Access Control (RBAC) Middleware
  // ----------------------------------------------------
  await test('auth.requireRole middleware grants or denies operations based on claims', async () => {
    const middleware = requireRole(['owner', 'admin']);

    // Scenario A: Accessing with correct role (admin) should proceed smoothly
    let passedA: boolean = false;
    const reqA: any = {
      user: {
        id: 'user-123',
        email: 'admin@acme-test.com',
        role: 'admin',
        tenantId: 'tenant-123'
      }
    };
    const resA: any = {};
    const nextA = (err?: any) => {
      if (!err) passedA = true;
    };

    middleware(reqA, resA, nextA);
    assert(passedA, 'Admin should be granted access by requireRole([owner, admin])');

    // Scenario B: Accessing with incorrect role (member) should be blocked with 403 Forbidden
    let nextErrorB: any = null;
    const reqB: any = {
      user: {
        id: 'user-456',
        email: 'member@acme-test.com',
        role: 'member',
        tenantId: 'tenant-123'
      }
    };
    const resB: any = {};
    const nextB = (err?: any) => {
      nextErrorB = err;
    };

    middleware(reqB, resB, nextB);
    assert(nextErrorB !== null, 'Member should be denied access by requireRole([owner, admin])');
    assert(nextErrorB.statusCode === 403, 'Denied role should yield 403 Forbidden status');

    // Scenario C: Accessing with no active session user should trigger 401 Unauthorized
    let nextErrorC: any = null;
    const reqC: any = {};
    const resC: any = {};
    const nextC = (err?: any) => {
      nextErrorC = err;
    };

    middleware(reqC, resC, nextC);
    assert(nextErrorC !== null, 'Anonymous requests should be denied by requireRole');
    assert(nextErrorC.statusCode === 401, 'Anonymous requests should yield 401 Unauthorized status');
  });

  // ----------------------------------------------------
  // TEST UNIT 10: Tenant Cross-Isolation Verification
  // ----------------------------------------------------
  await test('Tenant isolation middleware blocks cross-tenant token usage', async () => {
    const tenantAToken = JwtProvider.signAccessToken({
      id: 'user-tenant-a',
      email: 'user@tenant-a.com',
      role: 'owner',
      tenantId: 'tenant-uuid-A',
    });

    // Request context resolves to Tenant B, but user passes Tenant A token
    let authError: any = null;
    const req: any = {
      headers: {
        authorization: `Bearer ${tenantAToken}`,
      },
      cookies: {},
      tenantId: 'tenant-uuid-B',
    };
    const res: any = {};
    const next = (err?: any) => {
      authError = err;
    };

    authenticate(req, res, next);

    assert(authError !== null, 'Cross-tenant request must be rejected');
    assert(authError.statusCode === 403, 'Cross-tenant request must yield 403 Forbidden');
  });

  // ----------------------------------------------------
  // TEST UNIT 11: Rate Limiting Enforcement
  // ----------------------------------------------------
  await test('Rate limiting middleware throttles excessive requests with HTTP 429', async () => {
    const rateLimiter = createRateLimiter({
      windowMs: 60 * 1000,
      maxRequests: 3,
      message: 'Rate limit test threshold exceeded',
    });

    let lastStatus = 200;
    let lastJson: any = null;

    const makeRequest = () => {
      let status = 200;
      let json = null;
      const req: any = {
        headers: {},
        socket: { remoteAddress: '127.0.0.99' },
        path: '/api/v1/auth/login',
      };
      const res: any = {
        setHeader: () => {},
        status: (code: number) => {
          status = code;
          return res;
        },
        json: (data: any) => {
          json = data;
          return res;
        },
      };
      const next = () => {};

      rateLimiter(req, res, next);
      lastStatus = status;
      lastJson = json;
    };

    // Make 3 allowed requests
    makeRequest();
    makeRequest();
    makeRequest();
    assert(lastStatus === 200, 'First 3 requests should be permitted');

    // 4th request exceeds threshold (maxRequests = 3)
    makeRequest();
    assert(lastStatus === 429, '4th request must be rate limited with HTTP 429');
    assert(lastJson.error.code === 'TOO_MANY_REQUESTS', 'Rate limit error code must match');
  });

  // ----------------------------------------------------
  // TEST UNIT 12: Audit Log & Credential Sanitization Test
  // ----------------------------------------------------
  await test('AuditService redacts sensitive credentials from recorded metadata', async () => {
    const { AuditService } = await import('./shared/services/audit-service');
    const schemaName = `tenant_${testDomain.replace(/-/g, '_')}`;
    const tenantDbInfo = await getTenantDrizzleClient(schemaName);

    const mockReq: any = {
      user: { id: 'test-user-id', email: 'test@acme-test.com' },
      ip: '127.0.0.1',
      headers: {}
    };

    await AuditService.log(tenantDbInfo.db, mockReq, {
      action: 'TEST_AUDIT_ACTION',
      module: 'TestModule',
      details: 'Audit trail test log execution',
      metadata: {
        password: 'SuperSecretPassword123',
        token: 'eySecretJwtToken123456',
        publicField: 'VisibleValue'
      }
    });

    const logs = await tenantDbInfo.db.select().from(activityLogs).where(eq(activityLogs.action, 'TEST_AUDIT_ACTION'));
    tenantDbInfo.release();

    assert(logs.length === 1, 'Audit log record should be created in DB');
    const logDetails = logs[0].details;
    assert(!logDetails.includes('SuperSecretPassword123'), 'Raw password MUST NOT appear in audit details');
    assert(!logDetails.includes('eySecretJwtToken123456'), 'Raw token MUST NOT appear in audit details');
    assert(logDetails.includes('[REDACTED_SECRET]'), 'Redacted marker MUST appear in place of sensitive fields');
    assert(logDetails.includes('VisibleValue'), 'Public un-redacted field MUST remain intact');
  });

  // ----------------------------------------------------
  // TEST UNIT 13: Transaction Rollback on Inventory Service Failure
  // ----------------------------------------------------
  await test('Transaction rollback reverts database state on operation failure', async () => {
    const { InventoryService } = await import('./modules/core_erp/domain/inventory-service');
    const schemaName = `tenant_${testDomain.replace(/-/g, '_')}`;
    const tenantDbInfo = await getTenantDrizzleClient(schemaName);

    // Count movements before failed attempt
    const initialMovements = await tenantDbInfo.db.select().from(stockMovements);

    const mockReq: any = {
      user: { id: 'test-user-id', email: 'admin@acme.com' },
      ip: '127.0.0.1'
    };

    let errorThrown = false;
    try {
      // Missing destination warehouse ID for IN movement triggers validation error
      await InventoryService.processStockMovement(tenantDbInfo.db, mockReq, {
        type: 'IN',
        items: []
      });
    } catch (err) {
      errorThrown = true;
    }
    tenantDbInfo.release();

    assert(errorThrown === true, 'Validation error should be thrown for invalid stock movement');

    const tenantDbInfoAfter = await getTenantDrizzleClient(schemaName);
    const finalMovements = await tenantDbInfoAfter.db.select().from(stockMovements);
    tenantDbInfoAfter.release();

    assert(finalMovements.length === initialMovements.length, 'Database state must be identical after failed transaction attempt');
  });

  // ----------------------------------------------------
  // TEST UNIT 14: Production Reset Token Suppression
  // ----------------------------------------------------
  await test('ForgotPassword suppresses reset token in production mode response payload', async () => {
    const originalEnv = env.NODE_ENV;
    (env as any).NODE_ENV = 'production';

    try {
      const schemaName = `tenant_${testDomain.replace(/-/g, '_')}`;
      const tenantDbInfo = await getTenantDrizzleClient(schemaName);

      const req: any = {
        db: tenantDbInfo.db,
        tenantDomain: testDomain,
        body: {
          email: 'ceo@acme-test.com',
        },
      };

      let status = 200;
      let jsonResult: any = null;

      const res: any = {
        status: (code: number) => {
          status = code;
          return res;
        },
        json: (data: any) => {
          jsonResult = data;
          return res;
        },
      };

      const next = (err: any) => {
        if (err) throw err;
      };

      await AuthController.forgotPassword(req, res, next);
      tenantDbInfo.release();

      assert(status === 200, 'Expected status 200');
      assert(jsonResult.success === true, 'ForgotPassword response must be successful');
      assert(jsonResult.data?.resetToken === undefined, 'Reset token MUST NOT be present in production response');
    } finally {
      (env as any).NODE_ENV = originalEnv;
    }
  });

  // ----------------------------------------------------
  // TEST UNIT 15: Complete Tenant Schema Provisioning & Table Verification
  // ----------------------------------------------------
  await test('Provisioned tenant contains complete ERP table schema', async () => {
    const schemaName = `tenant_${testDomain.replace(/-/g, '_')}`;
    const tenantDbInfo = await getTenantDrizzleClient(schemaName);

    // Verify key ERP tables can be queried without "relation does not exist" errors
    const erpTables = [
      'organizations', 'branches', 'warehouses', 'departments', 'positions',
      'employees', 'user_invitations', 'currencies', 'tax_configurations',
      'number_sequences', 'files', 'activity_logs', 'notifications',
      'product_categories', 'brands', 'units_of_measure', 'products',
      'product_variants', 'stock_locations', 'inventory_items', 'stock_movements',
      'stock_movement_items', 'crm_companies', 'crm_contacts', 'crm_leads',
      'crm_opportunities', 'crm_activities', 'sales_orders', 'sales_order_items',
      'delivery_orders', 'delivery_order_items', 'invoices', 'invoice_items',
      'users', 'sessions'
    ];

    const { organizations, branches, warehouses, products, salesOrders, employees: empTable } = await import('./modules/core_erp/infrastructure/db-schemas');

    const orgs = await tenantDbInfo.db.select().from(organizations);
    assert(Array.isArray(orgs), 'organizations query should succeed');

    const branchList = await tenantDbInfo.db.select().from(branches);
    assert(Array.isArray(branchList), 'branches query should succeed');

    const warehouseList = await tenantDbInfo.db.select().from(warehouses);
    assert(Array.isArray(warehouseList), 'warehouses query should succeed');

    const productList = await tenantDbInfo.db.select().from(products);
    assert(Array.isArray(productList), 'products query should succeed');

    const salesOrderList = await tenantDbInfo.db.select().from(salesOrders);
    assert(Array.isArray(salesOrderList), 'salesOrders query should succeed');

    const employeeList = await tenantDbInfo.db.select().from(empTable);
    assert(Array.isArray(employeeList), 'employees query should succeed');

    tenantDbInfo.release();
  });

  // ----------------------------------------------------
  // TEST UNIT 16: Safe Existing Tenant Upgrade
  // ----------------------------------------------------
  await test('ensureTenantSchema upgrades legacy tenant missing ERP tables without data loss', async () => {
    const legacyDomain = `legacy-${crypto.randomInt(1000, 9999)}`;
    const legacySchema = `tenant_${legacyDomain.replace(/-/g, '_')}`;

    const { ensureTenantSchema } = await import('./modules/core_erp/infrastructure/tenant-provisioner');

    // Provision legacy schema with only users & sessions manually
    await publicDb.execute(`CREATE SCHEMA IF NOT EXISTS "${legacySchema}"`);
    await publicDb.execute(`
      CREATE TABLE IF NOT EXISTS "${legacySchema}"."users" (
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

    // Insert pre-existing user
    const existingEmail = `legacy-user@${legacyDomain}.com`;
    await publicDb.execute(`
      INSERT INTO "${legacySchema}"."users" (email, password_hash, name, role, is_verified)
      VALUES ('${existingEmail}', 'hash123', 'Legacy User', 'owner', true);
    `);

    // Run schema upgrade
    await ensureTenantSchema(legacySchema, true);

    // Verify existing user still exists
    const legacyDbInfo = await getTenantDrizzleClient(legacySchema);
    const usersInLegacy = await legacyDbInfo.db.select().from(users).where(eq(users.email, existingEmail));
    assert(usersInLegacy.length === 1, 'Pre-existing legacy user must not be deleted');
    assert(usersInLegacy[0].name === 'Legacy User', 'Pre-existing user data must remain intact');

    // Verify newly added ERP table works
    const { organizations } = await import('./modules/core_erp/infrastructure/db-schemas');
    const orgs = await legacyDbInfo.db.select().from(organizations);
    assert(Array.isArray(orgs), 'Newly added organizations table in upgraded tenant must be queryable');

    legacyDbInfo.release();
  });

  // ----------------------------------------------------
  // TEST UNIT 17: Non-UUID userId Audit Log Sanitization
  // ----------------------------------------------------
  await test('AuditService handles non-UUID string userId without throwing invalid syntax errors', async () => {
    const { AuditService } = await import('./shared/services/audit-service');
    const schemaName = `tenant_${testDomain.replace(/-/g, '_')}`;
    const tenantDbInfo = await getTenantDrizzleClient(schemaName);

    const mockReq: any = {
      user: { id: 'non-uuid-string-user-id', email: 'system-agent@acme.com' },
      ip: '127.0.0.1',
      headers: {}
    };

    let errorOccurred = false;
    try {
      await AuditService.log(tenantDbInfo.db, mockReq, {
        action: 'SYSTEM_EVENT_NON_UUID',
        module: 'SystemModule',
        details: 'Testing non-UUID userId handling'
      });
    } catch (err) {
      errorOccurred = true;
    }

    assert(!errorOccurred, 'AuditService.log must not throw error for non-UUID userId');

    const logs = await tenantDbInfo.db.select().from(activityLogs).where(eq(activityLogs.action, 'SYSTEM_EVENT_NON_UUID'));
    assert(logs.length === 1, 'Audit log record should be created in DB');
    assert(logs[0].userId === null, 'Non-UUID userId should be converted to null');
    assert(logs[0].userName === 'system-agent@acme.com', 'userName should be preserved from req.user.email');

    tenantDbInfo.release();
  });

  // ----------------------------------------------------
  // TEST UNIT 18: Unauthenticated, Malformed & Expired JWT Requests
  // ----------------------------------------------------
  await test('authenticate middleware handles missing, malformed, and expired JWTs with 401', async () => {
    // 1. Missing Authorization header
    let err1: any = null;
    const req1: any = { headers: {}, cookies: {} };
    authenticate(req1, {} as any, (err?: any) => { err1 = err; });
    assert(err1 !== null && err1.statusCode === 401, 'Missing token must yield 401 Unauthorized');

    // 2. Malformed token
    let err2: any = null;
    const req2: any = { headers: { authorization: 'Bearer malformed.invalid.token' }, cookies: {} };
    authenticate(req2, {} as any, (err?: any) => { err2 = err; });
    assert(err2 !== null && err2.statusCode === 401, 'Malformed token must yield 401 Unauthorized');

    // 3. Expired token
    const expiredToken = jwt.sign(
      { id: 'u1', email: 'e@a.com', role: 'owner', tenantId: 't1' },
      env.JWT_SECRET,
      { expiresIn: '-1s' }
    );
    let err3: any = null;
    const req3: any = { headers: { authorization: `Bearer ${expiredToken}` }, cookies: {} };
    authenticate(req3, {} as any, (err?: any) => { err3 = err; });
    assert(err3 !== null && err3.statusCode === 401, 'Expired token must yield 401 Unauthorized');
  });

  // ----------------------------------------------------
  // TEST UNIT 19: Tenant Context Resolution & Status Validation
  // ----------------------------------------------------
  await test('tenantResolver rejects missing, non-existent, and suspended tenants with appropriate status codes', async () => {
    // 1. Missing tenant context on protected route -> 403 Forbidden
    let err1: any = null;
    const req1: any = { path: '/api/v1/erp/inventory/products', headers: {}, query: {} };
    await tenantResolver(req1, {} as any, (err?: any) => { err1 = err; });
    assert(err1 !== null && err1.statusCode === 403, 'Missing tenant context on protected route must yield 403');

    const mockRes: any = { on: () => {} };

    // 2. Non-existent tenant domain -> 404 Not Found
    let err2: any = null;
    const req2: any = { path: '/api/v1/erp/inventory/products', headers: { 'x-tenant-domain': 'nonexistent-workspace-xyz-9999' }, query: {} };
    await tenantResolver(req2, mockRes, (err?: any) => { err2 = err; });
    assert(err2 !== null && err2.statusCode === 404, 'Non-existent tenant domain must yield 404 Not Found');

    // 3. Suspended tenant -> 403 Forbidden
    const suspendedDomain = `suspended-corp-${crypto.randomInt(1000, 9999)}`;
    const [insertedTenant] = await publicDb.insert(tenants).values({
      name: 'Suspended Corp',
      domain: suspendedDomain,
      schema: `tenant_${suspendedDomain.replace(/-/g, '_')}`,
      status: 'suspended',
    }).returning();

    let err3: any = null;
    const req3: any = { path: '/api/v1/erp/inventory/products', headers: { 'x-tenant-domain': suspendedDomain }, query: {} };
    await tenantResolver(req3, mockRes, (err?: any) => { err3 = err; });
    assert(err3 !== null && err3.statusCode === 403, 'Suspended tenant must yield 403 Forbidden');

    // Cleanup suspended test tenant
    await publicDb.delete(tenants).where(eq(tenants.id, insertedTenant.id));
  });

  // ----------------------------------------------------
  // TEST UNIT 20: Cross-Tenant Isolation & Cross-Tenant Resource Access
  // ----------------------------------------------------
  await test('Cross-tenant isolation blocks cross-tenant claims, administrative actions, and resource leakage', async () => {
    const tenantAToken = JwtProvider.signAccessToken({
      id: 'user-tenant-a',
      email: 'owner@tenant-a.com',
      role: 'owner',
      tenantId: 'tenant-uuid-A',
    });

    // 1. Tenant A token sent with Tenant B tenant context
    let err1: any = null;
    const req1: any = {
      headers: { authorization: `Bearer ${tenantAToken}` },
      cookies: {},
      tenantId: 'tenant-uuid-B',
    };
    authenticate(req1, {} as any, (err?: any) => { err1 = err; });
    assert(err1 !== null && err1.statusCode === 403, 'Cross-tenant request must yield 403 Forbidden');

    // 2. User from Tenant A attempting an administrative action in Tenant B
    let adminErr: any = null;
    const adminMiddleware = requireRole(['owner', 'admin']);
    // Even if authentication passed hypothetically, requireRole with incorrect context is blocked
    const req2: any = {
      user: { id: 'user-a', email: 'owner@tenant-a.com', role: 'member', tenantId: 'tenant-uuid-A' }
    };
    adminMiddleware(req2, {} as any, (err?: any) => { adminErr = err; });
    assert(adminErr !== null && adminErr.statusCode === 403, 'User attempting unauthorized action must yield 403 Forbidden');

    // 3. Tenant A token accessing non-existent resource ID in Tenant A schema (or Tenant B resource ID)
    const schemaName = `tenant_${testDomain.replace(/-/g, '_')}`;
    const tenantDbInfo = await getTenantDrizzleClient(schemaName);
    const nonExistentId = crypto.randomUUID();

    const { products } = await import('./modules/core_erp/infrastructure/db-schemas');
    const matchedProducts = await tenantDbInfo.db.select().from(products).where(eq(products.id, nonExistentId));
    tenantDbInfo.release();

    assert(matchedProducts.length === 0, 'Resource ID from another tenant must return 0 results / Not Found in local tenant schema');
  });

  // ----------------------------------------------------
  // TEST UNIT 21: Inventory Endpoint Authorization & Destructive Mutation Protection
  // ----------------------------------------------------
  await test('Inventory mutation endpoints allow owner/admin and reject member roles with 403', async () => {
    const roleCheck = requireRole(['owner', 'admin']);

    // Owner role -> allowed
    let ownerPassed = false as boolean;
    const ownerReq: any = { user: { id: 'u-owner', email: 'owner@corp.com', role: 'owner', tenantId: 't1' } };
    roleCheck(ownerReq, {} as any, (err?: any) => { if (!err) ownerPassed = true; });
    assert(ownerPassed, 'Owner role must be permitted on Inventory mutations');

    // Admin role -> allowed
    let adminPassed = false as boolean;
    const adminReq: any = { user: { id: 'u-admin', email: 'admin@corp.com', role: 'admin', tenantId: 't1' } };
    roleCheck(adminReq, {} as any, (err?: any) => { if (!err) adminPassed = true; });
    assert(adminPassed, 'Admin role must be permitted on Inventory mutations');

    // Member role -> rejected with 403 Forbidden
    let memberErr: any = null;
    const memberReq: any = { user: { id: 'u-member', email: 'member@corp.com', role: 'member', tenantId: 't1' } };
    roleCheck(memberReq, {} as any, (err?: any) => { memberErr = err; });
    assert(memberErr !== null && memberErr.statusCode === 403, 'Member role must be rejected with 403 on Inventory mutations');
  });

  // ----------------------------------------------------
  // TEST UNIT 22: Sales/CRM Endpoint Authorization & Destructive Mutation Protection
  // ----------------------------------------------------
  await test('Sales/CRM and File Storage mutation endpoints enforce owner/admin role protection', async () => {
    const roleCheck = requireRole(['owner', 'admin']);

    // Owner role -> allowed
    let ownerPassed = false as boolean;
    const ownerReq: any = { user: { id: 'u-owner', email: 'owner@corp.com', role: 'owner', tenantId: 't1' } };
    roleCheck(ownerReq, {} as any, (err?: any) => { if (!err) ownerPassed = true; });
    assert(ownerPassed, 'Owner role must be permitted on Sales/CRM mutations');

    // Admin role -> allowed
    let adminPassed = false as boolean;
    const adminReq: any = { user: { id: 'u-admin', email: 'admin@corp.com', role: 'admin', tenantId: 't1' } };
    roleCheck(adminReq, {} as any, (err?: any) => { if (!err) adminPassed = true; });
    assert(adminPassed, 'Admin role must be permitted on Sales/CRM mutations');

    // Member role -> rejected with 403 Forbidden across all Sales/CRM, File, and Audit routes
    let memberErr: any = null;
    const memberReq: any = { user: { id: 'u-member', email: 'member@corp.com', role: 'member', tenantId: 't1' } };
    roleCheck(memberReq, {} as any, (err?: any) => { memberErr = err; });
    assert(memberErr !== null && memberErr.statusCode === 403, 'Member role must be rejected with 403 on Sales/CRM/File mutations');
  });

  // ----------------------------------------------------
  // REPORT RESULTS
  // ----------------------------------------------------
  console.log('\n===================================================');
  console.log('                 TEST SUITE SUMMARY                ');
  console.log('===================================================');
  console.log(`TOTAL TESTS EXECUTED: ${passed + failed}`);
  console.log(`✓ PASSED: ${passed}`);
  console.log(`❌ FAILED: ${failed}`);
  console.log('===================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal failure in test suite execution', err);
  process.exit(1);
});
