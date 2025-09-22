const request = require('supertest');
const app = require('../../server');

describe('Calendar Integration Tests', () => {
  const adminToken = 'test-admin-token';
  let testEmployeeId, testCustomerId, testItemId, testTokenId;
  
  beforeAll(async () => {
    process.env.X_ADMIN_TOKEN = adminToken;
    process.env.NODE_ENV = 'test';
  });

  beforeEach(async () => {
    // Create test data
    const employeeResponse = await request(app)
      .post('/api/employees')
      .set('X-Admin-Token', adminToken)
      .send({
        fullName: 'Calendar Test Employee',
        email: 'calendar@test.com',
        role: 'Staff'
      });
    testEmployeeId = employeeResponse.body.employee.id;

    const customerResponse = await request(app)
      .post('/api/customers')
      .set('X-Admin-Token', adminToken)
      .send({
        displayName: 'Calendar Test Customer',
        contactInfo: { email: 'calendar-customer@test.com' }
      });
    testCustomerId = customerResponse.body.customer.id;

    const itemResponse = await request(app)
      .post('/api/items')
      .set('X-Admin-Token', adminToken)
      .send({
        name: 'Calendar Test Item',
        sku: 'CAL-TEST-001',
        pricePerDay: 30.00,
        isComposite: false,
        quantityOnHand: 5
      });
    testItemId = itemResponse.body.item.id;
  });

  describe('Calendar Token Management', () => {
    test('should create calendar token', async () => {
      const response = await request(app)
        .post('/api/calendar/tokens')
        .set('X-Admin-Token', adminToken)
        .send({
          description: 'Test Calendar Token',
          createdBy: 'Test System'
        })
        .expect(201);

      expect(response.body.token.description).toBe('Test Calendar Token');
      expect(response.body.token.token).toMatch(/^[a-f0-9-]{36}$/); // UUID format
      testTokenId = response.body.token.id;
    });

    test('should list calendar tokens', async () => {
      // Create a token first
      await request(app)
        .post('/api/calendar/tokens')
        .set('X-Admin-Token', adminToken)
        .send({
          description: 'List Test Token',
          createdBy: 'Test System'
        });

      const response = await request(app)
        .get('/api/calendar/tokens')
        .expect(200);

      expect(response.body.tokens).toBeInstanceOf(Array);
      expect(response.body.tokens.length).toBeGreaterThan(0);
      expect(response.body.tokens[0]).toHaveProperty('description');
      expect(response.body.tokens[0]).toHaveProperty('token');
      expect(response.body.tokens[0]).toHaveProperty('created_at');
    });

    test('should revoke calendar token', async () => {
      // Create a token first
      const createResponse = await request(app)
        .post('/api/calendar/tokens')
        .set('X-Admin-Token', adminToken)
        .send({
          description: 'Token to Revoke',
          createdBy: 'Test System'
        });

      const tokenId = createResponse.body.token.id;

      // Revoke the token
      await request(app)
        .delete(`/api/calendar/tokens/${tokenId}`)
        .set('X-Admin-Token', adminToken)
        .expect(200);

      // Verify token is no longer in the list
      const listResponse = await request(app)
        .get('/api/calendar/tokens')
        .expect(200);

      const revokedToken = listResponse.body.tokens.find(t => t.id === tokenId);
      expect(revokedToken).toBeUndefined();
    });
  });

  describe('ICS Feed Generation', () => {
    test('should generate ICS feed with valid token', async () => {
      // Create calendar token
      const tokenResponse = await request(app)
        .post('/api/calendar/tokens')
        .set('X-Admin-Token', adminToken)
        .send({
          description: 'ICS Test Token',
          createdBy: 'Test System'
        });

      const token = tokenResponse.body.token.token;

      // Create some orders for the calendar
      const order1Response = await request(app)
        .post('/api/orders')
        .set('X-Admin-Token', adminToken)
        .send({
          customerId: testCustomerId,
          salesPersonId: testEmployeeId,
          startDate: '2025-01-15',
          returnDueDate: '2025-01-20',
          notes: 'First calendar test order'
        });

      const order1Id = order1Response.body.order.id;

      await request(app)
        .post(`/api/orders/${order1Id}/lines`)
        .set('X-Admin-Token', adminToken)
        .send({
          itemId: testItemId,
          quantity: 2,
          pricePerDay: 30.00
        });

      await request(app)
        .post(`/api/orders/${order1Id}/transition`)
        .set('X-Admin-Token', adminToken)
        .send({
          newStatus: 'Reserved',
          createdBy: 'Test System'
        });

      // Generate ICS feed
      const icsResponse = await request(app)
        .get('/calendar.ics')
        .query({ token })
        .expect(200);

      expect(icsResponse.headers['content-type']).toBe('text/calendar; charset=utf-8');
      expect(icsResponse.text).toContain('BEGIN:VCALENDAR');
      expect(icsResponse.text).toContain('END:VCALENDAR');
      expect(icsResponse.text).toContain('BEGIN:VEVENT');
      expect(icsResponse.text).toContain('END:VEVENT');
      expect(icsResponse.text).toContain('Calendar Test Customer'); // Customer name should be in the event
      expect(icsResponse.text).toContain('Reserved'); // Status should be included
    });

    test('should reject ICS feed request with invalid token', async () => {
      await request(app)
        .get('/calendar.ics')
        .query({ token: 'invalid-token-123' })
        .expect(401);
    });

    test('should include different order statuses with color coding', async () => {
      // Create calendar token
      const tokenResponse = await request(app)
        .post('/api/calendar/tokens')
        .set('X-Admin-Token', adminToken)
        .send({
          description: 'Status Test Token',
          createdBy: 'Test System'
        });

      const token = tokenResponse.body.token.token;

      // Create orders with different statuses
      const statuses = ['Draft', 'Reserved', 'Checked Out'];
      const orderIds = [];

      for (let i = 0; i < statuses.length; i++) {
        const status = statuses[i];
        const orderResponse = await request(app)
          .post('/api/orders')
          .set('X-Admin-Token', adminToken)
          .send({
            customerId: testCustomerId,
            salesPersonId: testEmployeeId,
            startDate: `2025-01-${15 + i * 2}`,
            returnDueDate: `2025-01-${20 + i * 2}`,
            notes: `${status} test order`
          });

        const orderId = orderResponse.body.order.id;
        orderIds.push(orderId);

        await request(app)
          .post(`/api/orders/${orderId}/lines`)
          .set('X-Admin-Token', adminToken)
          .send({
            itemId: testItemId,
            quantity: 1,
            pricePerDay: 30.00
          });

        // Transition to desired status (if not Draft)
        if (status !== 'Draft') {
          await request(app)
            .post(`/api/orders/${orderId}/transition`)
            .set('X-Admin-Token', adminToken)
            .send({
              newStatus: 'Reserved',
              createdBy: 'Test System'
            });
        }

        if (status === 'Checked Out') {
          await request(app)
            .post(`/api/orders/${orderId}/transition`)
            .set('X-Admin-Token', adminToken)
            .send({
              newStatus: 'Checked Out',
              createdBy: 'Test System'
            });
        }
      }

      // Generate ICS feed
      const icsResponse = await request(app)
        .get('/calendar.ics')
        .query({ token });

      // Verify all statuses are included
      expect(icsResponse.text).toContain('Draft');
      expect(icsResponse.text).toContain('Reserved');
      expect(icsResponse.text).toContain('Checked Out');

      // Verify multiple events are present
      const eventCount = (icsResponse.text.match(/BEGIN:VEVENT/g) || []).length;
      expect(eventCount).toBe(statuses.length);
    });
  });

  describe('ICS Feed Caching', () => {
    test('should cache ICS feed responses', async () => {
      // Create calendar token
      const tokenResponse = await request(app)
        .post('/api/calendar/tokens')
        .set('X-Admin-Token', adminToken)
        .send({
          description: 'Cache Test Token',
          createdBy: 'Test System'
        });

      const token = tokenResponse.body.token.token;

      // Create an order
      const orderResponse = await request(app)
        .post('/api/orders')
        .set('X-Admin-Token', adminToken)
        .send({
          customerId: testCustomerId,
          salesPersonId: testEmployeeId,
          startDate: '2025-01-15',
          returnDueDate: '2025-01-20'
        });

      const orderId = orderResponse.body.order.id;

      await request(app)
        .post(`/api/orders/${orderId}/lines`)
        .set('X-Admin-Token', adminToken)
        .send({
          itemId: testItemId,
          quantity: 1,
          pricePerDay: 30.00
        });

      await request(app)
        .post(`/api/orders/${orderId}/transition`)
        .set('X-Admin-Token', adminToken)
        .send({
          newStatus: 'Reserved',
          createdBy: 'Test System'
        });

      // First request - should generate fresh
      const firstResponse = await request(app)
        .get('/calendar.ics')
        .query({ token })
        .expect(200);

      const firstGeneratedTime = firstResponse.headers['x-generated-at'] || firstResponse.headers['date'];

      // Second request immediately after - should be cached
      const secondResponse = await request(app)
        .get('/calendar.ics')
        .query({ token })
        .expect(200);

      // Content should be identical
      expect(firstResponse.text).toBe(secondResponse.text);

      // Wait a moment and modify an order to test cache invalidation
      await new Promise(resolve => setTimeout(resolve, 100));

      await request(app)
        .post(`/api/orders/${orderId}/transition`)
        .set('X-Admin-Token', adminToken)
        .send({
          newStatus: 'Checked Out',
          createdBy: 'Test System'
        });

      // Third request after modification - should be regenerated
      const thirdResponse = await request(app)
        .get('/calendar.ics')
        .query({ token })
        .expect(200);

      // Content should now include the status change
      expect(thirdResponse.text).toContain('Checked Out');
      expect(thirdResponse.text).not.toBe(firstResponse.text);
    });
  });

  describe('Calendar Token Security', () => {
    test('should require admin token for token management operations', async () => {
      // Creating token without admin token should fail
      await request(app)
        .post('/api/calendar/tokens')
        .send({
          description: 'Unauthorized Token',
          createdBy: 'Test System'
        })
        .expect(401);

      // Listing tokens without admin token should fail
      await request(app)
        .get('/api/calendar/tokens')
        .expect(401);

      // Deleting token without admin token should fail
      await request(app)
        .delete('/api/calendar/tokens/1')
        .expect(401);
    });

    test('should update token last_used_at when accessing ICS feed', async () => {
      // Create calendar token
      const tokenResponse = await request(app)
        .post('/api/calendar/tokens')
        .set('X-Admin-Token', adminToken)
        .send({
          description: 'Usage Tracking Token',
          createdBy: 'Test System'
        });

      const tokenId = tokenResponse.body.token.id;
      const token = tokenResponse.body.token.token;

      // Access ICS feed
      await request(app)
        .get('/calendar.ics')
        .query({ token })
        .expect(200);

      // Check that last_used_at was updated
      const tokensResponse = await request(app)
        .get('/api/calendar/tokens')
        .set('X-Admin-Token', adminToken)
        .expect(200);

      const usedToken = tokensResponse.body.tokens.find(t => t.id === tokenId);
      expect(usedToken.last_used_at).not.toBeNull();
      expect(new Date(usedToken.last_used_at).getTime()).toBeGreaterThan(
        new Date(usedToken.created_at).getTime()
      );
    });
  });

  describe('Calendar Integration with Order Events', () => {
    test('should include order financial information in calendar events', async () => {
      // Create calendar token
      const tokenResponse = await request(app)
        .post('/api/calendar/tokens')
        .set('X-Admin-Token', adminToken)
        .send({
          description: 'Financial Info Token',
          createdBy: 'Test System'
        });

      const token = tokenResponse.body.token.token;

      // Create order with multiple line items
      const orderResponse = await request(app)
        .post('/api/orders')
        .set('X-Admin-Token', adminToken)
        .send({
          customerId: testCustomerId,
          salesPersonId: testEmployeeId,
          startDate: '2025-01-15',
          returnDueDate: '2025-01-20',
          discount: 50.00,
          tax: 25.00
        });

      const orderId = orderResponse.body.order.id;

      // Add multiple line items
      await request(app)
        .post(`/api/orders/${orderId}/lines`)
        .set('X-Admin-Token', adminToken)
        .send({
          itemId: testItemId,
          quantity: 2,
          pricePerDay: 30.00
        });

      await request(app)
        .post(`/api/orders/${orderId}/transition`)
        .set('X-Admin-Token', adminToken)
        .send({
          newStatus: 'Reserved',
          createdBy: 'Test System'
        });

      // Generate ICS feed
      const icsResponse = await request(app)
        .get('/calendar.ics')
        .query({ token })
        .expect(200);

      // Verify financial information is included
      expect(icsResponse.text).toContain('Total'); // Order total should be mentioned
      expect(icsResponse.text).toContain('Calendar Test Employee'); // Sales person name
      expect(icsResponse.text).toContain(`Order #${orderId}`); // Order ID
    });

    test('should handle orders with no line items gracefully', async () => {
      // Create calendar token
      const tokenResponse = await request(app)
        .post('/api/calendar/tokens')
        .set('X-Admin-Token', adminToken)
        .send({
          description: 'Empty Order Token',
          createdBy: 'Test System'
        });

      const token = tokenResponse.body.token.token;

      // Create order without line items
      await request(app)
        .post('/api/orders')
        .set('X-Admin-Token', adminToken)
        .send({
          customerId: testCustomerId,
          salesPersonId: testEmployeeId,
          startDate: '2025-01-15',
          returnDueDate: '2025-01-20'
        });

      // Generate ICS feed - should not fail
      const icsResponse = await request(app)
        .get('/calendar.ics')
        .query({ token })
        .expect(200);

      expect(icsResponse.text).toContain('BEGIN:VCALENDAR');
      expect(icsResponse.text).toContain('END:VCALENDAR');
    });
  });
});