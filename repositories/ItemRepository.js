const BaseRepository = require('./BaseRepository');
const db = require('../config/database');

class ItemRepository extends BaseRepository {
  constructor() {
    super('items');
  }

  async findBySku(sku) {
    const result = await db.query(
      'SELECT * FROM items WHERE sku = $1',
      [sku]
    );
    return result.rows[0] || null;
  }

  async findAtomic() {
    return this.findAll({
      where: "type = 'Atomic'",
      orderBy: 'name ASC'
    });
  }

  async findComposite() {
    return this.findAll({
      where: "type = 'Composite'",
      orderBy: 'name ASC'
    });
  }

  async findService() {
    return this.findAll({
      where: "type = 'Service'",
      orderBy: 'name ASC'
    });
  }

  async searchByName(searchTerm) {
    const result = await db.query(
      'SELECT * FROM items WHERE name ILIKE $1 OR sku ILIKE $1 ORDER BY name',
      [`%${searchTerm}%`]
    );
    return result.rows;
  }

  async getItemWithComponents(itemId) {
    const result = await db.query(`
      SELECT 
        i.*,
        COALESCE(
          json_agg(
            json_build_object(
              'component_id', ic.child_id,
              'component_name', ci.name,
              'component_sku', ci.sku,
              'quantity', ic.quantity,
              'available_quantity', ci.quantity_on_hand
            ) ORDER BY ci.name
          ) FILTER (WHERE ic.child_id IS NOT NULL),
          '[]'::json
        ) as components
      FROM items i
      LEFT JOIN item_components ic ON i.id = ic.parent_id
      LEFT JOIN items ci ON ic.child_id = ci.id
      WHERE i.id = $1
      GROUP BY i.id
    `, [itemId]);
    
    return result.rows[0] || null;
  }

  async getItemComponents(parentId) {
    const result = await db.query(`
      SELECT 
        ic.*,
        i.name as component_name,
        i.sku as component_sku,
        i.price_per_day as component_price,
        i.quantity_on_hand as available_quantity
      FROM item_components ic
      JOIN items i ON ic.child_id = i.id
      WHERE ic.parent_id = $1
      ORDER BY i.name
    `, [parentId]);
    
    return result.rows;
  }

  async addComponent(parentId, childId, quantity) {
    const result = await db.query(`
      INSERT INTO item_components (parent_id, child_id, quantity)
      VALUES ($1, $2, $3)
      ON CONFLICT (parent_id, child_id) 
      DO UPDATE SET quantity = $3, created_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [parentId, childId, quantity]);
    
    return result.rows[0];
  }

  async removeComponent(parentId, childId) {
    const result = await db.query(
      'DELETE FROM item_components WHERE parent_id = $1 AND child_id = $2 RETURNING *',
      [parentId, childId]
    );
    return result.rows[0] || null;
  }

  async updateStock(itemId, newQuantity) {
    return this.update(itemId, { quantity_on_hand: newQuantity });
  }

  async getStockLevels() {
    const result = await db.query(`
      SELECT 
        id,
        name,
        sku,
        quantity_on_hand,
        CASE 
          WHEN quantity_on_hand = 0 THEN 'out_of_stock'
          WHEN quantity_on_hand <= 5 THEN 'low_stock'
          ELSE 'in_stock'
        END as stock_status
      FROM items 
      WHERE type = 'Atomic'
      ORDER BY 
        CASE 
          WHEN quantity_on_hand = 0 THEN 1
          WHEN quantity_on_hand <= 5 THEN 2
          ELSE 3
        END,
        name
    `);
    
    return result.rows;
  }

  async getItemAvailability(itemId, startDate, endDate) {
    const result = await db.query(`
      SELECT 
        i.id,
        i.name,
        i.sku,
        i.quantity_on_hand,
        COALESCE(SUM(
          CASE 
            WHEN o.status IN ('Reserved', 'Checked Out') 
            AND o.start_date <= $3 
            AND o.return_due_date >= $2
            THEN or_row.quantity
            ELSE 0
          END
        ), 0) as reserved_quantity,
        (i.quantity_on_hand - COALESCE(SUM(
          CASE 
            WHEN o.status IN ('Reserved', 'Checked Out') 
            AND o.start_date <= $3 
            AND o.return_due_date >= $2
            THEN or_row.quantity
            ELSE 0
          END
        ), 0)) as available_quantity
      FROM items i
      LEFT JOIN order_rows or_row ON i.id = or_row.item_id
      LEFT JOIN orders o ON or_row.order_id = o.id
      WHERE i.id = $1 AND i.type = 'Atomic'
      GROUP BY i.id, i.name, i.sku, i.quantity_on_hand
    `, [itemId, startDate, endDate]);
    
    return result.rows[0] || null;
  }
}

module.exports = ItemRepository;
