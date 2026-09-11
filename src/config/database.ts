import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from './env';
import { Logger } from '../shared/utils/logger';
import { InternalServerError } from '../shared/utils/errors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

const logger = new Logger('DatabaseConfiguration');

const DB_FILE = path.join(process.cwd(), 'db.json');

interface DbState {
  tenants: any[];
  users: Record<string, any[]>;
  sessions?: Record<string, any[]>;
  genericTables?: Record<string, Record<string, any[]>>;
}

let state: DbState = {
  tenants: [],
  users: {},
  sessions: {},
  genericTables: {}
};

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      state = JSON.parse(data);
      if (!state.sessions) {
        state.sessions = {};
      }
      if (!state.genericTables) {
        state.genericTables = {};
      }
    } else {
      // Seed an initial demo tenant if empty
      state = {
        tenants: [
          {
            id: 'd9b3a328-912f-48d8-913a-7dbda2c64b7c',
            domain: 'demo',
            name: 'Demo Workspace',
            schema: 'tenant_demo',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ],
        users: {
          'tenant_demo': [
            {
              id: 'a87a2d4b-76f5-4428-a40d-d42187cf92f8',
              email: 'demo@apps.com',
              // Hashed 'password123' using scrypt PasswordHasher:
              password_hash: '900b9247cc9f688bf992e5914620b720:073f1146747dfcb60da54a4f8cfc3b03697e37920fca9e144a1068bd8fa32c70da0cb4e99f0f97061d335607b3149fc9cb907fc2f5ae12f0e60803c00445d448',
              passwordHash: '900b9247cc9f688bf992e5914620b720:073f1146747dfcb60da54a4f8cfc3b03697e37920fca9e144a1068bd8fa32c70da0cb4e99f0f97061d335607b3149fc9cb907fc2f5ae12f0e60803c00445d448',
              name: 'Demo Administrator',
              role: 'owner',
              status: 'active',
              isVerified: true,
              is_verified: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ]
        },
        sessions: {},
        genericTables: {}
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
    }
  } catch (error) {
    logger.error('Failed to load DB file', error);
  }
}

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    logger.error('Failed to save DB file', error);
  }
}

// Load current DB on start
loadDb();

