const { orderRepository, orderRowRepository, customerRepository, employeeRepository, itemRepository, rebateGroupRepository } = require('../repositories');
const pricing = require('../lib/pricing');
const { Order } = require('../models');
const AvailabilityService = require('./AvailabilityService');

class OrderService {
  constructor() {
    this.orderRepository = orderRepository;
    this.orderRowRepository = orderRowRepository;
    this.customerRepository = customerRepository;
    this.employeeRepository = employeeRepository;
    this.itemRepository = itemRepository;
    this.rebateGroupRepository = rebateGroupRepository;
    this.availabilityService = new AvailabilityService();
  }

  // Order creation and validation
  async createOrder(orderData) {
    try {
      // Validate required fields
      if (!orderData.customerId) {
        throw new Error('Customer ID is required');
      }

      if (!orderData.salesPersonId) {
        throw new Error('Sales person ID is required');
      }

      // Validate time windows
      if (!(orderData.startDate && orderData.returnDueDate) && !(orderData.orderStart && orderData.orderEnd)) {
        throw new Error('Either Start/Return dates or Order Start/End must be provided');
      }

      // Validate customer exists and is active
      const customer = await this.customerRepository.findById(orderData.customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      if (!customer.is_active) {
        throw new Error('Cannot create orders for inactive customers');
      }

      // Validate employee exists and is active
      const employee = await this.employeeRepository.findById(orderData.salesPersonId);
      if (!employee) {
        throw new Error('Sales person not found');
      }

      if (!employee.is_active) {
        throw new Error('Cannot assign orders to inactive employees');
      }

      // Validate dates
      if (orderData.startDate && orderData.returnDueDate) {
        const startDate = new Date(orderData.startDate);
        const returnDate = new Date(orderData.returnDueDate);
        if (returnDate <= startDate) {
          throw new Error('Return due date must be after start date');
        }
      }

      // Create order object
      const order = new Order({
        customerId: orderData.customerId,
        salesPersonId: orderData.salesPersonId,
        status: 'Draft',
        startDate: orderData.startDate,
        returnDueDate: orderData.returnDueDate,
        setupStart: orderData.setupStart || null,
        orderStart: orderData.orderStart || orderData.startDate || null,
        orderEnd: orderData.orderEnd || orderData.returnDueDate || null,
        cleanupEnd: orderData.cleanupEnd || null,
        discountAmount: orderData.discountAmount || 0,
        taxAmount: orderData.taxAmount || 0
      });

      // Validate order
      const validation = order.validate();
      if (!validation.isValid) {
        throw new Error(`Invalid order data: ${validation.errors.join(', ')}`);
      }

      // Create order in database
      const createdOrderData = await this.orderRepository.create(order.toDatabaseObject());
      const createdOrder = Order.fromDatabaseRow(createdOrderData);

      // Auto-calc marker on creation (placeholder)
      try {
        const { createLogger } = require('./logger');
        const log = createLogger('service:order');
        await this.orderRepository.updateTotals(createdOrder.id, { calculated_at: new Date().toISOString() });
        log.info('order_created', { orderId: createdOrder.id });
      } catch (e) {
        const { createLogger } = require('./logger');
        const log = createLogger('service:order');
        log.warn('order_create_calc_marker_failed', { error: e.message });
      }

      // Invalidate calendar cache when new order is created
      this.invalidateCalendarCache();

      return createdOrder;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  // Line item management
  async addLineItem(orderId, itemId, quantity, pricePerDay) {
    try {
      // Validate inputs
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      if (!itemId) {
        throw new Error('Item ID is required');
      }

      if (!quantity || quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
      }

      if (!pricePerDay || pricePerDay < 0) {
        throw new Error('Price per day must be 0 or greater');
      }

      // Get order
      const orderData = await this.orderRepository.findById(orderId);
      if (!orderData) {
        throw new Error('Order not found');
      }

      const order = Order.fromDatabaseRow(orderData);

      // Only allow line item changes for Draft orders
      if (order.status !== 'Draft') {
        throw new Error('Can only modify line items for Draft orders');
      }

      // Validate item exists
      const item = await this.itemRepository.findById(itemId);
      if (!item) {
        throw new Error('Item not found');
      }

      // Check if item already exists in order
      const existingLineItems = await this.orderRowRepository.findByOrder(orderId);
      const existingItem = existingLineItems.find(li => li.item_id === itemId);
      
      if (existingItem) {
        throw new Error('Item already exists in order. Use updateLineItem to modify quantity.');
      }

      // Calculate rental days and line total
      const rentalDays = order.calculateRentalDays();
      const lineTotal = quantity * pricePerDay * rentalDays;

      // Add line item
      const lineItem = await this.orderRowRepository.addLineItem(orderId, itemId, quantity, pricePerDay);

      return {
        ...lineItem,
        rental_days: rentalDays,
        line_total: lineTotal
      };
    } catch (error) {
      console.error('Error adding line item:', error);
      throw error;
    }
  }

  async updateLineItem(lineItemId, quantity, pricePerDay) {
    try {
      // Validate inputs
      if (!lineItemId) {
        throw new Error('Line item ID is required');
      }

      if (!quantity || quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
      }

      if (!pricePerDay || pricePerDay < 0) {
        throw new Error('Price per day must be 0 or greater');
      }

      // Get line item to find order
      const lineItem = await this.orderRowRepository.findById(lineItemId);
      if (!lineItem) {
        throw new Error('Line item not found');
      }

      // Get order
      const orderData = await this.orderRepository.findById(lineItem.order_id);
      if (!orderData) {
        throw new Error('Order not found');
      }

      const order = Order.fromDatabaseRow(orderData);

      // Only allow line item changes for Draft orders
      if (order.status !== 'Draft') {
        throw new Error('Can only modify line items for Draft orders');
      }

      // Calculate new line total
      const rentalDays = order.calculateRentalDays();
      const lineTotal = quantity * pricePerDay * rentalDays;

      // Update line item
      const updatedLineItem = await this.orderRowRepository.updateLineItem(lineItemId, quantity, pricePerDay);

      return {
        ...updatedLineItem,
        rental_days: rentalDays,
        line_total: lineTotal
      };
    } catch (error) {
      console.error('Error updating line item:', error);
      throw error;
    }
  }

  async removeLineItem(lineItemId) {
    try {
      if (!lineItemId) {
        throw new Error('Line item ID is required');
      }

      // Get line item to find order
      const lineItem = await this.orderRowRepository.findById(lineItemId);
      if (!lineItem) {
        throw new Error('Line item not found');
      }

      // Get order
      const orderData = await this.orderRepository.findById(lineItem.order_id);
      if (!orderData) {
        throw new Error('Order not found');
      }

      const order = Order.fromDatabaseRow(orderData);

      // Only allow line item changes for Draft orders
      if (order.status !== 'Draft') {
        throw new Error('Can only modify line items for Draft orders');
      }

      // Remove line item
      await this.orderRowRepository.removeLineItem(lineItemId);

      return { success: true, message: 'Line item removed successfully' };
    } catch (error) {
      console.error('Error removing line item:', error);
      throw error;
    }
  }

  // Order total calculations
  async calculateOrderTotal(orderId) {
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      // Get order
      const orderData = await this.orderRepository.findById(orderId);
      if (!orderData) {
        throw new Error('Order not found');
      }

      const order = Order.fromDatabaseRow(orderData);

      // Get line items
      const lineItems = await this.orderRowRepository.findByOrder(orderId);

      // Calculate totals
      const subtotal = lineItems.reduce((sum, item) => sum + (item.line_total || 0), 0);
      const total = subtotal + order.taxAmount - order.discountAmount;

      return {
        subtotal,
        discountAmount: order.discountAmount,
        taxAmount: order.taxAmount,
        total,
        lineItemCount: lineItems.length,
        rentalDays: order.calculateRentalDays()
      };
    } catch (error) {
      console.error('Error calculating order total:', error);
      throw error;
    }
  }

  async updateOrderPricing(orderId, discountAmount, taxAmount) {
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      if (discountAmount < 0) {
        throw new Error('Discount amount cannot be negative');
      }

      if (taxAmount < 0) {
        throw new Error('Tax amount cannot be negative');
      }

      // Get order
      const orderData = await this.orderRepository.findById(orderId);
      if (!orderData) {
        throw new Error('Order not found');
      }

      const order = Order.fromDatabaseRow(orderData);

      // Only allow pricing changes for Draft orders
      if (order.status !== 'Draft') {
        throw new Error('Can only modify pricing for Draft orders');
      }

      // Update order
      const updatedOrderData = await this.orderRepository.update(orderId, {
        discount_amount: discountAmount,
        tax_amount: taxAmount
      });

      const updatedOrder = Order.fromDatabaseRow(updatedOrderData);

      // Return updated totals
      return await this.calculateOrderTotal(orderId);
    } catch (error) {
      console.error('Error updating order pricing:', error);
      throw error;
    }
  }

  // Order retrieval with details
  async getOrderWithDetails(orderId) {
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      const orderData = await this.orderRepository.getOrderWithDetails(orderId);
      if (!orderData) {
        throw new Error('Order not found');
      }

      const order = Order.fromDatabaseRow(orderData);
      
      // Add calculated fields
      const totals = await this.calculateOrderTotal(orderId);

      return {
        ...order.toJSON(),
        customerName: orderData.customer_name,
        customerOrganization: orderData.customer_organization,
        salesPersonName: orderData.sales_person_name,
        lineItems: orderData.line_items || [],
        ...totals
      };
    } catch (error) {
      console.error('Error getting order with details:', error);
      throw error;
    }
  }

