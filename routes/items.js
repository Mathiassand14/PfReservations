const express = require('express');
const router = express.Router();
const { itemRepository, priceRepository } = require('../repositories');
const { Item } = require('../models');
const { InventoryService, ItemComponentService, AvailabilityService } = require('../services');
const { asyncHandler } = require('../middleware/auth');

const inventoryService = new InventoryService();
const itemComponentService = new ItemComponentService();
const availabilityService = new AvailabilityService();

function mapItemValidationErrors(errors = []) {
  const mapped = [];
  for (const msg of errors) {
    if (msg.includes('Item name is required')) {
      mapped.push({ code: 'ITEM_NAME_REQUIRED', field: 'name', message: msg });
    } else if (msg.includes('Item name must be 255')) {
      mapped.push({ code: 'ITEM_NAME_TOO_LONG', field: 'name', message: msg });
    } else if (msg.includes('SKU is required')) {
      mapped.push({ code: 'ITEM_SKU_REQUIRED', field: 'sku', message: msg });
    } else if (msg.includes('SKU must be 100')) {
      mapped.push({ code: 'ITEM_SKU_TOO_LONG', field: 'sku', message: msg });
    } else if (msg.includes('Price per day must be non-negative')) {
      mapped.push({ code: 'ITEM_PRICE_DAILY_NONNEGATIVE', field: 'pricePerDay', message: msg });
    } else if (msg.includes('Price per day must be less')) {
      mapped.push({ code: 'ITEM_PRICE_DAILY_TOO_HIGH', field: 'pricePerDay', message: msg });
    } else if (msg.includes('Composite items should not have a quantity on hand')) {
      mapped.push({ code: 'ITEM_COMPOSITE_QUANTITY_FORBIDDEN', field: 'quantityOnHand', message: msg });
    } else if (msg.includes('Service items should not have a quantity on hand')) {
      mapped.push({ code: 'ITEM_SERVICE_QUANTITY_FORBIDDEN', field: 'quantityOnHand', message: msg });
    } else if (msg.includes('Quantity on hand must be non-negative')) {
      mapped.push({ code: 'ITEM_QUANTITY_NONNEGATIVE', field: 'quantityOnHand', message: msg });
    } else {
      mapped.push({ code: 'ITEM_VALIDATION_ERROR', field: null, message: msg });
    }
  }
  return mapped;
}

// GET /api/items - List all items
router.get('/', asyncHandler(async (req, res) => {
  const { type, search, limit = 50, offset = 0 } = req.query;
  
  let items;
  
  if (search) {
    items = await itemRepository.searchByName(search);
  } else if (type === 'atomic') {
    items = await itemRepository.findAtomic();
  } else if (type === 'composite') {
    items = await itemRepository.findComposite();
  } else if (type === 'service') {
    items = await itemRepository.findService();
  } else {
    items = await itemRepository.findAll({
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy: 'name ASC'
    });
  }

  const itemObjects = items.map(item => Item.fromDatabaseRow(item).toJSON());
  
  res.json({
    items: itemObjects,
    count: itemObjects.length
  });
}));

// GET /api/items/stock-levels - Get stock levels for all items
router.get('/stock-levels', asyncHandler(async (req, res) => {
  const stockLevels = await inventoryService.getAllStockLevels();
  res.json({
    stockLevels,
    count: stockLevels.length
  });
}));

// GET /api/items/low-stock - Get low stock items
router.get('/low-stock', asyncHandler(async (req, res) => {
  const { threshold = 5 } = req.query;
  const lowStockItems = await inventoryService.getLowStockItems(parseInt(threshold));
  res.json({
    items: lowStockItems,
    count: lowStockItems.length,
    threshold: parseInt(threshold)
  });
}));

// GET /api/items/out-of-stock - Get out of stock items
router.get('/out-of-stock', asyncHandler(async (req, res) => {
  const outOfStockItems = await inventoryService.getOutOfStockItems();
  res.json({
    items: outOfStockItems,
    count: outOfStockItems.length
  });
}));

