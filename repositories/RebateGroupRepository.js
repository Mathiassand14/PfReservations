const BaseRepository = require('./BaseRepository');

class RebateGroupRepository extends BaseRepository {
  constructor() {
    super('rebate_groups');
  }

  async findByName(name) {
    const db = require('../config/database');
    const res = await db.query('SELECT * FROM rebate_groups WHERE name = $1', [name]);
    return res.rows[0] || null;
  }
}

module.exports = RebateGroupRepository;

