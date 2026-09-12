import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { env } from './src/config/env';
import { tenantResolver } from './src/shared/middleware/tenant-resolver';
import { authenticate, requireRole } from './src/shared/middleware/auth';
import { authRateLimiter } from './src/shared/middleware/rate-limiter';
import { securityHeadersMiddleware } from './src/shared/middleware/security-headers';
import { AuthController } from './src/modules/core_erp/controllers/auth-controller';
import { ErpController } from './src/modules/core_erp/controllers/erp-controller';
import { SalesCrmController } from './src/modules/core_erp/controllers/sales-crm-controller';
import { errorHandler } from './src/shared/middleware/error-handler';
import { pool } from './src/config/database';
import { Logger } from './src/shared/utils/logger';

// Extend Express Request type to support cookies cleanly without heavy middleware dependencies
declare global {
  namespace Express {
    interface Request {
      cookies?: Record<string, string>;
    }
  }
}

const logger = new Logger('ServerEntrypoint');

async function bootstrap() {
  const app = express();

  // 1. Core middlewares
  app.use(securityHeadersMiddleware);
  app.use(express.json());

  // Light-weight inline zero-dependency cookie parsing
  app.use((req, res, next) => {
    const cookieHeader = req.headers.cookie;
    const cookies: Record<string, string> = {};
    if (cookieHeader) {
      cookieHeader.split(';').forEach((item) => {
        const parts = item.split('=');
        if (parts[0] && parts[1]) {
          cookies[parts[0].trim()] = decodeURIComponent(parts[1].trim());
        }
      });
    }
    req.cookies = cookies;
    next();
  });

  // 2. Platform health routing (public endpoint)
  app.get('/api/health', async (req, res) => {
    try {
      // Test the database pool connection
      const dbCheck = await pool.query('SELECT 1');
      res.status(200).json({
        status: 'green',
        timestamp: new Date().toISOString(),
        services: {
          database: dbCheck.rowCount === 1 ? 'connected' : 'degraded',
          server: 'running',
        },
      });
    } catch (error) {
      logger.error('Health check failed', error);
      res.status(500).json({
        status: 'red',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // 3. Multi-Tenant schema routing middleware
  app.use('/api/v1', tenantResolver);

  // 4. Core Authentication endpoints
  app.post('/api/v1/auth/register', authRateLimiter, AuthController.register);
  app.post('/api/v1/auth/login', authRateLimiter, AuthController.login);
  app.post('/api/v1/auth/logout', AuthController.logout);
  app.post('/api/v1/auth/refresh', authRateLimiter, AuthController.refresh);
  app.post('/api/v1/auth/forgot-password', authRateLimiter, AuthController.forgotPassword);
  app.post('/api/v1/auth/reset-password', authRateLimiter, AuthController.resetPassword);
  app.post('/api/v1/auth/verify-email', authRateLimiter, AuthController.verifyEmail);
  app.get('/api/v1/auth/me', authenticate, AuthController.me);

  // 4b. Core ERP Foundation Module endpoints
  // Organization
  app.get('/api/v1/erp/organization', authenticate, ErpController.getOrganization);
  app.put('/api/v1/erp/organization', authenticate, requireRole(['owner', 'admin']), ErpController.updateOrganization);

  // Branches
  app.get('/api/v1/erp/branches', authenticate, ErpController.getBranches);
  app.post('/api/v1/erp/branches', authenticate, requireRole(['owner', 'admin']), ErpController.createBranch);
  app.put('/api/v1/erp/branches/:id', authenticate, requireRole(['owner', 'admin']), ErpController.updateBranch);
  app.delete('/api/v1/erp/branches/:id', authenticate, requireRole(['owner', 'admin']), ErpController.deleteBranch);

  // Warehouses
  app.get('/api/v1/erp/warehouses', authenticate, ErpController.getWarehouses);
  app.post('/api/v1/erp/warehouses', authenticate, requireRole(['owner', 'admin']), ErpController.createWarehouse);
  app.put('/api/v1/erp/warehouses/:id', authenticate, requireRole(['owner', 'admin']), ErpController.updateWarehouse);
  app.delete('/api/v1/erp/warehouses/:id', authenticate, requireRole(['owner', 'admin']), ErpController.deleteWarehouse);

  // Departments
  app.get('/api/v1/erp/departments', authenticate, ErpController.getDepartments);
  app.post('/api/v1/erp/departments', authenticate, requireRole(['owner', 'admin']), ErpController.createDepartment);
  app.put('/api/v1/erp/departments/:id', authenticate, requireRole(['owner', 'admin']), ErpController.updateDepartment);
  app.delete('/api/v1/erp/departments/:id', authenticate, requireRole(['owner', 'admin']), ErpController.deleteDepartment);

  // Positions
  app.get('/api/v1/erp/positions', authenticate, ErpController.getPositions);
  app.post('/api/v1/erp/positions', authenticate, requireRole(['owner', 'admin']), ErpController.createPosition);
  app.put('/api/v1/erp/positions/:id', authenticate, requireRole(['owner', 'admin']), ErpController.updatePosition);
  app.delete('/api/v1/erp/positions/:id', authenticate, requireRole(['owner', 'admin']), ErpController.deletePosition);

  // Employees
  app.get('/api/v1/erp/employees', authenticate, ErpController.getEmployees);
  app.post('/api/v1/erp/employees', authenticate, requireRole(['owner', 'admin']), ErpController.createEmployee);
  app.put('/api/v1/erp/employees/:id', authenticate, requireRole(['owner', 'admin']), ErpController.updateEmployee);
  app.delete('/api/v1/erp/employees/:id', authenticate, requireRole(['owner', 'admin']), ErpController.deleteEmployee);

  // User Invitations
  app.get('/api/v1/erp/invitations', authenticate, ErpController.getInvitations);
  app.post('/api/v1/erp/invitations', authenticate, requireRole(['owner', 'admin']), ErpController.createInvitation);
  app.delete('/api/v1/erp/invitations/:id', authenticate, requireRole(['owner', 'admin']), ErpController.cancelInvitation);

  // Currencies
  app.get('/api/v1/erp/currencies', authenticate, ErpController.getCurrencies);
  app.post('/api/v1/erp/currencies', authenticate, requireRole(['owner', 'admin']), ErpController.createCurrency);
  app.put('/api/v1/erp/currencies/:id', authenticate, requireRole(['owner', 'admin']), ErpController.updateCurrency);
  app.delete('/api/v1/erp/currencies/:id', authenticate, requireRole(['owner', 'admin']), ErpController.deleteCurrency);

  // Taxes
  app.get('/api/v1/erp/taxes', authenticate, ErpController.getTaxes);
  app.post('/api/v1/erp/taxes', authenticate, requireRole(['owner', 'admin']), ErpController.createTax);
  app.put('/api/v1/erp/taxes/:id', authenticate, requireRole(['owner', 'admin']), ErpController.updateTax);
  app.delete('/api/v1/erp/taxes/:id', authenticate, requireRole(['owner', 'admin']), ErpController.deleteTax);

  // Number sequences
  app.get('/api/v1/erp/sequences', authenticate, ErpController.getSequences);
  app.put('/api/v1/erp/sequences/:id', authenticate, requireRole(['owner', 'admin']), ErpController.updateSequence);

  // Files
  app.get('/api/v1/erp/files', authenticate, ErpController.getFiles);
  app.post('/api/v1/erp/files', authenticate, requireRole(['owner', 'admin']), ErpController.uploadFile);
  app.delete('/api/v1/erp/files/:id', authenticate, requireRole(['owner', 'admin']), ErpController.deleteFile);

  // Audit Logs
  app.get('/api/v1/erp/logs', authenticate, requireRole(['owner', 'admin']), ErpController.getActivityLogs);

  // Notifications
  app.get('/api/v1/erp/notifications', authenticate, ErpController.getNotifications);
  app.put('/api/v1/erp/notifications/:id/read', authenticate, ErpController.markNotificationAsRead);
  app.put('/api/v1/erp/notifications/read-all', authenticate, ErpController.markAllNotificationsAsRead);

  // 4c. Inventory & Product Management Module endpoints
  // Categories
  app.get('/api/v1/erp/inventory/categories', authenticate, ErpController.getCategories);
  app.post('/api/v1/erp/inventory/categories', authenticate, requireRole(['owner', 'admin']), ErpController.createCategory);
  app.put('/api/v1/erp/inventory/categories/:id', authenticate, requireRole(['owner', 'admin']), ErpController.updateCategory);
  app.delete('/api/v1/erp/inventory/categories/:id', authenticate, requireRole(['owner', 'admin']), ErpController.deleteCategory);

  // Brands
  app.get('/api/v1/erp/inventory/brands', authenticate, ErpController.getBrands);
  app.post('/api/v1/erp/inventory/brands', authenticate, requireRole(['owner', 'admin']), ErpController.createBrand);
  app.put('/api/v1/erp/inventory/brands/:id', authenticate, requireRole(['owner', 'admin']), ErpController.updateBrand);
  app.delete('/api/v1/erp/inventory/brands/:id', authenticate, requireRole(['owner', 'admin']), ErpController.deleteBrand);

  // Units of Measure (UoM)
  app.get('/api/v1/erp/inventory/uoms', authenticate, ErpController.getUoms);
  app.post('/api/v1/erp/inventory/uoms', authenticate, requireRole(['owner', 'admin']), ErpController.createUom);
  app.put('/api/v1/erp/inventory/uoms/:id', authenticate, requireRole(['owner', 'admin']), ErpController.updateUom);
  app.delete('/api/v1/erp/inventory/uoms/:id', authenticate, requireRole(['owner', 'admin']), ErpController.deleteUom);

  // Products
  app.get('/api/v1/erp/inventory/products', authenticate, ErpController.getProducts);
  app.post('/api/v1/erp/inventory/products', authenticate, requireRole(['owner', 'admin']), ErpController.createProduct);
  app.put('/api/v1/erp/inventory/products/:id', authenticate, requireRole(['owner', 'admin']), ErpController.updateProduct);
  app.delete('/api/v1/erp/inventory/products/:id', authenticate, requireRole(['owner', 'admin']), ErpController.deleteProduct);

  // Product Variants
  app.get('/api/v1/erp/inventory/products/:productId/variants', authenticate, ErpController.getProductVariants);
  app.post('/api/v1/erp/inventory/products/:productId/variants', authenticate, requireRole(['owner', 'admin']), ErpController.createProductVariant);
  app.delete('/api/v1/erp/inventory/products/variants/:id', authenticate, requireRole(['owner', 'admin']), ErpController.deleteProductVariant);

  // Stock Locations
  app.get('/api/v1/erp/inventory/locations', authenticate, ErpController.getLocations);
  app.post('/api/v1/erp/inventory/locations', authenticate, requireRole(['owner', 'admin']), ErpController.createLocation);
  app.put('/api/v1/erp/inventory/locations/:id', authenticate, requireRole(['owner', 'admin']), ErpController.updateLocation);
  app.delete('/api/v1/erp/inventory/locations/:id', authenticate, requireRole(['owner', 'admin']), ErpController.deleteLocation);

  // Stock levels, alerts, movements & valuation
  app.get('/api/v1/erp/inventory/stock-levels', authenticate, ErpController.getStockLevels);
  app.get('/api/v1/erp/inventory/movements', authenticate, ErpController.getMovements);
  app.post('/api/v1/erp/inventory/movements', authenticate, requireRole(['owner', 'admin']), ErpController.createMovement);
  app.get('/api/v1/erp/inventory/valuation', authenticate, ErpController.getStockValuation);
  app.get('/api/v1/erp/inventory/dashboard', authenticate, ErpController.getInventoryDashboard);

  // 4d. Sales & CRM Module endpoints
  // CRM Companies (Accounts)
  app.get('/api/v1/erp/crm/companies', authenticate, SalesCrmController.getCompanies);
  app.post('/api/v1/erp/crm/companies', authenticate, requireRole(['owner', 'admin']), SalesCrmController.createCompany);
  app.put('/api/v1/erp/crm/companies/:id', authenticate, requireRole(['owner', 'admin']), SalesCrmController.updateCompany);
  app.delete('/api/v1/erp/crm/companies/:id', authenticate, requireRole(['owner', 'admin']), SalesCrmController.deleteCompany);

  // CRM Contacts
  app.get('/api/v1/erp/crm/contacts', authenticate, SalesCrmController.getContacts);
  app.post('/api/v1/erp/crm/contacts', authenticate, requireRole(['owner', 'admin']), SalesCrmController.createContact);
  app.put('/api/v1/erp/crm/contacts/:id', authenticate, requireRole(['owner', 'admin']), SalesCrmController.updateContact);
  app.delete('/api/v1/erp/crm/contacts/:id', authenticate, requireRole(['owner', 'admin']), SalesCrmController.deleteContact);

  // CRM Leads
  app.get('/api/v1/erp/crm/leads', authenticate, SalesCrmController.getLeads);
  app.post('/api/v1/erp/crm/leads', authenticate, requireRole(['owner', 'admin']), SalesCrmController.createLead);
  app.put('/api/v1/erp/crm/leads/:id', authenticate, requireRole(['owner', 'admin']), SalesCrmController.updateLead);
  app.delete('/api/v1/erp/crm/leads/:id', authenticate, requireRole(['owner', 'admin']), SalesCrmController.deleteLead);

  // CRM Opportunities (Pipelines)
  app.get('/api/v1/erp/crm/opportunities', authenticate, SalesCrmController.getOpportunities);
  app.post('/api/v1/erp/crm/opportunities', authenticate, requireRole(['owner', 'admin']), SalesCrmController.createOpportunity);
  app.put('/api/v1/erp/crm/opportunities/:id', authenticate, requireRole(['owner', 'admin']), SalesCrmController.updateOpportunity);
  app.delete('/api/v1/erp/crm/opportunities/:id', authenticate, requireRole(['owner', 'admin']), SalesCrmController.deleteOpportunity);

  // CRM Activities (Calls, Emails, Tasks, notes, meetings)
  app.get('/api/v1/erp/crm/activities', authenticate, SalesCrmController.getActivities);
  app.post('/api/v1/erp/crm/activities', authenticate, requireRole(['owner', 'admin']), SalesCrmController.createActivity);
  app.delete('/api/v1/erp/crm/activities/:id', authenticate, requireRole(['owner', 'admin']), SalesCrmController.deleteActivity);

  // Sales Orders & Quotations (Multi-currency, Product inventory integration, Automatic Stock reservation)
  app.get('/api/v1/erp/sales/orders', authenticate, SalesCrmController.getSalesOrders);
  app.post('/api/v1/erp/sales/orders', authenticate, requireRole(['owner', 'admin']), SalesCrmController.createSalesOrder);
  app.put('/api/v1/erp/sales/orders/:id/status', authenticate, requireRole(['owner', 'admin']), SalesCrmController.updateOrderStatus);
  app.delete('/api/v1/erp/sales/orders/:id', authenticate, requireRole(['owner', 'admin']), SalesCrmController.deleteSalesOrder);

  // Delivery Orders (Shipment processing)
  app.get('/api/v1/erp/sales/deliveries', authenticate, SalesCrmController.getDeliveryOrders);
  app.post('/api/v1/erp/sales/deliveries', authenticate, requireRole(['owner', 'admin']), SalesCrmController.createDeliveryOrder);

  // Invoices (Billing preparation & multi-currency/payment terms)
  app.get('/api/v1/erp/sales/invoices', authenticate, SalesCrmController.getInvoices);
  app.post('/api/v1/erp/sales/invoices', authenticate, requireRole(['owner', 'admin']), SalesCrmController.createInvoice);
  app.put('/api/v1/erp/sales/invoices/:id/status', authenticate, requireRole(['owner', 'admin']), SalesCrmController.updateInvoiceStatus);

  // Sales & CRM Dashboard Analytical KPI Reports
  app.get('/api/v1/erp/sales/dashboard', authenticate, SalesCrmController.getDashboard);

  // 5. Build framework-specific front-end serving
  if (env.NODE_ENV !== 'production') {
    logger.info('Starting server in DEVELOPMENT mode with Vite compiler middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    logger.info('Starting server in PRODUCTION mode with precompiled assets...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 6. Centralized Error Handler (must be registered last)
  app.use(errorHandler);

  app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`Business Suite Server listening on port ${env.PORT} (http://localhost:${env.PORT})`);
  });
}

bootstrap().catch((err) => {
  logger.error('Critical bootstrapper system failure', err);
  process.exit(1);
});
