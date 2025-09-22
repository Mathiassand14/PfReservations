const express = require('express');
const router = express.Router();
const { orderRepository, orderRowRepository, stockMovementRepository } = require('../repositories');
const { Order, StockMovement } = require('../models');
const { OrderService, OrderStatusService, AvailabilityService } = require('../services');
const ReceiptService = require('../services/ReceiptService');
const { asyncHandler } = require('../middleware/auth');

const orderService = new OrderService();
const orderStatusService = new OrderStatusService();
const availabilityService = new AvailabilityService();
const receiptService = new ReceiptService();
const ordersRecalcRouter = require('./orders-recalc');

// GET /api/orders - List and search orders
router.get('/', asyncHandler(async (req, res) => {
  const filters = {
    status: req.query.status,
    customerId: req.query.customerId ? parseInt(req.query.customerId) : undefined,
    salesPersonId: req.query.salesPersonId ? parseInt(req.query.salesPersonId) : undefined,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    limit: req.query.limit ? parseInt(req.query.limit) : 50,
    offset: req.query.offset ? parseInt(req.query.offset) : 0
  };

  const orders = await orderService.searchOrders(filters);
  
  res.json({
    orders,
    count: orders.length,
    filters: Object.fromEntries(Object.entries(filters).filter(([k, v]) => v !== undefined))
  });
}));

// POST /api/orders/:id/recalculate - Recalculate totals (placeholder)
router.use('/', ordersRecalcRouter);

// GET /api/orders/stats - Get order statistics
router.get('/stats', asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  if (!startDate || !endDate) {
    return res.status(400).json({
      error: {
        code: 'MISSING_DATES',
        message: 'Start date and end date are required'
      }
    });
  }

  const stats = await orderRepository.getOrderStats(startDate, endDate);
  res.json({
    stats,
    period: { startDate, endDate }
  });
}));

// GET /api/orders/active - Get active orders
router.get('/active', asyncHandler(async (req, res) => {
  const activeOrders = await orderRepository.getActiveOrders();
  const orders = activeOrders.map(order => Order.fromDatabaseRow(order).toJSON());
  
  res.json({
    orders,
    count: orders.length
  });
}));

// GET /api/orders/overdue - Get overdue orders
router.get('/overdue', asyncHandler(async (req, res) => {
  const overdueOrders = await orderRepository.getOverdueOrders();
  
  res.json({
    orders: overdueOrders,
    count: overdueOrders.length
  });
}));

// GET /api/orders/:id - Get order by ID with full details
router.get('/:id', asyncHandler(async (req, res) => {
  const order = await orderService.getOrderWithDetails(req.params.id);
  res.json({ order, ...order });
}));

// GET /api/orders/:id/lines - Get line items for order
router.get('/:id/lines', asyncHandler(async (req, res) => {
  const order = await orderRepository.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } });
  }

  const rows = await orderRowRepository.findByOrder(req.params.id);
  const start = new Date(order.start_date || order.startDate);
  const end = new Date(order.return_due_date || order.returnDueDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const rentalDays = Math.max(1, Math.ceil((end - start) / msPerDay));

  const lineItems = rows.map(r => ({
    id: r.id,
    orderId: r.order_id,
    itemId: r.item_id,
    itemName: r.item_name,
    itemSku: r.item_sku,
    quantity: Number(r.quantity),
    pricePerDay: Number(r.price_per_day),
    rentalDays,
    lineTotal: Number(r.line_total)
  }));

  res.json({
    orderId: parseInt(req.params.id),
    lineItems,
    count: lineItems.length
  });
}));

// GET /api/orders/:id/availability - Check order availability
router.get('/:id/availability', asyncHandler(async (req, res) => {
  const validation = await orderService.validateOrderForReservation(req.params.id);
  res.json(validation);
}));

