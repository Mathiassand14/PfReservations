const { ItemComponentService, AvailabilityService, StockMovementService, OrderStatusService } = require('../../services');

// Mock repositories
const mockItemRepository = {
  getById: jest.fn(),
  getItemWithComponents: jest.fn(),
  addComponent: jest.fn(),
  removeComponent: jest.fn(),
  getComponentsByParent: jest.fn()
};

const mockStockMovementRepository = {
  create: jest.fn(),
  getByFilters: jest.fn()
};

const mockOrderRepository = {
  getById: jest.fn(),
  getOrdersInDateRange: jest.fn(),
  updateStatus: jest.fn()
};

describe('ItemComponentService', () => {
  let itemComponentService;

  beforeEach(() => {
    jest.clearAllMocks();
    itemComponentService = new ItemComponentService(mockItemRepository);
  });

  describe('Cycle Detection', () => {
    test('should detect direct cycle (A -> B -> A)', async () => {
      // Mock component relationships: A has component B, and we're trying to add A as component of B
      mockItemRepository.getComponentsByParent.mockImplementation((parentId) => {
        if (parentId === 1) { // Item A
          return Promise.resolve([{ child_id: 2, quantity: 1 }]); // A -> B
        }
        if (parentId === 2) { // Item B
          return Promise.resolve([]); // B has no components yet
        }
        return Promise.resolve([]);
      });

      // Try to add A as component of B (would create cycle: A -> B -> A)
      const result = await itemComponentService.detectCycle(2, 1);
      
      expect(result.isValid).toBe(false);
      expect(result.cyclePath).toContain(1);
      expect(result.cyclePath).toContain(2);
    });

    test('should detect indirect cycle (A -> B -> C -> A)', async () => {
      // Mock component relationships: A -> B -> C, trying to add A as component of C
      mockItemRepository.getComponentsByParent.mockImplementation((parentId) => {
        if (parentId === 1) { // Item A
          return Promise.resolve([{ child_id: 2, quantity: 1 }]); // A -> B
        }
        if (parentId === 2) { // Item B
          return Promise.resolve([{ child_id: 3, quantity: 1 }]); // B -> C
        }
        if (parentId === 3) { // Item C
          return Promise.resolve([]); // C has no components yet
        }
        return Promise.resolve([]);
      });

      // Try to add A as component of C (would create cycle: A -> B -> C -> A)
      const result = await itemComponentService.detectCycle(3, 1);
      
      expect(result.isValid).toBe(false);
      expect(result.cyclePath).toContain(1);
      expect(result.cyclePath).toContain(2);
      expect(result.cyclePath).toContain(3);
    });

    test('should allow valid component addition with no cycles', async () => {
      // Mock component relationships: A -> B, trying to add C as component of A
      mockItemRepository.getComponentsByParent.mockImplementation((parentId) => {
        if (parentId === 1) { // Item A
          return Promise.resolve([{ child_id: 2, quantity: 1 }]); // A -> B
        }
        if (parentId === 2) { // Item B
          return Promise.resolve([]); // B has no components
        }
        if (parentId === 3) { // Item C
          return Promise.resolve([]); // C has no components
        }
        return Promise.resolve([]);
      });

      // Try to add C as component of A (valid: A -> B, A -> C)
      const result = await itemComponentService.detectCycle(1, 3);
      
      expect(result.isValid).toBe(true);
      expect(result.cyclePath).toEqual([]);
    });

    test('should handle complex BOM structures without cycles', async () => {
      // Mock complex structure: A -> [B, C], B -> [D, E], C -> [F]
      mockItemRepository.getComponentsByParent.mockImplementation((parentId) => {
        if (parentId === 1) { // Item A
          return Promise.resolve([
            { child_id: 2, quantity: 1 }, // A -> B
            { child_id: 3, quantity: 1 }  // A -> C
          ]);
        }
        if (parentId === 2) { // Item B
          return Promise.resolve([
            { child_id: 4, quantity: 1 }, // B -> D
            { child_id: 5, quantity: 1 }  // B -> E
          ]);
        }
        if (parentId === 3) { // Item C
          return Promise.resolve([{ child_id: 6, quantity: 1 }]); // C -> F
        }
        return Promise.resolve([]);
      });

      // Try to add F as component of B (valid: no cycle)
      const result = await itemComponentService.detectCycle(2, 6);
      
      expect(result.isValid).toBe(true);
      expect(result.cyclePath).toEqual([]);
    });
  });

  describe('BOM Validation', () => {
    test('should validate entire BOM structure for cycles', async () => {
      // Mock BOM structure with cycle: A -> B -> C -> B
      mockItemRepository.getComponentsByParent.mockImplementation((parentId) => {
        if (parentId === 1) { // Item A
          return Promise.resolve([{ child_id: 2, quantity: 1 }]); // A -> B
        }
        if (parentId === 2) { // Item B
          return Promise.resolve([{ child_id: 3, quantity: 1 }]); // B -> C
        }
        if (parentId === 3) { // Item C
          return Promise.resolve([{ child_id: 2, quantity: 1 }]); // C -> B (creates cycle)
        }
        return Promise.resolve([]);
      });

      const result = await itemComponentService.detectCycleInBOM(1);
      
      expect(result.isValid).toBe(false);
      expect(result.cyclePath.length).toBeGreaterThan(0);
    });

    test('should validate complex BOM without cycles', async () => {
      // Mock valid complex BOM: A -> [B, C], B -> [D], C -> [E]
      mockItemRepository.getComponentsByParent.mockImplementation((parentId) => {
        if (parentId === 1) { // Item A
          return Promise.resolve([
            { child_id: 2, quantity: 1 }, // A -> B
            { child_id: 3, quantity: 1 }  // A -> C
          ]);
        }
        if (parentId === 2) { // Item B
          return Promise.resolve([{ child_id: 4, quantity: 1 }]); // B -> D
        }
        if (parentId === 3) { // Item C
          return Promise.resolve([{ child_id: 5, quantity: 1 }]); // C -> E
        }
        return Promise.resolve([]);
      });

      const result = await itemComponentService.detectCycleInBOM(1);
      
      expect(result.isValid).toBe(true);
      expect(result.cyclePath).toEqual([]);
    });
  });

  describe('Stock Calculations', () => {
    test('should calculate composite stock correctly', async () => {
      // Mock composite item with components
      const compositeItem = {
        id: 1,
        name: 'Workstation Bundle',
        is_composite: true,
        components: [
          {
            child_id: 2,
            quantity: 1,
            component_name: 'Laptop',
            available_quantity: 10
          },
          {
            child_id: 3,
            quantity: 2,
            component_name: 'Monitor',
            available_quantity: 8
          }
        ]
      };

      mockItemRepository.getItemWithComponents.mockResolvedValue(compositeItem);

      const result = await itemComponentService.calculateCompositeStock(1);
      
      expect(result.availableQuantity).toBe(4); // min(floor(10/1), floor(8/2)) = min(10, 4) = 4
      expect(result.stockStatus).toBe('in_stock');
      expect(result.limitingComponent).toBe('Monitor');
    });

    test('should handle out of stock components', async () => {
      const compositeItem = {
        id: 1,
        name: 'Bundle',
        is_composite: true,
        components: [
          {
            child_id: 2,
            quantity: 1,
            component_name: 'Laptop',
            available_quantity: 5
          },
          {
            child_id: 3,
            quantity: 1,
            component_name: 'Monitor',
            available_quantity: 0
          }
        ]
      };

      mockItemRepository.getItemWithComponents.mockResolvedValue(compositeItem);

      const result = await itemComponentService.calculateCompositeStock(1);
      
      expect(result.availableQuantity).toBe(0);
      expect(result.stockStatus).toBe('out_of_stock');
      expect(result.limitingComponent).toBe('Monitor');
    });
  });
});

