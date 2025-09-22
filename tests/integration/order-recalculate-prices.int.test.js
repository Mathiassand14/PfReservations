const request = require('supertest');
const app = require('../../server');

describe('Order Recalculate uses Start/Daily prices', () => {
  test('26-hour rental charges Start + 1 Daily (no rebate)', async () => {
    // Create employee and customer (IDs may be required depending on constraints)
    const emp = await request(app).post('/api/employees').send({ fullName: 'Rep', email: 'rep@test', role: 'Staff' });
    const employeeId = emp.body.employee?.id || emp.body.id;
    const cust = await request(app).post('/api/customers').send({ displayName: 'Acme Co' });
    const customerId = cust.body.customer?.id || cust.body.id;

    // Create atomic item with prices
    const createItem = await request(app).post('/api/items').send({
      name: 'Light', sku: 'LGT-001', type: 'Atomic', pricePerDay: 200, quantityOnHand: 10,
      prices: { Start: 500, Daily: 200 },
    });
    const itemId = createItem.body.item?.id || createItem.body.id;

    // Create order and add line
    const createOrder = await request(app).post('/api/orders').send({
      customerId, salesPersonId: employeeId,
      startDate: '2025-01-10T08:00:00Z', returnDueDate: '2025-01-11T10:00:00Z',
    });
    const orderId = createOrder.body.order?.id || createOrder.body.id;

    await request(app).post(`/api/orders/${orderId}/lines`).send({ itemId, quantity: 1, pricePerDay: 200 });

    const recalc = await request(app).post(`/api/orders/${orderId}/recalculate`).send({});
    expect(recalc.status).toBe(200);
    const subtotal = recalc.body.subtotal || recalc.body.order?.subtotal || recalc.body?.totals?.subtotal;
    expect(typeof subtotal).toBe('number');
    expect(subtotal).toBe(700); // 500 + 200, no rebate
  });
});