// GET /api/orders/:id/stock-movements - Get stock movements for order
router.get('/:id/stock-movements', asyncHandler(async (req, res) => {
  const movements = await stockMovementRepository.findByOrder(req.params.id);
  const stockMovements = movements.map(movement => StockMovement.fromDatabaseRow(movement).toJSON());
  
  res.json({
    movements: stockMovements,
    count: stockMovements.length
  });
}));

function mapOrderValidationErrors(errors = []) {
  const mapped = [];
  for (const msg of errors) {
  if (msg.includes('Customer ID is required')) {
    mapped.push({ code: 'ORDER_CUSTOMER_ID_REQUIRED', field: 'customerId', message: msg });
  } else if (msg.includes('Sales person ID is required')) {
    mapped.push({ code: 'ORDER_SALES_PERSON_ID_REQUIRED', field: 'salesPersonId', message: msg });
  } else if (msg.includes('Status must be one of')) {
    mapped.push({ code: 'ORDER_STATUS_INVALID', field: 'status', message: msg });
  } else if (msg.includes('Start date is required')) {
    mapped.push({ code: 'ORDER_START_DATE_REQUIRED', field: 'startDate', message: msg });
  } else if (msg.includes('Return due date is required')) {
    mapped.push({ code: 'ORDER_RETURN_DUE_DATE_REQUIRED', field: 'returnDueDate', message: msg });
  } else if (msg.includes('Either Start/Return dates or Order Start/End must be provided')) {
    mapped.push({ code: 'ORDER_TIME_WINDOW_REQUIRED', field: 'timeWindow', message: msg });
  } else if (msg.includes('Return due date must be after')) {
    mapped.push({ code: 'ORDER_DATE_RANGE_INVALID', field: 'returnDueDate', message: msg });
  } else if (msg.includes('Order End must be after Order Start')) {
    mapped.push({ code: 'ORDER_TIME_ORDER_END_AFTER_START', field: 'orderEnd', message: msg });
  } else if (msg.includes('Order Start must be on/after Setup Start')) {
    mapped.push({ code: 'ORDER_TIME_START_AFTER_SETUP', field: 'orderStart', message: msg });
  } else if (msg.includes('Cleanup End must be on/after Order End')) {
    mapped.push({ code: 'ORDER_TIME_CLEANUP_AFTER_END', field: 'cleanupEnd', message: msg });
  } else if (msg.includes('Discount amount cannot be negative')) {
    mapped.push({ code: 'ORDER_DISCOUNT_NEGATIVE', field: 'discountAmount', message: msg });
  } else if (msg.includes('Tax amount cannot be negative')) {
    mapped.push({ code: 'ORDER_TAX_NEGATIVE', field: 'taxAmount', message: msg });
  } else {
      mapped.push({ code: 'ORDER_VALIDATION_ERROR', field: null, message: msg });
    }
  }
  return mapped;
}

// POST /api/orders - Create new order (supports 4-date window)
router.post('/', asyncHandler(async (req, res) => {
  // Pre-validate full payload using model
  const pre = new Order({
    customerId: req.body.customerId,
    salesPersonId: req.body.salesPersonId,
    startDate: req.body.startDate,
    returnDueDate: req.body.returnDueDate,
    setupStart: req.body.setupStart,
    orderStart: req.body.orderStart,
    orderEnd: req.body.orderEnd,
    cleanupEnd: req.body.cleanupEnd,
    discountAmount: req.body.discountAmount || 0,
    taxAmount: req.body.taxAmount || 0
  });
  const validation = pre.validate();
  if (!validation.isValid) {
    return res.status(400).json({
      error: {
        code: 'ORDER_VALIDATION_FAILED',
        message: 'Invalid order data',
        details: mapOrderValidationErrors(validation.errors)
      }
    });
  }

  try {
    const order = await orderService.createOrder(req.body);
    const obj = order.toJSON();
    res.status(201).json({ order: obj, ...obj });
  } catch (error) {
    const msg = error.message || '';
    if (msg.includes('Customer not found')) {
      return res.status(404).json({ error: { code: 'ORDER_CUSTOMER_NOT_FOUND', message: msg } });
    }
    if (msg.includes('Sales person not found')) {
      return res.status(404).json({ error: { code: 'ORDER_SALES_PERSON_NOT_FOUND', message: msg } });
    }
    if (msg.includes('inactive customers')) {
      return res.status(409).json({ error: { code: 'ORDER_CUSTOMER_INACTIVE', message: msg } });
    }
    if (msg.includes('inactive employees')) {
      return res.status(409).json({ error: { code: 'ORDER_EMPLOYEE_INACTIVE', message: msg } });
    }
    if (msg.includes('Return due date must be after')) {
      return res.status(400).json({ error: { code: 'ORDER_DATE_RANGE_INVALID', message: msg } });
    }
    // Fallback to global handler
    throw error;
  }
}));