describe('AvailabilityService', () => {
  let availabilityService;

  beforeEach(() => {
    jest.clearAllMocks();
    availabilityService = new AvailabilityService(mockItemRepository, mockOrderRepository);
  });

  describe('Availability Calculations', () => {
    test('should calculate availability with overlapping orders', async () => {
      const itemId = 1;
      const startDate = '2025-01-15';
      const endDate = '2025-01-20';

      // Mock item with 10 on hand
      mockItemRepository.getById.mockResolvedValue({
        id: 1,
        name: 'Laptop',
        is_composite: false,
        quantity_on_hand: 10
      });

      // Mock overlapping orders
      mockOrderRepository.getOrdersInDateRange.mockResolvedValue([
        {
          id: 1,
          status: 'Reserved',
          start_date: '2025-01-16',
          end_date: '2025-01-18',
          lines: [{ item_id: 1, quantity: 3 }]
        },
        {
          id: 2,
          status: 'Checked Out', 
          start_date: '2025-01-14',
          end_date: '2025-01-19',
          lines: [{ item_id: 1, quantity: 2 }]
        }
      ]);

      const result = await availabilityService.checkAvailability(itemId, startDate, endDate);
      
      expect(result.isAvailable).toBe(true);
      expect(result.availableQuantity).toBe(5); // 10 - 3 - 2 = 5
      expect(result.conflicts).toHaveLength(2);
    });

    test('should detect availability conflicts', async () => {
      const itemId = 1;
      const startDate = '2025-01-15';
      const endDate = '2025-01-20';
      const requestedQuantity = 8;

      mockItemRepository.getById.mockResolvedValue({
        id: 1,
        name: 'Laptop',
        is_composite: false,
        quantity_on_hand: 10
      });

      mockOrderRepository.getOrdersInDateRange.mockResolvedValue([
        {
          id: 1,
          status: 'Reserved',
          start_date: '2025-01-16',
          end_date: '2025-01-18',
          lines: [{ item_id: 1, quantity: 7 }]
        }
      ]);

      const result = await availabilityService.checkAvailability(itemId, startDate, endDate, requestedQuantity);
      
      expect(result.isAvailable).toBe(false);
      expect(result.availableQuantity).toBe(3); // 10 - 7 = 3, but requesting 8
      expect(result.conflicts).toHaveLength(1);
    });
  });
});

