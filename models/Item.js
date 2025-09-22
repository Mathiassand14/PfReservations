class Item {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || '';
    this.sku = data.sku || '';
    const rawPrice = (data.price_per_day !== undefined && data.price_per_day !== null)
      ? data.price_per_day
      : (data.pricePerDay !== undefined && data.pricePerDay !== null)
        ? data.pricePerDay
        : 0;
    this.pricePerDay = typeof rawPrice === 'string' ? parseFloat(rawPrice) : rawPrice;
    this.type = data.type || (data.is_composite ? 'Composite' : 'Atomic');
    this.isComposite = this.type === 'Composite';
    this.quantityOnHand = data.quantity_on_hand !== undefined ? data.quantity_on_hand : data.quantityOnHand;
    this.createdAt = data.created_at || data.createdAt || null;
    this.updatedAt = data.updated_at || data.updatedAt || null;
    
    // For composite items with components loaded
    this.components = data.components || [];
  }

  // Validation methods
  validate() {
    const errors = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Item name is required');
    }

    if (this.name && this.name.length > 255) {
      errors.push('Item name must be 255 characters or less');
    }

    if (!this.sku || this.sku.trim().length === 0) {
      errors.push('SKU is required');
    }

    if (this.sku && this.sku.length > 100) {
      errors.push('SKU must be 100 characters or less');
    }

    if (this.pricePerDay < 0) {
      errors.push('Price per day must be non-negative');
    }

    if (this.pricePerDay > 999999.99) {
      errors.push('Price per day must be less than $999,999.99');
    }

    // Composite/Service items should not have quantity on hand
    if (this.type === 'Composite' && this.quantityOnHand !== null && this.quantityOnHand !== undefined) {
      errors.push('Composite items should not have a quantity on hand');
    }
    if (this.type === 'Service' && this.quantityOnHand !== null && this.quantityOnHand !== undefined) {
      errors.push('Service items should not have a quantity on hand');
    }

    // If provided, quantity_on_hand must be non-negative
    if (this.quantityOnHand !== null && this.quantityOnHand !== undefined && this.quantityOnHand < 0) {
      errors.push('Quantity on hand must be non-negative');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Business logic methods
  isAtomic() {
    return !this.isComposite;
  }

  hasComponents() {
    return this.isComposite && this.components && this.components.length > 0;
  }

  calculateAvailableQuantity(reservedQuantity = 0) {
    if (this.isComposite) {
      return this.calculateCompositeAvailability();
    }
    
    return Math.max(0, (this.quantityOnHand || 0) - reservedQuantity);
  }

  calculateCompositeAvailability() {
    if (!this.hasComponents()) {
      return 0;
    }

    let minAvailable = Infinity;

    for (const component of this.components) {
      const componentAvailable = component.available_quantity || 0;
      const requiredQuantity = component.quantity || 1;
      
      if (requiredQuantity <= 0) {
        continue;
      }

      const possibleSets = Math.floor(componentAvailable / requiredQuantity);
      minAvailable = Math.min(minAvailable, possibleSets);
    }

    return minAvailable === Infinity ? 0 : Math.max(0, minAvailable);
  }

  updateStock(newQuantity) {
    if (this.isComposite) {
      throw new Error('Cannot update stock for composite items');
    }
    
    if (newQuantity < 0) {
      throw new Error('Stock quantity cannot be negative');
    }
    
    this.quantityOnHand = newQuantity;
  }

  adjustStock(delta) {
    if (this.isComposite) {
      throw new Error('Cannot adjust stock for composite items');
    }
    
    const newQuantity = (this.quantityOnHand || 0) + delta;
    
    if (newQuantity < 0) {
      throw new Error('Stock adjustment would result in negative quantity');
    }
    
    this.quantityOnHand = newQuantity;
  }

  updatePrice(newPrice) {
    if (newPrice < 0) {
      throw new Error('Price cannot be negative');
    }
    
    if (newPrice > 999999.99) {
      throw new Error('Price cannot exceed $999,999.99');
    }
    
    this.pricePerDay = newPrice;
  }

  addComponent(componentId, quantity) {
    if (!this.isComposite) {
      throw new Error('Cannot add components to atomic items');
    }
    
    if (quantity <= 0) {
      throw new Error('Component quantity must be positive');
    }
    
    // Check if component already exists
    const existingIndex = this.components.findIndex(c => c.component_id === componentId);
    
    if (existingIndex >= 0) {
      this.components[existingIndex].quantity = quantity;
    } else {
      this.components.push({
        component_id: componentId,
        quantity: quantity
      });
    }
  }

  removeComponent(componentId) {
    if (!this.isComposite) {
      throw new Error('Cannot remove components from atomic items');
    }
    
    this.components = this.components.filter(c => c.component_id !== componentId);
  }

  getComponentIds() {
    return this.components.map(c => c.component_id);
  }

  hasComponent(componentId) {
    return this.components.some(c => c.component_id === componentId);
  }

  getStockStatus() {
    const available = this.calculateAvailableQuantity();
    
    if (available === 0) {
      return 'out_of_stock';
    } else if (available <= 5) {
      return 'low_stock';
    } else {
      return 'in_stock';
    }
  }

  // Data transformation methods
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      sku: this.sku,
      pricePerDay: this.pricePerDay,
      isComposite: this.isComposite,
      type: this.type,
      quantityOnHand: this.quantityOnHand,
      components: this.components,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toDatabaseObject() {
    const type = this.type || (this.isComposite ? 'Composite' : 'Atomic');
    return {
      name: this.name,
      sku: this.sku,
      price_per_day: this.pricePerDay,
      is_composite: type === 'Composite',
      type,
      quantity_on_hand: (type === 'Composite' || type === 'Service') ? null : (this.quantityOnHand ?? 0)
    };
  }

  static fromDatabaseRow(row) {
    return new Item(row);
  }

  static validateSku(sku) {
    if (!sku || typeof sku !== 'string') {
      return false;
    }
    
    // SKU should be alphanumeric with hyphens and underscores allowed
    const skuRegex = /^[A-Z0-9\-_]+$/i;
    return skuRegex.test(sku) && sku.length <= 100;
  }

  static getStockStatusLevels() {
    return {
      out_of_stock: { threshold: 0, label: 'Out of Stock', color: 'red' },
      low_stock: { threshold: 5, label: 'Low Stock', color: 'yellow' },
      in_stock: { threshold: Infinity, label: 'In Stock', color: 'green' }
    };
  }
}

module.exports = Item;
