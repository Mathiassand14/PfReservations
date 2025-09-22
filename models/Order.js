class Order {
  constructor(data = {}) {
    this.id = data.id || null;
    this.customerId = data.customer_id || data.customerId || null;
    this.salesPersonId = data.sales_person_id || data.salesPersonId || null;
    this.status = data.status || 'Draft';
    this.startDate = data.start_date || data.startDate || null;
    this.returnDueDate = data.return_due_date || data.returnDueDate || null;
    // Extended time window (TIMESTAMPTZ)
    this.setupStart = data.setup_start || data.setupStart || null;
    this.orderStart = data.order_start || data.orderStart || null;
    this.orderEnd = data.order_end || data.orderEnd || null;
    this.cleanupEnd = data.cleanup_end || data.cleanupEnd || null;
    this.discountAmount = data.discount_amount || data.discountAmount || 0;
    this.taxAmount = data.tax_amount || data.taxAmount || 0;
    this.createdAt = data.created_at || data.createdAt || null;
    this.updatedAt = data.updated_at || data.updatedAt || null;
    
    // Additional data that might be loaded with the order
    this.customerName = data.customer_name || data.customerName || null;
    this.salesPersonName = data.sales_person_name || data.salesPersonName || null;
    this.lineItems = data.line_items || data.lineItems || [];
  }

  // Validation methods
  validate() {
    const errors = [];

    if (!this.customerId) {
      errors.push('Customer ID is required');
    }

    if (!this.salesPersonId) {
      errors.push('Sales person ID is required');
    }

    if (!this.isValidStatus(this.status)) {
      errors.push('Status must be one of: Draft, Reserved, Checked Out, Returned, Cancelled');
    }

    // Support either classic pair (start/return) or extended time (orderStart/orderEnd)
    const hasClassic = !!(this.startDate && this.returnDueDate);
    const hasExtended = !!(this.orderStart && this.orderEnd);
    if (!hasClassic && !hasExtended) {
      errors.push('Either Start/Return dates or Order Start/End must be provided');
    }

    // Validate classic pair if provided
    if (this.startDate && this.returnDueDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.returnDueDate);
      if (end <= start) {
        errors.push('Return due date must be after start date');
      }
    }

    // Validate extended window ordering if provided
    const toTs = (v) => (v ? new Date(v).getTime() : null);
    const ss = toTs(this.setupStart);
    const os = toTs(this.orderStart);
    const oe = toTs(this.orderEnd);
    const ce = toTs(this.cleanupEnd);

    if (os !== null && oe !== null && oe <= os) {
      errors.push('Order End must be after Order Start');
    }
    if (ss !== null && os !== null && os < ss) {
      errors.push('Order Start must be on/after Setup Start');
    }
    if (ce !== null && oe !== null && ce < oe) {
      errors.push('Cleanup End must be on/after Order End');
    }

    if (this.discountAmount < 0) {
      errors.push('Discount amount cannot be negative');
    }

    if (this.taxAmount < 0) {
      errors.push('Tax amount cannot be negative');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  isValidStatus(status) {
    const validStatuses = ['Draft', 'Reserved', 'Checked Out', 'Returned', 'Cancelled'];
    return validStatuses.includes(status);
  }

  // Status transition methods
  canTransitionTo(newStatus) {
    const transitions = this.getValidTransitions();
    return transitions.includes(newStatus);
  }

  getValidTransitions() {
    const transitionMap = {
      'Draft': ['Reserved', 'Cancelled'],
      'Reserved': ['Checked Out', 'Cancelled'],
      'Checked Out': ['Returned'],
      'Returned': [], // Terminal state
      'Cancelled': [] // Terminal state
    };

    return transitionMap[this.status] || [];
  }

  transitionTo(newStatus) {
    if (!this.canTransitionTo(newStatus)) {
      throw new Error(`Cannot transition from ${this.status} to ${newStatus}`);
    }
    
    this.status = newStatus;
  }

  // Business logic methods
  isDraft() {
    return this.status === 'Draft';
  }

  isReserved() {
    return this.status === 'Reserved';
  }

  isCheckedOut() {
    return this.status === 'Checked Out';
  }

  isReturned() {
    return this.status === 'Returned';
  }

  isCancelled() {
    return this.status === 'Cancelled';
  }

  isActive() {
    return this.status === 'Reserved' || this.status === 'Checked Out';
  }

  isCompleted() {
    return this.status === 'Returned' || this.status === 'Cancelled';
  }

  requiresStockReservation() {
    return this.status === 'Reserved' || this.status === 'Checked Out';
  }

  calculateRentalDays() {
    if (!this.startDate || !this.returnDueDate) {
      return 0;
    }
    
    const start = new Date(this.startDate);
    const end = new Date(this.returnDueDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(1, diffDays); // Minimum 1 day rental
  }

  calculateSubtotal() {
    return this.lineItems.reduce((total, item) => total + (item.line_total || 0), 0);
  }

  calculateTotal() {
    const subtotal = this.calculateSubtotal();
    return subtotal + this.taxAmount - this.discountAmount;
  }

  isOverdue() {
    if (this.status !== 'Checked Out') {
      return false;
    }
    
    const today = new Date();
    const dueDate = new Date(this.returnDueDate);
    
    return today > dueDate;
  }

  getDaysOverdue() {
    if (!this.isOverdue()) {
      return 0;
    }
    
    const today = new Date();
    const dueDate = new Date(this.returnDueDate);
    const diffTime = today - dueDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  addLineItem(itemId, quantity, pricePerDay) {
    const rentalDays = this.calculateRentalDays();
    const lineTotal = quantity * pricePerDay * rentalDays;
    
    const lineItem = {
      item_id: itemId,
      quantity: quantity,
      price_per_day: pricePerDay,
      line_total: lineTotal
    };
    
    this.lineItems.push(lineItem);
    return lineItem;
  }

  removeLineItem(itemId) {
    this.lineItems = this.lineItems.filter(item => item.item_id !== itemId);
  }

  updateLineItem(itemId, quantity, pricePerDay) {
    const lineItem = this.lineItems.find(item => item.item_id === itemId);
    if (!lineItem) {
      throw new Error('Line item not found');
    }
    
    const rentalDays = this.calculateRentalDays();
    lineItem.quantity = quantity;
    lineItem.price_per_day = pricePerDay;
    lineItem.line_total = quantity * pricePerDay * rentalDays;
    
    return lineItem;
  }

  hasLineItems() {
    return this.lineItems && this.lineItems.length > 0;
  }

  getItemQuantity(itemId) {
    const lineItem = this.lineItems.find(item => item.item_id === itemId);
    return lineItem ? lineItem.quantity : 0;
  }

  // Data transformation methods
  toJSON() {
    return {
      id: this.id,
      customerId: this.customerId,
      salesPersonId: this.salesPersonId,
      status: this.status,
      startDate: this.startDate,
      returnDueDate: this.returnDueDate,
      setupStart: this.setupStart,
      orderStart: this.orderStart,
      orderEnd: this.orderEnd,
      cleanupEnd: this.cleanupEnd,
      discountAmount: this.discountAmount,
      taxAmount: this.taxAmount,
      customerName: this.customerName,
      salesPersonName: this.salesPersonName,
      lineItems: this.lineItems,
      rentalDays: this.calculateRentalDays(),
      subtotal: this.calculateSubtotal(),
      total: this.calculateTotal(),
      isOverdue: this.isOverdue(),
      daysOverdue: this.getDaysOverdue(),
      validTransitions: this.getValidTransitions(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toDatabaseObject() {
    return {
      customer_id: this.customerId,
      sales_person_id: this.salesPersonId,
      status: this.status,
      start_date: this.startDate,
      return_due_date: this.returnDueDate,
      setup_start: this.setupStart || null,
      order_start: this.orderStart || this.startDate || null,
      order_end: this.orderEnd || this.returnDueDate || null,
      cleanup_end: this.cleanupEnd || null,
      discount_amount: this.discountAmount,
      tax_amount: this.taxAmount
    };
  }

  static fromDatabaseRow(row) {
    return new Order(row);
  }

  static getValidStatuses() {
    return ['Draft', 'Reserved', 'Checked Out', 'Returned', 'Cancelled'];
  }

  static getStatusTransitions() {
    return {
      'Draft': ['Reserved', 'Cancelled'],
      'Reserved': ['Checked Out', 'Cancelled'],
      'Checked Out': ['Returned'],
      'Returned': [],
      'Cancelled': []
    };
  }

  static getStatusColors() {
    return {
      'Draft': '#6c757d',      // Gray
      'Reserved': '#ffc107',   // Yellow
      'Checked Out': '#dc3545', // Red
      'Returned': '#28a745',   // Green
      'Cancelled': '#343a40'   // Dark gray
    };
  }
}

module.exports = Order;