  // Recalculate totals and update calculated_at using pricing engine
  async recalculate(orderId) {
    if (!orderId) {
      throw new Error('Order ID is required');
    }
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    // Determine order window
    const orderStart = order.order_start || order.start_date;
    const orderEnd = order.order_end || order.return_due_date;
    // Fetch lines
    const rows = await this.orderRowRepository.findByOrder(orderId);
    // Determine rebate percent
    const customer = await this.customerRepository.findById(order.customer_id);
    let rebatePct = 0;
    if (customer) {
      if (customer.rebate_percent_override !== null && customer.rebate_percent_override !== undefined) {
        rebatePct = Number(customer.rebate_percent_override) || 0;
      } else if (customer.rebate_group) {
        const group = await this.rebateGroupRepository.findByName(customer.rebate_group);
        rebatePct = group ? Number(group.percent) || 0 : 0;
      }
    }
    // Price each equipment line based on current item Start/Daily prices
    let equipmentTotal = 0;
    let rebateAmount = 0;
    const { priceRepository } = require('../repositories');
    const itemIds = Array.from(new Set(rows.map(r => r.item_id).filter(Boolean)));
    const priceMap = await priceRepository.findByItems(itemIds);
    for (const r of rows) {
      const p = priceMap.get(r.item_id) || {};
      const res = pricing.priceEquipmentLine({
        start: Number(p.Start) || 0,
        daily: Number(p.Daily) || Number(r.price_per_day) || 0,
        qty: Number(r.quantity) || 1,
        rebatePct,
        orderStart,
        orderEnd,
      });
      equipmentTotal += res.total;
      rebateAmount += res.discount;
    }
    equipmentTotal = +equipmentTotal.toFixed(2);
    rebateAmount = +rebateAmount.toFixed(2);
    const subtotal = equipmentTotal; // services not modeled in legacy rows
    const total_ex_vat = subtotal;
    const now = new Date().toISOString();
    await this.orderRepository.updateTotals(orderId, {
      subtotal,
      rebate_amount: rebateAmount,
      total_ex_vat,
      calculated_at: now,
      captured_rebate_percent: rebatePct,
    });
    const { createLogger } = require('./logger');
    const log = createLogger('service:order');
    log.info('order_recalculated', { orderId, subtotal, rebateAmount, total_ex_vat, rebatePct });
    return this.getOrderWithDetails(orderId);
  }

