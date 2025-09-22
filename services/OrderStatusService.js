const { orderRepository, orderRowRepository, stockMovementRepository } = require('../repositories');
const { Order, StockMovement } = require('../models');
const AvailabilityService = require('./AvailabilityService');

class OrderStatusService {
  constructor(orderRepoOverride = null, stockMovementRepoOverride = null, orderRowRepoOverride = null) {
    this.orderRepository = orderRepoOverride || orderRepository;
    this.orderRowRepository = orderRowRepoOverride || orderRowRepository;
    this.stockMovementRepository = stockMovementRepoOverride || stockMovementRepository;
    this.availabilityService = new AvailabilityService();
  }

  // Core status transition method
  async transitionOrderStatus(orderId, newStatus, createdBy, notes = null) {
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      if (!newStatus) {
        throw new Error('New status is required');
      }

      if (!createdBy) {
        throw new Error('Created by is required');
      }

      // Get current order
      const orderData = await this.orderRepository.findById(orderId);
      if (!orderData) {
        throw new Error('Order not found');
      }

      const order = Order.fromDatabaseRow(orderData);

      // Validate transition is allowed
      if (!order.canTransitionTo(newStatus)) {
        const validTransitions = order.getValidTransitions();
        throw new Error(
          `Invalid transition from ${order.status} to ${newStatus}. ` +
          `Valid transitions: ${validTransitions.join(', ')}`
        );
      }

      // Get line items for stock movement calculations
      const lineItems = await this.orderRowRepository.findByOrder(orderId);

      // Validate availability for reservations and checkouts
      if (newStatus === 'Reserved' || newStatus === 'Checked Out') {
        const validation = await this.validateAvailabilityForTransition(order, lineItems, newStatus);
        if (!validation.isValid) {
          throw new Error(`Availability validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Begin transaction - in a real implementation, we'd wrap this in a database transaction
      const stockMovements = await this.createStockMovementsForTransition(
        order, 
        newStatus, 
        lineItems, 
        createdBy, 
        notes
      );

      // Update order status
      const updatedOrderData = await this.orderRepository.update(orderId, {
        status: newStatus,
        updated_at: new Date()
      });

      // Auto-calc marker on Reserved (placeholder until full pricing wiring)
      if (newStatus === 'Reserved') {
        try {
          await this.orderRepository.updateTotals(orderId, { calculated_at: new Date().toISOString() });
        } catch (e) {
          console.warn('Failed to mark calculated_at on reservation:', e.message);
        }
      }

      // Record all stock movements
      const recordedMovements = [];
      for (const movement of stockMovements) {
        const recorded = await this.stockMovementRepository.recordMovement(
          movement.itemId,
          movement.orderId,
          movement.delta,
          movement.reason,
          movement.createdBy,
          movement.notes
        );
        recordedMovements.push(StockMovement.fromDatabaseRow(recorded));
      }

      const updatedOrder = Order.fromDatabaseRow(updatedOrderData);
      // Auto-recalculate totals on reservation
      if (newStatus === 'Reserved') {
        try {
          const { OrderService } = require('./index');
          const os = new OrderService();
          await os.recalculate(orderId);
        } catch (e) {
          console.warn('Auto recalc on reservation failed:', e.message);
        }
      }

      // Invalidate calendar cache when order status changes
      this.invalidateCalendarCache();

      return {
        order: updatedOrder.toJSON(),
        stockMovements: recordedMovements.map(sm => sm.toJSON()),
        previousStatus: order.status,
        newStatus: newStatus,
        transitionedBy: createdBy,
        transitionedAt: new Date()
      };
    } catch (error) {
      console.error('Error transitioning order status:', error);
      throw error;
    }
  }

  // Backwards-compat alias used by tests
  async transitionStatus(orderId, newStatus, createdBy) {
    return this.transitionOrderStatus(orderId, newStatus, createdBy);
  }

  // Availability validation for transitions
  async validateAvailabilityForTransition(order, lineItems, newStatus) {
    const errors = [];

    try {
      const extendedStart = order.setup_start || order.startDate;
      const extendedEnd = order.cleanup_end || order.returnDueDate;
      for (const lineItem of lineItems) {
        const availability = await this.availabilityService.checkItemAvailability(
          lineItem.item_id,
          extendedStart,
          extendedEnd,
          order.id // Exclude current order from availability check
        );

        if (availability.available < lineItem.quantity) {
          errors.push(
            `Item ${lineItem.item_name || lineItem.item_id}: ` +
            `requested ${lineItem.quantity}, available ${availability.available}`
          );
        }
      }
    } catch (error) {
      errors.push(`Availability check failed: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Create appropriate stock movements based on status transition
  async createStockMovementsForTransition(order, newStatus, lineItems, createdBy, notes) {
    const movements = [];
    const currentStatus = order.status;

    for (const lineItem of lineItems) {
      const itemId = lineItem.item_id;
      const quantity = lineItem.quantity;
      const orderId = order.id;

      if (currentStatus === 'Draft' && newStatus === 'Reserved') {
        // Reserve stock (reduce available quantity but don't change on_hand)
        movements.push(StockMovement.createReserveMovement(itemId, orderId, quantity, createdBy));
        
      } else if (currentStatus === 'Reserved' && newStatus === 'Checked Out') {
        // Convert reservation to checkout (actually reduce on_hand quantity)
        movements.push(StockMovement.createCheckoutMovement(itemId, orderId, quantity, createdBy));
        
      } else if (currentStatus === 'Checked Out' && newStatus === 'Returned') {
        // Return stock (increase on_hand quantity)
        movements.push(StockMovement.createReturnMovement(itemId, orderId, quantity, createdBy));
        
      } else if (currentStatus === 'Reserved' && newStatus === 'Cancelled') {
        // Release reserved stock
        movements.push(StockMovement.createReleaseMovement(itemId, orderId, quantity, createdBy));
        
      } else if (currentStatus === 'Draft' && newStatus === 'Cancelled') {
        // No stock movements needed - nothing was reserved
        // (but we still create the movements array for consistency)
        
      } else {
        // Unexpected transition - this shouldn't happen due to validation
        console.warn(`Unexpected status transition from ${currentStatus} to ${newStatus} for order ${orderId}`);
      }
    }

    // Add notes to movements if provided
    if (notes) {
      movements.forEach(movement => {
        movement.notes = notes;
      });
    }

    return movements;
  }

  // Convenience methods for specific transitions
  async reserveOrder(orderId, createdBy, notes = null) {
    return await this.transitionOrderStatus(orderId, 'Reserved', createdBy, notes);
  }

  async checkoutOrder(orderId, createdBy, notes = null) {
    return await this.transitionOrderStatus(orderId, 'Checked Out', createdBy, notes);
  }

  async returnOrder(orderId, createdBy, notes = null) {
    return await this.transitionOrderStatus(orderId, 'Returned', createdBy, notes);
  }

  async cancelOrder(orderId, createdBy, notes = null) {
    return await this.transitionOrderStatus(orderId, 'Cancelled', createdBy, notes);
  }

  // Get valid transitions for an order
  async getValidTransitions(orderId) {
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      const orderData = await this.orderRepository.findById(orderId);
      if (!orderData) {
        throw new Error('Order not found');
      }

      const order = Order.fromDatabaseRow(orderData);
      
      return {
        currentStatus: order.status,
        validTransitions: order.getValidTransitions(),
        canReserve: order.canTransitionTo('Reserved'),
        canCheckout: order.canTransitionTo('Checked Out'),
        canReturn: order.canTransitionTo('Returned'),
        canCancel: order.canTransitionTo('Cancelled')
      };
    } catch (error) {
      console.error('Error getting valid transitions:', error);
      throw error;
    }
  }

  // Get status transition history for an order
  async getStatusHistory(orderId) {
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      const stockMovements = await this.stockMovementRepository.findByOrder(orderId);
      
      // Group movements by status transition events
      const statusEvents = [];
      const movementsByReason = {};

      // Group movements by reason
      stockMovements.forEach(movement => {
        if (!movementsByReason[movement.reason]) {
          movementsByReason[movement.reason] = [];
        }
        movementsByReason[movement.reason].push(movement);
      });

      // Create status events based on movement patterns
      if (movementsByReason.reserve && movementsByReason.reserve.length > 0) {
        const reserveMovement = movementsByReason.reserve[0];
        statusEvents.push({
          status: 'Reserved',
          timestamp: reserveMovement.created_at,
          createdBy: reserveMovement.created_by,
          notes: reserveMovement.notes,
          movementCount: movementsByReason.reserve.length
        });
      }

      if (movementsByReason.checkout && movementsByReason.checkout.length > 0) {
        const checkoutMovement = movementsByReason.checkout[0];
        statusEvents.push({
          status: 'Checked Out',
          timestamp: checkoutMovement.created_at,
          createdBy: checkoutMovement.created_by,
          notes: checkoutMovement.notes,
          movementCount: movementsByReason.checkout.length
        });
      }

      if (movementsByReason.return && movementsByReason.return.length > 0) {
        const returnMovement = movementsByReason.return[0];
        statusEvents.push({
          status: 'Returned',
          timestamp: returnMovement.created_at,
          createdBy: returnMovement.created_by,
          notes: returnMovement.notes,
          movementCount: movementsByReason.return.length
        });
      }

      if (movementsByReason.release && movementsByReason.release.length > 0) {
        const releaseMovement = movementsByReason.release[0];
        statusEvents.push({
          status: 'Cancelled',
          timestamp: releaseMovement.created_at,
          createdBy: releaseMovement.created_by,
          notes: releaseMovement.notes,
          movementCount: movementsByReason.release.length
        });
      }

      // Sort by timestamp
      statusEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      return {
        orderId,
        statusEvents,
        totalMovements: stockMovements.length,
        allMovements: stockMovements.map(sm => StockMovement.fromDatabaseRow(sm).toJSON())
      };
    } catch (error) {
      console.error('Error getting status history:', error);
      throw error;
    }
  }

  // Bulk status operations
  async bulkTransition(orderIds, newStatus, createdBy, notes = null) {
    try {
      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        throw new Error('Order IDs array is required');
      }

      if (!newStatus) {
        throw new Error('New status is required');
      }

      if (!createdBy) {
        throw new Error('Created by is required');
      }

      const results = {
        successful: [],
        failed: []
      };

      // Process each order individually
      for (const orderId of orderIds) {
        try {
          const transitionResult = await this.transitionOrderStatus(orderId, newStatus, createdBy, notes);
          results.successful.push({
            orderId,
            result: transitionResult
          });
        } catch (error) {
          results.failed.push({
            orderId,
            error: error.message
          });
        }
      }

      return {
        ...results,
        totalProcessed: orderIds.length,
        successCount: results.successful.length,
        failureCount: results.failed.length
      };
    } catch (error) {
      console.error('Error in bulk transition:', error);
      throw error;
    }
  }

  // Validation helpers
  async validateOrderForTransition(orderId, newStatus) {
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      if (!newStatus) {
        throw new Error('New status is required');
      }

      const orderData = await this.orderRepository.findById(orderId);
      if (!orderData) {
        return {
          isValid: false,
          errors: ['Order not found'],
          canTransition: false
        };
      }

      const order = Order.fromDatabaseRow(orderData);
      const errors = [];
      let canTransition = false;

      // Check if transition is valid
      if (!order.canTransitionTo(newStatus)) {
        errors.push(
          `Cannot transition from ${order.status} to ${newStatus}. ` +
          `Valid transitions: ${order.getValidTransitions().join(', ')}`
        );
      } else {
        canTransition = true;

        // Additional validation for specific transitions
        if (newStatus === 'Reserved' || newStatus === 'Checked Out') {
          const lineItems = await this.orderRowRepository.findByOrder(orderId);
          
          if (lineItems.length === 0) {
            errors.push('Order must have line items before it can be reserved or checked out');
            canTransition = false;
          } else {
            // Check availability
            const availabilityValidation = await this.validateAvailabilityForTransition(
              order, 
              lineItems, 
              newStatus
            );
            
            if (!availabilityValidation.isValid) {
              errors.push(...availabilityValidation.errors);
              canTransition = false;
            }
          }
        }
      }

      return {
        isValid: errors.length === 0 && canTransition,
        canTransition,
        errors,
        currentStatus: order.status,
        requestedStatus: newStatus,
        validTransitions: order.getValidTransitions()
      };
    } catch (error) {
      console.error('Error validating order for transition:', error);
      return {
        isValid: false,
        canTransition: false,
        errors: [error.message],
        currentStatus: null,
        requestedStatus: newStatus,
        validTransitions: []
      };
    }
  }

  // Helper method to invalidate calendar cache when orders change
  invalidateCalendarCache() {
    try {
      // Import CalendarService dynamically to avoid circular dependencies
      const CalendarService = require('./CalendarService');
      const calendarService = new CalendarService();
      calendarService.clearCache();
    } catch (error) {
      console.warn('Failed to invalidate calendar cache:', error.message);
      // Don't throw - this is a non-critical operation
    }
  }
}

module.exports = OrderStatusService;
