const db = require('../config/database');

async function seedDatabase() {
  try {
    if (process.env.ALLOW_DESTRUCTIVE_SEED !== 'true') {
      console.error('Seeding aborted: set ALLOW_DESTRUCTIVE_SEED=true to allow destructive reseed');
      process.exit(1);
    }
    console.log('Starting database seeding...');

    // Clear existing data (in reverse order of dependencies)
    await db.query('DELETE FROM stock_movements');
    await db.query('DELETE FROM order_rows');
    await db.query('DELETE FROM orders');
    await db.query('DELETE FROM item_components');
    await db.query('DELETE FROM items');
    await db.query('DELETE FROM customers');
    await db.query('DELETE FROM employees');
    await db.query('DELETE FROM calendar_tokens');

    // Reset sequences
    await db.query('ALTER SEQUENCE employees_id_seq RESTART WITH 1');
    await db.query('ALTER SEQUENCE customers_id_seq RESTART WITH 1');
    await db.query('ALTER SEQUENCE items_id_seq RESTART WITH 1');
    await db.query('ALTER SEQUENCE orders_id_seq RESTART WITH 1');

    // Seed rebate groups
    console.log('Seeding rebate groups...');
    await db.query(`
      INSERT INTO rebate_groups (name, percent) VALUES
      ('Ekstern', 0.00)
      ON CONFLICT (name) DO NOTHING
    `);
    await db.query(`
      INSERT INTO rebate_groups (name, percent) VALUES
      ('Internal', 0.00)
      ON CONFLICT (name) DO NOTHING
    `);

    // Seed employees
    console.log('Seeding employees...');
    await db.query(`
      INSERT INTO employees (full_name, email, phone, role, is_active) VALUES
      ('John Admin', 'john.admin@company.com', '555-0101', 'Admin', true),
      ('Jane Staff', 'jane.staff@company.com', '555-0102', 'Staff', true),
      ('Bob Viewer', 'bob.viewer@company.com', '555-0103', 'ReadOnly', true),
      ('Alice Manager', 'alice.manager@company.com', '555-0104', 'Staff', true),
      ('Charlie Inactive', 'charlie@company.com', '555-0105', 'Staff', false)
    `);

    // Seed customers
    console.log('Seeding customers...');
    await db.query(`
      INSERT INTO customers (display_name, organization, contact_info, billing_info, is_active) VALUES
      ('Acme Corporation', 'Acme Corp', 
       '{"email": "contact@acme.com", "phone": "555-1001", "address": "123 Business St"}',
       '{"billing_email": "billing@acme.com", "tax_id": "12-3456789"}', true),
      ('Tech Solutions Inc', 'Tech Solutions', 
       '{"email": "info@techsolutions.com", "phone": "555-1002"}',
       '{"billing_email": "accounts@techsolutions.com"}', true),
      ('Local Workshop', null, 
       '{"email": "workshop@local.com", "phone": "555-1003"}',
       null, true),
      ('Inactive Client', 'Old Company', 
       '{"email": "old@company.com"}',
       null, false)
    `);
    // Ensure customers have a default rebate group
    await db.query(`UPDATE customers SET rebate_group = 'Ekstern' WHERE rebate_group IS NULL`);

    // Seed atomic items
    console.log('Seeding items...');
    await db.query(`
      INSERT INTO items (name, sku, price_per_day, is_composite, quantity_on_hand) VALUES
      ('Laptop Dell XPS 13', 'LAPTOP-DELL-001', 25.00, false, 10),
      ('Monitor 24" Samsung', 'MONITOR-SAM-001', 15.00, false, 8),
      ('Wireless Mouse', 'MOUSE-WIRE-001', 3.00, false, 20),
      ('USB-C Hub', 'HUB-USBC-001', 8.00, false, 15),
      ('Projector Epson', 'PROJ-EPS-001', 45.00, false, 3),
      ('Presentation Remote', 'REMOTE-PRES-001', 5.00, false, 12),
      ('HDMI Cable 6ft', 'CABLE-HDMI-001', 2.00, false, 25),
      ('Power Strip 6-outlet', 'POWER-STRIP-001', 4.00, false, 18)
    `);

    // Seed composite items
    await db.query(`
      INSERT INTO items (name, sku, price_per_day, is_composite, quantity_on_hand) VALUES
      ('Complete Workstation Bundle', 'BUNDLE-WORK-001', 40.00, true, null),
      ('Presentation Setup Kit', 'BUNDLE-PRES-001', 60.00, true, null)
    `);

    // Seed base prices (Daily) for atomic items; skip composites
    console.log('Seeding base prices (Daily) for items...');
    await db.query(`
      INSERT INTO prices (item_id, kind, amount)
      SELECT id, 'Daily', price_per_day
      FROM items
      WHERE is_composite = false
      ON CONFLICT (item_id, kind) DO UPDATE SET amount = EXCLUDED.amount
    `);

    // Seed item components (BOM)
    console.log('Seeding item components...');
    // Complete Workstation Bundle (id: 9) = Laptop + Monitor + Mouse + USB-C Hub
    await db.query(`
      INSERT INTO item_components (parent_id, child_id, quantity) VALUES
      (9, 1, 1), -- 1 Laptop
      (9, 2, 1), -- 1 Monitor  
      (9, 3, 1), -- 1 Mouse
      (9, 4, 1)  -- 1 USB-C Hub
    `);

    // Presentation Setup Kit (id: 10) = Projector + Remote + HDMI Cable + Power Strip
    await db.query(`
      INSERT INTO item_components (parent_id, child_id, quantity) VALUES
      (10, 5, 1), -- 1 Projector
      (10, 6, 1), -- 1 Remote
      (10, 7, 2), -- 2 HDMI Cables
      (10, 8, 1)  -- 1 Power Strip
    `);

    // Seed sample orders
    console.log('Seeding orders...');
    await db.query(`
      INSERT INTO orders (customer_id, sales_person_id, status, start_date, return_due_date) VALUES
      (1, 1, 'Reserved', '2025-01-15', '2025-01-20'),
      (2, 2, 'Draft', '2025-01-22', '2025-01-25'),
      (3, 1, 'Checked Out', '2025-01-10', '2025-01-14')
    `);

    // Seed order rows
    console.log('Seeding order rows...');
    await db.query(`
      INSERT INTO order_rows (order_id, item_id, quantity, price_per_day, line_total) VALUES
      (1, 9, 2, 40.00, 400.00), -- 2 Workstation Bundles for 5 days
      (1, 5, 1, 45.00, 225.00), -- 1 Projector for 5 days
      (2, 1, 3, 25.00, 225.00), -- 3 Laptops for 3 days (draft)
      (3, 10, 1, 60.00, 240.00) -- 1 Presentation Kit for 4 days (checked out)
    `);

    // Seed stock movements for the checked out order
    console.log('Seeding stock movements...');
    await db.query(`
      INSERT INTO stock_movements (item_id, order_id, delta, reason, created_by, created_at) VALUES
      (5, 3, -1, 'reserve', 'John Admin', '2025-01-09 10:00:00'),
      (6, 3, -1, 'reserve', 'John Admin', '2025-01-09 10:00:00'),
      (7, 3, -2, 'reserve', 'John Admin', '2025-01-09 10:00:00'),
      (8, 3, -1, 'reserve', 'John Admin', '2025-01-09 10:00:00'),
      (5, 3, -1, 'checkout', 'John Admin', '2025-01-10 09:00:00'),
      (6, 3, -1, 'checkout', 'John Admin', '2025-01-10 09:00:00'),
      (7, 3, -2, 'checkout', 'John Admin', '2025-01-10 09:00:00'),
      (8, 3, -1, 'checkout', 'John Admin', '2025-01-10 09:00:00')
    `);

    // Seed calendar token
    console.log('Seeding calendar tokens...');
    await db.query(`
      INSERT INTO calendar_tokens (token, description, created_by) VALUES
      ('cal-token-abc123def456', 'Main calendar feed', 'John Admin'),
      ('cal-token-xyz789uvw012', 'Secondary feed for managers', 'Alice Manager')
    `);

    console.log('✓ Database seeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase().then(() => {
    process.exit(0);
  });
}

module.exports = { seedDatabase };