// GET /api/items/available - List items available for a given period and quantity
router.get('/available', asyncHandler(async (req, res) => {
  const { startDate, endDate, quantity = 1, excludeOrderId, includeService } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({
      error: {
        code: 'MISSING_DATES',
        message: 'Start date and end date are required'
      }
    });
  }

  // Load all items and filter types per includeService
  const all = await itemRepository.findAll({ orderBy: 'name ASC' });
  const filtered = all.filter(i => (i.type === 'Atomic' || i.type === 'Composite' || (includeService === 'true' && i.type === 'Service')));

  // Build requests for availability check
  const itemRequests = filtered.map(i => ({ itemId: i.id, quantity: parseInt(quantity) || 1 }));
  const availabilityService = new (require('../services').AvailabilityService)();
  const result = await availabilityService.checkMultipleItemsAvailability(
    itemRequests,
    startDate,
    endDate,
    excludeOrderId ? parseInt(excludeOrderId) : null
  );

  const byId = new Map(filtered.map(i => [i.id, i]));
  const availableItems = result.results
    .filter(r => r.isAvailable)
    .map(r => {
      const item = byId.get(r.itemId);
      const obj = Item.fromDatabaseRow(item).toJSON();
      return {
        ...obj,
        available: r.available,
        baseQuantity: r.baseQuantity,
        reservedQuantity: r.reservedQuantity
      };
    });

  res.json({
    items: availableItems,
    count: availableItems.length,
    period: { startDate, endDate },
    requestedQuantity: parseInt(quantity) || 1
  });
}));

// GET /api/items/:id - Get item by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const item = await itemRepository.findById(req.params.id);
  
  if (!item) {
    return res.status(404).json({
      error: {
        code: 'ITEM_NOT_FOUND',
        message: 'Item not found'
      }
    });
  }

  const obj = Item.fromDatabaseRow(item).toJSON();
  res.json({ item: obj, ...obj });
}));

// GET /api/items/:id/prices - Get item prices (Start/Daily/Hourly)
router.get('/:id/prices', asyncHandler(async (req, res) => {
  const item = await itemRepository.findById(req.params.id);
  if (!item) {
    return res.status(404).json({ error: { code: 'ITEM_NOT_FOUND', message: 'Item not found' } });
  }
  const rows = await priceRepository.findByItem(req.params.id);
  const prices = {};
  for (const r of rows) {
    prices[r.kind] = Number(r.amount);
  }
  res.json({ itemId: Number(req.params.id), type: item.type || (item.is_composite ? 'Composite' : 'Atomic'), prices });
}));

// GET /api/items/:id/details - Get item with components (for composite items)
router.get('/:id/details', asyncHandler(async (req, res) => {
  const itemDetails = await itemComponentService.getItemWithComponents(req.params.id);
  res.json(itemDetails);
}));

// GET /api/items/:id/components - Get item components
router.get('/:id/components', asyncHandler(async (req, res) => {
  const components = await itemComponentService.getItemComponents(req.params.id);
  res.json({
    components,
    count: components.length
  });
}));

// GET /api/items/:id/availability - Get item availability for date range
router.get('/:id/availability', asyncHandler(async (req, res) => {
  const { startDate, endDate, excludeOrderId } = req.query;
  
  if (!startDate || !endDate) {
    return res.status(400).json({
      error: {
        code: 'MISSING_DATES',
        message: 'Start date and end date are required'
      }
    });
  }

  const availability = await availabilityService.checkItemAvailability(
    req.params.id,
    startDate,
    endDate,
    excludeOrderId ? parseInt(excludeOrderId) : null
  );

  res.json(availability);
}));

// GET /api/items/:id/stock-summary - Get stock summary for item
router.get('/:id/stock-summary', asyncHandler(async (req, res) => {
  const stockSummary = await inventoryService.getStockSummary(req.params.id);
  res.json(stockSummary);
}));

