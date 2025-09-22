const express = require('express');
const router = express.Router();
const { stockMovementRepository, itemRepository } = require('../repositories');
const { StockMovement } = require('../models');
const { StockMovementService, ItemComponentService } = require('../services');
const { asyncHandler, adminTokenMiddleware } = require('../middleware/auth');

const stockMovementService = new StockMovementService();
const itemComponentService = new ItemComponentService();

// GET /api/stock-movements - Get stock movements with filtering
router.get('/', asyncHandler(async (req, res) => {
  const { 
    itemId, 
    orderId, 
    reason, 
    startDate, 
    endDate, 
    limit = 100,
    offset = 0 
  } = req.query;

  let movements;

  if (startDate && endDate) {
    if (itemId) {
      movements = await stockMovementRepository.getAuditTrail(startDate, endDate, parseInt(itemId));
    } else {
      movements = await stockMovementRepository.getMovementsByDateRange(startDate, endDate);
    }
  } else if (itemId) {
    movements = await stockMovementRepository.findByItem(parseInt(itemId), parseInt(limit));
  } else if (orderId) {
    movements = await stockMovementRepository.findByOrder(parseInt(orderId));
  } else if (reason) {
    movements = await stockMovementRepository.getMovementsByReason(reason, parseInt(limit));
  } else {
    // Get recent movements
    const recent = await stockMovementRepository.findAll({
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy: 'created_at DESC'
    });
    movements = recent;
  }

  const stockMovements = movements.map(movement => StockMovement.fromDatabaseRow(movement).toJSON());
  
  res.json({
    movements: stockMovements,
    count: stockMovements.length,
    filters: {
      itemId: itemId ? parseInt(itemId) : undefined,
      orderId: orderId ? parseInt(orderId) : undefined,
      reason,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset)
    }
  });
}));

// GET /api/stock-movements/reasons - Get valid movement reasons
router.get('/reasons', asyncHandler(async (req, res) => {
  const reasons = StockMovement.getValidReasons();
  const descriptions = StockMovement.getReasonDescriptions();
  const categories = StockMovement.getReasonCategories();
  
  res.json({
    reasons,
    descriptions,
    categories
  });
}));

// GET /api/stock-movements/summary/:itemId - Get movement summary for item
router.get('/summary/:itemId', asyncHandler(async (req, res) => {
  const itemId = parseInt(req.params.itemId);
  const summary = await stockMovementRepository.getStockMovementSummary(itemId);

  // Determine if item is composite and compute accordingly
  const item = await itemRepository.findById(itemId);
  let currentStock;

  if (item && (item.type === 'Composite' || item.is_composite === true)) {
    const composite = await itemComponentService.calculateCompositeStock(itemId);
    currentStock = {
      isCalculated: true,
      method: 'composite_min_sets',
      availableQuantity: composite.availableQuantity,
      limitingComponent: composite.limitingComponent,
      stockStatus: composite.stockStatus
    };
  } else {
    const atomic = await stockMovementRepository.getCurrentStock(itemId);
    currentStock = atomic ? { ...atomic, isCalculated: false } : null;
  }

  res.json({
    summary,
    currentStock,
    itemId
  });
}));

// POST /api/stock-movements - Create manual stock movement (requires admin token)
function mapStockError(message) {
  const details = [];
  let code = 'STOCK_ADJUSTMENT_FAILED';
  if (message.includes('Cannot manually adjust stock for composite items')) {
    code = 'STOCK_COMPOSITE_FORBIDDEN';
    details.push({ code, field: 'itemId', message });
  } else if (message.includes('service items')) {
    code = 'STOCK_SERVICE_FORBIDDEN';
    details.push({ code, field: 'itemId', message });
  } else if (message.includes('Invalid reason')) {
    code = 'STOCK_REASON_INVALID';
    details.push({ code, field: 'reason', message });
  } else if (message.includes('would result in negative stock') || message.includes('negative stock')) {
    code = 'STOCK_NEGATIVE_RESULT';
    details.push({ code, field: 'delta', message });
  } else if (message.includes('Item not found')) {
    code = 'ITEM_NOT_FOUND';
    details.push({ code, field: 'itemId', message });
  } else {
    details.push({ code: 'STOCK_ADJUSTMENT_FAILED', field: null, message });
  }
  return { code, details };
}

