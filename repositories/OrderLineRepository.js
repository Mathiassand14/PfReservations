const BaseRepository = require('./BaseRepository');

class OrderLineRepository extends BaseRepository {
  constructor() {
    super('order_lines');
  }
}

module.exports = OrderLineRepository;

