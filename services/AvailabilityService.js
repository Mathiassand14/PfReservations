const { itemRepository, orderRepository, orderRowRepository } = require('../repositories');
const { Item } = require('../models');
const ItemComponentService = require('./ItemComponentService');

class AvailabilityService {
  constructor() {
    this.itemRepository = itemRepository;
    this.orderRepository = orderRepository;
    this.orderRowRepository = orderRowRepository;
    this.itemComponentService = new ItemComponentService();
  }

  // Backwards-compat alias used by some tests
  async checkAvailability(itemId, startDate, endDate, excludeOrderId = null) {
    const res = await this.checkItemAvailability(itemId, startDate, endDate, excludeOrderId);
    return {
      isAvailable: (res.available || 0) > 0,
      availableQuantity: res.available,
      ...res
    };
  }

  // Real-time availability calculations accounting for reservations
  async checkItemAvailability(itemId, startDate, endDate, excludeOrderId = null) {
    try {
      if (!itemId) {
        throw new Error('Item ID is required');
      }

      if (!startDate || !endDate) {
        throw new Error('Start date and end date are required');
      }

      // Get item details
      const itemData = await this.itemRepository.findById(itemId);
      if (!itemData) {
        throw new Error('Item not found');
      }

      const item = Item.fromDatabaseRow(itemData);

      // Calculate base quantity (atomic vs composite)
      let baseQuantity;
      if (item.isComposite) {
        baseQuantity = await this.calculateCompositeAvailability(itemId);
      } else {
        baseQuantity = item.quantityOnHand || 0;
      }

      // Get overlapping reservations and checkouts
      const reservedQuantity = await this.getReservedQuantityForPeriod(
        itemId, 
        startDate, 
        endDate, 
        excludeOrderId
      );

      const availableQuantity = Math.max(0, baseQuantity - reservedQuantity);

      return {
        itemId,
        itemName: item.name,
        itemSku: item.sku,
        isComposite: item.isComposite,
        baseQuantity,
        reservedQuantity,
        available: availableQuantity,
        period: {
          startDate,
          endDate
        }
      };
    } catch (error) {
      console.error('Error checking item availability:', error);
      throw error;
    }
  }

  // Calculate available quantities for specific date ranges
  async calculateAvailableQuantityForPeriod(itemId, startDate, endDate, excludeOrderId = null) {
    try {
      const availability = await this.checkItemAvailability(itemId, startDate, endDate, excludeOrderId);
      return availability.available;
    } catch (error) {
      console.error('Error calculating available quantity for period:', error);
      throw error;
    }
  }

  // Conflict detection for overlapping reservations
  async detectAvailabilityConflicts(orderItems, startDate, endDate, excludeOrderId = null) {
    try {
      const conflicts = [];

      for (const orderItem of orderItems) {
        const availability = await this.checkItemAvailability(
          orderItem.itemId || orderItem.item_id,
          startDate,
          endDate,
          excludeOrderId
        );

        const requestedQuantity = orderItem.quantity;

        if (availability.available < requestedQuantity) {
          conflicts.push({
            itemId: availability.itemId,
            itemName: availability.itemName,
            itemSku: availability.itemSku,
            requested: requestedQuantity,
            available: availability.available,
            shortfall: requestedQuantity - availability.available,
            period: availability.period,
            conflictingOrders: await this.getConflictingOrders(
              availability.itemId,
              startDate,
              endDate,
              excludeOrderId
            )
          });
        }
      }

      return {
        hasConflicts: conflicts.length > 0,
        conflicts,
        totalItems: orderItems.length,
        conflictCount: conflicts.length
      };
    } catch (error) {
      console.error('Error detecting availability conflicts:', error);
      throw error;
    }
  }