describe('StockMovementService', () => {
  let stockMovementService;

  beforeEach(() => {
    jest.clearAllMocks();
    stockMovementService = new StockMovementService(mockStockMovementRepository, mockItemRepository);
  });

  describe('Stock Movement Creation', () => {
    test('should create stock movement with audit trail', async () => {
      const movementData = {
        itemId: 1,
        delta: -5,
        reason: 'checkout',
        orderId: 100,
        createdBy: 'Test User',
        notes: 'Order checkout'
      };

      mockStockMovementRepository.create.mockResolvedValue({
        id: 1,
        ...movementData,
        created_at: new Date()
      });

      const result = await stockMovementService.createMovement(movementData);
      
      expect(mockStockMovementRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          item_id: 1,
          delta: -5,
          reason: 'checkout',
          order_id: 100,
          created_by: 'Test User',
          notes: 'Order checkout'
        })
      );
      expect(result.id).toBe(1);
    });

    test('should validate reason codes', async () => {
      const invalidMovementData = {
        itemId: 1,
        delta: 5,
        reason: 'invalid_reason',
        createdBy: 'Test User'
      };

      await expect(stockMovementService.createMovement(invalidMovementData))
        .rejects.toThrow('Invalid reason code');
    });
  });
});

describe('OrderStatusService', () => {
  let orderStatusService;

  beforeEach(() => {
    jest.clearAllMocks();
    orderStatusService = new OrderStatusService(mockOrderRepository, mockStockMovementRepository);
  });

  describe('Status Transitions', () => {
    test('should allow valid status transition from Draft to Reserved', async () => {
      const orderId = 1;
      const newStatus = 'Reserved';
      const currentOrder = {
        id: 1,
        status: 'Draft',
        customer_id: 1,
        lines: [{ item_id: 1, quantity: 2 }]
      };

      mockOrderRepository.getById.mockResolvedValue(currentOrder);
      mockOrderRepository.updateStatus.mockResolvedValue({ ...currentOrder, status: newStatus });

      const result = await orderStatusService.transitionStatus(orderId, newStatus, 'Test User');
      
      expect(result.success).toBe(true);
      expect(result.order.status).toBe('Reserved');
      expect(mockStockMovementRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'reserve',
          delta: -2
        })
      );
    });

    test('should reject invalid status transitions', async () => {
      const orderId = 1;
      const newStatus = 'Checked Out';
      const currentOrder = {
        id: 1,
        status: 'Draft', // Can't go directly from Draft to Checked Out
        customer_id: 1
      };

      mockOrderRepository.getById.mockResolvedValue(currentOrder);

      await expect(orderStatusService.transitionStatus(orderId, newStatus, 'Test User'))
        .rejects.toThrow('Invalid status transition');
    });

    test('should create appropriate stock movements on status changes', async () => {
      const orderId = 1;
      const currentOrder = {
        id: 1,
        status: 'Reserved',
        customer_id: 1,
        lines: [
          { item_id: 1, quantity: 2 },
          { item_id: 2, quantity: 1 }
        ]
      };

      mockOrderRepository.getById.mockResolvedValue(currentOrder);
      mockOrderRepository.updateStatus.mockResolvedValue({ ...currentOrder, status: 'Checked Out' });

      await orderStatusService.transitionStatus(orderId, 'Checked Out', 'Test User');
      
      // Should create checkout movements for each line item
      expect(mockStockMovementRepository.create).toHaveBeenCalledTimes(2);
      expect(mockStockMovementRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'checkout',
          delta: -2,
          item_id: 1
        })
      );
      expect(mockStockMovementRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'checkout',
          delta: -1,
          item_id: 2
        })
      );
    });
  });

  describe('Business Rules', () => {
    test('should validate order has line items before reservation', async () => {
      const orderId = 1;
      const currentOrder = {
        id: 1,
        status: 'Draft',
        customer_id: 1,
        lines: [] // No line items
      };

      mockOrderRepository.getById.mockResolvedValue(currentOrder);

      await expect(orderStatusService.transitionStatus(orderId, 'Reserved', 'Test User'))
        .rejects.toThrow('Cannot reserve order without line items');
    });

    test('should check customer activation status', async () => {
      const orderId = 1;
      const currentOrder = {
        id: 1,
        status: 'Draft',
        customer_id: 1,
        customer_is_active: false, // Inactive customer
        lines: [{ item_id: 1, quantity: 1 }]
      };

      mockOrderRepository.getById.mockResolvedValue(currentOrder);

      await expect(orderStatusService.transitionStatus(orderId, 'Reserved', 'Test User'))
        .rejects.toThrow('Cannot create orders for inactive customers');
    });
  });
});