// GET /api/items/:id/stock-movements - Get stock movement history
router.get('/:id/stock-movements', asyncHandler(async (req, res) => {
  const { limit = 50 } = req.query;
  const movements = await inventoryService.getStockMovementHistory(req.params.id, parseInt(limit));
  res.json({
    movements,
    count: movements.length
  });
}));

// POST /api/items - Create new item (requires admin token)
router.post('/', asyncHandler(async (req, res) => {
  const item = new Item(req.body);
  
  const validation = item.validate();
  if (!validation.isValid) {
    return res.status(400).json({
      error: {
        code: 'ITEM_VALIDATION_FAILED',
        message: 'Invalid item data',
        details: mapItemValidationErrors(validation.errors)
      }
    });
  }

  // Check if SKU already exists
  const existingItem = await itemRepository.findBySku(item.sku);
  if (existingItem) {
    return res.status(409).json({
      error: {
        code: 'SKU_EXISTS',
        message: 'Item with this SKU already exists'
      }
    });
  }

  let createdItem;
  try {
    createdItem = await itemRepository.create(item.toDatabaseObject());
  } catch (e) {
    // Map common DB constraint violations to clearer messages
    if (e && e.code === '23514') { // check constraint violation
      const msg = String(e.message || '');
      if (msg.includes('check_atomic_has_quantity')) {
        return res.status(400).json({
          error: {
            code: 'ITEM_QUANTITY_CONSTRAINT_LEGACY',
            message: 'Database has a legacy quantity constraint. Please run migrations to drop check_atomic_has_quantity.'
          }
        });
      }
      if (msg.includes('items_qty_by_type_check')) {
        return res.status(400).json({
          error: {
            code: 'ITEM_QTY_BY_TYPE_CONSTRAINT',
            message: 'Quantity must be NULL for Service/Composite and non-negative for Atomic.'
          }
        });
      }
    }
    throw e;
  }

  // Handle type-specific prices if provided
  const prices = req.body.prices || {};
  try {
    if (createdItem.type === 'Composite') {
      await priceRepository.deleteByItem(createdItem.id);
    } else if (createdItem.type === 'Atomic') {
      if (prices.Start !== undefined) await priceRepository.upsert(createdItem.id, 'Start', Number(prices.Start) || 0);
      if (prices.Daily !== undefined) await priceRepository.upsert(createdItem.id, 'Daily', Number(prices.Daily) || 0);
      // keep legacy price_per_day in sync with Daily when provided
      if (prices.Daily !== undefined) {
        await itemRepository.update(createdItem.id, { price_per_day: Number(prices.Daily) || 0 });
      }
    } else if (createdItem.type === 'Service') {
      await priceRepository.deleteByItem(createdItem.id);
      if (prices.Hourly !== undefined) await priceRepository.upsert(createdItem.id, 'Hourly', Number(prices.Hourly) || 0);
      // legacy price_per_day not applicable for services; set to 0
      await itemRepository.update(createdItem.id, { price_per_day: 0, quantity_on_hand: null });
    }
  } catch (e) {
    // If price constraint fails, return 400
    return res.status(400).json({ error: { code: 'PRICE_CONSTRAINT', message: e.message } });
  }

  const fresh = await itemRepository.findById(createdItem.id);
  const obj = Item.fromDatabaseRow(fresh).toJSON();
  res.status(201).json({ item: obj, ...obj });
}));