// PUT /api/orders/:id - Update order (Draft orders only)
router.put('/:id', asyncHandler(async (req, res) => {
  const existingOrder = await orderRepository.findById(req.params.id);
  if (!existingOrder) {
    return res.status(404).json({
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found'
      }
    });
  }

  const orderObj = Order.fromDatabaseRow(existingOrder);
  if (orderObj.status !== 'Draft') {
    return res.status(409).json({
      error: {
        code: 'ORDER_NOT_DRAFT',
        message: 'Can only modify Draft orders'
      }
    });
  }

  const updatedData = { ...existingOrder, ...req.body };
  const updatedOrder = new Order(updatedData);
  
  const validation = updatedOrder.validate();
  if (!validation.isValid) {
    return res.status(400).json({
      error: {
        code: 'ORDER_VALIDATION_FAILED',
        message: 'Invalid order data',
        details: mapOrderValidationErrors(validation.errors)
      }
    });
  }

  const savedOrder = await orderRepository.update(req.params.id, updatedOrder.toDatabaseObject());
  const orderWithDetails = await orderService.getOrderWithDetails(savedOrder.id);
  
  res.json({ order: orderWithDetails, ...orderWithDetails });
}));

// POST /api/orders/:id/lines - Add line item to order
function mapOrderLineError(message) {
  const details = [];
  let code = 'ORDER_LINE_ERROR';
  if (message.includes('Order ID is required')) {
    code = 'ORDER_LINE_ORDER_ID_REQUIRED';
    details.push({ code, field: 'orderId', message });
  } else if (message.includes('Item ID is required')) {
    code = 'ORDER_LINE_ITEM_ID_REQUIRED';
    details.push({ code, field: 'itemId', message });
  } else if (message.includes('Quantity must be greater than 0')) {
    code = 'ORDER_LINE_QUANTITY_POSITIVE';
    details.push({ code, field: 'quantity', message });
  } else if (message.includes('Price per day must be')) {
    code = 'ORDER_LINE_PRICE_NONNEGATIVE';
    details.push({ code, field: 'pricePerDay', message });
  } else if (message.includes('Order not found')) {
    code = 'ORDER_NOT_FOUND';
    details.push({ code, field: 'orderId', message });
  } else if (message.includes('Can only modify line items for Draft orders')) {
    code = 'ORDER_NOT_DRAFT';
    details.push({ code, field: 'status', message });
  } else if (message.includes('Item not found')) {
    code = 'ITEM_NOT_FOUND';
    details.push({ code, field: 'itemId', message });
  } else if (message.includes('already exists in order')) {
    code = 'ORDER_LINE_ITEM_ALREADY_EXISTS';
    details.push({ code, field: 'itemId', message });
  } else if (message.includes('Line item not found')) {
    code = 'ORDER_LINE_ITEM_NOT_FOUND';
    details.push({ code, field: 'lineId', message });
  } else {
    details.push({ code: 'ORDER_LINE_ERROR', field: null, message });
  }
  return { code, details };
}

