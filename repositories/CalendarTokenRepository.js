const BaseRepository = require('./BaseRepository');
const db = require('../config/database');

class CalendarTokenRepository extends BaseRepository {
  constructor() {
    super('calendar_tokens');
  }

  async findByToken(token) {
    const result = await db.query(
      'SELECT * FROM calendar_tokens WHERE token = $1',
      [token]
    );
    return result.rows[0] || null;
  }

  async generateToken(description, createdBy) {
    // Generate a secure random token
    const token = 'cal-token-' + Math.random().toString(36).substring(2, 15) + 
                  Math.random().toString(36).substring(2, 15);
    
    const result = await db.query(`
      INSERT INTO calendar_tokens (token, description, created_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [token, description, createdBy]);
    
    return result.rows[0];
  }

  async updateLastUsed(token) {
    const result = await db.query(`
      UPDATE calendar_tokens 
      SET last_used_at = CURRENT_TIMESTAMP
      WHERE token = $1
      RETURNING *
    `, [token]);
    
    return result.rows[0] || null;
  }

  async revokeToken(tokenId) {
    return this.delete(tokenId);
  }

  async getActiveTokens() {
    return this.findAll({ orderBy: 'created_at DESC' });
  }

  async getTokenUsageStats() {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_tokens,
        COUNT(CASE WHEN last_used_at IS NOT NULL THEN 1 END) as used_tokens,
        COUNT(CASE WHEN last_used_at > CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 1 END) as recently_used,
        MAX(last_used_at) as most_recent_use
      FROM calendar_tokens
    `);
    
    return result.rows[0];
  }

  async cleanupUnusedTokens(daysOld = 90) {
    const result = await db.query(`
      DELETE FROM calendar_tokens 
      WHERE last_used_at IS NULL 
      AND created_at < CURRENT_TIMESTAMP - INTERVAL '${daysOld} days'
      RETURNING *
    `);
    
    return result.rows;
  }
}

module.exports = CalendarTokenRepository;