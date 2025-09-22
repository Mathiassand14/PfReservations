const BaseRepository = require('./BaseRepository');

class PriceRepository extends BaseRepository {
  constructor() {
    super('prices');
  }

  async upsert(itemId, kind, amount) {
    const query = `
      INSERT INTO prices (item_id, kind, amount)
      VALUES ($1, $2, $3)
      ON CONFLICT (item_id, kind)
      DO UPDATE SET amount = EXCLUDED.amount
      RETURNING *
    `;
    const db = require('../config/database');
    const result = await db.query(query, [itemId, kind, amount]);
    return result.rows[0];
  }

  async deleteByItem(itemId) {
    const db = require('../config/database');
    await db.query('DELETE FROM prices WHERE item_id = $1', [itemId]);
  }

  async findByItem(itemId) {
    const db = require('../config/database');
    const res = await db.query('SELECT item_id, kind, amount FROM prices WHERE item_id = $1', [itemId]);
    return res.rows;
  }

  async findByItems(itemIds = []) {
    if (!Array.isArray(itemIds) || itemIds.length === 0) return new Map();
    const db = require('../config/database');
    const res = await db.query('SELECT item_id, kind, amount FROM prices WHERE item_id = ANY($1)', [itemIds]);
    const map = new Map();
    for (const r of res.rows) {
      if (!map.has(r.item_id)) map.set(r.item_id, {});
      map.get(r.item_id)[r.kind] = Number(r.amount);
    }
    return map;
  }
}

module.exports = PriceRepository;
