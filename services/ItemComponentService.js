const { itemRepository } = require('../repositories');
const { Item } = require('../models');

class ItemComponentService {
  constructor(repoOverride = null) {
    // Allow repository injection for testing; default to real repository
    this.itemRepository = repoOverride || itemRepository;
  }

  // BOM management methods
  async addComponent(parentId, childId, quantity) {
    try {
      // Validate inputs
      if (!parentId || !childId) {
        throw new Error('Parent ID and Child ID are required');
      }

      if (quantity <= 0) {
        throw new Error('Quantity must be positive');
      }

      if (parentId === childId) {
        throw new Error('Item cannot be a component of itself');
      }

      // Validate that parent exists and is composite
      const parentData = await this.itemRepository.findById(parentId);
      if (!parentData) {
        throw new Error('Parent item not found');
      }

      const parent = Item.fromDatabaseRow(parentData);
      if (!parent.isComposite) {
        throw new Error('Parent item must be composite to have components');
      }

      // Validate that child exists and is atomic
      const childData = await this.itemRepository.findById(childId);
      if (!childData) {
        throw new Error('Child item not found');
      }

      const child = Item.fromDatabaseRow(childData);
      if (child.isComposite) {
        throw new Error('Child item must be atomic (composite items cannot be components)');
      }

      // Check for cycles before adding
      const cycleCheck = await this.detectCycle(parentId, childId);
      if (!cycleCheck.isValid) {
        throw new Error(`Adding this component would create a cycle: ${cycleCheck.cyclePath.join(' -> ')}`);
      }

      // Add the component
      const component = await this.itemRepository.addComponent(parentId, childId, quantity);
      
      return {
        component,
        parent: parent.toJSON(),
        child: child.toJSON()
      };
    } catch (error) {
      console.error('Error adding component:', error);
      throw error;
    }
  }

  async removeComponent(parentId, childId) {
    try {
      if (!parentId || !childId) {
        throw new Error('Parent ID and Child ID are required');
      }

      // Validate that parent exists and is composite
      const parentData = await this.itemRepository.findById(parentId);
      if (!parentData) {
        throw new Error('Parent item not found');
      }

      const parent = Item.fromDatabaseRow(parentData);
      if (!parent.isComposite) {
        throw new Error('Parent item must be composite');
      }

      // Remove the component
      const removedComponent = await this.itemRepository.removeComponent(parentId, childId);
      
      if (!removedComponent) {
        throw new Error('Component relationship not found');
      }

      return {
        removedComponent,
        parent: parent.toJSON()
      };
    } catch (error) {
      console.error('Error removing component:', error);
      throw error;
    }
  }

  async updateComponentQuantity(parentId, childId, newQuantity) {
    try {
      if (!parentId || !childId) {
        throw new Error('Parent ID and Child ID are required');
      }

      if (newQuantity <= 0) {
        throw new Error('Quantity must be positive');
      }

      // Validate that parent exists and is composite
      const parentData = await this.itemRepository.findById(parentId);
      if (!parentData) {
        throw new Error('Parent item not found');
      }

      const parent = Item.fromDatabaseRow(parentData);
      if (!parent.isComposite) {
        throw new Error('Parent item must be composite');
      }

      // Update the component quantity
      const component = await this.itemRepository.addComponent(parentId, childId, newQuantity);
      
      return {
        component,
        parent: parent.toJSON()
      };
    } catch (error) {
      console.error('Error updating component quantity:', error);
      throw error;
    }
  }

  async getItemComponents(parentId) {
    try {
      if (!parentId) {
        throw new Error('Parent ID is required');
      }
      // Support both real repo method and tests' mock naming
      const repo = this.itemRepository;
      const components = repo.getItemComponents
        ? await repo.getItemComponents(parentId)
        : (repo.getComponentsByParent
            ? await repo.getComponentsByParent(parentId)
            : []);
      return components;
    } catch (error) {
      console.error('Error getting item components:', error);
      throw error;
    }
  }

  async getItemWithComponents(itemId) {
    try {
      if (!itemId) {
        throw new Error('Item ID is required');
      }

      const itemData = await this.itemRepository.getItemWithComponents(itemId);
      if (!itemData) {
        throw new Error('Item not found');
      }

      const item = Item.fromDatabaseRow(itemData);
      
      // Calculate availability for composite items
      if (item.isComposite && item.components && item.components.length > 0) {
        const availability = this.calculateCompositeAvailability(item.components);
        return {
          ...item.toJSON(),
          calculatedAvailability: availability
        };
      }

      return item.toJSON();
    } catch (error) {
      console.error('Error getting item with components:', error);
      throw error;
    }
  }

