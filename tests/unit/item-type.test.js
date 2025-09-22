const Item = require('../../models/Item');

describe('Item Model type mapping', () => {
  test('defaults to Atomic when no legacy/composite flags provided', () => {
    const it = new Item({ name: 'X', sku: 'X-1' });
    expect(it.type).toBe('Atomic');
    expect(it.isComposite).toBe(false);
  });

  test('maps legacy is_composite=true to Composite', () => {
    const it = new Item({ name: 'C', sku: 'C-1', is_composite: true });
    expect(it.type).toBe('Composite');
    expect(it.isComposite).toBe(true);
  });

  test('respects explicit type Service and null stock', () => {
    const it = new Item({ name: 'S', sku: 'S-1', type: 'Service', quantity_on_hand: null });
    expect(it.type).toBe('Service');
    expect(it.isComposite).toBe(false);
    const json = it.toDatabaseObject();
    expect(json.quantity_on_hand).toBeNull();
  });

  test('validation enforces composite cannot have quantity_on_hand', () => {
    const it = new Item({ name: 'Bundle', sku: 'B-1', type: 'Composite', quantity_on_hand: 5 });
    const v = it.validate();
    expect(v.isValid).toBe(false);
    expect(v.errors.join(' ')).toMatch(/Composite items should not have a quantity on hand/);
  });
});

