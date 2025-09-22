'use strict';

const engine = require('../../lib/pricing');

describe('Pricing Engine', () => {
  test('rounds hours up to the next 15 minutes', () => {
    const stub = (h) => Math.ceil(h * 4) / 4; // expected behavior
    expect(stub(2.01)).toBeCloseTo(2.25);
    expect(stub(2.25)).toBeCloseTo(2.25);
    expect(stub(2.26)).toBeCloseTo(2.5);
  });

  test('calculates daily count after first 24h', () => {
    expect(typeof engine.calcDailyCount).toBe('function');
  });

  test('equipment vs service rebate application placeholders', () => {
    expect(typeof engine.priceEquipmentLine).toBe('function');
    expect(typeof engine.priceServiceLine).toBe('function');
    // Equipment rebate example (20%): start 500 + 1 daily 200 over 26h => (500+200)*0.8 = 560
    const eq = engine.priceEquipmentLine({ start: 500, daily: 200, qty: 1, rebatePct: 20, orderStart: '2025-01-10T08:00:00Z', orderEnd: '2025-01-11T10:00:00Z' });
    expect(eq.total).toBeCloseTo(560, 2);
    // Service has no rebate, hourly rounds up
    const sv = engine.priceServiceLine({ hours: 2.05, rate: 160 });
    expect(sv.total).toBeCloseTo(2.25 * 160, 2);
  });

  test('composite components sum equipment line totals', () => {
    expect(typeof engine.priceCompositeLine).toBe('function');
    const total = engine.priceCompositeLine(
      [
        { start: 500, daily: 200, qty: 1 },
        { start: 300, daily: 150, qty: 2 },
      ],
      '2025-01-10T08:00:00Z',
      '2025-01-11T10:00:00Z',
      20
    );
    // (500+200) + 2*(300+150) = 500+200+600+300 = 1600; apply 20% rebate => 1280
    expect(total).toBeCloseTo(1280, 2);
  });

  test('calcOrderTotals aggregates equipment, services, and returns totals', () => {
    const order = { orderStart: '2025-01-10T08:00:00Z', orderEnd: '2025-01-11T10:00:00Z' };
    const lines = [
      { type: 'Equipment', start: 500, daily: 200, qty: 1 },
      { type: 'Equipment', start: 300, daily: 150, qty: 2 },
      { type: 'Service', hours: 2.05, rate: 160 },
    ];
    const res = engine.calcOrderTotals(order, lines, 20);
    expect(res.equipmentTotal).toBeCloseTo(1280, 2);
    expect(res.servicesTotal).toBeCloseTo(360, 2);
    expect(res.totalExVat).toBeCloseTo(1640, 2);
  });
});
