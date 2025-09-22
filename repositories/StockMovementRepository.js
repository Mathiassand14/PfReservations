const BaseRepository = require('./BaseRepository');
const db = require('../config/database');

class StockMovementRepository extends BaseRepository {
  constructor() {
    super('stock_movements');
  }

  async findByItem(itemId, limit = 50) {
    const result = await db.query(`
      SELECT 
        sm.*,
        o.id as order_number,
        c.display_name as customer_name
      FROM stock_movements sm
      LEFT JOIN orders o ON sm.order_id = o.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE sm.item_id = $1
      ORDER BY sm.created_at DESC
      LIMIT $2
    `, [itemId, limit]);
    
    return result.rows;
  }

  async findByOrder(orderId) {
    const result = await db.query(`
      SELECT 
        sm.*,
        i.name as item_name,
        i.sku as item_sku
      FROM stock_movements sm
      JOIN items i ON sm.item_id = i.id
      WHERE sm.order_id = $1
      ORDER BY sm.created_at ASC
    `, [orderId]);
    
    return result.rows;
  }

  async recordMovement(itemId, orderId, delta, reason, createdBy, notes = null) {
    const result = await db.query(`
      INSERT INTO stock_movements (item_id, order_id, delta, reason, created_by, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [itemId, orderId, delta, reason, createdBy, notes]);
    
    return result.rows[0];
  }

  async recordAdjustment(itemId, delta, reason, createdBy, notes = null) {
    const result = await db.query(`
      INSERT INTO stock_movements (item_id, order_id, delta, reason, created_by, notes)
      VALUES ($1, NULL, $2, $3, $4, $5)
      RETURNING *
    `, [itemId, delta, reason, createdBy, notes]);
    
    return result.rows[0];
  }

  async getMovementsByDateRange(startDate, endDate) {
    const result = await db.query(`
      SELECT 
        sm.*,
        i.name as item_name,
        i.sku as item_sku,
        o.id as order_number,
        c.display_name as customer_name
      FROM stock_movements sm
      JOIN items i ON sm.item_id = i.id
      LEFT JOIN orders o ON sm.order_id = o.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE sm.created_at >= $1 AND sm.created_at <= $2
      ORDER BY sm.created_at DESC
    `, [startDate, endDate]);
    
    return result.rows;
  }

  async getMovementsByReason(reason, limit = 100) {
    const result = await db.query(`
      SELECT 
        sm.*,
        i.name as item_name,
        i.sku as item_sku,
        o.id as order_number
      FROM stock_movements sm
      JOIN items i ON sm.item_id = i.id
      LEFT JOIN orders o ON sm.order_id = o.id
      WHERE sm.reason = $1
      ORDER BY sm.created_at DESC
      LIMIT $2
    `, [reason, limit]);
    
    return result.rows;
  }

  async getStockMovementSummary(itemId) {
    const result = await db.query(`
      SELECT 
        reason,
        COUNT(*) as movement_count,
        SUM(delta) as total_delta,
        MIN(created_at) as first_movement,
        MAX(created_at) as last_movement
      FROM stock_movements
      WHERE item_id = $1
      GROUP BY reason
      ORDER BY reason
    `, [itemId]);
    
    return result.rows;
  }

  async getCurrentStock(itemId) {
    const result = await db.query(`
      SELECT 
        i.quantity_on_hand as system_quantity,
        COALESCE(SUM(sm.delta), 0) as movement_total,
        (i.quantity_on_hand - COALESCE(SUM(sm.delta), 0)) as calculated_initial
      FROM items i
      LEFT JOIN stock_movements sm ON i.id = sm.item_id
      WHERE i.id = $1 AND i.is_composite = false
      GROUP BY i.id, i.quantity_on_hand
    `, [itemId]);
    
    return result.rows[0] || null;
  }

  async getAuditTrail(startDate, endDate, itemId = null) {
    let query = `
      SELECT 
        sm.*,
        i.name as item_name,
        i.sku as item_sku,
        o.id as order_number,
        c.display_name as customer_name
      FROM stock_movements sm
      JOIN items i ON sm.item_id = i.id
      LEFT JOIN orders o ON sm.order_id = o.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE sm.created_at >= $1 AND sm.created_at <= $2
    `;
    
    const params = [startDate, endDate];
    
    if (itemId) {
      query += ' AND sm.item_id = $3';
      params.push(itemId);
    }
    
    query += ' ORDER BY sm.created_at DESC';
    
    const result = await db.query(query, params);
    return result.rows;
  }
}

module.exports = StockMovementRepository;