  // Returns a detailed composite stock calculation with limiting component and status
  async calculateCompositeStock(itemId) {
    if (!itemId) {
      throw new Error('Item ID is required');
    }

    const itemData = await this.itemRepository.getItemWithComponents(itemId);
    if (!itemData) {
      throw new Error('Item not found');
    }

    const item = Item.fromDatabaseRow(itemData);
    if (!item.isComposite) {
      // For atomic items, surface direct quantity and status
      const availableQuantity = Math.max(0, item.quantityOnHand || 0);
      const stockStatus = availableQuantity === 0 ? 'out_of_stock' : (availableQuantity <= 5 ? 'low_stock' : 'in_stock');
      return { availableQuantity, stockStatus, limitingComponent: null };
    }

    const components = item.components || [];
    if (components.length === 0) {
      return { availableQuantity: 0, stockStatus: 'out_of_stock', limitingComponent: null };
    }

    let minAvailable = Infinity;
    let limitingComponent = null;

    for (const component of components) {
      const available = Number(component.available_quantity || 0);
      const required = Number(component.quantity || 1);
      if (required <= 0) {
        continue;
      }
      const possibleSets = Math.floor(available / required);
      if (possibleSets < minAvailable) {
        minAvailable = possibleSets;
        limitingComponent = component.component_name || null;
      }
    }

    const availableQuantity = minAvailable === Infinity ? 0 : Math.max(0, minAvailable);
    const stockStatus = availableQuantity === 0 ? 'out_of_stock' : (availableQuantity <= 5 ? 'low_stock' : 'in_stock');

    return { availableQuantity, stockStatus, limitingComponent };
  }

  // Cycle detection using depth-first search
  async detectCycle(parentId, newChildId) {
    try {
      const visited = new Set();
      const recursionStack = new Set();
      const path = [];

      const hasCycle = await this.dfsDetectCycle(newChildId, parentId, visited, recursionStack, path);
      
      return {
        isValid: !hasCycle,
        cyclePath: hasCycle ? path : []
      };
    } catch (error) {
      console.error('Error detecting cycle:', error);
      throw error;
    }
  }

  async dfsDetectCycle(currentId, targetId, visited, recursionStack, path) {
    try {
      // If we've reached the target, we found a cycle
      if (currentId === targetId) {
        path.push(currentId);
        return true;
      }

      // If already visited in current path, we have a cycle
      if (recursionStack.has(currentId)) {
        return true;
      }

      // If already processed, no cycle through this node
      if (visited.has(currentId)) {
        return false;
      }

      // Mark as visited and add to recursion stack
      visited.add(currentId);
      recursionStack.add(currentId);
      path.push(currentId);

      // Get all components of current item (compat with different repo APIs)
      let components;
      if (typeof this.itemRepository.getItemComponents === 'function') {
        components = await this.itemRepository.getItemComponents(currentId);
      } else if (typeof this.itemRepository.getComponentsByParent === 'function') {
        components = await this.itemRepository.getComponentsByParent(currentId);
      } else {
        components = [];
      }
      
      for (const component of components) {
        if (await this.dfsDetectCycle(component.child_id, targetId, visited, recursionStack, path)) {
          return true;
        }
      }

      // Remove from recursion stack and path
      recursionStack.delete(currentId);
      path.pop();
      
      return false;
    } catch (error) {
      console.error('Error in DFS cycle detection:', error);
      throw error;
    }
  }

  // Stock calculation for composite items
  calculateCompositeAvailability(components) {
    if (!components || components.length === 0) {
      return 0;
    }

    let minAvailable = Infinity;

    for (const component of components) {
      const availableQuantity = component.available_quantity || 0;
      const requiredQuantity = component.quantity || 1;
      
      if (requiredQuantity <= 0) {
        continue;
      }

      const possibleSets = Math.floor(availableQuantity / requiredQuantity);
      minAvailable = Math.min(minAvailable, possibleSets);
    }

    return minAvailable === Infinity ? 0 : Math.max(0, minAvailable);
  }

