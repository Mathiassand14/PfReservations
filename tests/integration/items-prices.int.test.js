const request = require('supertest');
const app = require('../../server');

describe('Items Prices API', () => {
  test('create Atomic with Start/Daily prices and fetch them', async () => {
    const create = await request(app)
      .post('/api/items')
      .send({
        name: 'Atomic Camera',
        sku: 'CAM-AT-001',
        type: 'Atomic',
        pricePerDay: 200,
        prices: { Start: 500, Daily: 200 },
        quantityOnHand: 3,
      });
    // Accept either wrapped or direct response shapes
    const item = create.body.item || create.body;
    expect(create.status).toBe(201);
    expect(item.id).toBeTruthy();
    expect(item.type).toBe('Atomic');

    const res = await request(app).get(`/api/items/${item.id}/prices`);
    expect(res.status).toBe(200);
    expect(res.body.prices.Start).toBe(500);
    expect(res.body.prices.Daily).toBe(200);
  });

  test('create Service with Hourly price and fetch it', async () => {
    const create = await request(app)
      .post('/api/items')
      .send({
        name: 'Operator Service',
        sku: 'SRV-OP-001',
        type: 'Service',
        prices: { Hourly: 750 },
      });
    const item = create.body.item || create.body;
    expect(create.status).toBe(201);
    expect(item.type).toBe('Service');

    const res = await request(app).get(`/api/items/${item.id}/prices`);
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('Service');
    expect(res.body.prices.Hourly).toBe(750);
  });

  test('Composite should have no prices persisted', async () => {
    const create = await request(app)
      .post('/api/items')
      .send({ name: 'Bundle', sku: 'BND-001', type: 'Composite' });
    const item = create.body.item || create.body;
    expect(create.status).toBe(201);
    expect(item.type).toBe('Composite');

    const res = await request(app).get(`/api/items/${item.id}/prices`);
    expect(res.status).toBe(200);
    expect(res.body.prices || {}).toMatchObject({});
  });
});

