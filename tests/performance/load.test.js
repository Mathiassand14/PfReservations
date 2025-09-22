const request = require('supertest');
const app = require('../../server');

describe('Performance Load Tests', () => {
  const adminToken = 'test-admin-token';
  let testEmployeeId, testCustomerId, testItemIds = [];
  
  beforeAll(async () => {
    process.env.X_ADMIN_TOKEN = adminToken;
    process.env.NODE_ENV = 'test';
    
    // Set up test data for load testing
    const employeeResponse = await request(app)
      .post('/api/employees')
      .set('X-Admin-Token', adminToken)
      .send({
        fullName: 'Load Test Employee',
        email: 'load@test.com',
        role: 'Staff'
      });
    testEmployeeId = employeeResponse.body.employee.id;

    const customerResponse = await request(app)
      .post('/api/customers')
      .set('X-Admin-Token', adminToken)
      .send({
        displayName: 'Load Test Customer',
        contactInfo: { email: 'loadcustomer@test.com' }
      });
    testCustomerId = customerResponse.body.customer.id;

    // Create multiple test items for concurrent testing
    for (let i = 0; i < 10; i++) {
      const itemResponse = await request(app)
        .post('/api/items')
        .set('X-Admin-Token', adminToken)
        .send({
          name: `Load Test Item ${i}`,
          sku: `LOAD-${i.toString().padStart(3, '0')}`,
          pricePerDay: 20.00 + i,
          isComposite: false,
          quantityOnHand: 100
        });
      testItemIds.push(itemResponse.body.item.id);
    }
  }, 30000); // Extended timeout for setup

  describe('Concurrent Order Operations', () => {
    test('should handle concurrent order creation', async () => {
      const concurrentRequests = 50;
      const startTime = Date.now();
      
      // Create concurrent order creation requests
      const promises = Array.from({ length: concurrentRequests }, (_, i) => {
        return request(app)
          .post('/api/orders')
          .set('X-Admin-Token', adminToken)
          .send({
            customerId: testCustomerId,
            salesPersonId: testEmployeeId,
            startDate: `2025-02-${(i % 28) + 1}`.padStart(10, '0'),
            returnDueDate: `2025-03-${(i % 28) + 1}`.padStart(10, '0'),
            notes: `Concurrent test order ${i}`
          });
      });

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.order).toBeDefined();
      });

      // Performance benchmark: should complete within reasonable time
      expect(totalTime).toBeLessThan(10000); // 10 seconds for 50 concurrent requests
      
      console.log(`Created ${concurrentRequests} orders in ${totalTime}ms (${(totalTime/concurrentRequests).toFixed(2)}ms avg per order)`);
    }, 15000);

    test('should handle concurrent availability calculations', async () => {
      const concurrentRequests = 30;
      const itemId = testItemIds[0];
      const startTime = Date.now();

      // Create concurrent availability check requests
      const promises = Array.from({ length: concurrentRequests }, (_, i) => {
        return request(app)
          .get(`/api/items/${itemId}/availability`)
          .query({
            startDate: '2025-02-15',
            endDate: '2025-02-20'
          });
      });

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.availableQuantity).toBeDefined();
      });

      // Performance benchmark
      expect(totalTime).toBeLessThan(5000); // 5 seconds for 30 concurrent requests
      
      console.log(`Completed ${concurrentRequests} availability checks in ${totalTime}ms (${(totalTime/concurrentRequests).toFixed(2)}ms avg per check)`);
    }, 10000);

    test('should handle concurrent order status transitions', async () => {
      // Create base orders first
      const baseOrders = await Promise.all(
        Array.from({ length: 20 }, (_, i) => 
          request(app)
            .post('/api/orders')
            .set('X-Admin-Token', adminToken)
            .send({
              customerId: testCustomerId,
              salesPersonId: testEmployeeId,
              startDate: '2025-02-15',
              returnDueDate: '2025-02-20',
              notes: `Status transition test order ${i}`
            })
        )
      );

      const orderIds = baseOrders.map(response => response.body.order.id);

      // Add line items to each order
      await Promise.all(
        orderIds.map((orderId, i) =>
          request(app)
            .post(`/api/orders/${orderId}/lines`)
            .set('X-Admin-Token', adminToken)
            .send({
              itemId: testItemIds[i % testItemIds.length],
              quantity: 1,
              pricePerDay: 25.00
            })
        )
      );

      // Concurrent status transitions
      const startTime = Date.now();
      const transitionPromises = orderIds.map(orderId =>
        request(app)
          .post(`/api/orders/${orderId}/transition`)
          .set('X-Admin-Token', adminToken)
          .send({
            newStatus: 'Reserved',
            createdBy: 'Load Test'
          })
      );

      const responses = await Promise.all(transitionPromises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All transitions should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.order.status).toBe('Reserved');
      });

      console.log(`Completed ${orderIds.length} status transitions in ${totalTime}ms (${(totalTime/orderIds.length).toFixed(2)}ms avg per transition)`);
    }, 15000);
  });

  describe('Calendar Feed Performance', () => {
    test('should generate ICS feed efficiently with many orders', async () => {
      // Create calendar token
      const tokenResponse = await request(app)
        .post('/api/calendar/tokens')
        .set('X-Admin-Token', adminToken)
        .send({
          description: 'Performance Test Token',
          createdBy: 'Performance Test'
        });

      const token = tokenResponse.body.token.token;

      // Create many orders for calendar testing
      const orderCount = 100;
      const orderCreationPromises = Array.from({ length: orderCount }, (_, i) =>
        request(app)
          .post('/api/orders')
          .set('X-Admin-Token', adminToken)
          .send({
            customerId: testCustomerId,
            salesPersonId: testEmployeeId,
            startDate: `2025-02-${((i % 28) + 1).toString().padStart(2, '0')}`,
            returnDueDate: `2025-03-${((i % 28) + 1).toString().padStart(2, '0')}`,
            notes: `Calendar performance test order ${i}`
          })
          .then(response => {
            const orderId = response.body.order.id;
            return request(app)
              .post(`/api/orders/${orderId}/lines`)
              .set('X-Admin-Token', adminToken)
              .send({
                itemId: testItemIds[i % testItemIds.length],
                quantity: 1,
                pricePerDay: 25.00
              })
              .then(() => 
                request(app)
                  .post(`/api/orders/${orderId}/transition`)
                  .set('X-Admin-Token', adminToken)
                  .send({
                    newStatus: 'Reserved',
                    createdBy: 'Performance Test'
                  })
              );
          })
      );

      await Promise.all(orderCreationPromises);

      // Test ICS feed generation performance
      const startTime = Date.now();
      const icsResponse = await request(app)
        .get('/calendar.ics')
        .query({ token })
        .expect(200);
      const endTime = Date.now();
      const generationTime = endTime - startTime;

      expect(icsResponse.text).toContain('BEGIN:VCALENDAR');
      expect(icsResponse.text).toContain('END:VCALENDAR');
      
      // Count events in the ICS feed
      const eventCount = (icsResponse.text.match(/BEGIN:VEVENT/g) || []).length;
      expect(eventCount).toBe(orderCount);

      // Performance benchmark: should generate within reasonable time
      expect(generationTime).toBeLessThan(5000); // 5 seconds for 100 orders
      
      console.log(`Generated ICS feed with ${eventCount} events in ${generationTime}ms`);
    }, 30000);

    test('should cache calendar feeds effectively', async () => {
      const tokenResponse = await request(app)
        .post('/api/calendar/tokens')
        .set('X-Admin-Token', adminToken)
        .send({
          description: 'Cache Performance Token',
          createdBy: 'Cache Test'
        });

      const token = tokenResponse.body.token.token;

      // First request (cache miss)
      const firstStart = Date.now();
      await request(app)
        .get('/calendar.ics')
        .query({ token })
        .expect(200);
      const firstTime = Date.now() - firstStart;

      // Multiple subsequent requests (cache hits)
      const cacheRequests = 10;
      const secondStart = Date.now();
      
      const cachePromises = Array.from({ length: cacheRequests }, () =>
        request(app)
          .get('/calendar.ics')
          .query({ token })
          .expect(200)
      );

      await Promise.all(cachePromises);
      const cacheTime = Date.now() - secondStart;
      const avgCacheTime = cacheTime / cacheRequests;

      // Cached requests should be significantly faster
      expect(avgCacheTime).toBeLessThan(firstTime * 0.5); // At least 50% faster when cached
      
      console.log(`First generation: ${firstTime}ms, Cached average: ${avgCacheTime.toFixed(2)}ms (${((firstTime - avgCacheTime) / firstTime * 100).toFixed(1)}% faster)`);
    }, 10000);
  });

  describe('Database Performance', () => {
    test('should handle large dataset queries efficiently', async () => {
      // Test large list operations
      const startTime = Date.now();
      
      const [itemsResponse, ordersResponse, customersResponse] = await Promise.all([
        request(app).get('/api/items'),
        request(app).get('/api/orders'),
        request(app).get('/api/customers')
      ]);
      
      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(itemsResponse.status).toBe(200);
      expect(ordersResponse.status).toBe(200);
      expect(customersResponse.status).toBe(200);

      // Should complete within reasonable time even with large datasets
      expect(queryTime).toBeLessThan(3000); // 3 seconds for bulk queries
      
      console.log(`Bulk queries completed in ${queryTime}ms`);
    }, 10000);

    test('should handle stock movement queries with filtering', async () => {
      const startTime = Date.now();
      
      const stockMovementsResponse = await request(app)
        .get('/api/stock-movements')
        .query({
          reason: 'reserve',
          limit: 100
        })
        .expect(200);
      
      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(stockMovementsResponse.body.movements).toBeInstanceOf(Array);
      expect(queryTime).toBeLessThan(2000); // 2 seconds for filtered stock movements
      
      console.log(`Stock movements query with filtering completed in ${queryTime}ms`);
    }, 5000);
  });

  describe('Memory and Resource Usage', () => {
    test('should not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await request(app)
          .get('/api/items')
          .expect(200);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB for 100 requests)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB after 100 requests`);
    }, 30000);
  });
});