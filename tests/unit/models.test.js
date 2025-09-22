const { Employee, Customer, Item, Order, StockMovement } = require('../../models');

describe('Models', () => {
  describe('Employee Model', () => {
    test('should create valid employee', () => {
      const employee = new Employee({
        fullName: 'John Doe',
        email: 'john@company.com',
        role: 'Admin'
      });

      const validation = employee.validate();
      expect(validation.isValid).toBe(true);
      expect(employee.canManageEmployees()).toBe(true);
    });

    test('should validate email format', () => {
      const employee = new Employee({
        fullName: 'John Doe',
        email: 'invalid-email',
        role: 'Staff'
      });

      const validation = employee.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Email must be a valid email address');
    });

    test('should validate role', () => {
      const employee = new Employee({
        fullName: 'John Doe',
        role: 'InvalidRole'
      });

      const validation = employee.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Role must be one of: Admin, Staff, ReadOnly');
    });

    test('should check permissions correctly', () => {
      const admin = new Employee({ role: 'Admin' });
      const staff = new Employee({ role: 'Staff' });
      const readOnly = new Employee({ role: 'ReadOnly' });

      expect(admin.canManageEmployees()).toBe(true);
      expect(staff.canManageEmployees()).toBe(false);
      expect(readOnly.canManageEmployees()).toBe(false);

      expect(admin.canManageCustomers()).toBe(true);
      expect(staff.canManageCustomers()).toBe(true);
      expect(readOnly.canManageCustomers()).toBe(false);
    });
  });

  describe('Customer Model', () => {
    test('should create valid customer', () => {
      const customer = new Customer({
        displayName: 'Acme Corp',
        contactInfo: {
          email: 'contact@acme.com',
          phone: '555-1234'
        }
      });

      const validation = customer.validate();
      expect(validation.isValid).toBe(true);
      expect(customer.canCreateOrders()).toBe(true);
    });

    test('should require display name', () => {
      const customer = new Customer({});
      
      const validation = customer.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Display name is required');
    });

    test('should validate contact info email', () => {
      const customer = new Customer({
        displayName: 'Test Corp',
        contactInfo: {
          email: 'invalid-email'
        }
      });

      const validation = customer.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Contact email must be a valid email address');
    });

    test('should prevent orders for inactive customers', () => {
      const customer = new Customer({
        displayName: 'Test Corp',
        isActive: false
      });

      expect(customer.canCreateOrders()).toBe(false);
    });
  });

  describe('Item Model', () => {
    test('should create valid atomic item', () => {
      const item = new Item({
        name: 'Laptop',
        sku: 'LAPTOP-001',
        pricePerDay: 25.00,
        isComposite: false,
        quantityOnHand: 10
      });

      const validation = item.validate();
      expect(validation.isValid).toBe(true);
      expect(item.isAtomic()).toBe(true);
    });

    test('should create valid composite item', () => {
      const item = new Item({
        name: 'Workstation Bundle',
        sku: 'BUNDLE-001',
        pricePerDay: 40.00,
        isComposite: true
      });

      const validation = item.validate();
      expect(validation.isValid).toBe(true);
      expect(item.isAtomic()).toBe(false);
    });

    test('should validate atomic item has quantity', () => {
      const item = new Item({
        name: 'Laptop',
        sku: 'LAPTOP-001',
        pricePerDay: 25.00,
        isComposite: false
      });

      const validation = item.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Atomic items must have a quantity on hand');
    });

    test('should validate composite item has no quantity', () => {
      const item = new Item({
        name: 'Bundle',
        sku: 'BUNDLE-001',
        pricePerDay: 40.00,
        isComposite: true,
        quantityOnHand: 5
      });

      const validation = item.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Composite items should not have a quantity on hand');
    });

    test('should calculate atomic availability', () => {
      const item = new Item({
        quantityOnHand: 10,
        isComposite: false
      });

      expect(item.calculateAvailableQuantity(3)).toBe(7);
      expect(item.calculateAvailableQuantity(15)).toBe(0);
    });

    test('should get stock status', () => {
      const outOfStock = new Item({ quantityOnHand: 0, isComposite: false });
      const lowStock = new Item({ quantityOnHand: 3, isComposite: false });
      const inStock = new Item({ quantityOnHand: 10, isComposite: false });

      expect(outOfStock.getStockStatus()).toBe('out_of_stock');
      expect(lowStock.getStockStatus()).toBe('low_stock');
      expect(inStock.getStockStatus()).toBe('in_stock');
    });

    describe('Composite Item Stock Calculations', () => {
      test('should calculate availability for composite item with single component', () => {
        const item = new Item({
          name: 'Basic Bundle',
          isComposite: true,
          components: [
            {
              component_name: 'Laptop',
              quantity: 2,
              available_quantity: 10
            }
          ]
        });

        expect(item.calculateCompositeAvailability()).toBe(5); // floor(10/2)
      });

      test('should calculate availability for composite item with multiple components', () => {
        const item = new Item({
          name: 'Workstation Bundle',
          isComposite: true,
          components: [
            {
              component_name: 'Laptop',
              quantity: 1,
              available_quantity: 10
            },
            {
              component_name: 'Monitor',
              quantity: 2,
              available_quantity: 8
            },
            {
              component_name: 'Keyboard',
              quantity: 1,
              available_quantity: 15
            }
          ]
        });

        // Limiting factor is Monitor: floor(8/2) = 4
        expect(item.calculateCompositeAvailability()).toBe(4);
      });

      test('should return 0 when any component is out of stock', () => {
        const item = new Item({
          name: 'Bundle',
          isComposite: true,
          components: [
            {
              component_name: 'Laptop',
              quantity: 1,
              available_quantity: 10
            },
            {
              component_name: 'Monitor',
              quantity: 1,
              available_quantity: 0
            }
          ]
        });

        expect(item.calculateCompositeAvailability()).toBe(0);
      });

      test('should handle insufficient component quantities', () => {
        const item = new Item({
          name: 'Bundle',
          isComposite: true,
          components: [
            {
              component_name: 'Laptop',
              quantity: 5,
              available_quantity: 3
            }
          ]
        });

        expect(item.calculateCompositeAvailability()).toBe(0);
      });

      test('should return 0 for composite item with no components', () => {
        const item = new Item({
          name: 'Empty Bundle',
          isComposite: true,
          components: []
        });

        expect(item.calculateCompositeAvailability()).toBe(0);
      });

      test('should handle edge case with zero required quantity', () => {
        const item = new Item({
          name: 'Bundle',
          isComposite: true,
          components: [
            {
              component_name: 'Optional Item',
              quantity: 0,
              available_quantity: 5
            },
            {
              component_name: 'Required Item',
              quantity: 2,
              available_quantity: 6
            }
          ]
        });

        // Should ignore components with zero quantity and use only Required Item
        expect(item.calculateCompositeAvailability()).toBe(3);
      });
    });

    describe('Stock Management', () => {
      test('should update stock for atomic items', () => {
        const item = new Item({
          name: 'Laptop',
          isComposite: false,
          quantityOnHand: 10
        });

        item.updateStock(15);
        expect(item.quantityOnHand).toBe(15);
      });

      test('should not allow stock updates for composite items', () => {
        const item = new Item({
          name: 'Bundle',
          isComposite: true
        });

        expect(() => item.updateStock(5)).toThrow('Cannot update stock for composite items');
      });

      test('should not allow negative stock quantities', () => {
        const item = new Item({
          name: 'Laptop',
          isComposite: false,
          quantityOnHand: 10
        });

        expect(() => item.updateStock(-5)).toThrow('Stock quantity cannot be negative');
      });

      test('should adjust stock for atomic items', () => {
        const item = new Item({
          name: 'Laptop',
          isComposite: false,
          quantityOnHand: 10
        });

        item.adjustStock(5);
        expect(item.quantityOnHand).toBe(15);

        item.adjustStock(-3);
        expect(item.quantityOnHand).toBe(12);
      });

      test('should not allow stock adjustments for composite items', () => {
        const item = new Item({
          name: 'Bundle',
          isComposite: true
        });

        expect(() => item.adjustStock(5)).toThrow('Cannot adjust stock for composite items');
      });

      test('should not allow adjustments resulting in negative stock', () => {
        const item = new Item({
          name: 'Laptop',
          isComposite: false,
          quantityOnHand: 5
        });

        expect(() => item.adjustStock(-10)).toThrow('Stock adjustment would result in negative quantity');
      });
    });
  });

  describe('Order Model', () => {
    test('should create valid order', () => {
      const order = new Order({
        customerId: 1,
        salesPersonId: 1,
        startDate: '2025-01-15',
        returnDueDate: '2025-01-20'
      });

      const validation = order.validate();
      expect(validation.isValid).toBe(true);
      expect(order.calculateRentalDays()).toBe(5);
    });

    test('should validate date range', () => {
      const order = new Order({
        customerId: 1,
        salesPersonId: 1,
        startDate: '2025-01-20',
        returnDueDate: '2025-01-15'
      });

      const validation = order.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Return due date must be after start date');
    });

    test('should validate status transitions', () => {
      const order = new Order({ status: 'Draft' });

      expect(order.canTransitionTo('Reserved')).toBe(true);
      expect(order.canTransitionTo('Checked Out')).toBe(false);
      expect(order.canTransitionTo('Returned')).toBe(false);

      order.status = 'Reserved';
      expect(order.canTransitionTo('Checked Out')).toBe(true);
      expect(order.canTransitionTo('Cancelled')).toBe(true);
      expect(order.canTransitionTo('Draft')).toBe(false);
    });

    test('should calculate totals', () => {
      const order = new Order({
        discountAmount: 10,
        taxAmount: 5,
        lineItems: [
          { line_total: 100 },
          { line_total: 50 }
        ]
      });

      expect(order.calculateSubtotal()).toBe(150);
      expect(order.calculateTotal()).toBe(145); // 150 - 10 + 5
    });
  });

  describe('StockMovement Model', () => {
    test('should create valid stock movement', () => {
      const movement = new StockMovement({
        itemId: 1,
        orderId: 1,
        delta: -2,
        reason: 'checkout',
        createdBy: 'Test User'
      });

      const validation = movement.validate();
      expect(validation.isValid).toBe(true);
      expect(movement.isStockDecrease()).toBe(true);
      expect(movement.isOrderRelated()).toBe(true);
    });

    test('should validate reason-specific rules', () => {
      const checkoutMovement = new StockMovement({
        itemId: 1,
        delta: 2, // Should be negative for checkout
        reason: 'checkout',
        createdBy: 'Test User'
      });

      const validation = checkoutMovement.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('checkout movements must have negative delta');
    });

    test('should require notes for adjustments', () => {
      const adjustment = new StockMovement({
        itemId: 1,
        delta: 5,
        reason: 'adjustment',
        createdBy: 'Test User'
      });

      const validation = adjustment.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Adjustment movements require notes explaining the reason');
    });

    test('should create factory methods', () => {
      const checkout = StockMovement.createCheckoutMovement(1, 1, 2, 'Test User');
      expect(checkout.reason).toBe('checkout');
      expect(checkout.delta).toBe(-2);

      const return_ = StockMovement.createReturnMovement(1, 1, 2, 'Test User');
      expect(return_.reason).toBe('return');
      expect(return_.delta).toBe(2);
    });
  });
});