router.post('/:id/lines', asyncHandler(async (req, res) => {
  const { itemId, quantity, pricePerDay } = req.body;
  
  if (!itemId || !quantity || pricePerDay === undefined) {
    return res.status(400).json({
      error: {
        code: 'MISSING_DATA',
        message: 'Item ID, quantity, and price per day are required'
      }
    });
  }

  try {
    const lineItem = await orderService.addLineItem(req.params.id, itemId, quantity, pricePerDay);
    res.status(201).json(lineItem);
  } catch (error) {
    const mapped = mapOrderLineError(error.message || 'Add line item failed');
    const status = mapped.code === 'ORDER_NOT_FOUND' || mapped.code === 'ITEM_NOT_FOUND' ? 404
      : mapped.code === 'ORDER_NOT_DRAFT' || mapped.code === 'ORDER_LINE_ITEM_ALREADY_EXISTS' ? 409
      : 400;
    return res.status(status).json({ error: { code: mapped.code, message: error.message, details: mapped.details } });
  }
}));

// PUT /api/orders/:id/lines/:lineId - Update line item
router.put('/:id/lines/:lineId', asyncHandler(async (req, res) => {
  const { quantity, pricePerDay } = req.body;
  
  if (!quantity || pricePerDay === undefined) {
    return res.status(400).json({
      error: {
        code: 'MISSING_DATA',
        message: 'Quantity and price per day are required'
      }
    });
  }

  try {
    const lineItem = await orderService.updateLineItem(req.params.lineId, quantity, pricePerDay);
    res.json(lineItem);
  } catch (error) {
    const mapped = mapOrderLineError(error.message || 'Update line item failed');
    const status = mapped.code === 'ORDER_NOT_FOUND' || mapped.code === 'ORDER_LINE_ITEM_NOT_FOUND' ? 404
      : mapped.code === 'ORDER_NOT_DRAFT' ? 409
      : 400;
    return res.status(status).json({ error: { code: mapped.code, message: error.message, details: mapped.details } });
  }
}));

// DELETE /api/orders/:id/lines/:lineId - Remove line item
router.delete('/:id/lines/:lineId', asyncHandler(async (req, res) => {
  try {
    const result = await orderService.removeLineItem(req.params.lineId);
    res.json(result);
  } catch (error) {
    const mapped = mapOrderLineError(error.message || 'Remove line item failed');
    const status = mapped.code === 'ORDER_NOT_FOUND' || mapped.code === 'ORDER_LINE_ITEM_NOT_FOUND' ? 404
      : mapped.code === 'ORDER_NOT_DRAFT' ? 409
      : 400;
    return res.status(status).json({ error: { code: mapped.code, message: error.message, details: mapped.details } });
  }
}));

// PATCH /api/orders/:id/pricing - Update order discount and tax
router.patch('/:id/pricing', asyncHandler(async (req, res) => {
  const { discountAmount = 0, taxAmount = 0 } = req.body;
  
  const totals = await orderService.updateOrderPricing(req.params.id, discountAmount, taxAmount);
  res.json(totals);
}));

// POST /api/orders/:id/transition - Transition order status (requires admin token)
router.post('/:id/transition', asyncHandler(async (req, res) => {
  const { newStatus, createdBy = 'API User', notes } = req.body;
  
  if (!newStatus) {
    return res.status(400).json({
      error: {
        code: 'MISSING_STATUS',
        message: 'New status is required'
      }
    });
  }

  try {
    const result = await orderStatusService.transitionOrderStatus(
      req.params.id,
      newStatus,
      createdBy,
      notes
    );
    
    res.json(result);
  } catch (error) {
    // Handle specific error types
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: {
          code: 'ORDER_NOT_FOUND',
          message: error.message
        }
      });
    }
    
    if (error.message.includes('Invalid transition') || error.message.includes('Cannot transition')) {
      return res.status(409).json({
        error: {
          code: 'INVALID_TRANSITION',
          message: error.message
        }
      });
    }
    
    if (error.message.includes('Availability validation failed')) {
      return res.status(409).json({
        error: {
          code: 'AVAILABILITY_CONFLICT',
          message: error.message
        }
      });
    }
    
    // Re-throw for global error handler
    throw error;
  }
}));