// PUT /api/items/:id - Update item (requires admin token)
router.put('/:id', asyncHandler(async (req, res) => {
  const existingItem = await itemRepository.findById(req.params.id);
  if (!existingItem) {
    return res.status(404).json({
      error: {
        code: 'ITEM_NOT_FOUND',
        message: 'Item not found'
      }
    });
  }

  const updatedData = { ...existingItem, ...req.body };
  // If converting to Composite or Service, ensure quantity_on_hand is cleared before validation
  const targetType = (req.body && req.body.type) ? req.body.type : (updatedData.is_composite ? 'Composite' : updatedData.type);
  if (targetType === 'Composite' || targetType === 'Service') {
    updatedData.quantity_on_hand = null;
  }
  const item = Item.fromDatabaseRow(updatedData);
  
  const validation = item.validate();
  if (!validation.isValid) {
    return res.status(400).json({
      error: {
        code: 'ITEM_VALIDATION_FAILED',
        message: 'Invalid item data',
        details: mapItemValidationErrors(validation.errors)
      }
    });
  }

  // Check if SKU already exists (if being changed)
  if (item.sku !== existingItem.sku) {
    const existingBySku = await itemRepository.findBySku(item.sku);
    if (existingBySku && existingBySku.id !== parseInt(req.params.id)) {
      return res.status(409).json({
        error: {
          code: 'SKU_EXISTS',
          message: 'Item with this SKU already exists'
        }
      });
    }
  }

  const updatedItem = await itemRepository.update(req.params.id, item.toDatabaseObject());

  // Handle type-specific prices if provided
  const prices = req.body.prices || {};
  try {
    if (updatedItem.type === 'Composite') {
      await priceRepository.deleteByItem(updatedItem.id);
    } else if (updatedItem.type === 'Atomic') {
      const upserts = [];
      if (prices.Start !== undefined) upserts.push(priceRepository.upsert(updatedItem.id, 'Start', Number(prices.Start) || 0));
      if (prices.Daily !== undefined) upserts.push(priceRepository.upsert(updatedItem.id, 'Daily', Number(prices.Daily) || 0));
      await Promise.all(upserts);
      if (prices.Daily !== undefined) {
        await itemRepository.update(updatedItem.id, { price_per_day: Number(prices.Daily) || 0 });
      }
    } else if (updatedItem.type === 'Service') {
      await priceRepository.deleteByItem(updatedItem.id);
      if (prices.Hourly !== undefined) await priceRepository.upsert(updatedItem.id, 'Hourly', Number(prices.Hourly) || 0);
      await itemRepository.update(updatedItem.id, { price_per_day: 0, quantity_on_hand: null });
    }
  } catch (e) {
    return res.status(400).json({ error: { code: 'PRICE_CONSTRAINT', message: e.message } });
  }

  const fresh = await itemRepository.findById(updatedItem.id);
  const obj = Item.fromDatabaseRow(fresh).toJSON();
  res.json({ item: obj, ...obj });
}));

// PATCH /api/items/:id/stock - Update stock quantity (requires admin token, atomic items only)
router.patch('/:id/stock', asyncHandler(async (req, res) => {
  const { notes, createdBy = 'API User' } = req.body;
  const quantity = Number(req.body.quantity);
  
  if (!Number.isFinite(quantity) || quantity < 0) {
    return res.status(400).json({
      error: {
        code: 'INVALID_QUANTITY',
        message: 'Quantity must be a non-negative number'
      }
    });
  }

  function mapStockSetError(message) {
    const details = [];
    let code = 'ITEM_STOCK_UPDATE_FAILED';
    if (message.includes('Cannot update stock quantity for composite items')) {
      code = 'ITEM_STOCK_COMPOSITE_FORBIDDEN';
      details.push({ code, field: 'itemId', message });
    } else if (message.includes('service items')) {
      code = 'ITEM_STOCK_SERVICE_FORBIDDEN';
      details.push({ code, field: 'itemId', message });
    } else if (message.includes('Stock quantity cannot be negative')) {
      code = 'ITEM_STOCK_QUANTITY_NEGATIVE';
      details.push({ code, field: 'quantity', message });
    } else if (message.includes('Item not found')) {
      code = 'ITEM_NOT_FOUND';
      details.push({ code, field: 'itemId', message });
    } else {
      details.push({ code: 'ITEM_STOCK_UPDATE_FAILED', field: null, message });
    }
    return { code, details };
  }

  try {
    const updatedItem = await inventoryService.updateStockQuantity(
      req.params.id,
      quantity,
      createdBy,
      notes
    );
    res.json(updatedItem.toJSON());
  } catch (error) {
    const mapped = mapStockSetError(error.message || 'Stock update failed');
    const status = mapped.code === 'ITEM_NOT_FOUND' ? 404 : 400;
    return res.status(status).json({ error: { code: mapped.code, message: error.message, details: mapped.details } });
  }
}));

