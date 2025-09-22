const { itemRepository, stockMovementRepository } = require('../repositories');
const { Item, StockMovement } = require('../models');
const ItemComponentService = require('./ItemComponentService');

class InventoryService {
  constructor() {
    this.itemRepository = itemRepository;
    this.stockMovementRepository = stockMovementRepository;
    this.itemComponentService = new ItemComponentService();
  }

  // Stock quantity management
  async updateStockQuantity(itemId, newQuantity, createdBy, notes = null) {
    try {
      // Validate inputs
      if (!itemId) {
        throw new Error('Item ID is required');
      }

      if (newQuantity < 0) {
        throw new Error('Stock quantity cannot be negative');
      }

      if (!createdBy) {
        throw new Error('Created by is required');
      }

      // Get the item
      const itemData = await this.itemRepository.findById(itemId);
      if (!itemData) {
        throw new Error('Item not found');
      }

      const item = Item.fromDatabaseRow(itemData);

      // Validate that this is an atomic item
      if (item.isComposite) {
        throw new Error('Cannot update stock quantity for composite items');
      }
      if (item.type === 'Service') {
        throw new Error('Cannot update stock quantity for service items');
      }

      const currentQuantity = item.quantityOnHand || 0;
      const delta = newQuantity - currentQuantity;

      // If no change, return current item
      if (delta === 0) {
        return item;
      }

      // Update the item quantity
      const updatedItemData = await this.itemRepository.updateStock(itemId, newQuantity);
      const updatedItem = Item.fromDatabaseRow(updatedItemData);

      // Create stock movement record
      const stockMovement = StockMovement.createAdjustmentMovement(
        itemId,
        delta,
        createdBy,
        notes || `Stock quantity updated from ${currentQuantity} to ${newQuantity}`
      );

      const validation = stockMovement.validate();
      if (!validation.isValid) {
        throw new Error(`Invalid stock movement: ${validation.errors.join(', ')}`);
      }

      await this.stockMovementRepository.recordAdjustment(
        itemId,
        delta,
        'adjustment',
        createdBy,
        stockMovement.notes
      );

      return updatedItem;
    } catch (error) {
      console.error('Error updating stock quantity:', error);
      throw error;
    }
  }

  async adjustStockQuantity(itemId, delta, reason, createdBy, notes = null) {
    try {
      // Validate inputs
      if (!itemId) {
        throw new Error('Item ID is required');
      }

      if (delta === 0) {
        throw new Error('Delta cannot be zero');
      }

      if (!reason) {
        throw new Error('Reason is required');
      }

      if (!createdBy) {
        throw new Error('Created by is required');
      }

      // Validate reason
      const validReasons = ['adjustment', 'repair', 'loss', 'found'];
      if (!validReasons.includes(reason)) {
        throw new Error(`Invalid reason. Must be one of: ${validReasons.join(', ')}`);
      }

      // Get the item
      const itemData = await this.itemRepository.findById(itemId);
      if (!itemData) {
        throw new Error('Item not found');
      }

      const item = Item.fromDatabaseRow(itemData);

      // Validate that this is an atomic item
      if (item.isComposite) {
        throw new Error('Cannot adjust stock quantity for composite items');
      }
      if (item.type === 'Service') {
        throw new Error('Cannot adjust stock quantity for service items');
      }

      const currentQuantity = item.quantityOnHand || 0;
      const newQuantity = currentQuantity + delta;

      // Validate that adjustment won't result in negative quantity
      if (newQuantity < 0) {
        throw new Error(`Stock adjustment would result in negative quantity (${newQuantity})`);
      }

      // Update the item quantity
      const updatedItemData = await this.itemRepository.updateStock(itemId, newQuantity);
      const updatedItem = Item.fromDatabaseRow(updatedItemData);

      // Create stock movement record
      const stockMovement = new StockMovement({
        itemId,
        orderId: null,
        delta,
        reason,
        createdBy,
        notes: notes || `Stock ${delta > 0 ? 'increase' : 'decrease'} of ${Math.abs(delta)} units`
      });

      const validation = stockMovement.validate();
      if (!validation.isValid) {
        throw new Error(`Invalid stock movement: ${validation.errors.join(', ')}`);
      }

      await this.stockMovementRepository.recordAdjustment(
        itemId,
        delta,
        reason,
        createdBy,
        stockMovement.notes
      );

      return {
        item: updatedItem,
        movement: stockMovement,
        previousQuantity: currentQuantity,
        newQuantity: newQuantity
      };
    } catch (error) {
      console.error('Error adjusting stock quantity:', error);
      throw error;
    }
  }

