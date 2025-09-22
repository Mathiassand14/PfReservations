class API {
    constructor() {
        this.baseURL = '/api';
        this.adminToken = localStorage.getItem('adminToken') || null;
    }

    setAdminToken(token) {
        this.adminToken = token;
        if (token) {
            localStorage.setItem('adminToken', token);
        } else {
            localStorage.removeItem('adminToken');
        }
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (this.adminToken) {
            headers['X-Admin-Token'] = this.adminToken;
        }

        return headers;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getHeaders(),
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                const err = new Error(data.error?.message || `HTTP ${response.status}`);
                if (data && data.error) {
                    err.code = data.error.code;
                    err.details = data.error.details || data.error.detail || null;
                    err.status = response.status;
                }
                throw err;
            }

            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // Employees
    async getEmployees(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/employees?${params}`);
    }

    async getEmployee(id) {
        return this.request(`/employees/${id}`);
    }

    async createEmployee(employeeData) {
        return this.request('/employees', {
            method: 'POST',
            body: JSON.stringify(employeeData)
        });
    }

    async updateEmployee(id, employeeData) {
        return this.request(`/employees/${id}`, {
            method: 'PUT',
            body: JSON.stringify(employeeData)
        });
    }

    async activateEmployee(id) {
        return this.request(`/employees/${id}/activate`, {
            method: 'POST'
        });
    }

    async deactivateEmployee(id) {
        return this.request(`/employees/${id}/deactivate`, {
            method: 'POST'
        });
    }

    // Customers
    async getCustomers(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/customers?${params}`);
    }

    async getCustomer(id) {
        return this.request(`/customers/${id}`);
    }

    async getCustomerWithOrders(id) {
        return this.request(`/customers/${id}/orders`);
    }

    async createCustomer(customerData) {
        return this.request('/customers', {
            method: 'POST',
            body: JSON.stringify(customerData)
        });
    }

    async updateCustomer(id, customerData) {
        return this.request(`/customers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(customerData)
        });
    }

    async activateCustomer(id) {
        return this.request(`/customers/${id}/activate`, {
            method: 'POST'
        });
    }

    async deactivateCustomer(id) {
        return this.request(`/customers/${id}/deactivate`, {
            method: 'POST'
        });
    }

    // Items
    async getItems(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/items?${params}`);
    }

    async getItem(id) {
        return this.request(`/items/${id}`);
    }

    async getItemDetails(id) {
        return this.request(`/items/${id}/details`);
    }

    async getItemPrices(id) {
        return this.request(`/items/${id}/prices`);
    }

    async getItemAvailability(id, startDate, endDate, excludeOrderId = null) {
        const params = new URLSearchParams({ startDate, endDate });
        if (excludeOrderId) {
            params.append('excludeOrderId', excludeOrderId);
        }
        return this.request(`/items/${id}/availability?${params}`);
    }

    async getAvailableItems(startDate, endDate, quantity = 1, excludeOrderId = null, includeService = false) {
        const params = new URLSearchParams({ startDate, endDate, quantity: String(quantity) });
        if (excludeOrderId) params.append('excludeOrderId', String(excludeOrderId));
        if (includeService) params.append('includeService', 'true');
        return this.request(`/items/available?${params}`);
    }

    async getStockLevels() {
        return this.request('/items/stock-levels');
    }

    async getLowStockItems(threshold = 5) {
        return this.request(`/items/low-stock?threshold=${threshold}`);
    }

    async createItem(itemData) {
        return this.request('/items', {
            method: 'POST',
            body: JSON.stringify(itemData)
        });
    }

    async updateItem(id, itemData) {
        return this.request(`/items/${id}`, {
            method: 'PUT',
            body: JSON.stringify(itemData)
        });
    }

    async updateItemStock(id, quantity, notes = '', createdBy = 'Web User') {
        return this.request(`/items/${id}/stock`, {
            method: 'PATCH',
            body: JSON.stringify({ quantity, notes, createdBy })
        });
    }

    async adjustItemStock(id, delta, reason, notes = '', createdBy = 'Web User') {
        return this.request(`/items/${id}/stock-adjustment`, {
            method: 'POST',
            body: JSON.stringify({ delta, reason, notes, createdBy })
        });
    }

    async getItemComponents(id) {
        return this.request(`/items/${id}/components`);
    }

    async addItemComponent(itemId, childId, quantity) {
        return this.request(`/items/${itemId}/components`, {
            method: 'POST',
            body: JSON.stringify({ childId, quantity })
        });
    }

    async removeItemComponent(itemId, childId) {
        return this.request(`/items/${itemId}/components/${childId}`, {
            method: 'DELETE'
        });
    }

    // Orders
    async getOrders(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/orders?${params}`);
    }

    async getOrder(id) {
        return this.request(`/orders/${id}`);
    }

    async getActiveOrders() {
        return this.request('/orders/active');
    }

    async getOverdueOrders() {
        return this.request('/orders/overdue');
    }

    async createOrder(orderData) {
        return this.request('/orders', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
    }

    async updateOrder(id, orderData) {
        return this.request(`/orders/${id}`, {
            method: 'PUT',
            body: JSON.stringify(orderData)
        });
    }

    async addOrderLine(orderId, itemId, quantity, pricePerDay) {
        return this.request(`/orders/${orderId}/lines`, {
            method: 'POST',
            body: JSON.stringify({ itemId, quantity, pricePerDay })
        });
    }

    async updateOrderLine(orderId, lineId, quantity, pricePerDay) {
        return this.request(`/orders/${orderId}/lines/${lineId}`, {
            method: 'PUT',
            body: JSON.stringify({ quantity, pricePerDay })
        });
    }

    async removeOrderLine(orderId, lineId) {
        return this.request(`/orders/${orderId}/lines/${lineId}`, {
            method: 'DELETE'
        });
    }

    async transitionOrder(id, newStatus, createdBy = 'Web User') {
        return this.request(`/orders/${id}/transition`, {
            method: 'POST',
            body: JSON.stringify({ newStatus, createdBy })
        });
    }

    async generateOrderReceipt(id) {
        const response = await fetch(`${this.baseURL}/orders/${id}/receipt`, {
            headers: this.getHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate receipt');
        }
        
        return response.blob();
    }

    // Additional order methods
    async getOrderWithDetails(id) {
        return this.request(`/orders/${id}`); // Same as getOrder for now
    }

    async getOrderLineItems(orderId) {
        return this.request(`/orders/${orderId}/lines`);
    }

    async addOrderLineItem(orderId, lineData) {
        return this.request(`/orders/${orderId}/lines`, {
            method: 'POST',
            body: JSON.stringify(lineData)
        });
    }

    async removeOrderLineItem(orderId, lineId) {
        return this.request(`/orders/${orderId}/lines/${lineId}`, {
            method: 'DELETE'
        });
    }

    async editLineItem(orderId, lineId, data) {
        return this.request(`/orders/${orderId}/lines/${lineId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // Status transition convenience methods
    async reserveOrder(orderId) {
        return this.request(`/orders/${orderId}/reserve`, {
            method: 'POST',
            body: JSON.stringify({ createdBy: 'Web User' })
        });
    }

    async checkoutOrder(orderId) {
        return this.request(`/orders/${orderId}/checkout`, {
            method: 'POST',
            body: JSON.stringify({ createdBy: 'Web User' })
        });
    }

    async returnOrder(orderId) {
        return this.request(`/orders/${orderId}/return`, {
            method: 'POST',
            body: JSON.stringify({ createdBy: 'Web User' })
        });
    }

    async cancelOrder(orderId) {
        return this.request(`/orders/${orderId}/cancel`, {
            method: 'POST',
            body: JSON.stringify({ createdBy: 'Web User' })
        });
    }

    async generateReceipt(orderId) {
        // For now, just return a URL to the receipt endpoint
        return { url: `${this.baseURL}/orders/${orderId}/receipt` };
    }

    // Stock Movements
    async getStockMovements(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/stock-movements?${params}`);
    }

    async getStockMovementReasons() {
        return this.request('/stock-movements/reasons');
    }

    // Calendar
    async getCalendarTokens() {
        return this.request('/calendar/tokens');
    }

    async createCalendarToken(description, createdBy = 'Web User') {
        return this.request('/calendar/tokens', {
            method: 'POST',
            body: JSON.stringify({ description, createdBy })
        });
    }

    async revokeCalendarToken(id) {
        return this.request(`/calendar/tokens/${id}`, {
            method: 'DELETE'
        });
    }

    async getCalendarStats() {
        return this.request('/calendar/stats');
    }

    // Health check
    async getHealth() {
        const response = await fetch('/health');
        return response.json();
    }
}

// Create global API instance
window.api = new API();