  // Availability validation for order creation and updates
  async validateOrderAvailability(orderId) {
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      // Get order details
      const orderData = await this.orderRepository.findById(orderId);
      if (!orderData) {
        throw new Error('Order not found');
      }

      // Get order line items
      const lineItems = await this.orderRowRepository.findByOrder(orderId);
      if (!lineItems || lineItems.length === 0) {
        return {
          isValid: false,
          errors: ['Order has no line items'],
          conflicts: []
        };
      }

      // Check availability for each line item
      const orderItems = lineItems.map(item => ({
        itemId: item.item_id,
        quantity: item.quantity
      }));

      const conflictResult = await this.detectAvailabilityConflicts(
        orderItems,
        orderData.start_date,
        orderData.return_due_date,
        orderId
      );

      const errors = conflictResult.conflicts.map(conflict => 
        `Insufficient availability for ${conflict.itemName}: ` +
        `requested ${conflict.requested}, available ${conflict.available}`
      );

      return {
        isValid: !conflictResult.hasConflicts,
        errors,
        conflicts: conflictResult.conflicts,
        orderDetails: {
          id: orderData.id,
          startDate: orderData.start_date,
          endDate: orderData.return_due_date,
          status: orderData.status
        }
      };
    } catch (error) {
      console.error('Error validating order availability:', error);
      throw error;
    }
  }

  // Helper methods
  async getReservedQuantityForPeriod(itemId, startDate, endDate, excludeOrderId = null) {
    try {
      let query = `
        SELECT COALESCE(SUM(or_row.quantity), 0) as reserved_quantity
        FROM order_rows or_row
        JOIN orders o ON or_row.order_id = o.id
        WHERE or_row.item_id = $1
        AND o.status IN ('Reserved', 'Checked Out')
        AND COALESCE(o.setup_start, o.start_date) <= $3
        AND COALESCE(o.cleanup_end, o.return_due_date) >= $2
      `;

      const params = [itemId, startDate, endDate];

      if (excludeOrderId) {
        query += ' AND o.id != $4';
        params.push(excludeOrderId);
      }

      const result = await this.orderRepository.query(query, params);
      return parseInt(result.rows[0].reserved_quantity) || 0;
    } catch (error) {
      console.error('Error getting reserved quantity for period:', error);
      throw error;
    }
  }

  async getConflictingOrders(itemId, startDate, endDate, excludeOrderId = null) {
    try {
      let query = `
        SELECT 
          o.id,
          o.status,
          o.start_date,
          o.return_due_date,
          c.display_name as customer_name,
          or_row.quantity
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        JOIN order_rows or_row ON o.id = or_row.order_id
        WHERE or_row.item_id = $1
        AND o.status IN ('Reserved', 'Checked Out')
        AND COALESCE(o.setup_start, o.start_date) <= $3
        AND COALESCE(o.cleanup_end, o.return_due_date) >= $2
      `;

      const params = [itemId, startDate, endDate];

      if (excludeOrderId) {
        query += ' AND o.id != $4';
        params.push(excludeOrderId);
      }

      query += ' ORDER BY COALESCE(o.setup_start, o.start_date) ASC';

      const result = await this.orderRepository.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting conflicting orders:', error);
      throw error;
    }
  }

  async calculateCompositeAvailability(compositeItemId) {
    try {
      // Get composite item components
      const components = await this.itemComponentService.getItemComponents(compositeItemId);
      
      if (!components || components.length === 0) {
        return 0; // No components means no availability
      }

      let minAvailable = Infinity;

      for (const component of components) {
        const childItem = await this.itemRepository.findById(component.child_id);
        if (!childItem) {
          continue; // Skip missing components
        }

        let childAvailable;
        if (childItem.is_composite) {
          // Recursive calculation for nested composite items
          childAvailable = await this.calculateCompositeAvailability(component.child_id);
        } else {
          childAvailable = childItem.quantity_on_hand || 0;
        }

        const possibleSets = Math.floor(childAvailable / component.quantity);
        minAvailable = Math.min(minAvailable, possibleSets);
      }

      return minAvailable === Infinity ? 0 : minAvailable;
    } catch (error) {
      console.error('Error calculating composite availability:', error);
      throw error;
    }
  }

  // Bulk availability checking
  async checkMultipleItemsAvailability(itemRequests, startDate, endDate, excludeOrderId = null) {
    try {
      const results = [];

      for (const request of itemRequests) {
        try {
          const availability = await this.checkItemAvailability(
            request.itemId,
            startDate,
            endDate,
            excludeOrderId
          );

          results.push({
            ...availability,
            requestedQuantity: request.quantity,
            isAvailable: availability.available >= request.quantity,
            shortfall: Math.max(0, request.quantity - availability.available)
          });
        } catch (error) {
          results.push({
            itemId: request.itemId,
            error: error.message,
            isAvailable: false
          });
        }
      }

      const allAvailable = results.every(result => result.isAvailable);
      const totalShortfall = results.reduce((sum, result) => sum + (result.shortfall || 0), 0);

      return {
        allAvailable,
        totalShortfall,
        results,
        period: { startDate, endDate }
      };
    } catch (error) {
      console.error('Error checking multiple items availability:', error);
      throw error;
    }
  }

  // Get availability calendar for an item
  async getItemAvailabilityCalendar(itemId, startDate, endDate) {
    try {
      if (!itemId) {
        throw new Error('Item ID is required');
      }

      // Get item details
      const itemData = await this.itemRepository.findById(itemId);
      if (!itemData) {
        throw new Error('Item not found');
      }

      const item = Item.fromDatabaseRow(itemData);

      // Calculate base quantity
      let baseQuantity;
      if (item.isComposite) {
        baseQuantity = await this.calculateCompositeAvailability(itemId);
      } else {
        baseQuantity = item.quantityOnHand || 0;
      }

      // Get all reservations in the period
      const reservations = await this.getConflictingOrders(itemId, startDate, endDate);

      // Build calendar data
      const calendar = {
        itemId,
        itemName: item.name,
        itemSku: item.sku,
        isComposite: item.isComposite,
        baseQuantity,
        period: { startDate, endDate },
        reservations: reservations.map(reservation => ({
          orderId: reservation.id,
          status: reservation.status,
          startDate: reservation.start_date,
          endDate: reservation.return_due_date,
          customerName: reservation.customer_name,
          quantity: reservation.quantity,
          availableAfterReservation: baseQuantity - reservation.quantity
        }))
      };

      return calendar;
    } catch (error) {
      console.error('Error getting item availability calendar:', error);
      throw error;
    }
  }

  // Get system-wide availability summary
  async getAvailabilitySummary(startDate, endDate) {
    try {
      const items = await this.itemRepository.findAll();
      const summary = {
        totalItems: items.length,
        availableItems: 0,
        unavailableItems: 0,
        partiallyAvailableItems: 0,
        items: []
      };

      for (const itemData of items) {
        try {
          const item = Item.fromDatabaseRow(itemData);
          const availability = await this.checkItemAvailability(item.id, startDate, endDate);

          let status;
          if (availability.available === 0) {
            status = 'unavailable';
            summary.unavailableItems++;
          } else if (availability.available < availability.baseQuantity) {
            status = 'partially_available';
            summary.partiallyAvailableItems++;
          } else {
            status = 'available';
            summary.availableItems++;
          }

          summary.items.push({
            ...availability,
            status
          });
        } catch (error) {
          console.error(`Error checking availability for item ${itemData.id}:`, error);
          summary.items.push({
            itemId: itemData.id,
            itemName: itemData.name,
            error: error.message,
            status: 'error'
          });
        }
      }

      return summary;
    } catch (error) {
      console.error('Error getting availability summary:', error);
      throw error;
    }
  }
}

module.exports = AvailabilityService;