  async getStockMovementHistory(itemId, limit = 50) {
    try {
      if (!itemId) {
        throw new Error('Item ID is required');
      }

      const movements = await this.stockMovementRepository.findByItem(itemId, limit);
      return movements.map(movement => StockMovement.fromDatabaseRow(movement));
    } catch (error) {
      console.error('Error getting stock movement history:', error);
      throw error;
    }
  }

  async getStockSummary(itemId) {
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

      if (item.isComposite) {
        // Composite items: calculate based on components and mark as calculated
        const composite = await this.itemComponentService.calculateCompositeStock(itemId);
        const movementSummary = await this.stockMovementRepository.getStockMovementSummary(itemId);

        return {
          item: item.toJSON(),
          currentQuantity: composite.availableQuantity,
          movementSummary,
          stockCalculation: {
            isCalculated: true,
            method: 'composite_min_sets',
            availableQuantity: composite.availableQuantity,
            limitingComponent: composite.limitingComponent,
            stockStatus: composite.stockStatus
          },
          stockStatus: composite.stockStatus,
          isCalculated: true
        };
      }

      // Get movement summary
      const movementSummary = await this.stockMovementRepository.getStockMovementSummary(itemId);
      
      // Get current stock calculation
      const stockCalculation = await this.stockMovementRepository.getCurrentStock(itemId);

      return {
        item: item.toJSON(),
        currentQuantity: item.quantityOnHand,
        movementSummary,
        stockCalculation: { ...stockCalculation, isCalculated: false },
        stockStatus: item.getStockStatus(),
        isCalculated: false
      };
    } catch (error) {
      console.error('Error getting stock summary:', error);
      throw error;
    }
  }

  async getAllStockLevels() {
    try {
      const stockLevels = await this.itemRepository.getStockLevels();
      return stockLevels;
    } catch (error) {
      console.error('Error getting stock levels:', error);
      throw error;
    }
  }

  async getLowStockItems(threshold = 5) {
    try {
      const stockLevels = await this.getAllStockLevels();
      return stockLevels.filter(item => 
        item.quantity_on_hand <= threshold && item.quantity_on_hand > 0
      );
    } catch (error) {
      console.error('Error getting low stock items:', error);
      throw error;
    }
  }

  async getOutOfStockItems() {
    try {
      const stockLevels = await this.getAllStockLevels();
      return stockLevels.filter(item => item.quantity_on_hand === 0);
    } catch (error) {
      console.error('Error getting out of stock items:', error);
      throw error;
    }
  }

  async validateStockAdjustment(itemId, delta, reason) {
    try {
      const errors = [];

      // Get the item
      const itemData = await this.itemRepository.findById(itemId);
      if (!itemData) {
        errors.push('Item not found');
        return { isValid: false, errors };
      }

      const item = Item.fromDatabaseRow(itemData);

      // Check if it's an atomic item
      if (item.isComposite) {
        errors.push('Cannot adjust stock for composite items');
      }

      // Check if delta is valid
      if (delta === 0) {
        errors.push('Delta cannot be zero');
      }

      // Check if reason is valid
      const validReasons = ['adjustment', 'repair', 'loss', 'found'];
      if (!validReasons.includes(reason)) {
        errors.push(`Invalid reason. Must be one of: ${validReasons.join(', ')}`);
      }

      // Check if adjustment would result in negative quantity
      const currentQuantity = item.quantityOnHand || 0;
      const newQuantity = currentQuantity + delta;
      if (newQuantity < 0) {
        errors.push(`Adjustment would result in negative quantity (${newQuantity})`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        currentQuantity,
        newQuantity,
        item: item.toJSON()
      };
    } catch (error) {
      console.error('Error validating stock adjustment:', error);
      throw error;
    }
  }

  async bulkStockAdjustment(adjustments, createdBy) {
    try {
      const results = [];
      const errors = [];

      for (const adjustment of adjustments) {
        try {
          const { itemId, delta, reason, notes } = adjustment;
          
          const result = await this.adjustStockQuantity(itemId, delta, reason, createdBy, notes);
          results.push({
            itemId,
            success: true,
            result
          });
        } catch (error) {
          errors.push({
            itemId: adjustment.itemId,
            error: error.message
          });
        }
      }

      return {
        successful: results,
        failed: errors,
        totalProcessed: adjustments.length,
        successCount: results.length,
        errorCount: errors.length
      };
    } catch (error) {
      console.error('Error performing bulk stock adjustment:', error);
      throw error;
    }
  }
}

module.exports = InventoryService;
