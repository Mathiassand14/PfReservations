const BaseRepository = require('./BaseRepository');
const db = require('../config/database');

class CustomerRepository extends BaseRepository {
  constructor() {
    super('customers');
  }

  async findActive() {
    return this.findAll({ where: 'is_active = true', orderBy: 'display_name ASC' });
  }

  async findByOrganization(organization) {
    const result = await db.query(
      'SELECT * FROM customers WHERE organization ILIKE $1 AND is_active = true ORDER BY display_name',
      [`%${organization}%`]
    );
    return result.rows;
  }

  async searchByName(searchTerm) {
    const result = await db.query(
      `SELECT * FROM customers 
       WHERE (display_name ILIKE $1 OR organization ILIKE $1) 
       AND is_active = true 
       ORDER BY display_name`,
      [`%${searchTerm}%`]
    );
    return result.rows;
  }

  async deactivate(id) {
    return this.update(id, { is_active: false });
  }

  async activate(id) {
    return this.update(id, { is_active: true });
  }

  async getCustomerWithOrders(customerId) {
    const result = await db.query(`
      SELECT 
        c.*,
        COUNT(o.id) as total_orders,
        COUNT(CASE WHEN o.status IN ('Reserved', 'Checked Out') THEN 1 END) as active_orders,
        MAX(o.created_at) as last_order_date
      FROM customers c
      LEFT JOIN orders o ON c.id = o.customer_id
      WHERE c.id = $1
      GROUP BY c.id
    `, [customerId]);
    
    return result.rows[0] || null;
  }

  async getTopCustomers(limit = 10) {
    const result = await db.query(`
      SELECT 
        c.*,
        COUNT(o.id) as order_count,
        COALESCE(SUM(
          (or_row.line_total + COALESCE(o.tax_amount, 0) - COALESCE(o.discount_amount, 0))
        ), 0) as total_revenue
      FROM customers c
      LEFT JOIN orders o ON c.id = o.customer_id
      LEFT JOIN order_rows or_row ON o.id = or_row.order_id
      WHERE c.is_active = true
      GROUP BY c.id
      ORDER BY total_revenue DESC, order_count DESC
      LIMIT $1
    `, [limit]);
    
    return result.rows;
  }
}

module.exports = CustomerRepository;