  async calculateItemAvailability(itemId, reservedQuantity = 0) {
    try {
      if (!itemId) {
        throw new Error('Item ID is required');
      }

      const itemData = await this.itemRepository.getItemWithComponents(itemId);
      if (!itemData) {
        throw new Error('Item not found');
      }

      const item = Item.fromDatabaseRow(itemData);

      if (item.isAtomic()) {
        // For atomic items, subtract reserved quantity from on-hand quantity
        return Math.max(0, (item.quantityOnHand || 0) - reservedQuantity);
      } else {
        // For composite items, calculate based on component availability
        return this.calculateCompositeAvailability(item.components);
      }
    } catch (error) {
      console.error('Error calculating item availability:', error);
      throw error;
    }
  }

  async validateBOMStructure(itemId) {
    try {
      if (!itemId) {
        throw new Error('Item ID is required');
      }

      const errors = [];
      const warnings = [];

      // Get item with components
      const itemData = await this.itemRepository.getItemWithComponents(itemId);
      if (!itemData) {
        throw new Error('Item not found');
      }

      const item = Item.fromDatabaseRow(itemData);

      // Validate composite item has components
      if (item.isComposite) {
        if (!item.components || item.components.length === 0) {
          warnings.push('Composite item has no components defined');
        } else {
          // Check each component
          for (const component of item.components) {
            if (component.quantity <= 0) {
              errors.push(`Component ${component.component_name} has invalid quantity: ${component.quantity}`);
            }

            if (component.available_quantity === 0) {
              warnings.push(`Component ${component.component_name} is out of stock`);
            } else if (component.available_quantity <= 5) {
              warnings.push(`Component ${component.component_name} has low stock: ${component.available_quantity}`);
            }
          }

          // Check for cycles
          const cycleCheck = await this.detectCycleInBOM(itemId);
          if (!cycleCheck.isValid) {
            errors.push(`BOM contains cycle: ${cycleCheck.cyclePath.join(' -> ')}`);
          }
        }
      } else {
        // Atomic item should not have components
        if (item.components && item.components.length > 0) {
          errors.push('Atomic item should not have components');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        item: item.toJSON()
      };
    } catch (error) {
      console.error('Error validating BOM structure:', error);
      throw error;
    }
  }

  async detectCycleInBOM(itemId) {
    try {
      const visited = new Set();
      const recursionStack = new Set();
      const path = [];

      const hasCycle = await this.dfsDetectCycleInBOM(itemId, visited, recursionStack, path);
      
      return {
        isValid: !hasCycle,
        cyclePath: hasCycle ? path : []
      };
    } catch (error) {
      console.error('Error detecting cycle in BOM:', error);
      throw error;
    }
  }

  async dfsDetectCycleInBOM(currentId, visited, recursionStack, path) {
    try {
      // If already in recursion stack, we have a cycle
      if (recursionStack.has(currentId)) {
        path.push(currentId);
        return true;
      }

      // If already processed, no cycle through this node
      if (visited.has(currentId)) {
        return false;
      }

      // Mark as visited and add to recursion stack
      visited.add(currentId);
      recursionStack.add(currentId);
      path.push(currentId);

      // Get all components of current item (compat with different repo APIs)
      let components;
      if (typeof this.itemRepository.getItemComponents === 'function') {
        components = await this.itemRepository.getItemComponents(currentId);
      } else if (typeof this.itemRepository.getComponentsByParent === 'function') {
        components = await this.itemRepository.getComponentsByParent(currentId);
      } else {
        components = [];
      }
      
      for (const component of components) {
        if (await this.dfsDetectCycleInBOM(component.child_id, visited, recursionStack, path)) {
          return true;
        }
      }

      // Remove from recursion stack and path
      recursionStack.delete(currentId);
      path.pop();
      
      return false;
    } catch (error) {
      console.error('Error in DFS BOM cycle detection:', error);
      throw error;
    }
  }

  async getBOMTree(itemId, depth = 0, maxDepth = 10) {
    try {
      if (depth > maxDepth) {
        throw new Error('Maximum BOM depth exceeded - possible cycle detected');
      }

      const itemData = await this.itemRepository.getItemWithComponents(itemId);
      if (!itemData) {
        return null;
      }

      const item = Item.fromDatabaseRow(itemData);
      const result = {
        ...item.toJSON(),
        depth,
        children: []
      };

      if (item.isComposite && item.components) {
        for (const component of item.components) {
          const childTree = await this.getBOMTree(component.component_id, depth + 1, maxDepth);
          if (childTree) {
            result.children.push({
              ...childTree,
              requiredQuantity: component.quantity
            });
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Error getting BOM tree:', error);
      throw error;
    }
  }
}

module.exports = ItemComponentService;