function extractColumns(sql: string): string[] {
  // If select query:
  if (sql.toLowerCase().includes('select ')) {
    const selectIdx = sql.toLowerCase().indexOf('select ');
    const fromIdx = sql.toLowerCase().indexOf(' from ', selectIdx);
    if (selectIdx !== -1 && fromIdx !== -1) {
      const colsStr = sql.substring(selectIdx + 7, fromIdx);
      return colsStr.split(',').map(c => c.replace(/"/g, '').trim().split('.').pop() || '');
    }
  }
  // If returning clause:
  if (sql.toLowerCase().includes('returning ')) {
    const returningIdx = sql.toLowerCase().indexOf('returning ');
    const colsStr = sql.substring(returningIdx + 10);
    return colsStr.split(',').map(c => c.replace(/"/g, '').trim().replace(/;/g, ''));
  }
  return [];
}

function handleMockQuery(thisClient: { currentSchema?: string }, config: any, values?: any[]) {
  const sql = typeof config === 'string' ? config : config.text;
  const params = (values && values.length > 0) ? values : (config && typeof config === 'object' && config.values ? config.values : []);

  const safeParams = params.map(p => {
    if (typeof p === 'string') {
      if (p.includes(':') && p.length > 50) return '[REDACTED_HASH]';
      if (p.startsWith('ey') && p.length > 40) return '[REDACTED_JWT]';
      if (p.length >= 32) return '[REDACTED_SECRET]';
    }
    return p;
  });

  if (env.NODE_ENV !== 'production') {
    try {
      const configKeys = typeof config === 'object' && config !== null ? Object.keys(config) : [];
      fs.appendFileSync(path.join(process.cwd(), 'sql_logs.txt'), `SQL: ${sql}\nKEYS: ${JSON.stringify(configKeys)}\nPARAMS: ${JSON.stringify(safeParams)}\n\n`);
    } catch (err) {}

    logger.debug(`Executing SQL: ${sql} | Params: ${JSON.stringify(safeParams)}`);
  }

  let finalRows: any[] = [];
  let commandName = 'UNKNOWN';

  // 1. SELECT 1 (Healthcheck)
  if (/^\s*SELECT\s+1\s*$/i.test(sql.trim())) {
    finalRows = [{ '?column?': 1 }];
    commandName = 'SELECT';
  }

  // 2. SET search_path TO ...
  else if (/SET\s+search_path\s+TO/i.test(sql)) {
    const match = sql.match(/SET\s+search_path\s+TO\s+"?([^", ]+)"?/i);
    if (match) {
      thisClient.currentSchema = match[1];
    }
    finalRows = [];
    commandName = 'SET';
  }

  // 3. SELECT FROM tenants
  else if (/FROM\s+"?tenants"?/i.test(sql)) {
    const domainMatch = sql.match(/(?:"tenants"\.)?"domain"\s*=\s*\$(\d+)/i);
    if (domainMatch) {
      const pIdx = parseInt(domainMatch[1], 10) - 1;
      const targetDomain = params[pIdx]?.toLowerCase();
      const filtered = state.tenants.filter(t => t.domain && t.domain.toLowerCase() === targetDomain);
      finalRows = filtered;
    } else {
      finalRows = state.tenants;
    }
    commandName = 'SELECT';
  }

  // 4. INSERT INTO tenants
  else if (/INSERT\s+INTO\s+"?tenants"?/i.test(sql)) {
    const openParen1 = sql.indexOf('(');
    const closeParen1 = sql.indexOf(')', openParen1);
    const openParen2 = sql.indexOf('(', closeParen1);
    const closeParen2 = sql.indexOf(')', openParen2);
    
    if (openParen1 !== -1 && closeParen1 !== -1 && openParen2 !== -1 && closeParen2 !== -1) {
      const colsStr = sql.substring(openParen1 + 1, closeParen1);
      const valsStr = sql.substring(openParen2 + 1, closeParen2);
      
      const cols = colsStr.split(',').map(c => c.replace(/"/g, '').trim());
      const valPlaceholders = valsStr.split(',').map(v => v.trim());
      
      const newTenant: any = {};
      cols.forEach((col, idx) => {
        const valPlaceholder = valPlaceholders[idx];
        if (valPlaceholder) {
          const pIdxMatch = valPlaceholder.match(/\$(\d+)/);
          if (pIdxMatch) {
            const pIdx = parseInt(pIdxMatch[1], 10) - 1;
            newTenant[col] = params[pIdx];
          }
        }
      });
      
      const pgTenant = {
        id: newTenant.id || crypto.randomUUID(),
        domain: newTenant.domain,
        name: newTenant.name,
        schema: newTenant.schema,
        status: newTenant.status || 'active',
        created_at: newTenant.created_at || new Date().toISOString(),
        updated_at: newTenant.updated_at || new Date().toISOString()
      };
      
      state.tenants = state.tenants.filter(t => t.domain !== pgTenant.domain);
      state.tenants.push(pgTenant);
      saveDb();
      finalRows = [pgTenant];
      commandName = 'INSERT';
    }
  }

  // 5. CREATE SCHEMA & CREATE TABLE
  else if (/CREATE\s+SCHEMA/i.test(sql) || /CREATE\s+TABLE/i.test(sql)) {
    finalRows = [];
    commandName = 'CREATE';
  }

  // 6. RAW INSERT INTO users (during registration/seed)
  else if (/INSERT\s+INTO\s+"([^"]+)"\."users"/i.test(sql)) {
    const schemaMatch = sql.match(/INSERT\s+INTO\s+"([^"]+)"\."users"/i);
    const targetSchema = schemaMatch ? schemaMatch[1] : null;
    
    let newUser: any;
    if (params && params.length >= 3) {
      newUser = {
        id: crypto.randomUUID(),
        email: params[0],
        password_hash: params[1],
        passwordHash: params[1],
        name: params[2],
        role: params[3] || 'owner',
        status: 'active',
        isVerified: params[4] === true || params[4] === 'true',
        is_verified: params[4] === true || params[4] === 'true',
        verificationToken: params[5] || null,
        verification_token: params[5] || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    } else {
      const openParen = sql.lastIndexOf('(');
      const closeParen = sql.lastIndexOf(')');
      if (openParen !== -1 && closeParen !== -1 && targetSchema) {
        const rawValues = sql.substring(openParen + 1, closeParen);
        const valuesArray: string[] = [];
        let currentVal = '';
        let insideQuote = false;
        for (let i = 0; i < rawValues.length; i++) {
          const char = rawValues[i];
          if (char === "'") {
            if (insideQuote && rawValues[i+1] === "'") {
              currentVal += "'";
              i++;
            } else {
              insideQuote = !insideQuote;
            }
          } else if (char === ',' && !insideQuote) {
            valuesArray.push(currentVal.trim());
            currentVal = '';
          } else {
            currentVal += char;
          }
        }
        valuesArray.push(currentVal.trim());

        newUser = {
          id: crypto.randomUUID(),
          email: valuesArray[0],
          password_hash: valuesArray[1],
          passwordHash: valuesArray[1],
          name: valuesArray[2],
          role: valuesArray[3] || 'member',
          status: 'active',
          isVerified: valuesArray[4] === 'true',
          is_verified: valuesArray[4] === 'true',
          verificationToken: valuesArray[5] || null,
          verification_token: valuesArray[5] || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
    }

    if (newUser && targetSchema) {
      if (!state.users[targetSchema]) {
        state.users[targetSchema] = [];
      }
      state.users[targetSchema] = state.users[targetSchema].filter(u => u.email !== newUser.email);
      state.users[targetSchema].push(newUser);
      saveDb();
      finalRows = [newUser];
      commandName = 'INSERT';
    }
  }

  // 7. RAW SELECT users
  else if (/FROM\s+"([^"]+)"\."users"/i.test(sql) && /SELECT\s+/i.test(sql)) {
    const schemaMatch = sql.match(/FROM\s+"([^"]+)"\."users"/i);
    const targetSchema = schemaMatch ? schemaMatch[1] : null;
    
    let targetEmail = '';
    const emailMatch = sql.match(/WHERE\s+email\s*=\s*'([^']+)'/i);
    if (emailMatch) {
      targetEmail = emailMatch[1];
    } else if (params && params.length > 0) {
      targetEmail = params[0];
    }
    
    if (targetSchema) {
      const list = state.users[targetSchema] || [];
      const filtered = list.filter(u => u.email.toLowerCase() === targetEmail.toLowerCase());
      finalRows = filtered;
    }
    commandName = 'SELECT';
  }

  // 8. UPDATE "users" (dynamic parser)
  else if (/UPDATE\s+"?users"?/i.test(sql)) {
    const targetSchema = thisClient.currentSchema;
    if (!targetSchema) {
      return { rows: [], rowCount: 0, command: 'UPDATE' };
    }
    const list = state.users[targetSchema] || [];
    
    // Parse WHERE clause to find target user(s)
    let matchedUsers = [...list];
    const whereMatch = sql.match(/WHERE\s+([\s\S]+?)(?:RETURNING|$)/i);
    if (whereMatch) {
      const whereStr = whereMatch[1];
      const idMatch = whereStr.match(/(?:"users"\.)?"id"\s*=\s*\$(\d+)/i);
      const emailMatch = whereStr.match(/(?:"users"\.)?"email"\s*=\s*\$(\d+)/i);
      const resetTokenMatch = whereStr.match(/(?:"users"\.)?"reset_token"\s*=\s*\$(\d+)/i);
      const verificationTokenMatch = whereStr.match(/(?:"users"\.)?"verification_token"\s*=\s*\$(\d+)/i);

      if (idMatch) {
        const val = params[parseInt(idMatch[1], 10) - 1];
        matchedUsers = matchedUsers.filter(u => u.id === val);
      } else if (emailMatch) {
        const val = params[parseInt(emailMatch[1], 10) - 1]?.toLowerCase();
        matchedUsers = matchedUsers.filter(u => u.email?.toLowerCase() === val);
      } else if (resetTokenMatch) {
        const val = params[parseInt(resetTokenMatch[1], 10) - 1];
        matchedUsers = matchedUsers.filter(u => u.reset_token === val || u.resetToken === val);
      } else if (verificationTokenMatch) {
        const val = params[parseInt(verificationTokenMatch[1], 10) - 1];
        matchedUsers = matchedUsers.filter(u => u.verification_token === val || u.verificationToken === val);
      }
    }

    // Parse SET clause
    const setMatch = sql.match(/SET\s+([\s\S]+?)\s+WHERE/i);
    if (setMatch && matchedUsers.length > 0) {
      const setParts = setMatch[1].split(',');
      const updates: Record<string, any> = {};
      setParts.forEach(part => {
        const eqIdx = part.indexOf('=');
        if (eqIdx !== -1) {
          const colName = part.substring(0, eqIdx).replace(/"/g, '').trim().replace(/users\./i, '');
          const valPlaceholder = part.substring(eqIdx + 1).trim();
          const pIdxMatch = valPlaceholder.match(/\$(\d+)/);
          if (pIdxMatch) {
            const pIdx = parseInt(pIdxMatch[1], 10) - 1;
            updates[colName] = params[pIdx];
          } else if (valPlaceholder.toLowerCase() === 'null') {
            updates[colName] = null;
          } else if (valPlaceholder.toLowerCase() === 'true') {
            updates[colName] = true;
          } else if (valPlaceholder.toLowerCase() === 'false') {
            updates[colName] = false;
          }
        }
      });

      // Apply updates to matched users
      matchedUsers.forEach(u => {
        Object.keys(updates).forEach(col => {
          const camelCol = col.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
          u[col] = updates[col];
          u[camelCol] = updates[col];
          if (col === 'password_hash') {
            u.passwordHash = updates[col];
          }
          if (col === 'is_verified') {
            u.isVerified = updates[col];
          }
          if (col === 'verification_token') {
            u.verificationToken = updates[col];
          }
          if (col === 'reset_token') {
            u.resetToken = updates[col];
          }
          if (col === 'reset_token_expires_at') {
            u.resetTokenExpiresAt = updates[col];
          }
        });
        u.updated_at = new Date().toISOString();
        u.updatedAt = u.updated_at;
      });
      saveDb();
    }
    finalRows = matchedUsers;
    commandName = 'UPDATE';
  }

  // 9. COMPILED SELECT users (with search_path active)
  else if (/FROM\s+"?users"?/i.test(sql)) {
    const targetSchema = thisClient.currentSchema;
    if (targetSchema) {
      const list = state.users[targetSchema] || [];
      
      const emailMatch = sql.match(/(?:"users"\.)?"email"\s*=\s*\$(\d+)/i);
      const idMatch = sql.match(/(?:"users"\.)?"id"\s*=\s*\$(\d+)/i);
      const resetTokenMatch = sql.match(/(?:"users"\.)?"reset_token"\s*=\s*\$(\d+)/i);
      const verificationTokenMatch = sql.match(/(?:"users"\.)?"verification_token"\s*=\s*\$(\d+)/i);

      if (emailMatch) {
        const pIdx = parseInt(emailMatch[1], 10) - 1;
        const targetEmail = params[pIdx]?.toLowerCase();
        finalRows = list.filter(u => u.email && u.email.toLowerCase() === targetEmail);
      } else if (idMatch) {
        const pIdx = parseInt(idMatch[1], 10) - 1;
        const targetId = params[pIdx];
        finalRows = list.filter(u => u.id === targetId);
      } else if (resetTokenMatch) {
        const pIdx = parseInt(resetTokenMatch[1], 10) - 1;
        const val = params[pIdx];
        finalRows = list.filter(u => u.resetToken === val || u.reset_token === val);
      } else if (verificationTokenMatch) {
        const pIdx = parseInt(verificationTokenMatch[1], 10) - 1;
        const val = params[pIdx];
        finalRows = list.filter(u => u.verificationToken === val || u.verification_token === val);
      } else {
        finalRows = list;
      }
    }
    commandName = 'SELECT';
  }

  // 10. INSERT INTO sessions
  else if (/INSERT\s+INTO\s+"?sessions"?/i.test(sql)) {
    const targetSchema = thisClient.currentSchema;
    if (!targetSchema) {
      return { rows: [], rowCount: 0, command: 'INSERT' };
    }
    if (!state.sessions) {
      state.sessions = {};
    }
    if (!state.sessions[targetSchema]) {
      state.sessions[targetSchema] = [];
    }

    const openParen1 = sql.indexOf('(');
    const closeParen1 = sql.indexOf(')', openParen1);
    const openParen2 = sql.indexOf('(', closeParen1);
    const closeParen2 = sql.indexOf(')', openParen2);
    
    if (openParen1 !== -1 && closeParen1 !== -1 && openParen2 !== -1 && closeParen2 !== -1) {
      const colsStr = sql.substring(openParen1 + 1, closeParen1);
      const valsStr = sql.substring(openParen2 + 1, closeParen2);
      
      const cols = colsStr.split(',').map(c => c.replace(/"/g, '').trim());
      const valPlaceholders = valsStr.split(',').map(v => v.trim());
      
      const newSession: any = {};
      cols.forEach((col, idx) => {
        const valPlaceholder = valPlaceholders[idx];
        if (valPlaceholder) {
          const pIdxMatch = valPlaceholder.match(/\$(\d+)/);
          if (pIdxMatch) {
            const pIdx = parseInt(pIdxMatch[1], 10) - 1;
            newSession[col] = params[pIdx];
          }
        }
      });
      
      const pgSession = {
        id: newSession.id || crypto.randomUUID(),
        user_id: newSession.user_id || newSession.userId,
        userId: newSession.user_id || newSession.userId,
        token: newSession.token,
        expires_at: newSession.expires_at || newSession.expiresAt || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        expiresAt: newSession.expires_at || newSession.expiresAt || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        created_at: newSession.created_at || newSession.createdAt || new Date().toISOString(),
        createdAt: newSession.created_at || newSession.createdAt || new Date().toISOString(),
      };
      
      state.sessions[targetSchema].push(pgSession);
      saveDb();
      finalRows = [pgSession];
      commandName = 'INSERT';
    }
  }

  // 11. SELECT FROM sessions
  else if (/SELECT/i.test(sql) && /FROM\s+"?sessions"?/i.test(sql)) {
    const targetSchema = thisClient.currentSchema;
    if (targetSchema) {
      if (!state.sessions) {
        state.sessions = {};
      }
      const list = state.sessions[targetSchema] || [];
      
      const tokenMatch = sql.match(/(?:"sessions"\.)?"token"\s*=\s*\$(\d+)/i);
      const userIdMatch = sql.match(/(?:"sessions"\.)?"user_id"\s*=\s*\$(\d+)/i);
      const idMatch = sql.match(/(?:"sessions"\.)?"id"\s*=\s*\$(\d+)/i);
      
      if (tokenMatch) {
        const val = params[parseInt(tokenMatch[1], 10) - 1];
        finalRows = list.filter(s => s.token === val);
      } else if (userIdMatch) {
        const val = params[parseInt(userIdMatch[1], 10) - 1];
        finalRows = list.filter(s => s.user_id === val || s.userId === val);
      } else if (idMatch) {
        const val = params[parseInt(idMatch[1], 10) - 1];
        finalRows = list.filter(s => s.id === val);
      } else {
        finalRows = list;
      }
    }
    commandName = 'SELECT';
  }

  // 12. DELETE FROM sessions
  else if (/DELETE\s+FROM\s+"?sessions"?/i.test(sql)) {
    const targetSchema = thisClient.currentSchema;
    if (targetSchema) {
      if (!state.sessions) {
        state.sessions = {};
      }
      const list = state.sessions[targetSchema] || [];
      let kept = [...list];
      
      const tokenMatch = sql.match(/(?:sessions\.)?["']?token["']?\s*=\s*\$(\d+)/i) || sql.match(/(?:"sessions"\.)?"token"\s*=\s*\$(\d+)/i);
      const userIdMatch = sql.match(/(?:sessions\.)?["']?user_id["']?\s*=\s*\$(\d+)/i) || sql.match(/(?:"sessions"\.)?"user_id"\s*=\s*\$(\d+)/i);
      const idMatch = sql.match(/(?:sessions\.)?["']?id["']?\s*=\s*\$(\d+)/i) || sql.match(/(?:"sessions"\.)?"id"\s*=\s*\$(\d+)/i);
      
      if (tokenMatch) {
        const val = params[parseInt(tokenMatch[1], 10) - 1];
        kept = list.filter(s => s.token !== val);
      } else if (userIdMatch) {
        const val = params[parseInt(userIdMatch[1], 10) - 1];
        kept = list.filter(s => s.user_id !== val && s.userId !== val);
      } else if (idMatch) {
        const val = params[parseInt(idMatch[1], 10) - 1];
        kept = list.filter(s => s.id !== val);
      } else {
        kept = [];
      }
      state.sessions[targetSchema] = kept;
      saveDb();
      finalRows = [];
    }
    commandName = 'DELETE';
  }

  // 13. Fallback Generic Mock SQL Engine for ERP tables
  else {
    const targetSchema = thisClient.currentSchema || 'public';
    if (!state.genericTables) {
      state.genericTables = {};
    }
    if (!state.genericTables[targetSchema]) {
      state.genericTables[targetSchema] = {};
    }

    // A. INSERT INTO table
    if (/INSERT\s+INTO/i.test(sql)) {
      const matchTable = sql.match(/INSERT\s+INTO\s+(?:"?([a-zA-Z0-9_]+)"?\.)?"?([a-zA-Z0-9_]+)"?/i);
      if (matchTable) {
        const tableName = matchTable[2];
        const openParen1 = sql.indexOf('(');
        const closeParen1 = sql.indexOf(')', openParen1);
        const openParen2 = sql.indexOf('VALUES', closeParen1);
        const openParenVal = sql.indexOf('(', openParen2);
        const closeParenVal = sql.lastIndexOf(')');
        
        if (openParen1 !== -1 && closeParen1 !== -1 && openParenVal !== -1 && closeParenVal !== -1) {
          const colsStr = sql.substring(openParen1 + 1, closeParen1);
          const valsStr = sql.substring(openParenVal + 1, closeParenVal);
          
          const cols = colsStr.split(',').map(c => c.replace(/"/g, '').trim());
          const valPlaceholders = valsStr.split(',').map(v => v.trim());
          
          const newRow: any = {
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          cols.forEach((col, idx) => {
            const valPlaceholder = valPlaceholders[idx];
            if (valPlaceholder) {
              const pIdxMatch = valPlaceholder.match(/\$(\d+)/);
              if (pIdxMatch) {
                const pIdx = parseInt(pIdxMatch[1], 10) - 1;
                const val = params[pIdx];
                newRow[col] = val;
                const camelCol = col.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
                newRow[camelCol] = val;
              } else {
                let val: any = valPlaceholder.replace(/'/g, '').trim();
                if (valPlaceholder.toLowerCase() === 'null') val = null;
                else if (valPlaceholder.toLowerCase() === 'true') val = true;
                else if (valPlaceholder.toLowerCase() === 'false') val = false;
                else if (!isNaN(Number(val))) val = Number(val);
                newRow[col] = val;
                const camelCol = col.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
                newRow[camelCol] = val;
              }
            }
          });
          
          if (!newRow.id) {
            newRow.id = crypto.randomUUID();
          }

          if (!state.genericTables[targetSchema][tableName]) {
            state.genericTables[targetSchema][tableName] = [];
          }
          state.genericTables[targetSchema][tableName].push(newRow);
          saveDb();
          finalRows = [newRow];
          commandName = 'INSERT';
        }
      }
    }
    // B. SELECT FROM table
    else if (/SELECT/i.test(sql) && /FROM/i.test(sql)) {
      const matchTable = sql.match(/FROM\s+(?:"?([a-zA-Z0-9_]+)"?\.)?"?([a-zA-Z0-9_]+)"?/i);
      if (matchTable) {
        const tableName = matchTable[2];
        const list = state.genericTables[targetSchema][tableName] || [];
        
        // Parse conditions in WHERE clause
        const conditions: Array<{ column: string; operator: string; paramIndex?: number; rawValue?: any }> = [];
        const conditionRegex = /(?:"?([a-zA-Z0-9_]+)"?\.)?"?([a-zA-Z0-9_]+)"?\s*(=|LIKE|ILIKE|<>|>=|<=|>|<)\s*(?:\$(\d+)|(NULL)|'([^']*)'|(\d+))/gi;
        let match;
        while ((match = conditionRegex.exec(sql)) !== null) {
          const col = match[2];
          const op = match[3].toUpperCase();
          const pIdx = match[4] ? parseInt(match[4], 10) - 1 : undefined;
          const isNull = match[5] ? true : false;
          const strVal = match[6];
          const numVal = match[7] ? parseInt(match[7], 10) : undefined;
          
          conditions.push({
            column: col,
            operator: op,
            paramIndex: pIdx,
            rawValue: isNull ? null : (strVal !== undefined ? strVal : numVal)
          });
        }
        
        let filtered = [...list];
        for (const cond of conditions) {
          const colCamel = cond.column.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
          const colSnake = cond.column;
          let targetVal = cond.paramIndex !== undefined ? params[cond.paramIndex] : cond.rawValue;
          
          filtered = filtered.filter(row => {
            const val = row[colCamel] !== undefined ? row[colCamel] : row[colSnake];
            if (cond.operator === '=') {
              if (targetVal === null) return val === null || val === undefined;
              return String(val) === String(targetVal);
            } else if (cond.operator === '<>') {
              return String(val) !== String(targetVal);
            } else if (cond.operator === 'LIKE' || cond.operator === 'ILIKE') {
              if (!val) return false;
              const searchPattern = String(targetVal).replace(/%/g, '').toLowerCase();
              return String(val).toLowerCase().includes(searchPattern);
            } else if (cond.operator === '>=') {
              return Number(val) >= Number(targetVal);
            } else if (cond.operator === '<=') {
              return Number(val) <= Number(targetVal);
            } else if (cond.operator === '>') {
              return Number(val) > Number(targetVal);
            } else if (cond.operator === '<') {
              return Number(val) < Number(targetVal);
            }
            return true;
          });
        }
        
        // Handle sorting if requested
        if (sql.toLowerCase().includes('order by')) {
          const orderMatch = sql.match(/order\s+by\s+(?:"?[a-zA-Z0-9_]+"?\.)?"?([a-zA-Z0-9_]+)"?(?:\s+(asc|desc))?/i);
          if (orderMatch) {
            const sortCol = orderMatch[1];
            const sortColCamel = sortCol.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
            const isDesc = orderMatch[2] && orderMatch[2].toLowerCase() === 'desc';
            filtered.sort((a, b) => {
              const valA = a[sortColCamel] !== undefined ? a[sortColCamel] : a[sortCol];
              const valB = b[sortColCamel] !== undefined ? b[sortColCamel] : b[sortCol];
              if (valA < valB) return isDesc ? 1 : -1;
              if (valA > valB) return isDesc ? -1 : 1;
              return 0;
            });
          }
        }
        
        finalRows = filtered;
        commandName = 'SELECT';
      }
    }
    // C. UPDATE table
    else if (/UPDATE/i.test(sql)) {
      const matchTable = sql.match(/UPDATE\s+(?:"?([a-zA-Z0-9_]+)"?\.)?"?([a-zA-Z0-9_]+)"?/i);
      if (matchTable) {
        const tableName = matchTable[2];
        const list = state.genericTables[targetSchema][tableName] || [];
        
        // SET clause
        const setMatch = sql.match(/SET\s+([\s\S]+?)\s+WHERE/i) || sql.match(/SET\s+([\s\S]+?)$/i);
        const updates: Record<string, any> = {};
        if (setMatch) {
          const setParts = setMatch[1].split(',');
          setParts.forEach(part => {
            const eqIdx = part.indexOf('=');
            if (eqIdx !== -1) {
              const colName = part.substring(0, eqIdx).replace(/"/g, '').trim().split('.').pop() || '';
              const valPlaceholder = part.substring(eqIdx + 1).trim();
              const pIdxMatch = valPlaceholder.match(/\$(\d+)/);
              if (pIdxMatch) {
                const pIdx = parseInt(pIdxMatch[1], 10) - 1;
                updates[colName] = params[pIdx];
              } else {
                let val: any = valPlaceholder.replace(/'/g, '').trim();
                if (valPlaceholder.toLowerCase() === 'null') val = null;
                else if (valPlaceholder.toLowerCase() === 'true') val = true;
                else if (valPlaceholder.toLowerCase() === 'false') val = false;
                else if (!isNaN(Number(val))) val = Number(val);
                updates[colName] = val;
              }
            }
          });
        }
        
        // Parse conditions in WHERE clause to find rows to update
        const conditions: Array<{ column: string; operator: string; paramIndex?: number; rawValue?: any }> = [];
        const conditionRegex = /(?:"?([a-zA-Z0-9_]+)"?\.)?"?([a-zA-Z0-9_]+)"?\s*(=|LIKE|ILIKE|<>|>=|<=|>|<)\s*(?:\$(\d+)|(NULL)|'([^']*)'|(\d+))/gi;
        const whereMatch = sql.match(/WHERE\s+([\s\S]+?)$/i);
        if (whereMatch) {
          const whereSql = whereMatch[1];
          let match;
          while ((match = conditionRegex.exec(whereSql)) !== null) {
            const col = match[2];
            const op = match[3].toUpperCase();
            const pIdx = match[4] ? parseInt(match[4], 10) - 1 : undefined;
            const isNull = match[5] ? true : false;
            const strVal = match[6];
            const numVal = match[7] ? parseInt(match[7], 10) : undefined;
            
            conditions.push({
              column: col,
              operator: op,
              paramIndex: pIdx,
              rawValue: isNull ? null : (strVal !== undefined ? strVal : numVal)
            });
          }
        }
        
        let matchedRows = [...list];
        for (const cond of conditions) {
          const colCamel = cond.column.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
          const colSnake = cond.column;
          let targetVal = cond.paramIndex !== undefined ? params[cond.paramIndex] : cond.rawValue;
          
          matchedRows = matchedRows.filter(row => {
            const val = row[colCamel] !== undefined ? row[colCamel] : row[colSnake];
            if (cond.operator === '=') {
              if (targetVal === null) return val === null || val === undefined;
              return String(val) === String(targetVal);
            }
            return true;
          });
        }
        
        // Apply updates
        matchedRows.forEach(row => {
          Object.keys(updates).forEach(col => {
            row[col] = updates[col];
            const camelCol = col.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
            row[camelCol] = updates[col];
          });
          row.updated_at = new Date().toISOString();
          row.updatedAt = row.updated_at;
        });
        saveDb();
        finalRows = matchedRows;
        commandName = 'UPDATE';
      }
    }
    // D. DELETE FROM table
    else if (/DELETE/i.test(sql)) {
      const matchTable = sql.match(/DELETE\s+FROM\s+(?:"?([a-zA-Z0-9_]+)"?\.)?"?([a-zA-Z0-9_]+)"?/i);
      if (matchTable) {
        const tableName = matchTable[2];
        const list = state.genericTables[targetSchema][tableName] || [];
        
        // Parse conditions in WHERE clause to find rows to delete
        const conditions: Array<{ column: string; operator: string; paramIndex?: number; rawValue?: any }> = [];
        const conditionRegex = /(?:"?([a-zA-Z0-9_]+)"?\.)?"?([a-zA-Z0-9_]+)"?\s*(=|LIKE|ILIKE|<>|>=|<=|>|<)\s*(?:\$(\d+)|(NULL)|'([^']*)'|(\d+))/gi;
        const whereMatch = sql.match(/WHERE\s+([\s\S]+?)$/i);
        if (whereMatch) {
          const whereSql = whereMatch[1];
          let match;
          while ((match = conditionRegex.exec(whereSql)) !== null) {
            const col = match[2];
            const op = match[3].toUpperCase();
            const pIdx = match[4] ? parseInt(match[4], 10) - 1 : undefined;
            const isNull = match[5] ? true : false;
            const strVal = match[6];
            const numVal = match[7] ? parseInt(match[7], 10) : undefined;
            
            conditions.push({
              column: col,
              operator: op,
              paramIndex: pIdx,
              rawValue: isNull ? null : (strVal !== undefined ? strVal : numVal)
            });
          }
        }
        
        let keptRows = [...list];
        let deletedRows = [...list];
        for (const cond of conditions) {
          const colCamel = cond.column.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
          const colSnake = cond.column;
          let targetVal = cond.paramIndex !== undefined ? params[cond.paramIndex] : cond.rawValue;
          
          keptRows = keptRows.filter(row => {
            const val = row[colCamel] !== undefined ? row[colCamel] : row[colSnake];
            if (cond.operator === '=') {
              if (targetVal === null) return val !== null && val !== undefined;
              return String(val) !== String(targetVal);
            }
            return true;
          });
          
          deletedRows = deletedRows.filter(row => {
            const val = row[colCamel] !== undefined ? row[colCamel] : row[colSnake];
            if (cond.operator === '=') {
              if (targetVal === null) return val === null || val === undefined;
              return String(val) === String(targetVal);
            }
            return true;
          });
        }
        
        state.genericTables[targetSchema][tableName] = keptRows;
        saveDb();
        finalRows = deletedRows;
        commandName = 'DELETE';
      }
    }
  }

  // Handle Drizzle array mode if expected
  let returnedRows = finalRows;
  let colsList: string[] = [];
  if (config && config.rowMode === 'array') {
    colsList = extractColumns(sql);
    if (colsList.length > 0) {
      returnedRows = finalRows.map(row => {
        return colsList.map(col => row[col]);
      });
    }
  }

  return {
    rows: returnedRows,
    rowCount: returnedRows.length,
    command: commandName,
    fields: colsList.map(name => ({ name }))
  };
}

class MockClient extends EventEmitter {
  public currentSchema?: string;

  constructor() {
    super();
  }

  async query(config: any, values?: any[]) {
    return handleMockQuery(this, config, values);
  }

  release() {
    // No-op
  }
}

class MockPool extends EventEmitter {
  constructor() {
    super();
  }

  async connect() {
    return new MockClient();
  }

  async query(config: any, values?: any[]) {
    const dummyClient = { currentSchema: undefined };
    return handleMockQuery(dummyClient, config, values);
  }
}

let activePool: any;

const isProduction = env.NODE_ENV === 'production';
const isExplicitPostgres = env.DB_MODE === 'postgres';
const isExplicitMock = env.DB_MODE === 'mock';

if (isProduction || isExplicitPostgres) {
  if (isExplicitMock && isProduction) {
    logger.error('❌ CONFIGURATION ERROR: Cannot use mock database mode in production environment!');
    process.exit(1);
  }
  logger.info(`Initializing PostgreSQL database connection pool for [${env.NODE_ENV}] environment...`);
  activePool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_URL.includes('sslmode=require') || isProduction ? { rejectUnauthorized: false } : false,
  });

  activePool.on('error', (err: Error) => {
    logger.error('Unexpected error on idle PostgreSQL client pool', err);
    if (isProduction) {
      process.exit(1);
    }
  });
} else {
  logger.info('Initializing Mock database pool for development/testing environment...');
  activePool = new MockPool();
}

export const pool = activePool as any;

/**
 * Creates a Drizzle client instance bound to a specific tenant schema using search_path.
 * All subsequent Drizzle queries using this client will run inside that schema boundary.
 */
export async function getTenantDrizzleClient(schema: string) {
  try {
    const client = await pool.connect();
    const sanitizedSchema = schema.replace(/[^a-zA-Z0-9_]/g, '');
    await client.query(`SET search_path TO "${sanitizedSchema}", public`);

    const db = drizzle(client);

    return {
      db,
      release: () => {
        client.release();
      },
    };
  } catch (error) {
    logger.error(`Failed to checkout database connection for tenant schema [${schema}]`, error);
    throw new InternalServerError('Database connection check-out failure');
  }
}

/**
 * Execute database queries in public context (e.g. for tenant-lookup registries)
 */
export const publicDb = drizzle(pool);