// GET /api/orders/:id/transitions - Get valid transitions for order
router.get('/:id/transitions', asyncHandler(async (req, res) => {
  const transitions = await orderStatusService.getValidTransitions(req.params.id);
  res.json(transitions);
}));

// GET /api/orders/:id/status-history - Get status transition history
router.get('/:id/status-history', asyncHandler(async (req, res) => {
  const history = await orderStatusService.getStatusHistory(req.params.id);
  res.json(history);
}));

// POST /api/orders/:id/reserve - Reserve order (convenience endpoint)
router.post('/:id/reserve', asyncHandler(async (req, res) => {
  const { createdBy = 'API User', notes } = req.body;
  const result = await orderStatusService.reserveOrder(req.params.id, createdBy, notes);
  res.json(result);
}));

// POST /api/orders/:id/checkout - Checkout order (convenience endpoint)
router.post('/:id/checkout', asyncHandler(async (req, res) => {
  const { createdBy = 'API User', notes } = req.body;
  const result = await orderStatusService.checkoutOrder(req.params.id, createdBy, notes);
  res.json(result);
}));

// POST /api/orders/:id/return - Return order (convenience endpoint)
router.post('/:id/return', asyncHandler(async (req, res) => {
  const { createdBy = 'API User', notes } = req.body;
  const result = await orderStatusService.returnOrder(req.params.id, createdBy, notes);
  res.json(result);
}));

// POST /api/orders/:id/cancel - Cancel order (convenience endpoint)
router.post('/:id/cancel', asyncHandler(async (req, res) => {
  const { createdBy = 'API User', notes } = req.body;
  const result = await orderStatusService.cancelOrder(req.params.id, createdBy, notes);
  res.json(result);
}));

// POST /api/orders/bulk-transition - Bulk status transitions (requires admin token)
router.post('/bulk-transition', asyncHandler(async (req, res) => {
  const { orderIds, newStatus, createdBy = 'API User', notes } = req.body;
  
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return res.status(400).json({
      error: {
        code: 'MISSING_ORDER_IDS',
        message: 'Order IDs array is required'
      }
    });
  }
  
  if (!newStatus) {
    return res.status(400).json({
      error: {
        code: 'MISSING_STATUS',
        message: 'New status is required'
      }
    });
  }
  
  const result = await orderStatusService.bulkTransition(orderIds, newStatus, createdBy, notes);
  res.json(result);
}));

// DELETE /api/orders/:id - Delete order (Draft orders only)
router.delete('/:id', asyncHandler(async (req, res) => {
  const order = await orderRepository.findById(req.params.id);
  if (!order) {
    return res.status(404).json({
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found'
      }
    });
  }

  const orderObj = Order.fromDatabaseRow(order);
  if (orderObj.status !== 'Draft') {
    return res.status(409).json({
      error: {
        code: 'ORDER_NOT_DRAFT',
        message: 'Can only delete Draft orders'
      }
    });
  }

  // Delete order (cascade will handle line items)
  const deletedOrder = await orderRepository.delete(req.params.id);
  
  res.json({
    message: 'Order deleted successfully',
    order: Order.fromDatabaseRow(deletedOrder).toJSON()
  });
}));

// GET /api/orders/:id/receipt - Generate PDF receipt for order
router.get('/:id/receipt', asyncHandler(async (req, res) => {
  const order = await orderRepository.findById(req.params.id);
  if (!order) {
    return res.status(404).json({
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found'
      }
    });
  }

  try {
    const pdfBuffer = await receiptService.generateReceiptBuffer(req.params.id);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt-order-${req.params.id}.pdf"`,
      'Content-Length': pdfBuffer.length
    });
    
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating receipt:', error);
    res.status(500).json({
      error: {
        code: 'RECEIPT_GENERATION_ERROR',
        message: 'Failed to generate receipt PDF'
      }
    });
  }
}));

module.exports = router;
