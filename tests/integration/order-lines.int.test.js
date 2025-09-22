const request = require('supertest');
const app = require('../../server');

describe('Order Lines Endpoint', () => {
  test('returns 404 for missing order', async () => {
    const res = await request(app).get('/api/orders/999999/lines');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
  });

  test('creates order with line and fetches lines', async () => {
    // Create employee
    const emp = await request(app).post('/api/employees').send({ fullName: 'Rep User', email: 'rep.lines@test', role: 'Staff' });
    expect(emp.status).toBe(201);
    const employeeId = emp.body.id;

    // Create customer
    const cust = await request(app).post('/api/customers').send({ displayName: 'Lines Customer' });
    expect(cust.status).toBe(201);
    const customerId = cust.body.id;

    // Create item (atomic)
    const itemResp = await request(app).post('/api/items').send({
      name: 'Camera', sku: 'CAM-LN-1', type: 'Atomic', pricePerDay: 30, quantityOnHand: 5,
      prices: { Start: 0, Daily: 30 }
    });
    expect(itemResp.status).toBe(201);
    const itemId = itemResp.body.id;

    // Create order
    const orderCreate = await request(app).post('/api/orders').send({
      customerId, salesPersonId: employeeId, startDate: '2025-01-05', returnDueDate: '2025-01-08'
    });
    expect(orderCreate.status).toBe(201);
    const orderId = orderCreate.body.id;

    // Add line item with explicit pricePerDay
    const addLine = await request(app).post(`/api/orders/${orderId}/lines`).send({ itemId, quantity: 2, pricePerDay: 30 });
    expect(addLine.status).toBe(201);

    // Fetch lines
    const lines = await request(app).get(`/api/orders/${orderId}/lines`);
    expect(lines.status).toBe(200);
    expect(lines.body.orderId).toBe(orderId);
    expect(Array.isArray(lines.body.lineItems)).toBe(true);
    expect(lines.body.count).toBeGreaterThan(0);

    const line = lines.body.lineItems[0];
    expect(line.itemId).toBe(itemId);
    expect(line.quantity).toBe(2);
    expect(line.pricePerDay).toBe(30);
    expect(line.rentalDays).toBeGreaterThanOrEqual(1);
    expect(line.lineTotal).toBe(2 * 30 * line.rentalDays);
  });
});

