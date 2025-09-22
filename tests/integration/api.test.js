const request = require('supertest');
const app = require('../../server');

describe('API Integration Tests', () => {
  const adminToken = 'test-admin-token';
  
  // Set environment for testing
  beforeAll(() => {
    process.env.X_ADMIN_TOKEN = adminToken;
    process.env.NODE_ENV = 'test';
  });

  describe('Health Check', () => {
    test('GET /health should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.version).toBe('1.0.0');
    });
  });

  describe('Authentication', () => {
    test('GET requests should work without token', async () => {
      const response = await request(app)
        .get('/api/employees')
        .expect(200);

      expect(response.body).toHaveProperty('employees');
    });

    test('POST requests should require admin token', async () => {
      await request(app)
        .post('/api/employees')
        .send({
          fullName: 'Test Employee',
          role: 'Staff'
        })
        .expect(401);
    });

    test('POST requests should work with valid admin token', async () => {
      const response = await request(app)
        .post('/api/employees')
        .set('X-Admin-Token', adminToken)
        .send({
          fullName: 'Test Employee',
          email: 'test@company.com',
          role: 'Staff'
        })
        .expect(201);

      expect(response.body.fullName).toBe('Test Employee');
    });
  });

  describe('Employees API', () => {
    let employeeId;

    test('POST /api/employees should create employee', async () => {
      const response = await request(app)
        .post('/api/employees')
        .set('X-Admin-Token', adminToken)
        .send({
          fullName: 'John Doe',
          email: 'john@company.com',
          role: 'Admin'
        })
        .expect(201);

      expect(response.body.fullName).toBe('John Doe');
      expect(response.body.email).toBe('john@company.com');
      expect(response.body.role).toBe('Admin');
      employeeId = response.body.id;
    });

    test('GET /api/employees/:id should return employee', async () => {
      const response = await request(app)
        .get(`/api/employees/${employeeId}`)
        .expect(200);

      expect(response.body.id).toBe(employeeId);
      expect(response.body.fullName).toBe('John Doe');
    });

    test('PUT /api/employees/:id should update employee', async () => {
      const response = await request(app)
        .put(`/api/employees/${employeeId}`)
        .set('X-Admin-Token', adminToken)
        .send({
          fullName: 'John Smith',
          email: 'john.smith@company.com',
          role: 'Staff'
        })
        .expect(200);

      expect(response.body.fullName).toBe('John Smith');
      expect(response.body.role).toBe('Staff');
    });

    test('POST /api/employees/:id/deactivate should deactivate employee', async () => {
      const response = await request(app)
        .post(`/api/employees/${employeeId}/deactivate`)
        .set('X-Admin-Token', adminToken)
        .expect(200);

      expect(response.body.isActive).toBe(false);
    });
  });

  describe('Items API', () => {
    let itemId;

    test('POST /api/items should create atomic item', async () => {
      const response = await request(app)
        .post('/api/items')
        .set('X-Admin-Token', adminToken)
        .send({
          name: 'Test Laptop',
          sku: 'TEST-LAPTOP-001',
          pricePerDay: 25.00,
          isComposite: false,
          quantityOnHand: 10
        })
        .expect(201);

      expect(response.body.name).toBe('Test Laptop');
      expect(response.body.isComposite).toBe(false);
      expect(response.body.quantityOnHand).toBe(10);
      itemId = response.body.id;
    });

    test('GET /api/items/stock-levels should return stock information', async () => {
      const response = await request(app)
        .get('/api/items/stock-levels')
        .expect(200);

      expect(response.body).toHaveProperty('stockLevels');
      expect(Array.isArray(response.body.stockLevels)).toBe(true);
    });

    test('PATCH /api/items/:id/stock should update stock quantity', async () => {
      const response = await request(app)
        .patch(`/api/items/${itemId}/stock`)
        .set('X-Admin-Token', adminToken)
        .send({
          quantity: 15,
          notes: 'Stock replenishment',
          createdBy: 'Test User'
        })
        .expect(200);

      expect(response.body.quantityOnHand).toBe(15);
    });

    test('POST /api/items/:id/stock-adjustment should create stock movement', async () => {
      const response = await request(app)
        .post(`/api/items/${itemId}/stock-adjustment`)
        .set('X-Admin-Token', adminToken)
        .send({
          delta: -2,
          reason: 'adjustment',
          notes: 'Test adjustment',
          createdBy: 'Test User'
        })
        .expect(200);

      expect(response.body.item.quantityOnHand).toBe(13);
      expect(response.body.movement.delta).toBe(-2);
    });
  });

  describe('Calendar API', () => {
    let tokenId;

    test('POST /api/calendar/tokens should create calendar token', async () => {
      const response = await request(app)
        .post('/api/calendar/tokens')
        .set('X-Admin-Token', adminToken)
        .send({
          description: 'Test Token',
          createdBy: 'Test User'
        })
        .expect(201);

      expect(response.body.description).toBe('Test Token');
      expect(response.body.token).toBeTruthy();
      expect(response.body.feedUrl).toContain('/calendar.ics?token=');
      tokenId = response.body.id;
    });

    test('GET /calendar.ics should return ICS feed with valid token', async () => {
      const tokenResponse = await request(app)
        .get('/api/calendar/tokens')
        .expect(200);

      const token = tokenResponse.body.tokens[0].token;

      const response = await request(app)
        .get(`/calendar.ics?token=${token}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/calendar');
      expect(response.text).toContain('BEGIN:VCALENDAR');
      expect(response.text).toContain('END:VCALENDAR');
    });

    test('GET /calendar.ics should reject invalid token', async () => {
      await request(app)
        .get('/calendar.ics?token=invalid-token')
        .expect(401);
    });

    test('DELETE /api/calendar/tokens/:id should revoke token', async () => {
      const response = await request(app)
        .delete(`/api/calendar/tokens/${tokenId}`)
        .set('X-Admin-Token', adminToken)
        .expect(200);

      expect(response.body.message).toBe('Calendar token revoked successfully');
    });
  });

  describe('Error Handling', () => {
    test('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/employees')
        .set('X-Admin-Token', adminToken)
        .send({
          // Missing required fullName
          email: 'invalid-email',
          role: 'InvalidRole'
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain('Full name is required');
    });

    test('should handle not found errors', async () => {
      const response = await request(app)
        .get('/api/employees/999999')
        .expect(404);

      expect(response.body.error.code).toBe('EMPLOYEE_NOT_FOUND');
    });

    test('should handle duplicate entries', async () => {
      // First create an item
      await request(app)
        .post('/api/items')
        .set('X-Admin-Token', adminToken)
        .send({
          name: 'Unique Item',
          sku: 'UNIQUE-001',
          pricePerDay: 10.00,
          isComposite: false,
          quantityOnHand: 5
        });

      // Try to create another with same SKU
      const response = await request(app)
        .post('/api/items')
        .set('X-Admin-Token', adminToken)
        .send({
          name: 'Another Item',
          sku: 'UNIQUE-001', // Duplicate SKU
          pricePerDay: 15.00,
          isComposite: false,
          quantityOnHand: 3
        })
        .expect(409);

      expect(response.body.error.code).toBe('SKU_EXISTS');
    });
  });

  describe('Stock Movements API', () => {
    test('GET /api/stock-movements/reasons should return valid reasons', async () => {
      const response = await request(app)
        .get('/api/stock-movements/reasons')
        .expect(200);

      expect(response.body.reasons).toContain('checkout');
      expect(response.body.reasons).toContain('return');
      expect(response.body.descriptions).toHaveProperty('checkout');
    });

    test('GET /api/stock-movements should return movements', async () => {
      const response = await request(app)
        .get('/api/stock-movements')
        .expect(200);

      expect(response.body).toHaveProperty('movements');
      expect(Array.isArray(response.body.movements)).toBe(true);
    });
  });

  afterAll(() => {
    // Clean up test environment
    delete process.env.X_ADMIN_TOKEN;
  });
});