// POST /api/items/:id/stock-adjustment - Make stock adjustment (requires admin token)
router.post('/:id/stock-adjustment', asyncHandler(async (req, res) => {
  const reason = req.body.reason;
  const notes = req.body.notes;
  const createdBy = req.body.createdBy || 'API User';
  const delta = Number(req.body.delta);
  
  if (!Number.isFinite(delta) || delta === 0) {
    return res.status(400).json({
      error: {
        code: 'INVALID_DELTA',
        message: 'Delta must be a non-zero number'
      }
    });
  }

  if (!reason) {
    return res.status(400).json({
      error: {
        code: 'MISSING_REASON',
        message: 'Reason is required for stock adjustments'
      }
    });
  }

  function mapStockAdjustmentError(message) {
    const details = [];
    let code = 'ITEM_STOCK_ADJUSTMENT_FAILED';
    if (message.includes('Cannot adjust stock for composite items')) {
      code = 'ITEM_STOCK_COMPOSITE_FORBIDDEN';
      details.push({ code, field: 'itemId', message });
    } else if (message.includes('service items')) {
      code = 'ITEM_STOCK_SERVICE_FORBIDDEN';
      details.push({ code, field: 'itemId', message });
    } else if (message.includes('Delta cannot be zero')) {
      code = 'ITEM_STOCK_DELTA_ZERO';
      details.push({ code, field: 'delta', message });
    } else if (message.includes('Invalid reason')) {
      code = 'ITEM_STOCK_REASON_INVALID';
      details.push({ code, field: 'reason', message });
    } else if (message.includes('negative quantity')) {
      code = 'ITEM_STOCK_NEGATIVE_RESULT';
      details.push({ code, field: 'delta', message });
    } else if (message.includes('Item not found')) {
      code = 'ITEM_NOT_FOUND';
      details.push({ code, field: 'itemId', message });
    } else {
      details.push({ code: 'ITEM_STOCK_ADJUSTMENT_FAILED', field: null, message });
    }
    return { code, details };
  }

  try {
    const result = await inventoryService.adjustStockQuantity(
      req.params.id,
      delta,
      reason,
      createdBy,
      notes
    );
    res.json(result);
  } catch (error) {
    const mapped = mapStockAdjustmentError(error.message || 'Adjustment failed');
    const status = mapped.code === 'ITEM_NOT_FOUND' ? 404 : 400;
    return res.status(status).json({ error: { code: mapped.code, message: error.message, details: mapped.details } });
  }
}));

// POST /api/items/:id/components - Add component to composite item (requires admin token)
function mapComponentError(message) {
  const details = [];
  let code = 'ITEM_COMPONENT_ERROR';
  if (message.includes('Parent ID and Child ID are required')) {
    code = 'ITEM_COMPONENT_PARENT_OR_CHILD_REQUIRED';
    details.push({ code, field: 'parentId|childId', message });
  } else if (message.includes('Quantity must be positive')) {
    code = 'ITEM_COMPONENT_QUANTITY_POSITIVE';
    details.push({ code, field: 'quantity', message });
  } else if (message.includes('Item cannot be a component of itself')) {
    code = 'ITEM_COMPONENT_SELF_REFERENCE';
    details.push({ code, field: 'childId', message });
  } else if (message.includes('Parent item not found')) {
    code = 'ITEM_COMPONENT_PARENT_NOT_FOUND';
    details.push({ code, field: 'parentId', message });
  } else if (message.includes('Parent item must be composite')) {
    code = 'ITEM_COMPONENT_PARENT_NOT_COMPOSITE';
    details.push({ code, field: 'parentId', message });
  } else if (message.includes('Child item not found')) {
    code = 'ITEM_COMPONENT_CHILD_NOT_FOUND';
    details.push({ code, field: 'childId', message });
  } else if (message.includes('Child item must be atomic')) {
    code = 'ITEM_COMPONENT_CHILD_NOT_ATOMIC';
    details.push({ code, field: 'childId', message });
  } else if (message.includes('would create a cycle') || message.includes('cycle')) {
    code = 'ITEM_COMPONENT_CYCLE_DETECTED';
    details.push({ code, field: 'childId', message });
  } else if (message.includes('Component relationship not found')) {
    code = 'ITEM_COMPONENT_RELATIONSHIP_NOT_FOUND';
    details.push({ code, field: 'childId', message });
  } else {
    details.push({ code: 'ITEM_COMPONENT_ERROR', field: null, message });
  }
  return { code, details };
}