router.post('/', adminTokenMiddleware, asyncHandler(async (req, res) => {
  const { itemId, delta, reason = 'adjustment', createdBy = 'API User', notes } = req.body;
  
  if (!itemId || delta === undefined || !createdBy || !notes) {
    const missing = [];
    if (!itemId) missing.push({ code: 'MISSING_ITEM_ID', field: 'itemId', message: 'Item ID is required' });
    if (delta === undefined) missing.push({ code: 'MISSING_DELTA', field: 'delta', message: 'Delta is required' });
    if (!createdBy) missing.push({ code: 'MISSING_CREATED_BY', field: 'createdBy', message: 'Created by is required' });
    if (!notes) missing.push({ code: 'MISSING_NOTES', field: 'notes', message: 'Notes are required' });
    return res.status(400).json({
      error: {
        code: 'MISSING_DATA',
        message: 'Item ID, delta, created by, and notes are required',
        details: missing
      }
    });
  }

  try {
    const result = await stockMovementService.createManualAdjustment(
      itemId,
      delta,
      createdBy,
      notes,
      reason
    );
    
    res.status(201).json(result);
  } catch (error) {
    const mapped = mapStockError(error.message || 'Adjustment failed');
    const status = mapped.code === 'ITEM_NOT_FOUND' ? 404 : 400;
    return res.status(status).json({ error: { code: mapped.code, message: error.message, details: mapped.details } });
  }
}));

// GET /api/stock-movements/:id - Get specific stock movement
router.get('/:id', asyncHandler(async (req, res) => {
  const movement = await stockMovementRepository.findById(req.params.id);
  
  if (!movement) {
    return res.status(404).json({
      error: {
        code: 'MOVEMENT_NOT_FOUND',
        message: 'Stock movement not found'
      }
    });
  }

  res.json(StockMovement.fromDatabaseRow(movement).toJSON());
}));

// POST /api/stock-movements/batch - Create batch adjustments (requires admin token)
router.post('/batch', adminTokenMiddleware, asyncHandler(async (req, res) => {
  const { adjustments, createdBy = 'API User', notes } = req.body;
  
  if (!Array.isArray(adjustments) || adjustments.length === 0) {
    return res.status(400).json({
      error: {
        code: 'MISSING_ADJUSTMENTS',
        message: 'Adjustments array is required'
      }
    });
  }
  
  const result = await stockMovementService.createBatchAdjustments(adjustments, createdBy, notes);
  res.status(201).json(result);
}));

// POST /api/stock-movements/repair/send - Send items for repair (requires admin token)
router.post('/repair/send', adminTokenMiddleware, asyncHandler(async (req, res) => {
  const { itemId, quantity, createdBy = 'API User', notes } = req.body;
  
  if (!itemId || !quantity || !notes) {
    return res.status(400).json({
      error: {
        code: 'MISSING_DATA',
        message: 'Item ID, quantity, and notes are required',
        details: [
          ...(!itemId ? [{ code: 'MISSING_ITEM_ID', field: 'itemId', message: 'Item ID is required' }] : []),
          ...(!quantity ? [{ code: 'MISSING_QUANTITY', field: 'quantity', message: 'Quantity is required' }] : []),
          ...(!notes ? [{ code: 'MISSING_NOTES', field: 'notes', message: 'Notes are required' }] : [])
        ]
      }
    });
  }
  
  try {
    const result = await stockMovementService.sendItemForRepair(itemId, quantity, createdBy, notes);
    res.status(201).json(result);
  } catch (error) {
    const mapped = mapStockError(error.message || 'Repair send failed');
    const status = mapped.code === 'ITEM_NOT_FOUND' ? 404 : 400;
    return res.status(status).json({ error: { code: mapped.code, message: error.message, details: mapped.details } });
  }
}));

// POST /api/stock-movements/repair/return - Return items from repair (requires admin token)
router.post('/repair/return', adminTokenMiddleware, asyncHandler(async (req, res) => {
  const { itemId, quantity, createdBy = 'API User', notes } = req.body;
  
  if (!itemId || !quantity || !notes) {
    return res.status(400).json({
      error: {
        code: 'MISSING_DATA',
        message: 'Item ID, quantity, and notes are required',
        details: [
          ...(!itemId ? [{ code: 'MISSING_ITEM_ID', field: 'itemId', message: 'Item ID is required' }] : []),
          ...(!quantity ? [{ code: 'MISSING_QUANTITY', field: 'quantity', message: 'Quantity is required' }] : []),
          ...(!notes ? [{ code: 'MISSING_NOTES', field: 'notes', message: 'Notes are required' }] : [])
        ]
      }
    });
  }
  
  try {
    const result = await stockMovementService.returnItemFromRepair(itemId, quantity, createdBy, notes);
    res.status(201).json(result);
  } catch (error) {
    const mapped = mapStockError(error.message || 'Repair return failed');
    const status = mapped.code === 'ITEM_NOT_FOUND' ? 404 : 400;
    return res.status(status).json({ error: { code: mapped.code, message: error.message, details: mapped.details } });
  }
}));

