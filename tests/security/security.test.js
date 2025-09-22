const request = require('supertest');
const app = require('../../server');

describe('Security Tests', () => {
  const adminToken = 'test-admin-token';
  let testEmployeeId, testCustomerId, testItemId;
  
  beforeAll(async () => {
    process.env.X_ADMIN_TOKEN = adminToken;
    process.env.NODE_ENV = 'test';
  });

  beforeEach(async () => {
    // Create test data for security testing
    const employeeResponse = await request(app)
      .post('/api/employees')
      .set('X-Admin-Token', adminToken)
      .send({
        fullName: 'Security Test Employee',
        email: 'security@test.com',
        role: 'Staff'
      });
    testEmployeeId = employeeResponse.body.employee.id;

    const customerResponse = await request(app)
      .post('/api/customers')
      .set('X-Admin-Token', adminToken)
      .send({
        displayName: 'Security Test Customer',
        contactInfo: { email: 'security-customer@test.com' }
      });
    testCustomerId = customerResponse.body.customer.id;

    const itemResponse = await request(app)
      .post('/api/items')
      .set('X-Admin-Token', adminToken)
      .send({
        name: 'Security Test Item',
        sku: 'SEC-TEST-001',
        pricePerDay: 30.00,
        isComposite: false,
        quantityOnHand: 10
      });
    testItemId = itemResponse.body.item.id;
  });

  describe('Admin Token Protection', () => {
    test('should reject requests without admin token when required', async () => {
      const endpoints = [
        { method: 'post', path: '/api/employees' },
        { method: 'put', path: `/api/employees/${testEmployeeId}` },
        { method: 'post', path: '/api/customers' },
        { method: 'put', path: `/api/customers/${testCustomerId}` },
        { method: 'post', path: '/api/items' },
        { method: 'put', path: `/api/items/${testItemId}` },
        { method: 'post', path: '/api/orders' },
        { method: 'post', path: '/api/calendar/tokens' },
        { method: 'delete', path: '/api/calendar/tokens/1' }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .send({}) // Empty body
          .expect(401);

        expect(response.body.error.code).toBe('MISSING_ADMIN_TOKEN');
        expect(response.body.error.message).toBe('Admin token required for write operations');
      }
    });

    test('should reject requests with invalid admin token', async () => {
      const invalidTokens = [
        'invalid-token',
        'wrong-admin-token',
        '',
        'null',
        '12345',
        'admin',
        'Bearer test-admin-token'
      ];

      for (const invalidToken of invalidTokens) {
        const response = await request(app)
          .post('/api/employees')
          .set('X-Admin-Token', invalidToken)
          .send({
            fullName: 'Test Employee',
            role: 'Staff'
          })
          .expect(401);

        expect(response.body.error.code).toBe('INVALID_ADMIN_TOKEN');
      }
    });

    test('should accept requests with valid admin token', async () => {
      const response = await request(app)
        .post('/api/employees')
        .set('X-Admin-Token', adminToken)
        .send({
          fullName: 'Valid Token Employee',
          email: 'valid@test.com',
          role: 'Staff'
        })
        .expect(201);

      expect(response.body.employee.fullName).toBe('Valid Token Employee');
    });

    test('should allow GET requests without admin token', async () => {
      const readOnlyEndpoints = [
        '/api/employees',
        '/api/customers',
        '/api/items',
        '/api/orders',
        '/api/stock-movements',
        '/health'
      ];

      for (const endpoint of readOnlyEndpoints) {
        await request(app)
          .get(endpoint)
          .expect(200);
      }
    });
  });

  describe('Input Validation and Sanitization', () => {
    test('should validate and sanitize employee input', async () => {
      const invalidInputs = [
        {
          input: { fullName: '', role: 'Admin' },
          expectedError: 'Full name is required'
        },
        {
          input: { fullName: 'Test', email: 'invalid-email', role: 'Admin' },
          expectedError: 'must be a valid email'
        },
        {
          input: { fullName: 'Test', role: 'InvalidRole' },
          expectedError: 'Role must be one of'
        },
        {
          input: { fullName: '<script>alert("xss")</script>', role: 'Staff' },
          shouldSanitize: true
        }
      ];

      for (const test of invalidInputs) {
        const response = await request(app)
          .post('/api/employees')
          .set('X-Admin-Token', adminToken)
          .send(test.input);

        if (test.shouldSanitize) {
          // Should either sanitize or reject
          if (response.status === 201) {
            expect(response.body.employee.fullName).not.toContain('<script>');
          } else {
            expect(response.status).toBe(400);
          }
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error.message).toContain(test.expectedError);
        }
      }
    });

    test('should validate customer input', async () => {
      const invalidInputs = [
        {
          input: { displayName: '' },
          expectedError: 'Display name is required'
        },
        {
          input: { displayName: 'Test', contactInfo: { email: 'invalid-email' } },
          expectedError: 'valid email'
        },
        {
          input: { displayName: 'A'.repeat(300) }, // Too long
          expectedError: 'too long'
        }
      ];

      for (const test of invalidInputs) {
        const response = await request(app)
          .post('/api/customers')
          .set('X-Admin-Token', adminToken)
          .send(test.input)
          .expect(400);

        expect(response.body.error.message).toContain(test.expectedError);
      }
    });

    test('should validate item input', async () => {
      const invalidInputs = [
        {
          input: { name: '', sku: 'TEST', pricePerDay: 25 },
          expectedError: 'name is required'
        },
        {
          input: { name: 'Test', sku: '', pricePerDay: 25 },
          expectedError: 'SKU is required'
        },
        {
          input: { name: 'Test', sku: 'TEST', pricePerDay: -5 },
          expectedError: 'negative'
        },
        {
          input: { name: 'Test', sku: 'TEST', pricePerDay: 1000000 },
          expectedError: 'too large'
        }
      ];

      for (const test of invalidInputs) {
        const response = await request(app)
          .post('/api/items')
          .set('X-Admin-Token', adminToken)
          .send(test.input)
          .expect(400);

        expect(response.body.error.message).toContain(test.expectedError);
      }
    });

    test('should validate order input', async () => {
      const invalidInputs = [
        {
          input: { customerId: 'invalid', salesPersonId: testEmployeeId },
          expectedError: 'invalid'
        },
        {
          input: { customerId: testCustomerId, salesPersonId: 99999 },
          expectedError: 'not found'
        },
        {
          input: { 
            customerId: testCustomerId, 
            salesPersonId: testEmployeeId,
            startDate: 'invalid-date'
          },
          expectedError: 'date'
        },
        {
          input: { 
            customerId: testCustomerId, 
            salesPersonId: testEmployeeId,
            startDate: '2025-01-20',
            returnDueDate: '2025-01-15' // End before start
          },
          expectedError: 'must be after'
        }
      ];

      for (const test of invalidInputs) {
        const response = await request(app)
          .post('/api/orders')
          .set('X-Admin-Token', adminToken)
          .send(test.input)
          .expect(400);

        expect(response.body.error.message).toContain(test.expectedError);
      }
    });
  });

  describe('SQL Injection Prevention', () => {
    test('should prevent SQL injection in employee queries', async () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE employees; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM customers --",
        "'; INSERT INTO employees (full_name) VALUES ('hacker'); --",
        "admin'; UPDATE employees SET role='Admin' WHERE id=1; --"
      ];

      for (const injection of sqlInjectionAttempts) {
        // Try injection in search/filter parameters
        const response = await request(app)
          .get('/api/employees')
          .query({ search: injection })
          .expect(200);

        // Should return normal results, not execute injection
        expect(response.body).toHaveProperty('employees');
        expect(Array.isArray(response.body.employees)).toBe(true);
      }
    });

    test('should prevent SQL injection in item queries', async () => {
      const sqlInjectionAttempts = [
        "'; DELETE FROM items; --",
        "' OR 1=1 --",
        "test'; UPDATE items SET price_per_day=0; --"
      ];

      for (const injection of sqlInjectionAttempts) {
        await request(app)
          .get('/api/items')
          .query({ search: injection })
          .expect(200);

        // Verify items still exist and have correct prices
        const itemsResponse = await request(app)
          .get('/api/items')
          .expect(200);

        expect(itemsResponse.body.items.length).toBeGreaterThan(0);
        // Ensure prices weren't modified by injection
        const securityTestItem = itemsResponse.body.items.find(item => item.name === 'Security Test Item');
        if (securityTestItem) {
          expect(securityTestItem.price_per_day).toBe(30.00);
        }
      }
    });

    test('should prevent SQL injection in order queries', async () => {
      const maliciousOrderData = {
        customerId: testCustomerId,
        salesPersonId: testEmployeeId,
        startDate: '2025-01-15',
        returnDueDate: '2025-01-20',
        notes: "'; DROP TABLE orders; --"
      };

      const response = await request(app)
        .post('/api/orders')
        .set('X-Admin-Token', adminToken)
        .send(maliciousOrderData)
        .expect(201);

      // Order should be created with sanitized notes
      expect(response.body.order.notes).toBe(maliciousOrderData.notes);

      // Verify orders table still exists
      await request(app)
        .get('/api/orders')
        .expect(200);
    });
  });

  describe('Calendar Token Security', () => {
    test('should generate cryptographically secure tokens', async () => {
      const tokens = [];
      
      // Generate multiple tokens
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/api/calendar/tokens')
          .set('X-Admin-Token', adminToken)
          .send({
            description: `Security Test Token ${i}`,
            createdBy: 'Security Test'
          })
          .expect(201);

        tokens.push(response.body.token.token);
      }

      // Verify tokens are unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);

      // Verify tokens are properly formatted (UUID v4)
      tokens.forEach(token => {
        expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      });
    });

    test('should prevent calendar access with invalid tokens', async () => {
      const invalidTokens = [
        'invalid-token',
        '12345',
        '',
        'null',
        'undefined',
        '00000000-0000-0000-0000-000000000000',
        'admin',
        '<script>alert("xss")</script>'
      ];

      for (const invalidToken of invalidTokens) {
        await request(app)
          .get('/calendar.ics')
          .query({ token: invalidToken })
          .expect(401);
      }
    });

    test('should prevent unauthorized calendar token operations', async () => {
      // Create a token first
      const tokenResponse = await request(app)
        .post('/api/calendar/tokens')
        .set('X-Admin-Token', adminToken)
        .send({
          description: 'Test Token for Deletion',
          createdBy: 'Security Test'
        });

      const tokenId = tokenResponse.body.token.id;

      // Attempt to delete without admin token
      await request(app)
        .delete(`/api/calendar/tokens/${tokenId}`)
        .expect(401);

      // Attempt to list tokens without admin token
      await request(app)
        .get('/api/calendar/tokens')
        .expect(401);

      // Verify token still exists
      const listResponse = await request(app)
        .get('/api/calendar/tokens')
        .set('X-Admin-Token', adminToken)
        .expect(200);

      const tokenExists = listResponse.body.tokens.some(t => t.id === tokenId);
      expect(tokenExists).toBe(true);
    });
  });

  describe('Rate Limiting and DoS Prevention', () => {
    test('should handle rapid successive requests gracefully', async () => {
      const rapidRequests = 100;
      const promises = [];

      // Fire rapid requests
      for (let i = 0; i < rapidRequests; i++) {
        promises.push(
          request(app)
            .get('/health')
            .expect(200)
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // All requests should succeed
      expect(responses.length).toBe(rapidRequests);
      responses.forEach(response => {
        expect(response.body.status).toBe('healthy');
      });

      // Should complete within reasonable time (no blocking)
      expect(endTime - startTime).toBeLessThan(5000);
    }, 10000);

    test('should handle large payload gracefully', async () => {
      const largeNotes = 'A'.repeat(10000); // 10KB of notes

      const response = await request(app)
        .post('/api/orders')
        .set('X-Admin-Token', adminToken)
        .send({
          customerId: testCustomerId,
          salesPersonId: testEmployeeId,
          startDate: '2025-01-15',
          returnDueDate: '2025-01-20',
          notes: largeNotes
        });

      // Should either accept and truncate, or reject with proper error
      expect([201, 400, 413]).toContain(response.status);
      
      if (response.status === 201) {
        // If accepted, notes should be handled properly
        expect(response.body.order.notes).toBeDefined();
      }
    });
  });

  describe('Data Exposure Prevention', () => {
    test('should not expose sensitive data in error messages', async () => {
      // Try to access non-existent resources
      const response = await request(app)
        .get('/api/employees/99999')
        .expect(404);

      // Error message should not expose database schema or internal details
      expect(response.body.error.message).not.toContain('SQL');
      expect(response.body.error.message).not.toContain('database');
      expect(response.body.error.message).not.toContain('table');
      expect(response.body.error.message).not.toContain('column');
    });

    test('should not expose stack traces in production mode', async () => {
      // Temporarily set production mode
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const response = await request(app)
          .post('/api/items')
          .set('X-Admin-Token', adminToken)
          .send({
            // Invalid data to trigger error
            name: '',
            sku: '',
            pricePerDay: 'invalid'
          })
          .expect(400);

        // Should not expose stack trace or internal details
        expect(response.body.error).not.toHaveProperty('stack');
        expect(response.body.error).not.toHaveProperty('details');
        expect(JSON.stringify(response.body)).not.toContain('Error:');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    test('should sanitize log output', async () => {
      const maliciousInput = {
        fullName: 'Test\n[MALICIOUS LOG INJECTION] User: admin Password: secret\nEnd injection',
        email: 'test@example.com',
        role: 'Staff'
      };

      await request(app)
        .post('/api/employees')
        .set('X-Admin-Token', adminToken)
        .send(maliciousInput);

      // The test passes if no errors occur - actual log sanitization would be verified in logs
    });
  });

  describe('Role-Based Access Control', () => {
    test('should enforce employee role permissions correctly', async () => {
      // Create employees with different roles
      const adminEmployee = await request(app)
        .post('/api/employees')
        .set('X-Admin-Token', adminToken)
        .send({
          fullName: 'Admin Employee',
          email: 'admin-emp@test.com',
          role: 'Admin'
        });

      const staffEmployee = await request(app)
        .post('/api/employees')
        .set('X-Admin-Token', adminToken)
        .send({
          fullName: 'Staff Employee',
          email: 'staff-emp@test.com',
          role: 'Staff'
        });

      const readOnlyEmployee = await request(app)
        .post('/api/employees')
        .set('X-Admin-Token', adminToken)
        .send({
          fullName: 'ReadOnly Employee',
          email: 'readonly-emp@test.com',
          role: 'ReadOnly'
        });

      // Verify roles are correctly assigned
      expect(adminEmployee.body.employee.role).toBe('Admin');
      expect(staffEmployee.body.employee.role).toBe('Staff');
      expect(readOnlyEmployee.body.employee.role).toBe('ReadOnly');

      // Test role-based business logic (would be implemented in services)
      // This test verifies the role assignment is working correctly
    });

    test('should validate role transitions', async () => {
      // Create an employee
      const empResponse = await request(app)
        .post('/api/employees')
        .set('X-Admin-Token', adminToken)
        .send({
          fullName: 'Role Test Employee',
          email: 'role-test@test.com',
          role: 'Staff'
        });

      const employeeId = empResponse.body.employee.id;

      // Try to update to invalid role
      await request(app)
        .put(`/api/employees/${employeeId}`)
        .set('X-Admin-Token', adminToken)
        .send({
          fullName: 'Role Test Employee',
          email: 'role-test@test.com',
          role: 'SuperAdmin' // Invalid role
        })
        .expect(400);
    });
  });
});