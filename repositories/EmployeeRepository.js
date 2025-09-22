const BaseRepository = require('./BaseRepository');
const db = require('../config/database');

class EmployeeRepository extends BaseRepository {
  constructor() {
    super('employees');
  }

  async findActive() {
    return this.findAll({ where: 'is_active = true' });
  }

  async findByRole(role) {
    const result = await db.query(
      'SELECT * FROM employees WHERE role = $1 AND is_active = true ORDER BY full_name',
      [role]
    );
    return result.rows;
  }

  async findByEmail(email) {
    const result = await db.query(
      'SELECT * FROM employees WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  async deactivate(id) {
    return this.update(id, { is_active: false });
  }

  async activate(id) {
    return this.update(id, { is_active: true });
  }

  async searchByName(searchTerm) {
    const result = await db.query(
      `SELECT * FROM employees 
       WHERE full_name ILIKE $1 AND is_active = true 
       ORDER BY full_name`,
      [`%${searchTerm}%`]
    );
    return result.rows;
  }

  async getEmployeeStats() {
    const result = await db.query(`
      SELECT 
        role,
        COUNT(*) as total,
        COUNT(CASE WHEN is_active THEN 1 END) as active
      FROM employees 
      GROUP BY role
      ORDER BY role
    `);
    return result.rows;
  }
}

module.exports = EmployeeRepository;