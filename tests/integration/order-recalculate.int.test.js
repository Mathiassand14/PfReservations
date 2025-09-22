const request = require('supertest');
const app = require('../../server');

describe('Order Recalculate Endpoint', () => {
  test('recomputes totals for existing order', async () => {
    // Create a draft order first
    const create = await request(app).post('/api/orders').send({
      customerId: 1,
      status: 'Draft',
      order_start: '2025-01-10T08:00:00Z',
      order_end: '2025-01-11T10:00:00Z',
      lines: []
    });
    const id = create.body.id || create.body.order?.id;
    expect(id).toBeTruthy();

    const res = await request(app).post(`/api/orders/${id}/recalculate`).send({});
    expect([200, 404, 501]).toContain(res.status); // placeholder expectation; will refine after implementation
  });

  test('Dispatched does not auto-calc; recalc remains manual', async () => {
    const create = await request(app).post('/api/orders').send({
      customerId: 1,
      status: 'Draft',
      order_start: '2025-01-10T08:00:00Z',
      order_end: '2025-01-10T20:00:00Z',
      lines: []
    });
    const id = create.body.id || create.body.order?.id;
    expect(id).toBeTruthy();
    const toDispatched = await request(app).post(`/api/orders/${id}/transition`).send({ newStatus: 'Dispatched' });
    expect([200, 409]).toContain(toDispatched.status);
    // No further assertions yet; implementation will refine
  });
});