router.post('/:id/components', asyncHandler(async (req, res) => {
  const { childId, quantity } = req.body;
  
  if (!childId || !quantity) {
    return res.status(400).json({
      error: {
        code: 'MISSING_DATA',
        message: 'Child ID and quantity are required'
      }
    });
  }

  try {
    const result = await itemComponentService.addComponent(
      req.params.id,
      childId,
      quantity
    );
    res.status(201).json(result);
  } catch (error) {
    const mapped = mapComponentError(error.message || 'Component add failed');
    const status = mapped.code === 'ITEM_COMPONENT_PARENT_NOT_FOUND' || mapped.code === 'ITEM_COMPONENT_CHILD_NOT_FOUND'
      ? 404 : 400;
    return res.status(status).json({ error: { code: mapped.code, message: error.message, details: mapped.details } });
  }
}));

// PUT /api/items/:id/components/:childId - Update component quantity (requires admin token)
router.put('/:id/components/:childId', asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  
  if (!quantity || quantity <= 0) {
    return res.status(400).json({
      error: {
        code: 'INVALID_QUANTITY',
        message: 'Quantity must be a positive number'
      }
    });
  }

  try {
    const result = await itemComponentService.updateComponentQuantity(
      req.params.id,
      req.params.childId,
      quantity
    );
    res.json(result);
  } catch (error) {
    const mapped = mapComponentError(error.message || 'Component update failed');
    const status = mapped.code === 'ITEM_COMPONENT_RELATIONSHIP_NOT_FOUND' ? 404 : 400;
    return res.status(status).json({ error: { code: mapped.code, message: error.message, details: mapped.details } });
  }
}));

// DELETE /api/items/:id/components/:childId - Remove component from composite item (requires admin token)
router.delete('/:id/components/:childId', asyncHandler(async (req, res) => {
  try {
    const result = await itemComponentService.removeComponent(
      req.params.id,
      req.params.childId
    );
    res.json(result);
  } catch (error) {
    const mapped = mapComponentError(error.message || 'Component remove failed');
    const status = mapped.code === 'ITEM_COMPONENT_RELATIONSHIP_NOT_FOUND' ? 404 : 400;
    return res.status(status).json({ error: { code: mapped.code, message: error.message, details: mapped.details } });
  }
}));

// DELETE /api/items/:id - Delete item (requires admin token, only if no associated orders or components)
router.delete('/:id', asyncHandler(async (req, res) => {
  // Check if item is used in any orders
  const { orderRowRepository } = require('../repositories');
  const orderRows = await orderRowRepository.findByItem(req.params.id);
  
  if (orderRows.length > 0) {
    return res.status(409).json({
      error: {
        code: 'ITEM_HAS_ORDERS',
        message: 'Cannot delete item with associated orders'
      }
    });
  }

  // Check if item has components
  const components = await itemComponentService.getItemComponents(req.params.id);
  if (components.length > 0) {
    return res.status(409).json({
      error: {
        code: 'ITEM_HAS_COMPONENTS',
        message: 'Cannot delete composite item with components. Remove components first.'
      }
    });
  }

  const deletedItem = await itemRepository.delete(req.params.id);
  
  if (!deletedItem) {
    return res.status(404).json({
      error: {
        code: 'ITEM_NOT_FOUND',
        message: 'Item not found'
      }
    });
  }

  res.json({
    message: 'Item deleted successfully',
    item: Item.fromDatabaseRow(deletedItem).toJSON()
  });
}));

module.exports = router;
