const request = require('supertest');
const app = require('../../server');

describe('Order Workflow Integration Tests', () => {
  const adminToken = 'test-admin-token';
  let testEmployeeId, testCustomerId, testAtomicItemId, testCompositeItemId;
  
  beforeAll(async () => {
    process.env.X_ADMIN_TOKEN = adminToken;
    process.env.NODE_ENV = 'test';
  });

  beforeEach(async () => {
    // Create test data for each test
    // Create test employee
    const employeeResponse = await request(app)
      .post('/api/employees')
      .set('X-Admin-Token', adminToken)
      .send({
        fullName: 'Test Sales Person',
        email: 'sales@test.com',
        role: 'Staff'
      });
    testEmployeeId = employeeResponse.body.employee.id;

    // Create test customer
    const customerResponse = await request(app)
      .post('/api/customers')
      .set('X-Admin-Token', adminToken)
      .send({
        displayName: 'Test Customer Corp',
        contactInfo: {
          email: 'customer@test.com',
          phone: '555-1234'
        }
      });
    testCustomerId = customerResponse.body.customer.id;

    // Create test atomic item
    const atomicItemResponse = await request(app)
      .post('/api/items')
      .set('X-Admin-Token', adminToken)
      .send({
        name: 'Test Laptop',
        sku: 'LAPTOP-TEST-001',
        pricePerDay: 25.00,
        isComposite: false,
        quantityOnHand: 10
      });
    testAtomicItemId = atomicItemResponse.body.item.id;

    // Create test composite item
    const compositeItemResponse = await request(app)
      .post('/api/items')
      .set('X-Admin-Token', adminToken)
      .send({
        name: 'Test Workstation Bundle',
        sku: 'BUNDLE-TEST-001',
        pricePerDay: 45.00,
        isComposite: true
      });
    testCompositeItemId = compositeItemResponse.body.item.id;

    // Add atomic item as component of composite item
    await request(app)
      .post(`/api/items/${testCompositeItemId}/components`)
      .set('X-Admin-Token', adminToken)
      .send({
        childId: testAtomicItemId,
        quantity: 2
      });
  });

  describe('Complete Order Lifecycle', () => {
    test('should complete full order workflow from creation to return', async () => {
      // Step 1: Create order in Draft status
      const createOrderResponse = await request(app)
        .post('/api/orders')
        .set('X-Admin-Token', adminToken)
        .send({
          customerId: testCustomerId,
          salesPersonId: testEmployeeId,
          startDate: '2025-01-15',
          returnDueDate: '2025-01-20',
          notes: 'Test order for integration testing'
        })
        .expect(201);

      const orderId = createOrderResponse.body.order.id;
      expect(createOrderResponse.body.order.status).toBe('Draft');

      // Step 2: Add line items to order
      const addLineResponse = await request(app)
        .post(`/api/orders/${orderId}/lines`)
        .set('X-Admin-Token', adminToken)
        .send({
          itemId: testAtomicItemId,
          quantity: 3,
          pricePerDay: 25.00
        })
        .expect(201);

      expect(addLineResponse.body.lineItem.quantity).toBe(3);

      // Step 3: Check order availability
      const availabilityResponse = await request(app)
        .get(`/api/orders/${orderId}/availability`)
        .expect(200);

      expect(availabilityResponse.body.isAvailable).toBe(true);

      // Step 4: Transition to Reserved status
      const reserveResponse = await request(app)
        .post(`/api/orders/${orderId}/transition`)
        .set('X-Admin-Token', adminToken)
        .send({
          newStatus: 'Reserved',
          createdBy: 'Test System'
        })
        .expect(200);

      expect(reserveResponse.body.order.status).toBe('Reserved');

      // Verify stock movement was created
      const stockMovementsResponse = await request(app)
        .get('/api/stock-movements')
        .query({ orderId: orderId })
        .expect(200);

      const reserveMovements = stockMovementsResponse.body.movements.filter(m => m.reason === 'reserve');
      expect(reserveMovements).toHaveLength(1);
      expect(reserveMovements[0].delta).toBe(-3);

      // Step 5: Transition to Checked Out status
      const checkoutResponse = await request(app)
        .post(`/api/orders/${orderId}/transition`)
        .set('X-Admin-Token', adminToken)
        .send({
          newStatus: 'Checked Out',
          createdBy: 'Test System'
        })
        .expect(200);

      expect(checkoutResponse.body.order.status).toBe('Checked Out');

      // Step 6: Transition to Returned status
      const returnResponse = await request(app)
        .post(`/api/orders/${orderId}/transition`)
        .set('X-Admin-Token', adminToken)
        .send({
          newStatus: 'Returned',
          createdBy: 'Test System'
        })
        .expect(200);

      expect(returnResponse.body.order.status).toBe('Returned');

      // Verify return stock movement was created
      const finalStockMovements = await request(app)
        .get('/api/stock-movements')
        .query({ orderId: orderId })
        .expect(200);

      const returnMovements = finalStockMovements.body.movements.filter(m => m.reason === 'return');
      expect(returnMovements).toHaveLength(1);
      expect(returnMovements[0].delta).toBe(3); // Positive delta for return
    });

    test('should handle order cancellation properly', async () => {
      // Create and reserve order
      const createResponse = await request(app)
        .post('/api/orders')
        .set('X-Admin-Token', adminToken)
        .send({
          customerId: testCustomerId,
          salesPersonId: testEmployeeId,
          startDate: '2025-01-15',
          returnDueDate: '2025-01-20'
        });

      const orderId = createResponse.body.order.id;

      await request(app)
        .post(`/api/orders/${orderId}/lines`)
        .set('X-Admin-Token', adminToken)
        .send({
          itemId: testAtomicItemId,
          quantity: 2,
          pricePerDay: 25.00
        });

      await request(app)
        .post(`/api/orders/${orderId}/transition`)
        .set('X-Admin-Token', adminToken)
        .send({
          newStatus: 'Reserved',
          createdBy: 'Test System'
        });

      // Cancel the order
      const cancelResponse = await request(app)
        .post(`/api/orders/${orderId}/transition`)
        .set('X-Admin-Token', adminToken)
        .send({
          newStatus: 'Cancelled',
          createdBy: 'Test System'
        })
        .expect(200);

      expect(cancelResponse.body.order.status).toBe('Cancelled');

      // Verify release stock movement was created
      const stockMovements = await request(app)
        .get('/api/stock-movements')
        .query({ orderId: orderId });

      const releaseMovements = stockMovements.body.movements.filter(m => m.reason === 'release');
      expect(releaseMovements).toHaveLength(1);
      expect(releaseMovements[0].delta).toBe(2); // Positive delta for release
    });
  });

  describe('PDF Receipt Generation', () => {
    test('should generate PDF receipt for completed order', async () => {
      // Create and complete an order
      const orderResponse = await request(app)
        .post('/api/orders')
        .set('X-Admin-Token', adminToken)
        .send({
          customerId: testCustomerId,
          salesPersonId: testEmployeeId,
          startDate: '2025-01-15',
          returnDueDate: '2025-01-20',
          notes: 'PDF receipt test order'
        });

      const orderId = orderResponse.body.order.id;

      // Add multiple line items
      await request(app)
        .post(`/api/orders/${orderId}/lines`)
        .set('X-Admin-Token', adminToken)
        .send({
          itemId: testAtomicItemId,
          quantity: 2,
          pricePerDay: 25.00
        });

      await request(app)
        .post(`/api/orders/${orderId}/lines`)
        .set('X-Admin-Token', adminToken)
        .send({
          itemId: testCompositeItemId,
          quantity: 1,
          pricePerDay: 45.00
        });

      // Transition to Reserved status (minimum required for receipt)
      await request(app)
        .post(`/api/orders/${orderId}/transition`)
        .set('X-Admin-Token', adminToken)
        .send({
          newStatus: 'Reserved',
          createdBy: 'Test System'
        });

      // Generate PDF receipt
      const receiptResponse = await request(app)
        .get(`/api/orders/${orderId}/receipt`)
        .set('X-Admin-Token', adminToken)
        .expect(200);

      expect(receiptResponse.headers['content-type']).toBe('application/pdf');
      expect(receiptResponse.headers['content-disposition']).toContain(`order-${orderId}.pdf`);
      expect(receiptResponse.body.length).toBeGreaterThan(1000); // PDF should have substantial content
    });

    test('should not generate receipt for Draft orders', async () => {
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

      // Try to generate receipt for Draft order
      await request(app)
        .get(`/api/orders/${orderId}/receipt`)
        .set('X-Admin-Token', adminToken)
        .expect(400);
    });
  });

  describe('Availability Conflict Detection', () => {
    test('should detect and prevent overlapping reservations', async () => {
      // Create first order with reservation
      const order1Response = await request(app)
        .post('/api/orders')
        .set('X-Admin-Token', adminToken)
        .send({
          customerId: testCustomerId,
          salesPersonId: testEmployeeId,
          startDate: '2025-01-15',
          returnDueDate: '2025-01-20'
        });

      const order1Id = order1Response.body.order.id;

      await request(app)
        .post(`/api/orders/${order1Id}/lines`)
        .set('X-Admin-Token', adminToken)
        .send({
          itemId: testAtomicItemId,
          quantity: 8, // Reserve 8 out of 10 available
          pricePerDay: 25.00
        });

      await request(app)
        .post(`/api/orders/${order1Id}/transition`)
        .set('X-Admin-Token', adminToken)
        .send({
          newStatus: 'Reserved',
          createdBy: 'Test System'
        });

      // Create second order with overlapping dates
      const order2Response = await request(app)
        .post('/api/orders')
        .set('X-Admin-Token', adminToken)
        .send({
          customerId: testCustomerId,
          salesPersonId: testEmployeeId,
          startDate: '2025-01-17', // Overlaps with first order
          returnDueDate: '2025-01-22'
        });

      const order2Id = order2Response.body.order.id;

      await request(app)
        .post(`/api/orders/${order2Id}/lines`)
        .set('X-Admin-Token', adminToken)
        .send({
          itemId: testAtomicItemId,
          quantity: 5, // Would exceed available quantity (only 2 left)
          pricePerDay: 25.00
        });

      // Attempt to reserve should fail due to availability conflict
      const conflictResponse = await request(app)
        .post(`/api/orders/${order2Id}/transition`)
        .set('X-Admin-Token', adminToken)
        .send({
          newStatus: 'Reserved',
          createdBy: 'Test System'
        })
        .expect(409); // Conflict status

      expect(conflictResponse.body.error.code).toBe('AVAILABILITY_CONFLICT');
    });
  });

  describe('Composite Item Availability', () => {
    test('should calculate composite item availability correctly', async () => {
      // Check availability of composite item
      const availabilityResponse = await request(app)
        .get(`/api/items/${testCompositeItemId}/availability`)
        .query({
          startDate: '2025-01-15',
          endDate: '2025-01-20'
        })
        .expect(200);

      // Composite item has 2x atomic items as components, atomic item has 10 on hand
      // So composite should have floor(10/2) = 5 available
      expect(availabilityResponse.body.availableQuantity).toBe(5);

      // Create order that uses some atomic items
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
          itemId: testAtomicItemId,
          quantity: 4, // Use 4 atomic items directly
          pricePerDay: 25.00
        });

      await request(app)
        .post(`/api/orders/${orderId}/transition`)
        .set('X-Admin-Token', adminToken)
        .send({
          newStatus: 'Reserved',
          createdBy: 'Test System'
        });

      // Check composite availability again
      const updatedAvailabilityResponse = await request(app)
        .get(`/api/items/${testCompositeItemId}/availability`)
        .query({
          startDate: '2025-01-15',
          endDate: '2025-01-20'
        });

      // Now only 6 atomic items available, so composite should have floor(6/2) = 3
      expect(updatedAvailabilityResponse.body.availableQuantity).toBe(3);
    });
  });

  describe('Stock Movement Automation', () => {
    test('should automatically create stock movements across all status transitions', async () => {
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
          itemId: testAtomicItemId,
          quantity: 3,
          pricePerDay: 25.00
        });

      // Reserve
      await request(app)
        .post(`/api/orders/${orderId}/transition`)
        .set('X-Admin-Token', adminToken)
        .send({ newStatus: 'Reserved', createdBy: 'Test System' });

      // Check reserve movement
      let movements = await request(app).get('/api/stock-movements').query({ orderId });
      let reserveMovements = movements.body.movements.filter(m => m.reason === 'reserve');
      expect(reserveMovements).toHaveLength(1);
      expect(reserveMovements[0].delta).toBe(-3);

      // Checkout
      await request(app)
        .post(`/api/orders/${orderId}/transition`)
        .set('X-Admin-Token', adminToken)
        .send({ newStatus: 'Checked Out', createdBy: 'Test System' });

      // Check checkout movement
      movements = await request(app).get('/api/stock-movements').query({ orderId });
      let checkoutMovements = movements.body.movements.filter(m => m.reason === 'checkout');
      expect(checkoutMovements).toHaveLength(1);
      expect(checkoutMovements[0].delta).toBe(-3);

      // Return
      await request(app)
        .post(`/api/orders/${orderId}/transition`)
        .set('X-Admin-Token', adminToken)
        .send({ newStatus: 'Returned', createdBy: 'Test System' });

      // Check return movement
      movements = await request(app).get('/api/stock-movements').query({ orderId });
      let returnMovements = movements.body.movements.filter(m => m.reason === 'return');
      expect(returnMovements).toHaveLength(1);
      expect(returnMovements[0].delta).toBe(3);

      // Verify total movements for this order
      expect(movements.body.movements.filter(m => m.orderId === orderId)).toHaveLength(3);
    });
  });
});