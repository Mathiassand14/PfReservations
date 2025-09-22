const express = require('express');
const router = express.Router();
const { OrderService } = require('../services');
const { createLogger } = require('../services/logger');
const log = createLogger('api:orders-recalc');
const { asyncHandler } = require('../middleware/auth');

const orderService = new OrderService();

router.post('/:id/recalculate', asyncHandler(async (req, res) => {
  const id = req.params.id;
  log.info('recalculate_request', { orderId: id });
  const order = await orderService.recalculate(id);
  log.info('recalculate_success', { orderId: id });
  res.json(order);
}));

module.exports = router;
