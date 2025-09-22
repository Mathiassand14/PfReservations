class StockMovement {
  constructor(data = {}) {
    this.id = data.id || null;
    this.itemId = data.item_id || data.itemId || null;
    this.orderId = data.order_id || data.orderId || null;
    this.delta = data.delta || 0;
    this.reason = data.reason || '';
    this.createdBy = data.created_by || data.createdBy || '';
    this.notes = data.notes || null;
    this.createdAt = data.created_at || data.createdAt || null;
    
    // Additional data that might be loaded with the movement
    this.itemName = data.item_name || data.itemName || null;
    this.itemSku = data.item_sku || data.itemSku || null;
    this.orderNumber = data.order_number || data.orderNumber || null;
    this.customerName = data.customer_name || data.customerName || null;
  }

  // Validation methods
  validate() {
    const errors = [];

    if (!this.itemId) {
      errors.push('Item ID is required');
    }

    if (this.delta === 0) {
      errors.push('Delta cannot be zero');
    }

    if (!this.isValidReason(this.reason)) {
      errors.push('Reason must be one of: checkout, return, reserve, release, adjustment, repair, loss, found');
    }

    if (!this.createdBy || this.createdBy.trim().length === 0) {
      errors.push('Created by is required');
    }

    if (this.createdBy && this.createdBy.length > 255) {
      errors.push('Created by must be 255 characters or less');
    }

    // Validate reason-specific rules
    const reasonValidation = this.validateReasonSpecificRules();
    if (!reasonValidation.isValid) {
      errors.push(...reasonValidation.errors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  isValidReason(reason) {
    const validReasons = ['checkout', 'return', 'reserve', 'release', 'adjustment', 'repair', 'loss', 'found'];
    return validReasons.includes(reason);
  }

  validateReasonSpecificRules() {
    const errors = [];

    switch (this.reason) {
      case 'checkout':
      case 'reserve':
      case 'loss':
        if (this.delta >= 0) {
          errors.push(`${this.reason} movements must have negative delta`);
        }
        break;
        
      case 'return':
      case 'release':
      case 'found':
        if (this.delta <= 0) {
          errors.push(`${this.reason} movements must have positive delta`);
        }
        break;
        
      case 'repair':
        // Repair can be either direction (out for repair, back from repair)
        break;
        
      case 'adjustment':
        // Adjustments can be either direction
        if (!this.notes || this.notes.trim().length === 0) {
          errors.push('Adjustment movements require notes explaining the reason');
        }
        break;
    }

    // Order-related movements should have an order ID
    if (['checkout', 'return', 'reserve', 'release'].includes(this.reason)) {
      if (!this.orderId) {
        errors.push(`${this.reason} movements must be associated with an order`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Business logic methods
  isOrderRelated() {
    return ['checkout', 'return', 'reserve', 'release'].includes(this.reason);
  }

  isManualAdjustment() {
    return ['adjustment', 'repair', 'loss', 'found'].includes(this.reason);
  }

  isStockIncrease() {
    return this.delta > 0;
  }

  isStockDecrease() {
    return this.delta < 0;
  }

  getAbsoluteDelta() {
    return Math.abs(this.delta);
  }

  getMovementType() {
    if (this.isStockIncrease()) {
      return 'increase';
    } else if (this.isStockDecrease()) {
      return 'decrease';
    } else {
      return 'neutral';
    }
  }

  getReasonDescription() {
    const descriptions = {
      'checkout': 'Item checked out to customer',
      'return': 'Item returned from customer',
      'reserve': 'Item reserved for order',
      'release': 'Item reservation released',
      'adjustment': 'Manual stock adjustment',
      'repair': 'Item sent for repair or returned from repair',
      'loss': 'Item lost or damaged',
      'found': 'Item found or recovered'
    };

    return descriptions[this.reason] || 'Unknown reason';
  }

  requiresOrderContext() {
    return this.isOrderRelated();
  }

  requiresNotes() {
    return this.reason === 'adjustment';
  }

  // Data transformation methods
  toJSON() {
    return {
      id: this.id,
      itemId: this.itemId,
      orderId: this.orderId,
      delta: this.delta,
      reason: this.reason,
      createdBy: this.createdBy,
      notes: this.notes,
      itemName: this.itemName,
      itemSku: this.itemSku,
      orderNumber: this.orderNumber,
      customerName: this.customerName,
      movementType: this.getMovementType(),
      reasonDescription: this.getReasonDescription(),
      absoluteDelta: this.getAbsoluteDelta(),
      isOrderRelated: this.isOrderRelated(),
      isManualAdjustment: this.isManualAdjustment(),
      createdAt: this.createdAt
    };
  }

  toDatabaseObject() {
    return {
      item_id: this.itemId,
      order_id: this.orderId || null,
      delta: this.delta,
      reason: this.reason,
      created_by: this.createdBy,
      notes: this.notes || null
    };
  }

  static fromDatabaseRow(row) {
    return new StockMovement(row);
  }

  static getValidReasons() {
    return ['checkout', 'return', 'reserve', 'release', 'adjustment', 'repair', 'loss', 'found'];
  }

  static getReasonDescriptions() {
    return {
      'checkout': 'Item checked out to customer',
      'return': 'Item returned from customer',
      'reserve': 'Item reserved for order',
      'release': 'Item reservation released',
      'adjustment': 'Manual stock adjustment',
      'repair': 'Item sent for repair or returned from repair',
      'loss': 'Item lost or damaged',
      'found': 'Item found or recovered'
    };
  }

  static getReasonCategories() {
    return {
      order_related: ['checkout', 'return', 'reserve', 'release'],
      manual_adjustment: ['adjustment', 'repair', 'loss', 'found']
    };
  }

  static createCheckoutMovement(itemId, orderId, quantity, createdBy) {
    return new StockMovement({
      itemId,
      orderId,
      delta: -Math.abs(quantity),
      reason: 'checkout',
      createdBy
    });
  }

  static createReturnMovement(itemId, orderId, quantity, createdBy) {
    return new StockMovement({
      itemId,
      orderId,
      delta: Math.abs(quantity),
      reason: 'return',
      createdBy
    });
  }

  static createReserveMovement(itemId, orderId, quantity, createdBy) {
    return new StockMovement({
      itemId,
      orderId,
      delta: -Math.abs(quantity),
      reason: 'reserve',
      createdBy
    });
  }

  static createReleaseMovement(itemId, orderId, quantity, createdBy) {
    return new StockMovement({
      itemId,
      orderId,
      delta: Math.abs(quantity),
      reason: 'release',
      createdBy
    });
  }

  static createAdjustmentMovement(itemId, delta, createdBy, notes) {
    return new StockMovement({
      itemId,
      orderId: null,
      delta,
      reason: 'adjustment',
      createdBy,
      notes
    });
  }
}

module.exports = StockMovement;