// POST /api/stock-movements/loss/report - Report item loss (requires admin token)
router.post('/loss/report', adminTokenMiddleware, asyncHandler(async (req, res) => {
  const { itemId, quantity, createdBy = 'API User', notes } = req.body;
  
  if (!itemId || !quantity || !notes) {
    return res.status(400).json({
      error: {
        code: 'MISSING_DATA',
        message: 'Item ID, quantity, and notes are required',
        details: [
          ...(!itemId ? [{ code: 'MISSING_ITEM_ID', field: 'itemId', message: 'Item ID is required' }] : []),
          ...(!quantity ? [{ code: 'MISSING_QUANTITY', field: 'quantity', message: 'Quantity is required' }] : []),
          ...(!notes ? [{ code: 'MISSING_NOTES', field: 'notes', message: 'Notes are required' }] : [])
        ]
      }
    });
  }
  
  try {
    const result = await stockMovementService.reportItemLoss(itemId, quantity, createdBy, notes);
    res.status(201).json(result);
  } catch (error) {
    const mapped = mapStockError(error.message || 'Loss report failed');
    const status = mapped.code === 'ITEM_NOT_FOUND' ? 404 : 400;
    return res.status(status).json({ error: { code: mapped.code, message: error.message, details: mapped.details } });
  }
}));

// POST /api/stock-movements/found/report - Report found items (requires admin token)
router.post('/found/report', adminTokenMiddleware, asyncHandler(async (req, res) => {
  const { itemId, quantity, createdBy = 'API User', notes } = req.body;
  
  if (!itemId || !quantity || !notes) {
    return res.status(400).json({
      error: {
        code: 'MISSING_DATA',
        message: 'Item ID, quantity, and notes are required',
        details: [
          ...(!itemId ? [{ code: 'MISSING_ITEM_ID', field: 'itemId', message: 'Item ID is required' }] : []),
          ...(!quantity ? [{ code: 'MISSING_QUANTITY', field: 'quantity', message: 'Quantity is required' }] : []),
          ...(!notes ? [{ code: 'MISSING_NOTES', field: 'notes', message: 'Notes are required' }] : [])
        ]
      }
    });
  }
  
  try {
    const result = await stockMovementService.reportItemFound(itemId, quantity, createdBy, notes);
    res.status(201).json(result);
  } catch (error) {
    const mapped = mapStockError(error.message || 'Found report failed');
    const status = mapped.code === 'ITEM_NOT_FOUND' ? 404 : 400;
    return res.status(status).json({ error: { code: mapped.code, message: error.message, details: mapped.details } });
  }
}));

// GET /api/stock-movements/item/:itemId/history - Get detailed movement history for item
router.get('/item/:itemId/history', asyncHandler(async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  const result = await stockMovementService.getItemMovementHistory(
    req.params.itemId, 
    parseInt(limit), 
    parseInt(offset)
  );
  res.json(result);
}));

// GET /api/stock-movements/order/:orderId/history - Get movement history for order
router.get('/order/:orderId/history', asyncHandler(async (req, res) => {
  const result = await stockMovementService.getOrderMovementHistory(req.params.orderId);
  res.json(result);
}));

// GET /api/stock-movements/stats - Get movement statistics
router.get('/stats', asyncHandler(async (req, res) => {
  const { startDate, endDate, itemId } = req.query;
  
  if (!startDate || !endDate) {
    return res.status(400).json({
      error: {
        code: 'MISSING_DATES',
        message: 'Start date and end date are required'
      }
    });
  }
  
  const stats = await stockMovementService.getMovementStatistics(
    startDate, 
    endDate, 
    itemId ? parseInt(itemId) : null
  );
  res.json(stats);
}));

// GET /api/stock-movements/recent - Get recent movements
router.get('/recent', asyncHandler(async (req, res) => {
  const { limit = 20, itemId } = req.query;
  const result = await stockMovementService.getRecentMovements(
    parseInt(limit), 
    itemId ? parseInt(itemId) : null
  );
  res.json(result);
}));

// POST /api/stock-movements/validate - Validate movement impact (doesn't create movement)
router.post('/validate', asyncHandler(async (req, res) => {
  const { itemId, delta } = req.body;
  
  if (!itemId || delta === undefined) {
    return res.status(400).json({
      error: {
        code: 'MISSING_DATA',
        message: 'Item ID and delta are required'
      }
    });
  }
  
  const validation = await stockMovementService.validateMovementImpact(itemId, delta);
  res.json(validation);
}));

module.exports = router;