  // Order validation
  async validateOrderForReservation(orderId) {
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      const orderDetails = await this.getOrderWithDetails(orderId);
      const errors = [];

      // Check if order has line items
      if (!orderDetails.lineItems || orderDetails.lineItems.length === 0) {
        errors.push('Order must have at least one line item');
      }

      // Check availability for each line item
      for (const lineItem of orderDetails.lineItems || []) {
        try {
          const availability = await this.availabilityService.checkItemAvailability(
            lineItem.item_id,
            orderDetails.startDate,
            orderDetails.returnDueDate,
            orderId // Exclude current order from availability check
          );

          if (availability.available < lineItem.quantity) {
            errors.push(
              `Insufficient availability for ${lineItem.item_name}: ` +
              `requested ${lineItem.quantity}, available ${availability.available}`
            );
          }
        } catch (availabilityError) {
          errors.push(`Error checking availability for ${lineItem.item_name}: ${availabilityError.message}`);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        orderDetails
      };
    } catch (error) {
      console.error('Error validating order for reservation:', error);
      throw error;
    }
  }

  // Order search and filtering
  async searchOrders(filters = {}) {
    try {
      const {
        status,
        customerId,
        salesPersonId,
        startDate,
        endDate,
        limit = 50,
        offset = 0
      } = filters;

      let whereConditions = [];
      let params = [];
      let paramIndex = 1;

      if (status) {
        whereConditions.push(`o.status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      if (customerId) {
        whereConditions.push(`o.customer_id = $${paramIndex}`);
        params.push(customerId);
        paramIndex++;
      }

      if (salesPersonId) {
        whereConditions.push(`o.sales_person_id = $${paramIndex}`);
        params.push(salesPersonId);
        paramIndex++;
      }

      if (startDate) {
        whereConditions.push(`o.start_date >= $${paramIndex}`);
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereConditions.push(`o.return_due_date <= $${paramIndex}`);
        params.push(endDate);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      const query = `
        SELECT 
          o.*,
          c.display_name as customer_name,
          c.organization as customer_organization,
          e.full_name as sales_person_name,
          COUNT(or_row.id) as line_item_count,
          COALESCE(SUM(or_row.line_total), 0) as subtotal
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        JOIN employees e ON o.sales_person_id = e.id
        LEFT JOIN order_rows or_row ON o.id = or_row.order_id
        ${whereClause}
        GROUP BY o.id, c.display_name, c.organization, e.full_name
        ORDER BY o.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const db = require('../config/database');
      const result = await db.query(query, params);
      
      return result.rows.map(row => ({
        ...Order.fromDatabaseRow(row).toJSON(),
        customerName: row.customer_name,
        customerOrganization: row.customer_organization,
        salesPersonName: row.sales_person_name,
        lineItemCount: parseInt(row.line_item_count),
        subtotal: parseFloat(row.subtotal),
        total: parseFloat(row.subtotal) + row.tax_amount - row.discount_amount
      }));
    } catch (error) {
      console.error('Error searching orders:', error);
      throw error;
    }
  }

  // Customer order history
  async getCustomerOrderHistory(customerId, limit = 20) {
    try {
      if (!customerId) {
        throw new Error('Customer ID is required');
      }

      const orders = await this.orderRepository.findByCustomer(customerId);
      
      // Get detailed information for each order
      const detailedOrders = await Promise.all(
        orders.slice(0, limit).map(async (orderData) => {
          try {
            return await this.getOrderWithDetails(orderData.id);
          } catch (error) {
            console.error(`Error getting details for order ${orderData.id}:`, error);
            return Order.fromDatabaseRow(orderData).toJSON();
          }
        })
      );

      return detailedOrders;
    } catch (error) {
      console.error('Error getting customer order history:', error);
      throw error;
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

module.exports = OrderService;
