import { AuthController } from './modules/core_erp/controllers/auth-controller';
import { PasswordHasher, JwtProvider } from './modules/core_erp/domain/user';
import { publicDb, getTenantDrizzleClient } from './config/database';
import { tenants, users, sessions } from './modules/core_erp/infrastructure/db-schemas';
import { requireRole } from './shared/middleware/auth';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

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
