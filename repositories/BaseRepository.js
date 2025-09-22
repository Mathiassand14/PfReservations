const db = require('../config/database');

class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
  }

  async findAll(options = {}) {
    const { where = '', orderBy = 'id ASC', limit, offset } = options;
    
    let query = `SELECT * FROM ${this.tableName}`;
    const params = [];
    
    if (where) {
      query += ` WHERE ${where}`;
    }
    
    query += ` ORDER BY ${orderBy}`;
    
    if (limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }
    
    if (offset) {
      query += ` OFFSET $${params.length + 1}`;
      params.push(offset);
    }
    
    const result = await db.query(query, params);
    return result.rows;
  }

  async findById(id) {
    const result = await db.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${this.tableName} (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await db.query(query, values);
    return result.rows[0];
  }

  async update(id, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
    
    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, [id, ...values]);
    return result.rows[0] || null;
  }

  async delete(id) {
    const result = await db.query(
      `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  async count(where = '') {
    let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    if (where) {
      query += ` WHERE ${where}`;
    }
    
    const result = await db.query(query);
    return parseInt(result.rows[0].count);
  }

  async exists(id) {
    const result = await db.query(
      `SELECT 1 FROM ${this.tableName} WHERE id = $1 LIMIT 1`,
      [id]
    );
    return result.rows.length > 0;
  }
}

module.exports = BaseRepository;