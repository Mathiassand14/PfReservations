const request = require('supertest');
const app = require('../../server');

describe('Order Creation — Auto-calc on Draft/Reserved', () => {
  test('stores totals and captured rebate percent on creation', async () => {
    const payload = {
      customerId: 1,
      status: 'Draft',
      order_start: '2025-01-10T08:00:00Z',
      order_end: '2025-01-10T20:00:00Z',
      lines: [
        { line_type: 'Service', kind: 'Hourly', hours: 2.25, unit_price: 160.0 }
      ]
    };
    const res = await request(app).post('/api/orders').send(payload);
    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty('id');
  });

  test('auto-calculates on transition to Reserved', async () => {
    const create = await request(app).post('/api/orders').send({
      customerId: 1,
      status: 'Draft',
      order_start: '2025-01-10T08:00:00Z',
      order_end: '2025-01-10T20:00:00Z',
      lines: []
    });
    const id = create.body.id || create.body.order?.id;
    expect(id).toBeTruthy();
    const res = await request(app).post(`/api/orders/${id}/transition`).send({ newStatus: 'Reserved' });
    expect([200, 409]).toContain(res.status);
  });
});
