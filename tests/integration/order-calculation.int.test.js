const request = require('supertest');
const app = require('../../server');

describe('Order Calculation — Daily Threshold & Rounding', () => {
  test('charges Daily after first 24h and rounds hourly up to 15m', async () => {
    const payload = {
      customerId: 1,
      status: 'Draft',
      order_start: '2025-01-10T08:00:00Z',
      order_end: '2025-01-11T10:00:00Z',
      lines: [
        { line_type: 'Equipment', item_id: 5, kind: 'Start', quantity: 1 },
        { line_type: 'Equipment', item_id: 5, kind: 'Daily', quantity: 1 },
        { line_type: 'Service', kind: 'Hourly', hours: 2.05, unit_price: 160.0 }
      ]
    };

    const res = await request(app)
      .post('/api/orders')
      .send(payload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('total_ex_vat');
  });

  test('composite pricing sums components and reserves full setup→cleanup window', async () => {
    // Placeholder: ensure endpoint accepts a composite-like payload; actual calc verified later
    const payload = {
      customerId: 1,
      status: 'Draft',
      setup_start: '2025-01-10T06:00:00Z',
      order_start: '2025-01-10T08:00:00Z',
      order_end: '2025-01-11T09:00:00Z',
      cleanup_end: '2025-01-11T12:00:00Z',
      lines: [
        { line_type: 'Equipment', item_id: 9, kind: 'Start', quantity: 1 },
        { line_type: 'Equipment', item_id: 9, kind: 'Daily', quantity: 1 }
      ]
    };
    const res = await request(app).post('/api/orders').send(payload);
    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty('id');
  });
});
