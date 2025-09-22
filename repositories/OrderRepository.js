const BaseRepository = require('./BaseRepository');
const db = require('../config/database');

class OrderRepository extends BaseRepository {
  constructor() {
    super('orders');
  }

  async findByStatus(status) {
    return this.findAll({ 
      where: `status = '${status}'`, 
      orderBy: 'created_at DESC' 
    });
  }

  async findByCustomer(customerId) {
    return this.findAll({ 
      where: `customer_id = ${customerId}`, 
      orderBy: 'created_at DESC' 
    });
  }

  async findByDateRange(startDate, endDate) {
    const result = await db.query(`
      SELECT * FROM orders 
      WHERE start_date <= $2 AND return_due_date >= $1
      ORDER BY start_date ASC
    `, [startDate, endDate]);
    
    return result.rows;
  }

  async getOrderWithDetails(orderId) {
    const result = await db.query(`
      SELECT 
        o.*,
        c.display_name as customer_name,
        c.organization as customer_organization,
        e.full_name as sales_person_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', or_row.id,
              'item_id', or_row.item_id,
              'item_name', i.name,
              'item_sku', i.sku,
              'quantity', or_row.quantity,
              'price_per_day', or_row.price_per_day,
              'line_total', or_row.line_total
            ) ORDER BY or_row.id
          ) FILTER (WHERE or_row.id IS NOT NULL),
          '[]'::json
        ) as line_items
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN employees e ON o.sales_person_id = e.id
      LEFT JOIN order_rows or_row ON o.id = or_row.order_id
      LEFT JOIN items i ON or_row.item_id = i.id
      WHERE o.id = $1
      GROUP BY o.id, c.display_name, c.organization, e.full_name
    `, [orderId]);
    
    return result.rows[0] || null;
  }

  async updateStatus(orderId, newStatus) {
    return this.update(orderId, { status: newStatus });
  }

  async getOrdersByEmployee(employeeId) {
    return this.findAll({ 
      where: `sales_person_id = ${employeeId}`, 
      orderBy: 'created_at DESC' 
    });
  }

  async getActiveOrders() {
    return this.findAll({ 
      where: "status IN ('Reserved', 'Checked Out')", 
      orderBy: 'start_date ASC' 
    });
  }

  async getOverdueOrders() {
    const result = await db.query(`
      SELECT 
        o.*,
        c.display_name as customer_name,
        e.full_name as sales_person_name
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN employees e ON o.sales_person_id = e.id
      WHERE o.status = 'Checked Out' 
      AND o.return_due_date < CURRENT_DATE
      ORDER BY o.return_due_date ASC
    `);
    
    return result.rows;
  }

  async getOrderStats(startDate, endDate) {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'Draft' THEN 1 END) as draft_orders,
        COUNT(CASE WHEN status = 'Reserved' THEN 1 END) as reserved_orders,
        COUNT(CASE WHEN status = 'Checked Out' THEN 1 END) as checked_out_orders,
        COUNT(CASE WHEN status = 'Returned' THEN 1 END) as returned_orders,
        COUNT(CASE WHEN status = 'Cancelled' THEN 1 END) as cancelled_orders,
        COALESCE(SUM(
          (SELECT SUM(line_total) FROM order_rows WHERE order_id = orders.id) +
          COALESCE(tax_amount, 0) - COALESCE(discount_amount, 0)
        ), 0) as total_revenue
      FROM orders
      WHERE created_at >= $1 AND created_at <= $2
    `, [startDate, endDate]);
    
    return result.rows[0];
  }

  async getCalendarEvents(startDate, endDate) {
    const result = await db.query(`
      SELECT 
        o.id,
        o.start_date,
        o.return_due_date,
        o.status,
        c.display_name as customer_name,
        string_agg(i.name, ', ') as items
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      LEFT JOIN order_rows or_row ON o.id = or_row.order_id
      LEFT JOIN items i ON or_row.item_id = i.id
      WHERE o.status IN ('Reserved', 'Checked Out')
      AND o.start_date <= $2 
      AND o.return_due_date >= $1
      GROUP BY o.id, o.start_date, o.return_due_date, o.status, c.display_name
      ORDER BY o.start_date ASC
    `, [startDate, endDate]);
    
    return result.rows;
  }

  async getInternalEvents(startDate, endDate) {
    const result = await db.query(`
      SELECT 
        o.id,
        o.setup_start,
        COALESCE(o.order_start, o.start_date) AS order_start,
        COALESCE(o.order_end, o.return_due_date) AS order_end,
        o.cleanup_end,
        o.status,
        c.display_name as customer_name,
        e.full_name as sales_person_name,
        string_agg(i.name, ', ') as items
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN employees e ON o.sales_person_id = e.id
      LEFT JOIN order_rows or_row ON o.id = or_row.order_id
      LEFT JOIN items i ON or_row.item_id = i.id
      WHERE COALESCE(o.setup_start, COALESCE(o.order_start, o.start_date)) <= $2 
        AND COALESCE(o.cleanup_end, COALESCE(o.order_end, o.return_due_date)) >= $1
      GROUP BY o.id, o.setup_start, o.order_start, o.order_end, o.cleanup_end, o.status, c.display_name, e.full_name
      ORDER BY COALESCE(o.setup_start, COALESCE(o.order_start, o.start_date)) ASC
    `, [startDate, endDate]);
    return result.rows;
  }

  // New helpers for extended time and totals fields
  async updateTimeWindow(id, { setup_start = null, order_start = null, order_end = null, cleanup_end = null }) {
    const data = {};
    if (setup_start !== null) data.setup_start = setup_start;
    if (order_start !== null) data.order_start = order_start;
    if (order_end !== null) data.order_end = order_end;
    if (cleanup_end !== null) data.cleanup_end = cleanup_end;
    return this.update(id, data);
  }

  async updateTotals(id, { subtotal = 0, rebate_amount = 0, total_ex_vat = 0, captured_rebate_percent = null, calculated_at = null }) {
    const data = { subtotal, rebate_amount, total_ex_vat };
    if (captured_rebate_percent !== null && captured_rebate_percent !== undefined) data.captured_rebate_percent = captured_rebate_percent;
    if (calculated_at) data.calculated_at = calculated_at;
    return this.update(id, data);
  }

  async findOverlapsForWindow(startTs, endTs) {
    // Returns orders whose extended window intersects [startTs, endTs]
    const result = await db.query(
      `SELECT * FROM orders
       WHERE COALESCE(setup_start, order_start) <= $2
         AND COALESCE(cleanup_end, order_end) >= $1`,
      [startTs, endTs]
    );
    return result.rows;
  }
}

module.exports = OrderRepository;
