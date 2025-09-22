const BaseRepository = require('./BaseRepository');
const db = require('../config/database');

class OrderRowRepository extends BaseRepository {
  constructor() {
    super('order_rows');
  }

  async findByOrder(orderId) {
    const result = await db.query(`
      SELECT 
        or_row.*,
        i.name as item_name,
        i.sku as item_sku,
        i.is_composite
      FROM order_rows or_row
      JOIN items i ON or_row.item_id = i.id
      WHERE or_row.order_id = $1
      ORDER BY or_row.id
    `, [orderId]);
    
    return result.rows;
  }

  async findByItem(itemId) {
    const result = await db.query(`
      SELECT 
        or_row.*,
        o.status as order_status,
        o.start_date,
        o.return_due_date,
        c.display_name as customer_name
      FROM order_rows or_row
      JOIN orders o ON or_row.order_id = o.id
      JOIN customers c ON o.customer_id = c.id
      WHERE or_row.item_id = $1
      ORDER BY o.start_date DESC
    `, [itemId]);
    
    return result.rows;
  }

  async addLineItem(orderId, itemId, quantity, pricePerDay) {
    // Get order to calculate rental days
    const orderResult = await db.query(`
      SELECT start_date, return_due_date FROM orders WHERE id = $1
    `, [orderId]);
    
    if (orderResult.rows.length === 0) {
      throw new Error('Order not found');
    }
    
    const order = orderResult.rows[0];
    const startDate = new Date(order.start_date);
    const returnDate = new Date(order.return_due_date);
    const rentalDays = Math.max(1, Math.ceil((returnDate - startDate) / (1000 * 60 * 60 * 24)));
    
    const lineTotal = quantity * pricePerDay * rentalDays;
    
    const result = await db.query(`
      INSERT INTO order_rows (order_id, item_id, quantity, price_per_day, line_total)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [orderId, itemId, quantity, pricePerDay, lineTotal]);
    
    return result.rows[0];
  }

  async updateLineItem(lineItemId, quantity, pricePerDay) {
    const lineTotal = quantity * pricePerDay;
    
    const result = await db.query(`
      UPDATE order_rows 
      SET quantity = $2, price_per_day = $3, line_total = $4
      WHERE id = $1
      RETURNING *
    `, [lineItemId, quantity, pricePerDay, lineTotal]);
    
    return result.rows[0] || null;
  }

  async removeLineItem(lineItemId) {
    return this.delete(lineItemId);
  }

  async getOrderTotal(orderId) {
    const result = await db.query(`
      SELECT 
        COALESCE(SUM(line_total), 0) as subtotal,
        COUNT(*) as line_count
      FROM order_rows 
      WHERE order_id = $1
    `, [orderId]);
    
    return result.rows[0];
  }

  async getItemUsageStats(startDate, endDate) {
    const result = await db.query(`
      SELECT 
        i.id,
        i.name,
        i.sku,
        COUNT(or_row.id) as rental_count,
        SUM(or_row.quantity) as total_quantity_rented,
        SUM(or_row.line_total) as total_revenue
      FROM items i
      LEFT JOIN order_rows or_row ON i.id = or_row.item_id
      LEFT JOIN orders o ON or_row.order_id = o.id
      WHERE o.created_at >= $1 AND o.created_at <= $2
      GROUP BY i.id, i.name, i.sku
      HAVING COUNT(or_row.id) > 0
      ORDER BY total_revenue DESC, rental_count DESC
    `, [startDate, endDate]);
    
    return result.rows;
  }

  async clearOrderItems(orderId) {
    const result = await db.query(
      'DELETE FROM order_rows WHERE order_id = $1 RETURNING *',
      [orderId]
    );
    return result.rows;
  }
}

module.exports = OrderRowRepository;