class App {
    constructor() {
        this.currentSection = 'dashboard';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadDashboard();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                this.switchSection(section);
            });
        });

        // Admin token management
        document.getElementById('adminTokenBtn').addEventListener('click', () => {
            this.showAdminTokenModal();
        });

        // Section-specific listeners
        this.setupSectionListeners();
    }

    setupSectionListeners() {
        // Items section
        document.getElementById('addItemBtn')?.addEventListener('click', () => {
            this.showItemModal();
        });
        
        document.getElementById('itemTypeFilter')?.addEventListener('change', (e) => {
            this.loadItems({ type: e.target.value });
        });

        // Orders section
        document.getElementById('addOrderBtn')?.addEventListener('click', () => {
            this.showOrderModal();
        });
        
        document.getElementById('orderStatusFilter')?.addEventListener('change', (e) => {
            this.loadOrders({ status: e.target.value });
        });

        // Customers section
        document.getElementById('addCustomerBtn')?.addEventListener('click', () => {
            this.showCustomerModal();
        });
        
        document.getElementById('customerSearch')?.addEventListener('input', (e) => {
            this.searchCustomers(e.target.value);
        });

        // Employees section
        document.getElementById('addEmployeeBtn')?.addEventListener('click', () => {
            this.showEmployeeModal();
        });
        
        document.getElementById('employeeRoleFilter')?.addEventListener('change', (e) => {
            this.loadEmployees({ role: e.target.value });
        });

        // Stock movements section
        document.getElementById('movementReasonFilter')?.addEventListener('change', (e) => {
            this.loadStockMovements({ reason: e.target.value });
        });

        // Calendar section
        document.getElementById('createTokenBtn')?.addEventListener('click', () => {
            this.showCreateTokenModal();
        });
        
        document.getElementById('calendarViewMode')?.addEventListener('change', (e) => {
            this.switchCalendarView(e.target.value);
        });
        
        document.getElementById('receiptGeneratorBtn')?.addEventListener('click', () => {
            this.switchCalendarView('receipts');
        });
        
        document.getElementById('prevMonth')?.addEventListener('click', () => {
            this.changeCalendarMonth(-1);
        });
        
        document.getElementById('nextMonth')?.addEventListener('click', () => {
            this.changeCalendarMonth(1);
        });
        
        document.getElementById('receiptOrderSelect')?.addEventListener('change', (e) => {
            this.loadReceiptPreview(e.target.value);
        });
        
        document.getElementById('generateReceiptBtn')?.addEventListener('click', () => {
            this.downloadReceipt();
        });
    }

    switchSection(section) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.classList.remove('active');
        });
        document.getElementById(`${section}-section`).classList.add('active');

        this.currentSection = section;

        // Load section data
        this.loadSectionData(section);
    }

    async loadSectionData(section) {
        switch (section) {
            case 'dashboard':
                await this.loadDashboard();
                break;
            case 'items':
                await this.loadItems();
                break;
            case 'orders':
                await this.loadOrders();
                break;
            case 'customers':
                await this.loadCustomers();
                break;
            case 'employees':
                await this.loadEmployees();
                break;
            case 'stock':
                await this.loadStockMovements();
                break;
            case 'calendar':
                this.currentCalendarDate = new Date();
                await this.loadCalendar();
                break;
        }
    }

    // Dashboard
    async loadDashboard() {
        try {
            // Load stats
            const [activeOrders, items, lowStockItems, overdueOrders] = await Promise.all([
                api.getActiveOrders(),
                api.getItems(),
                api.getLowStockItems(),
                api.getOverdueOrders()
            ]);

            document.getElementById('activeOrders').textContent = activeOrders.orders.length;
            document.getElementById('totalItems').textContent = items.items.length;
            document.getElementById('lowStockItems').textContent = lowStockItems.items.length;
            document.getElementById('overdueOrders').textContent = overdueOrders.orders.length;

            // Load recent orders
            const recentOrders = await api.getOrders({ limit: 5 });
            this.renderRecentOrders(recentOrders.orders);

            // Load low stock alerts
            this.renderLowStockItems(lowStockItems.items);

        } catch (error) {
            this.showError('Failed to load dashboard data: ' + error.message);
        }
    }

    renderRecentOrders(orders) {
        const container = document.getElementById('recentOrdersList');
        
        if (orders.length === 0) {
            container.innerHTML = '<p class="text-gray-500">No recent orders</p>';
            return;
        }

        const html = orders.map(order => `
            <div class="flex justify-between items-center p-3 border-b border-gray-100 last:border-b-0">
                <div>
                    <div class="font-medium">Order #${order.id}</div>
                    <div class="text-sm text-gray-600">${order.customerName || 'Unknown Customer'}</div>
                </div>
                <div class="text-right">
                    <div class="status-badge status-${order.status.toLowerCase().replace(' ', '-')}">${order.status}</div>
                    <div class="text-sm text-gray-600 mt-1">$${(order.total || 0).toFixed(2)}</div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    renderLowStockItems(items) {
        const container = document.getElementById('lowStockList');
        
        if (items.length === 0) {
            container.innerHTML = '<p class="text-green-600">All items well stocked</p>';
            return;
        }

        const html = items.map(item => `
            <div class="flex justify-between items-center p-3 border-b border-gray-100 last:border-b-0">
                <div>
                    <div class="font-medium">${item.name}</div>
                    <div class="text-sm text-gray-600">${item.sku}</div>
                </div>
                <div class="text-right">
                    <div class="font-medium text-orange-600">${item.quantity_on_hand} remaining</div>
                    <div class="text-sm text-gray-600">Stock Status: ${item.stock_status}</div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    // Items
    async loadItems(filters = {}) {
        try {
            const response = await api.getItems(filters);
            this.renderItemsTable(response.items);
        } catch (error) {
            this.showError('Failed to load items: ' + error.message);
        }
    }

    renderItemsTable(items) {
        const container = document.getElementById('itemsList');
        
        if (items.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-gray-500">No items found</div>';
            return;
        }

        const html = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>SKU</th>
                        <th>Type</th>
                        <th>Price/Day</th>
                        <th>Stock</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td class="font-medium">${item.name}</td>
                            <td class="font-mono text-sm">${item.sku}</td>
                            <td>
                                ${(() => { const t = item.type || (item.isComposite ? 'Composite' : 'Atomic'); const cls = t==='Composite' ? 'bg-purple-100 text-purple-800' : (t==='Service' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'); return `<span class=\"px-2 py-1 text-xs rounded-full ${cls}\">${t}</span>`; })()}
                            </td>
                            <td>DKK ${Number(item.pricePerDay || 0).toFixed(2)}</td>
                            <td>${(item.type === 'Composite' || item.type === 'Service') ? 'N/A' : (item.quantityOnHand || 0)}</td>
                            <td>
                                <span class="status-badge ${this.getStockStatusClass(item)}">
                                    ${this.getStockStatusText(item)}
                                </span>
                            </td>
                            <td>
                                <div class="flex gap-2">
                                    <button onclick="app.editItem(${item.id})" class="btn btn-sm btn-outline">Edit</button>
                                    ${!item.isComposite ? `<button onclick="app.adjustStock(${item.id})" class="btn btn-sm btn-outline">Stock</button>` : ''}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    getStockStatusClass(item) {
        if (item.type === 'Composite' || item.type === 'Service') return 'status-badge';
        const stock = item.quantityOnHand || 0;
        if (stock === 0) return 'status-cancelled';
        if (stock <= 5) return 'status-reserved';
        return 'status-returned';
    }

    getStockStatusText(item) {
        if (item.type === 'Composite' || item.type === 'Service') return 'N/A';
        const stock = item.quantityOnHand || 0;
        if (stock === 0) return 'Out of Stock';
        if (stock <= 5) return 'Low Stock';
        return 'In Stock';
    }

    // Orders
    async loadOrders(filters = {}) {
        try {
            const response = await api.getOrders(filters);
            this.renderOrdersTable(response.orders);
        } catch (error) {
            this.showError('Failed to load orders: ' + error.message);
        }
    }

    renderOrdersTable(orders) {
        const container = document.getElementById('ordersList');
        
        if (orders.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-gray-500">No orders found</div>';
            return;
        }

        const html = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Order #</th>
                        <th>Customer</th>
                        <th>Sales Person</th>
                        <th>Start Date</th>
                        <th>Return Date</th>
                        <th>Status</th>
                        <th>Total</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map(order => `
                        <tr>
                            <td class="font-medium">#${order.id}</td>
                            <td>${order.customerName || 'Unknown'}</td>
                            <td>${order.salesPersonName || 'Unknown'}</td>
                            <td>${new Date(order.startDate).toLocaleDateString()}</td>
                            <td>${new Date(order.returnDueDate).toLocaleDateString()}</td>
                            <td>
                                <span class="status-badge status-${order.status.toLowerCase().replace(' ', '-')}">
                                    ${order.status}
                                </span>
                            </td>
                            <td class="font-medium">$${(order.total || 0).toFixed(2)}</td>
                            <td>
                                <div class="flex gap-2">
                                    <button onclick="app.viewOrder(${order.id})" class="btn btn-sm btn-outline">View</button>
                                    <button onclick="app.downloadReceipt(${order.id})" class="btn btn-sm btn-outline">Receipt</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    // Customers
    async loadCustomers(filters = {}) {
        try {
            const response = await api.getCustomers(filters);
            this.renderCustomersTable(response.customers);
        } catch (error) {
            this.showError('Failed to load customers: ' + error.message);
        }
    }

    async searchCustomers(query) {
        if (query.length < 2) {
            await this.loadCustomers();
            return;
        }

        try {
            const response = await api.getCustomers({ search: query });
            this.renderCustomersTable(response.customers);
        } catch (error) {
            this.showError('Failed to search customers: ' + error.message);
        }
    }

    renderCustomersTable(customers) {
        const container = document.getElementById('customersList');
        
        if (customers.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-gray-500">No customers found</div>';
            return;
        }

        const html = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Organization</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${customers.map(customer => `
                        <tr>
                            <td class="font-medium">${customer.displayName}</td>
                            <td>${customer.organization || 'N/A'}</td>
                            <td>${customer.contactInfo?.email || 'N/A'}</td>
                            <td>
                                <span class="status-badge ${customer.isActive ? 'status-active' : 'status-inactive'}">
                                    ${customer.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td>
                                <div class="flex gap-2">
                                    <button onclick="app.editCustomer(${customer.id})" class="btn btn-sm btn-outline">Edit</button>
                                    <button onclick="app.viewCustomerOrders(${customer.id})" class="btn btn-sm btn-outline">Orders</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    // Employees
    async loadEmployees(filters = {}) {
        try {
            const response = await api.getEmployees(filters);
            this.renderEmployeesTable(response.employees);
        } catch (error) {
            this.showError('Failed to load employees: ' + error.message);
        }
    }

    renderEmployeesTable(employees) {
        const container = document.getElementById('employeesList');
        
        if (employees.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-gray-500">No employees found</div>';
            return;
        }

        const html = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${employees.map(employee => `
                        <tr>
                            <td class="font-medium">${employee.fullName}</td>
                            <td>${employee.email || 'N/A'}</td>
                            <td>${employee.phone || 'N/A'}</td>
                            <td>
                                <span class="px-2 py-1 text-xs rounded-full ${this.getRoleClass(employee.role)}">
                                    ${employee.role}
                                </span>
                            </td>
                            <td>
                                <span class="status-badge ${employee.isActive ? 'status-active' : 'status-inactive'}">
                                    ${employee.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td>
                                <div class="flex gap-2">
                                    <button onclick="app.editEmployee(${employee.id})" class="btn btn-sm btn-outline">Edit</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    getRoleClass(role) {
        switch (role) {
            case 'Admin': return 'bg-red-100 text-red-800';
            case 'Staff': return 'bg-blue-100 text-blue-800';
            case 'ReadOnly': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    }

    // Stock Movements
    async loadStockMovements(filters = {}) {
        try {
            const response = await api.getStockMovements(filters);
            this.renderStockMovementsTable(response.movements);
        } catch (error) {
            this.showError('Failed to load stock movements: ' + error.message);
        }
    }

    renderStockMovementsTable(movements) {
        const container = document.getElementById('stockMovementsList');
        
        if (movements.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-gray-500">No stock movements found</div>';
            return;
        }

        const html = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Item</th>
                        <th>Delta</th>
                        <th>Reason</th>
                        <th>Created By</th>
                        <th>Order</th>
                    </tr>
                </thead>
                <tbody>
                    ${movements.map(movement => `
                        <tr>
                            <td>${new Date(movement.createdAt).toLocaleString()}</td>
                            <td>
                                <div class="font-medium">${movement.itemName || 'Unknown'}</div>
                                <div class="text-xs text-gray-600">${movement.itemSku || 'N/A'}</div>
                            </td>
                            <td class="${movement.delta > 0 ? 'text-green-600' : 'text-red-600'} font-medium">
                                ${movement.delta > 0 ? '+' : ''}${movement.delta}
                            </td>
                            <td>
                                <span class="px-2 py-1 text-xs rounded-full bg-gray-100">
                                    ${movement.reason}
                                </span>
                            </td>
                            <td>${movement.createdBy}</td>
                            <td>${movement.orderNumber ? `#${movement.orderNumber}` : 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    // Calendar Tokens
    async loadCalendarTokens() {
        try {
            const response = await api.getCalendarTokens();
            this.renderCalendarTokensTable(response.tokens);
        } catch (error) {
            this.showError('Failed to load calendar tokens: ' + error.message);
        }
    }

    renderCalendarTokensTable(tokens) {
        const container = document.getElementById('calendarTokensList');
        
        if (tokens.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-gray-500">No calendar tokens found</div>';
            return;
        }

        const html = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Token</th>
                        <th>Feed URL</th>
                        <th>Created</th>
                        <th>Last Used</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${tokens.map(token => `
                        <tr>
                            <td class="font-medium">${token.description}</td>
                            <td class="font-mono text-sm">${token.token}</td>
                            <td>
                                <button onclick="app.copyFeedUrl('${token.token}')" class="btn btn-sm btn-outline">
                                    Copy URL
                                </button>
                            </td>
                            <td>${new Date(token.created_at).toLocaleString()}</td>
                            <td>${token.last_used_at ? new Date(token.last_used_at).toLocaleString() : 'Never'}</td>
                            <td>
                                <button onclick="app.revokeToken(${token.id})" class="btn btn-sm btn-danger">
                                    Revoke
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    // Modal and UI helpers
    showAdminTokenModal() {
        const modal = this.createModal('Admin Token', `
            <div class="form-group">
                <label class="form-label">Admin Token (optional)</label>
                <input type="password" id="tokenInput" class="form-input" placeholder="Enter admin token for write operations" value="${api.adminToken || ''}">
                <small class="text-gray-600">Leave empty to disable write operations protection</small>
            </div>
        `, [
            { text: 'Cancel', class: 'btn-outline', action: 'close' },
            { text: 'Save', class: 'btn-primary', action: () => this.saveAdminToken() }
        ]);
        
        this.showModal(modal);
    }

    saveAdminToken() {
        const token = document.getElementById('tokenInput').value.trim();
        api.setAdminToken(token || null);
        this.hideModal();
        this.showSuccess(token ? 'Admin token saved' : 'Admin token cleared');
    }

    showCreateTokenModal() {
        const modal = this.createModal('Create Calendar Token', `
            <div class="form-group">
                <label class="form-label">Description</label>
                <input type="text" id="tokenDescription" class="form-input" placeholder="e.g., Main calendar feed" required>
            </div>
        `, [
            { text: 'Cancel', class: 'btn-outline', action: 'close' },
            { text: 'Create', class: 'btn-primary', action: () => this.createCalendarToken() }
        ]);
        
        this.showModal(modal);
    }

    async createCalendarToken() {
        const description = document.getElementById('tokenDescription').value.trim();
        
        if (!description) {
            this.showError('Description is required');
            return;
        }

        try {
            await api.createCalendarToken(description);
            this.hideModal();
            this.showSuccess('Calendar token created successfully');
            this.loadCalendarTokens();
        } catch (error) {
            this.showError('Failed to create token: ' + error.message);
        }
    }

    async revokeToken(tokenId) {
        if (!confirm('Are you sure you want to revoke this calendar token?')) {
            return;
        }

        try {
            await api.revokeCalendarToken(tokenId);
            this.showSuccess('Calendar token revoked successfully');
            this.loadCalendarTokens();
        } catch (error) {
            this.showError('Failed to revoke token: ' + error.message);
        }
    }

    copyFeedUrl(token) {
        const url = `${window.location.origin}/calendar.ics?token=${token}`;
        navigator.clipboard.writeText(url).then(() => {
            this.showSuccess('Calendar feed URL copied to clipboard');
        }).catch(() => {
            this.showError('Failed to copy URL');
        });
    }

    async downloadReceipt(orderId) {
        try {
            const blob = await api.generateOrderReceipt(orderId);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `receipt-order-${orderId}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            this.showError('Failed to download receipt: ' + error.message);
        }
    }

    // Enhanced Calendar functionality
    async loadCalendar() {
        // Load tokens first (always needed)
        await this.loadCalendarTokens();
        
        // Load orders for receipt generator
        await this.loadOrdersForReceipts();
        
        // Switch to default view (tokens)
        this.switchCalendarView('tokens');
    }

    switchCalendarView(view) {
        // Update dropdown
        const dropdown = document.getElementById('calendarViewMode');
        if (dropdown) dropdown.value = view;
        
        // Hide all views
        document.querySelectorAll('.calendar-view').forEach(v => v.classList.remove('active'));
        
        // Show selected view
        const viewMap = {
            'tokens': 'tokenManagementView',
            'view': 'calendarViewContainer', 
            'receipts': 'receiptGeneratorView'
        };
        
        const targetView = document.getElementById(viewMap[view]);
        if (targetView) {
            targetView.classList.add('active');
            
            // Load data based on view
            if (view === 'view') {
                this.loadCalendarView();
            } else if (view === 'receipts') {
                this.loadOrdersForReceipts();
            }
        }
    }

    async loadCalendarView() {
        try {
            // Load orders for the current month
            const startDate = new Date(this.currentCalendarDate.getFullYear(), this.currentCalendarDate.getMonth(), 1);
            const endDate = new Date(this.currentCalendarDate.getFullYear(), this.currentCalendarDate.getMonth() + 1, 0);
            
            const response = await api.getOrders({
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            });
            
            this.renderCalendarGrid(response.orders);
        } catch (error) {
            this.showError('Failed to load calendar: ' + error.message);
        }
    }

    renderCalendarGrid(orders) {
        const monthElement = document.getElementById('calendarMonth');
        const gridElement = document.getElementById('calendarGrid');
        
        if (!monthElement || !gridElement) return;
        
        // Update month header
        const monthName = this.currentCalendarDate.toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
        });
        monthElement.textContent = monthName;
        
        // Generate calendar grid
        const firstDay = new Date(this.currentCalendarDate.getFullYear(), this.currentCalendarDate.getMonth(), 1);
        const lastDay = new Date(this.currentCalendarDate.getFullYear(), this.currentCalendarDate.getMonth() + 1, 0);
        const startCalendar = new Date(firstDay);
        startCalendar.setDate(startCalendar.getDate() - firstDay.getDay());
        
        let html = '';
        
        // Day headers
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayHeaders.forEach(day => {
            html += `<div class="calendar-day-header">${day}</div>`;
        });
        
        // Calendar days
        const today = new Date();
        for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
            const currentDay = new Date(startCalendar);
            currentDay.setDate(startCalendar.getDate() + i);
            
            const isCurrentMonth = currentDay.getMonth() === this.currentCalendarDate.getMonth();
            const isToday = currentDay.toDateString() === today.toDateString();
            
            // Find orders for this day
            const dayOrders = orders.filter(order => {
                const startDate = new Date(order.start_date);
                const endDate = new Date(order.end_date);
                return currentDay >= startDate && currentDay <= endDate;
            });
            
            let dayClass = 'calendar-day';
            if (!isCurrentMonth) dayClass += ' other-month';
            if (isToday) dayClass += ' today';
            
            html += `
                <div class="${dayClass}">
                    <div class="calendar-day-number">${currentDay.getDate()}</div>
                    <div class="calendar-events">
                        ${this.renderCalendarEvents(dayOrders)}
                    </div>
                </div>
            `;
        }
        
        gridElement.innerHTML = html;
    }

    renderCalendarEvents(orders) {
        const maxVisible = 3;
        let html = '';
        
        for (let i = 0; i < Math.min(orders.length, maxVisible); i++) {
            const order = orders[i];
            const statusClass = `status-${order.status.toLowerCase().replace(' ', '-')}`;
            html += `
                <div class="calendar-event ${statusClass}" onclick="app.viewOrder(${order.id})" title="Order #${order.id} - ${order.customer_name}">
                    #${order.id} ${order.customer_name}
                </div>
            `;
        }
        
        if (orders.length > maxVisible) {
            html += `
                <div class="calendar-more-events">
                    +${orders.length - maxVisible} more
                </div>
            `;
        }
        
        return html;
    }

    changeCalendarMonth(delta) {
        this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + delta);
        this.loadCalendarView();
    }

    async loadOrdersForReceipts() {
        try {
            const response = await api.getOrders();
            const select = document.getElementById('receiptOrderSelect');
            
            if (!select) return;
            
            // Filter to orders that can have receipts (not Draft status)
            const eligibleOrders = response.orders.filter(order => 
                ['Reserved', 'Checked Out', 'Returned'].includes(order.status)
            );
            
            select.innerHTML = `
                <option value="">Select an order...</option>
                ${eligibleOrders.map(order => `
                    <option value="${order.id}">
                        Order #${order.id} - ${order.customer_name} (${order.status})
                    </option>
                `).join('')}
            `;
            
            // Disable generate button
            const generateBtn = document.getElementById('generateReceiptBtn');
            if (generateBtn) generateBtn.disabled = true;
            
        } catch (error) {
            this.showError('Failed to load orders: ' + error.message);
        }
    }

    async loadReceiptPreview(orderId) {
        const previewElement = document.getElementById('receiptPreview');
        const generateBtn = document.getElementById('generateReceiptBtn');
        
        if (!orderId) {
            previewElement.innerHTML = '<p class="text-muted">Select an order to preview receipt details</p>';
            if (generateBtn) generateBtn.disabled = true;
            return;
        }
        
        try {
            const order = await api.getOrder(orderId);
            this.renderReceiptPreview(order);
            if (generateBtn) generateBtn.disabled = false;
        } catch (error) {
            this.showError('Failed to load order details: ' + error.message);
            previewElement.innerHTML = '<p class="text-danger">Failed to load order details</p>';
            if (generateBtn) generateBtn.disabled = true;
        }
    }

    renderReceiptPreview(order) {
        const previewElement = document.getElementById('receiptPreview');
        
        if (!previewElement) return;
        
        const startDate = new Date(order.start_date).toLocaleDateString();
        const endDate = new Date(order.end_date).toLocaleDateString();
        const createdDate = new Date(order.created_at).toLocaleDateString();
        
        previewElement.innerHTML = `
            <div class="receipt-details">
                <div class="receipt-section">
                    <h4>Order Information</h4>
                    <div class="receipt-info">
                        <div class="receipt-field">
                            <span>Order ID:</span>
                            <strong>#${order.id}</strong>
                        </div>
                        <div class="receipt-field">
                            <span>Status:</span>
                            <strong>${order.status}</strong>
                        </div>
                        <div class="receipt-field">
                            <span>Created:</span>
                            <strong>${createdDate}</strong>
                        </div>
                        <div class="receipt-field">
                            <span>Rental Period:</span>
                            <strong>${startDate} to ${endDate}</strong>
                        </div>
                    </div>
                </div>
                
                <div class="receipt-section">
                    <h4>Customer Information</h4>
                    <div class="receipt-info">
                        <div class="receipt-field">
                            <span>Name:</span>
                            <strong>${order.customer_name}</strong>
                        </div>
                        <div class="receipt-field">
                            <span>Sales Person:</span>
                            <strong>${order.sales_person || 'N/A'}</strong>
                        </div>
                    </div>
                </div>
                
                <div class="receipt-section">
                    <h4>Order Items</h4>
                    <table class="receipt-items-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Quantity</th>
                                <th>Price/Day</th>
                                <th>Days</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(order.lines || []).map(line => `
                                <tr>
                                    <td>${line.item_name}</td>
                                    <td>${line.quantity}</td>
                                    <td>$${(line.price_per_day || 0).toFixed(2)}</td>
                                    <td>${order.rental_days || 1}</td>
                                    <td>$${((line.quantity || 0) * (line.price_per_day || 0) * (order.rental_days || 1)).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <div class="receipt-total">
                        <div class="receipt-field">
                            <span>Subtotal:</span>
                            <strong>$${(order.subtotal || 0).toFixed(2)}</strong>
                        </div>
                        <div class="receipt-field">
                            <span>Discount:</span>
                            <strong>-$${(order.discount || 0).toFixed(2)}</strong>
                        </div>
                        <div class="receipt-field">
                            <span>Tax:</span>
                            <strong>$${(order.tax || 0).toFixed(2)}</strong>
                        </div>
                        <div class="receipt-field" style="border-top: 2px solid #e5e7eb; padding-top: 0.5rem; margin-top: 0.5rem;">
                            <span>Total:</span>
                            <strong>$${(order.total || 0).toFixed(2)}</strong>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async downloadReceipt() {
        const select = document.getElementById('receiptOrderSelect');
        const orderId = select?.value;
        
        if (!orderId) {
            this.showError('Please select an order first');
            return;
        }
        
        try {
            const blob = await api.generateOrderReceipt(orderId);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `receipt-order-${orderId}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showSuccess('Receipt downloaded successfully');
        } catch (error) {
            this.showError('Failed to generate receipt: ' + error.message);
        }
    }

    // Placeholder methods for edit operations
    async editItem(id) {
        try {
            const item = await api.getItem(id);
            this.showItemModal(item);
        } catch (error) {
            this.showError('Failed to load item: ' + error.message);
        }
    }

    showItemModal(item = null) {
        const isEdit = item !== null;
        const title = isEdit ? 'Edit Item' : 'Add Item';
        
        const body = `
            <form id="itemForm">
                <div class="form-row">
                    <div class="form-group">
                        <label for="itemName">Name *</label>
                        <input type="text" id="itemName" class="form-input" value="${item?.name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="itemSku">SKU *</label>
                        <input type="text" id="itemSku" class="form-input" value="${item?.sku || ''}" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="itemType">Type *</label>
                        <select id="itemType" class="form-select" required>
                            <option value="atomic" ${item?.type === 'Atomic' || (!item?.type && !item?.isComposite) ? 'selected' : ''}>Atomic</option>
                            <option value="composite" ${item?.type === 'Composite' || item?.isComposite ? 'selected' : ''}>Composite</option>
                            <option value="service" ${item?.type === 'Service' ? 'selected' : ''}>Service</option>
                        </select>
                    </div>
                    <div class="form-group" id="atomicDailyField" style="${(item?.type === 'Atomic' || (!item?.type && !item?.isComposite)) ? 'display:block' : 'display:none'}">
                        <label for="itemDaily">Daily (DKK)</label>
                        <input type="number" id="itemDaily" class="form-input" step="0.01" min="0" value="${item?.pricePerDay || 0}">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group" id="atomicStartField" style="${(item?.type === 'Atomic' || (!item?.type && !item?.isComposite)) ? 'display:block' : 'display:none'}">
                        <label for="itemStart">Start (DKK)</label>
                        <input type="number" id="itemStart" class="form-input" step="0.01" min="0" value="${0}">
                    </div>
                    <div class="form-group" id="serviceHourlyField" style="${item?.type === 'Service' ? 'display:block' : 'display:none'}">
                        <label for="itemHourly">Hourly (DKK)</label>
                        <input type="number" id="itemHourly" class="form-input" step="0.01" min="0" value="${0}">
                    </div>
                </div>
                
                <div id="atomicFields" style="${(item?.type === 'Atomic' || (!item?.type && !item?.isComposite)) ? 'display: block;' : 'display: none;'}">
                    <div class="info-box">
                        ${isEdit ? `
                        <p>Current Stock: <strong>${item?.quantityOnHand ?? 0}</strong></p>
                        <p class="text-gray-600">Use the Stock action to adjust quantity.</p>
                        <button type="button" class="btn btn-sm btn-outline" onclick="app.adjustStock(${item?.id})">Adjust Stock</button>
                        ` : `
                        <p class="text-gray-600">Stock is managed after creation via the Stock action.</p>
                        `}
                    </div>
                </div>
                
                <div id="compositeFields" style="${(item?.type === 'Composite' || item?.isComposite) ? 'display: block;' : 'display: none;'}">
                    <div class="form-group">
                        <label>Components</label>
                        <div id="componentsList">
                            ${item?.isComposite ? '<div class="text-gray-500">Components will be loaded after item is saved</div>' : ''}
                        </div>
                        ${!isEdit ? '<div class="text-gray-500">Add components after creating the item</div>' : ''}
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="itemDescription">Description</label>
                    <textarea id="itemDescription" class="form-input" rows="3">${item?.description || ''}</textarea>
                </div>
            </form>
        `;
        
        const buttons = [
            { text: 'Cancel', class: 'btn-outline', action: 'close' },
            { text: isEdit ? 'Update' : 'Create', class: 'btn-primary', action: () => this.saveItem(item?.id) }
        ];
        
        this.showModal(this.createModal(title, body, buttons));
        
        // Add type change handler
        document.getElementById('itemType').addEventListener('change', (e) => {
            const val = e.target.value;
            const isComposite = val === 'composite';
            const isService = val === 'service';
            const isAtomic = !isComposite && !isService;
            document.getElementById('atomicFields').style.display = isAtomic ? 'block' : 'none';
            document.getElementById('compositeFields').style.display = isComposite ? 'block' : 'none';
            document.getElementById('atomicDailyField').style.display = isAtomic ? 'block' : 'none';
            document.getElementById('atomicStartField').style.display = isAtomic ? 'block' : 'none';
            document.getElementById('serviceHourlyField').style.display = isService ? 'block' : 'none';
        });
        
        // If editing composite item, load components
        if (isEdit && item.isComposite) {
            this.loadItemComponents(item.id);
        }

        // Load existing prices for edit
        if (isEdit) {
            api.getItemPrices(item.id).then(resp => {
                const p = resp.prices || {};
                const startEl = document.getElementById('itemStart');
                const dailyEl = document.getElementById('itemDaily');
                const hourlyEl = document.getElementById('itemHourly');
                if (startEl && p.Start !== undefined) startEl.value = p.Start;
                if (dailyEl && p.Daily !== undefined) dailyEl.value = p.Daily;
                if (hourlyEl && p.Hourly !== undefined) hourlyEl.value = p.Hourly;
            }).catch(() => {/* ignore */});
        }
    }

    async saveItem(id = null) {
        const form = document.getElementById('itemForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        const typeVal = document.getElementById('itemType').value;
        const isComposite = typeVal === 'composite';
        const isService = typeVal === 'service';
        const nameVal = document.getElementById('itemName').value.trim();
        const skuVal = document.getElementById('itemSku').value.trim();
        const startText = document.getElementById('itemStart')?.value;
        const dailyText = document.getElementById('itemDaily')?.value;
        const hourlyText = document.getElementById('itemHourly')?.value;
        const startVal = startText !== undefined && startText !== '' ? Number(startText) : undefined;
        const dailyVal = dailyText !== undefined && dailyText !== '' ? Number(dailyText) : undefined;
        const hourlyVal = hourlyText !== undefined && hourlyText !== '' ? Number(hourlyText) : undefined;

        if (!nameVal) {
            this.showError('Name is required');
            return;
        }
        if (!skuVal || !/^[A-Za-z0-9\-_]+$/.test(skuVal)) {
            this.showError('SKU is required (letters, numbers, hyphens and underscores)');
            return;
        }
        if (isService) {
            if (hourlyVal !== undefined && (Number.isNaN(hourlyVal) || hourlyVal < 0)) {
                this.showError('Hourly must be a number ≥ 0');
                return;
            }
        } else if (!isComposite) {
            if (dailyVal !== undefined && (Number.isNaN(dailyVal) || dailyVal < 0)) {
                this.showError('Daily must be a number ≥ 0');
                return;
            }
            if (startVal !== undefined && (Number.isNaN(startVal) || startVal < 0)) {
                this.showError('Start must be a number ≥ 0');
                return;
            }
        }

        const formData = {
            name: nameVal,
            sku: skuVal,
            isComposite,
            type: isComposite ? 'Composite' : (isService ? 'Service' : 'Atomic'),
            pricePerDay: (dailyVal !== undefined ? dailyVal : (item?.pricePerDay || 0)),
            description: document.getElementById('itemDescription').value || null,
            ...(isService ? { isService: true } : {})
        };

        const prices = {};
        if (isService) {
            if (hourlyVal !== undefined) prices.Hourly = hourlyVal;
        } else if (!isComposite) {
            if (startVal !== undefined) prices.Start = startVal;
            if (dailyVal !== undefined) prices.Daily = dailyVal;
        }
        formData.prices = prices;
        
        // Stock changes are managed via the dedicated Stock action, not in the edit form
        
        try {
            document.querySelectorAll('.modal .modal-footer .btn').forEach(b => b.disabled = true);
            if (id) {
                await api.updateItem(id, formData);
                this.showSuccess('Item updated successfully');
            } else {
                await api.createItem(formData);
                this.showSuccess('Item created successfully');
            }
            
            this.hideModal();
            this.loadItems(); // Refresh the list
        } catch (error) {
            if (error && Array.isArray(error.details) && error.details.length > 0) {
                const detailsText = error.details.map(d => d.message || d.code).join('; ');
                this.showError('Failed to save item: ' + error.message + ' — ' + detailsText);
            } else {
                this.showError('Failed to save item: ' + error.message);
            }
        } finally {
            document.querySelectorAll('.modal .modal-footer .btn').forEach(b => b.disabled = false);
        }
    }

    async loadItemComponents(itemId) {
        try {
            const response = await api.getItemComponents(itemId);
            this.renderComponentsList(response.components, itemId);
        } catch (error) {
            console.error('Failed to load components:', error);
            document.getElementById('componentsList').innerHTML = '<div class="text-red-500">Failed to load components</div>';
        }
    }

    renderComponentsList(components, itemId) {
        const container = document.getElementById('componentsList');
        
        if (components.length === 0) {
            container.innerHTML = `
                <div class="text-gray-500 mb-3">No components added yet</div>
                <button type="button" onclick="app.showAddComponentModal(${itemId})" class="btn btn-sm btn-outline">
                    <i class="fas fa-plus"></i> Add Component
                </button>
            `;
            return;
        }
        
        const html = `
            <div class="components-list mb-3">
                ${components.map(comp => `
                    <div class="component-item">
                        <div class="component-info">
                            <span class="font-medium">${comp.childName}</span>
                            <span class="text-gray-500">(${comp.quantityRequired}x)</span>
                        </div>
                        <div class="component-actions">
                            <button type="button" onclick="app.removeComponent(${itemId}, ${comp.childId})" class="btn btn-xs btn-danger">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button type="button" onclick="app.showAddComponentModal(${itemId})" class="btn btn-sm btn-outline">
                <i class="fas fa-plus"></i> Add Component
            </button>
        `;
        
        container.innerHTML = html;
    }

    async editCustomer(id) {
        try {
            const customer = await api.getCustomer(id);
            this.showCustomerModal(customer);
        } catch (error) {
            this.showError('Failed to load customer: ' + error.message);
        }
    }

    showCustomerModal(customer = null) {
        const isEdit = customer !== null;
        const title = isEdit ? 'Edit Customer' : 'Add Customer';
        
        const body = `
            <form id="customerForm">
                <div class="form-row">
                    <div class="form-group">
                        <label for="customerType">Customer Type *</label>
                        <select id="customerType" class="form-select" required>
                            <option value="Individual" ${customer?.customerType === 'Individual' ? 'selected' : ''}>Individual</option>
                            <option value="Organization" ${customer?.customerType === 'Organization' ? 'selected' : ''}>Organization</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="customerDisplayName">Display Name *</label>
                        <input type="text" id="customerDisplayName" class="form-input" value="${customer?.displayName || ''}" required>
                    </div>
                </div>
                
                <div id="organizationFields" style="${customer?.customerType !== 'Organization' ? 'display: none;' : ''}">
                    <div class="form-group">
                        <label for="customerOrganization">Organization Name</label>
                        <input type="text" id="customerOrganization" class="form-input" value="${customer?.organizationName || ''}">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="customerEmail">Email</label>
                        <input type="email" id="customerEmail" class="form-input" value="${customer?.email || ''}">
                    </div>
                    <div class="form-group">
                        <label for="customerPhone">Phone</label>
                        <input type="tel" id="customerPhone" class="form-input" value="${customer?.phone || ''}">
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="customerAddress">Address</label>
                    <textarea id="customerAddress" class="form-input" rows="3" placeholder="Street address, city, state, zip">${customer?.address || ''}</textarea>
                </div>
                
                <div class="form-group">
                    <label for="customerNotes">Notes</label>
                    <textarea id="customerNotes" class="form-input" rows="2" placeholder="Additional notes about this customer">${customer?.notes || ''}</textarea>
                </div>
                
                ${isEdit ? `
                    <div class="form-group">
                        <label>Status</label>
                        <div class="status-controls">
                            <label class="checkbox-label">
                                <input type="checkbox" id="customerActive" ${customer?.isActive ? 'checked' : ''}>
                                Active Customer
                            </label>
                        </div>
                    </div>
                ` : ''}
            </form>
        `;
        
        const buttons = [
            { text: 'Cancel', class: 'btn-outline', action: 'close' },
            { text: isEdit ? 'Update' : 'Create', class: 'btn-primary', action: () => this.saveCustomer(customer?.id) }
        ];
        
        this.showModal(this.createModal(title, body, buttons));
        
        // Add type change handler
        document.getElementById('customerType').addEventListener('change', (e) => {
            const isOrganization = e.target.value === 'Organization';
            document.getElementById('organizationFields').style.display = isOrganization ? 'block' : 'none';
        });
    }

    async saveCustomer(id = null) {
        const form = document.getElementById('customerForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        const formData = {
            customerType: document.getElementById('customerType').value,
            displayName: document.getElementById('customerDisplayName').value,
            email: document.getElementById('customerEmail').value || null,
            phone: document.getElementById('customerPhone').value || null,
            address: document.getElementById('customerAddress').value || null,
            notes: document.getElementById('customerNotes').value || null
        };
        
        if (formData.customerType === 'Organization') {
            formData.organizationName = document.getElementById('customerOrganization').value || null;
        }
        
        if (id) {
            formData.isActive = document.getElementById('customerActive').checked;
        }
        
        try {
            if (id) {
                await api.updateCustomer(id, formData);
                this.showSuccess('Customer updated successfully');
            } else {
                await api.createCustomer(formData);
                this.showSuccess('Customer created successfully');
            }
            
            this.hideModal();
            this.loadCustomers(); // Refresh the list
        } catch (error) {
            if (error && Array.isArray(error.details) && error.details.length > 0) {
                const detailsText = error.details.map(d => d.message || d.code).join('; ');
                this.showError('Failed to save customer: ' + error.message + ' — ' + detailsText);
            } else {
                this.showError('Failed to save customer: ' + error.message);
            }
        }
    }

    async editEmployee(id) {
        try {
            const employee = await api.getEmployee(id);
            this.showEmployeeModal(employee);
        } catch (error) {
            this.showError('Failed to load employee: ' + error.message);
        }
    }

    showEmployeeModal(employee = null) {
        const isEdit = employee !== null;
        const title = isEdit ? 'Edit Employee' : 'Add Employee';
        
        const body = `
            <form id="employeeForm">
                <div class="form-row">
                    <div class="form-group">
                        <label for="employeeFirstName">First Name *</label>
                        <input type="text" id="employeeFirstName" class="form-input" value="${employee?.firstName || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="employeeLastName">Last Name *</label>
                        <input type="text" id="employeeLastName" class="form-input" value="${employee?.lastName || ''}" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="employeeEmail">Email</label>
                        <input type="email" id="employeeEmail" class="form-input" value="${employee?.email || ''}">
                    </div>
                    <div class="form-group">
                        <label for="employeePhone">Phone</label>
                        <input type="tel" id="employeePhone" class="form-input" value="${employee?.phone || ''}">
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="employeeRole">Role *</label>
                    <select id="employeeRole" class="form-select" required>
                        <option value="Admin" ${employee?.role === 'Admin' ? 'selected' : ''}>Admin - Full access to all features</option>
                        <option value="Staff" ${employee?.role === 'Staff' ? 'selected' : ''}>Staff - Can manage orders and customers</option>
                        <option value="ReadOnly" ${employee?.role === 'ReadOnly' ? 'selected' : ''}>Read Only - View-only access</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="employeeJobTitle">Job Title</label>
                    <input type="text" id="employeeJobTitle" class="form-input" value="${employee?.jobTitle || ''}" placeholder="e.g., Sales Representative, Manager">
                </div>
                
                <div class="form-group">
                    <label for="employeeNotes">Notes</label>
                    <textarea id="employeeNotes" class="form-input" rows="2" placeholder="Additional notes about this employee">${employee?.notes || ''}</textarea>
                </div>
                
                ${isEdit ? `
                    <div class="form-group">
                        <label>Status</label>
                        <div class="status-controls">
                            <label class="checkbox-label">
                                <input type="checkbox" id="employeeActive" ${employee?.isActive ? 'checked' : ''}>
                                Active Employee
                            </label>
                        </div>
                    </div>
                    
                    <div class="info-box">
                        <h6>Role Permissions</h6>
                        <div id="rolePermissions">
                            ${this.getRolePermissionsDisplay(employee?.role || 'ReadOnly')}
                        </div>
                    </div>
                ` : ''}
            </form>
        `;
        
        const buttons = [
            { text: 'Cancel', class: 'btn-outline', action: 'close' },
            { text: isEdit ? 'Update' : 'Create', class: 'btn-primary', action: () => this.saveEmployee(employee?.id) }
        ];
        
        this.showModal(this.createModal(title, body, buttons));
        
        // Add role change handler for permissions display
        if (isEdit) {
            document.getElementById('employeeRole').addEventListener('change', (e) => {
                document.getElementById('rolePermissions').innerHTML = this.getRolePermissionsDisplay(e.target.value);
            });
        }
    }

    getRolePermissionsDisplay(role) {
        const permissions = {
            'Admin': ['Full system access', 'Manage employees', 'Manage all orders', 'Manage inventory', 'View reports', 'System configuration'],
            'Staff': ['Manage orders', 'Manage customers', 'View inventory', 'Generate receipts', 'View basic reports'],
            'ReadOnly': ['View orders', 'View customers', 'View inventory', 'Generate receipts']
        };
        
        return `
            <ul style="margin: 0; padding-left: 1rem;">
                ${(permissions[role] || []).map(perm => `<li>${perm}</li>`).join('')}
            </ul>
        `;
    }

    async saveEmployee(id = null) {
        const form = document.getElementById('employeeForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        const formData = {
            firstName: document.getElementById('employeeFirstName').value,
            lastName: document.getElementById('employeeLastName').value,
            email: document.getElementById('employeeEmail').value || null,
            phone: document.getElementById('employeePhone').value || null,
            role: document.getElementById('employeeRole').value,
            jobTitle: document.getElementById('employeeJobTitle').value || null,
            notes: document.getElementById('employeeNotes').value || null
        };
        
        if (id) {
            formData.isActive = document.getElementById('employeeActive').checked;
        }
        
        try {
            if (id) {
                await api.updateEmployee(id, formData);
                this.showSuccess('Employee updated successfully');
            } else {
                await api.createEmployee(formData);
                this.showSuccess('Employee created successfully');
            }
            
            this.hideModal();
            this.loadEmployees(); // Refresh the list
        } catch (error) {
            if (error && Array.isArray(error.details) && error.details.length > 0) {
                const detailsText = error.details.map(d => d.message || d.code).join('; ');
                this.showError('Failed to save employee: ' + error.message + ' — ' + detailsText);
            } else {
                this.showError('Failed to save employee: ' + error.message);
            }
        }
    }

    async adjustStock(id) {
        try {
            const item = await api.getItem(id);
            this.showStockAdjustmentModal(item);
        } catch (error) {
            this.showError('Failed to load item: ' + error.message);
        }
    }

    showStockAdjustmentModal(item) {
        const body = `
            <form id="stockAdjustmentForm">
                <div class="info-box mb-4">
                    <h4>${item.name}</h4>
                    <p>Current Stock: <strong>${item.quantityOnHand || 0}</strong></p>
                    <p>SKU: ${item.sku}</p>
                </div>
                
                <div class="form-group">
                    <label for="adjustmentMode">Adjustment Mode *</label>
                    <select id="adjustmentMode" class="form-select" required>
                        <option value="delta" selected>Adjust by amount (+/-)</option>
                        <option value="set">Set exact stock</option>
                    </select>
                </div>
                
                <div id="deltaFields">
                    <div class="form-group" id="reasonField">
                        <label for="adjustmentType">Adjustment Type *</label>
                        <select id="adjustmentType" class="form-select" required>
                            <option value="">Select adjustment type</option>
                            <option value="adjustment">Manual Adjustment</option>
                            <option value="repair">Repair (Send/Return)</option>
                            <option value="loss">Report Loss</option>
                            <option value="found">Report Found</option>
                        </select>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="adjustmentQuantity">Quantity *</label>
                            <input type="number" id="adjustmentQuantity" class="form-input" min="1" required>
                        </div>
                        <div class="form-group">
                            <label for="adjustmentDirection">Direction *</label>
                            <select id="adjustmentDirection" class="form-select" required>
                                <option value="">Select direction</option>
                                <option value="increase">Increase (+)</option>
                                <option value="decrease">Decrease (-)</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div id="setFields" style="display:none;">
                    <div class="form-group">
                        <label for="setQuantity">New Stock *</label>
                        <input type="number" id="setQuantity" class="form-input" min="0" value="${item.quantityOnHand || 0}">
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="adjustmentNotes">Notes *</label>
                    <textarea id="adjustmentNotes" class="form-input" rows="3" placeholder="Explain the reason for this change..." required></textarea>
                </div>
                
                <div id="previewSection" class="info-box" style="display: none;">
                    <p>Current: <span id="currentStock">${item.quantityOnHand || 0}</span></p>
                    <p>Change: <span id="changeAmount">-</span></p>
                    <p>New Total: <span id="newStock">-</span></p>
                </div>
            </form>
        `;
        
        const buttons = [
            { text: 'Cancel', class: 'btn-outline', action: 'close' },
            { text: 'Apply Adjustment', class: 'btn-primary', action: () => this.applyStockAdjustment(item.id) }
        ];
        
        this.showModal(this.createModal('Adjust Stock - ' + item.name, body, buttons));
        
        // Add change handlers for mode + preview
        const currentStockVal = item.quantityOnHand || 0;

        const updatePreview = () => {
            const mode = document.getElementById('adjustmentMode').value;
            let delta = 0;
            let newStock = currentStockVal;

            if (mode === 'delta') {
                const quantity = parseInt(document.getElementById('adjustmentQuantity').value) || 0;
                const direction = document.getElementById('adjustmentDirection').value;
                if (quantity && direction) {
                    delta = direction === 'increase' ? quantity : -quantity;
                    newStock = currentStockVal + delta;
                } else {
                    document.getElementById('previewSection').style.display = 'none';
                    return;
                }
            } else {
                // set mode
                const setQty = document.getElementById('setQuantity').value;
                const target = setQty === '' ? null : parseInt(setQty);
                if (target !== null && Number.isFinite(target)) {
                    delta = target - currentStockVal;
                    newStock = target;
                } else {
                    document.getElementById('previewSection').style.display = 'none';
                    return;
                }
            }

            document.getElementById('currentStock').textContent = currentStockVal;
            document.getElementById('changeAmount').textContent = delta > 0 ? `+${delta}` : delta;
            const newStockEl = document.getElementById('newStock');
            newStockEl.textContent = newStock;
            document.getElementById('previewSection').style.display = 'block';
            newStockEl.className = newStock < 0 ? 'text-red-600 font-bold' : '';
        };

        const onModeChange = () => {
            const mode = document.getElementById('adjustmentMode').value;
            const deltaFields = document.getElementById('deltaFields');
            const setFields = document.getElementById('setFields');

            // Toggle visibility
            deltaFields.style.display = mode === 'delta' ? 'block' : 'none';
            setFields.style.display = mode === 'set' ? 'block' : 'none';

            // Toggle required attributes
            document.getElementById('adjustmentType').required = mode === 'delta';
            document.getElementById('adjustmentQuantity').required = mode === 'delta';
            document.getElementById('adjustmentDirection').required = mode === 'delta';
            const setQtyEl = document.getElementById('setQuantity');
            setQtyEl.required = mode === 'set';
            if (mode === 'set' && setQtyEl.value === '') {
                setQtyEl.value = String(currentStockVal);
            }

            // Recompute preview
            updatePreview();
        };

        document.getElementById('adjustmentMode').addEventListener('change', onModeChange);
        document.getElementById('adjustmentQuantity').addEventListener('input', updatePreview);
        document.getElementById('adjustmentDirection').addEventListener('change', updatePreview);
        document.getElementById('setQuantity').addEventListener('input', updatePreview);
        // Initialize preview for default mode
        updatePreview();
    }

    async applyStockAdjustment(itemId) {
        const form = document.getElementById('stockAdjustmentForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        const mode = document.getElementById('adjustmentMode').value || 'delta';
        const notes = document.getElementById('adjustmentNotes').value;

        try {
            if (mode === 'set') {
                const setQty = parseInt(document.getElementById('setQuantity').value);
                if (!Number.isFinite(setQty) || setQty < 0) {
                    this.showError('New Stock must be a non-negative number');
                    return;
                }
                await api.updateItemStock(itemId, setQty, notes, 'Web User');
                this.showSuccess('Stock updated to exact quantity');
            } else {
                const quantity = parseInt(document.getElementById('adjustmentQuantity').value);
                const direction = document.getElementById('adjustmentDirection').value;
                const reason = document.getElementById('adjustmentType').value;
                const delta = direction === 'increase' ? quantity : -quantity;
                await api.adjustItemStock(itemId, delta, reason, notes, 'Web User');
                this.showSuccess('Stock adjustment applied successfully');
            }
            this.hideModal();
            this.loadItems(); // Refresh the list
        } catch (error) {
            if (error && Array.isArray(error.details) && error.details.length > 0) {
                const detailsText = error.details.map(d => d.message || d.code).join('; ');
                this.showError('Failed to apply stock change: ' + error.message + ' — ' + detailsText);
            } else {
                this.showError('Failed to apply stock change: ' + error.message);
            }
        }
    }

    showAddComponentModal(itemId) {
        const body = `
            <form id="addComponentForm">
                <div class="form-group">
                    <label for="childItemSelect">Child Item *</label>
                    <select id="childItemSelect" class="form-select" required>
                        <option value="">Loading items...</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="componentQuantity">Quantity Required *</label>
                    <input type="number" id="componentQuantity" class="form-input" min="1" value="1" required>
                </div>
                
                <div class="info-box">
                    <p><i class="fas fa-info-circle"></i> This will add the selected item as a component of this composite item.</p>
                </div>
            </form>
        `;
        
        const buttons = [
            { text: 'Cancel', class: 'btn-outline', action: 'close' },
            { text: 'Add Component', class: 'btn-primary', action: () => this.addComponent(itemId) }
        ];
        
        this.showModal(this.createModal('Add Component', body, buttons));
        
        // Load available items for the select
        this.loadAvailableItemsForComponent(itemId);
    }

    async loadAvailableItemsForComponent(excludeItemId) {
        try {
            const response = await api.getItems({ type: 'atomic' }); // Only atomic items can be components
            const select = document.getElementById('childItemSelect');
            
            if (response.items.length === 0) {
                select.innerHTML = '<option value="">No atomic items available</option>';
                return;
            }
            
            select.innerHTML = '<option value="">Select an item...</option>' +
                response.items
                    .filter(item => item.id != excludeItemId) // Don't allow self-reference
                    .map(item => `<option value="${item.id}">${item.name} (${item.sku})</option>`)
                    .join('');
        } catch (error) {
            console.error('Failed to load items:', error);
            document.getElementById('childItemSelect').innerHTML = '<option value="">Failed to load items</option>';
        }
    }

    async addComponent(itemId) {
        const form = document.getElementById('addComponentForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        const childId = parseInt(document.getElementById('childItemSelect').value);
        const quantity = parseInt(document.getElementById('componentQuantity').value);
        
        try {
            await api.addItemComponent(itemId, childId, quantity);
            this.showSuccess('Component added successfully');
            this.hideModal();
            // Reload components if the item modal is still open
            this.loadItemComponents(itemId);
        } catch (error) {
            if (error && Array.isArray(error.details) && error.details.length > 0) {
                const detailsText = error.details.map(d => d.message || d.code).join('; ');
                this.showError('Failed to add component: ' + error.message + ' — ' + detailsText);
            } else {
                this.showError('Failed to add component: ' + error.message);
            }
        }
    }

    async removeComponent(itemId, childId) {
        if (!confirm('Are you sure you want to remove this component?')) {
            return;
        }
        
        try {
            await api.removeItemComponent(itemId, childId);
            this.showSuccess('Component removed successfully');
            // Reload components
            this.loadItemComponents(itemId);
        } catch (error) {
            if (error && Array.isArray(error.details) && error.details.length > 0) {
                const detailsText = error.details.map(d => d.message || d.code).join('; ');
                this.showError('Failed to remove component: ' + error.message + ' — ' + detailsText);
            } else {
                this.showError('Failed to remove component: ' + error.message);
            }
        }
    }

    async viewOrder(id) {
        try {
            const order = await api.getOrderWithDetails(id);
            this.showOrderDetailsModal(order);
        } catch (error) {
            this.showError('Failed to load order: ' + error.message);
        }
    }

    showOrderModal(order = null) {
        const isEdit = order !== null;
        const title = isEdit ? 'Edit Order' : 'Create Order';
        
        const fmtDT = (iso) => {
            if (!iso) return '';
            try {
                const d = new Date(iso);
                const pad = (n) => String(n).padStart(2, '0');
                const yyyy = d.getFullYear();
                const mm = pad(d.getMonth() + 1);
                const dd = pad(d.getDate());
                const hh = pad(d.getHours());
                const mi = pad(d.getMinutes());
                return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
            } catch { return ''; }
        };

        const body = `
            <form id="orderForm">
                <div class="form-row">
                    <div class="form-group">
                        <label for="orderCustomer">Customer *</label>
                        <select id="orderCustomer" class="form-select" required ${isEdit ? 'disabled' : ''}>
                            <option value="">Loading customers...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="orderEmployee">Sales Person *</label>
                        <select id="orderEmployee" class="form-select" required>
                            <option value="">Loading employees...</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="orderStartDate">Start Date *</label>
                        <input type="date" id="orderStartDate" class="form-input" value="${order?.startDate ? order.startDate.split('T')[0] : ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="orderReturnDate">Return Due Date *</label>
                        <input type="date" id="orderReturnDate" class="form-input" value="${order?.returnDueDate ? order.returnDueDate.split('T')[0] : ''}" required>
                    </div>
                </div>

                <div class="info-box">
                    <h6>Extended Time Window (optional)</h6>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="orderSetupStart">Setup Start</label>
                            <input type="datetime-local" id="orderSetupStart" class="form-input" value="${fmtDT(order?.setupStart)}">
                        </div>
                        <div class="form-group">
                            <label for="orderOrderStart">Order Start</label>
                            <input type="datetime-local" id="orderOrderStart" class="form-input" value="${fmtDT(order?.orderStart || order?.startDate)}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="orderOrderEnd">Order End</label>
                            <input type="datetime-local" id="orderOrderEnd" class="form-input" value="${fmtDT(order?.orderEnd || order?.returnDueDate)}">
                        </div>
                        <div class="form-group">
                            <label for="orderCleanupEnd">Cleanup End</label>
                            <input type="datetime-local" id="orderCleanupEnd" class="form-input" value="${fmtDT(order?.cleanupEnd)}">
                        </div>
                    </div>
                </div>
                
                <div id="rentalPeriodDisplay" class="info-box" style="display: none;">
                    <p>Rental Period: <span id="rentalDays">-</span> days</p>
                </div>
                
                <div class="form-group">
                    <label for="orderNotes">Notes</label>
                    <textarea id="orderNotes" class="form-input" rows="3" placeholder="Order notes...">${order?.notes || ''}</textarea>
                </div>
                
                ${isEdit ? `
                    <div class="form-group">
                        <label>Order Status</label>
                        <div class="status-display">
                            <span class="status-badge status-${order.status.toLowerCase().replace(' ', '-')}">${order.status}</span>
                        </div>
                    </div>
                ` : ''}
            </form>
        `;
        
        const buttons = [
            { text: 'Cancel', class: 'btn-outline', action: 'close' },
            { text: isEdit ? 'Update' : 'Create', class: 'btn-primary', action: () => this.saveOrder(order?.id) }
        ];
        
        this.showModal(this.createModal(title, body, buttons));
        
        // Load dropdown data
        this.loadCustomersForSelect(order?.customerId);
        this.loadEmployeesForSelect(order?.salesPersonId);
        
        // Add date change handlers for rental period calculation
        const updateRentalPeriod = () => {
            const startDate = document.getElementById('orderStartDate').value;
            const returnDate = document.getElementById('orderReturnDate').value;
            
            if (startDate && returnDate) {
                const start = new Date(startDate);
                const end = new Date(returnDate);
                const timeDiff = end.getTime() - start.getTime();
                const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
                
                if (dayDiff > 0) {
                    document.getElementById('rentalDays').textContent = dayDiff;
                    document.getElementById('rentalPeriodDisplay').style.display = 'block';
                } else {
                    document.getElementById('rentalPeriodDisplay').style.display = 'none';
                }
            } else {
                document.getElementById('rentalPeriodDisplay').style.display = 'none';
            }
        };
        
        document.getElementById('orderStartDate').addEventListener('change', updateRentalPeriod);
        document.getElementById('orderReturnDate').addEventListener('change', updateRentalPeriod);
        
        // Initial calculation
        updateRentalPeriod();
    }

    async loadCustomersForSelect(selectedId = null) {
        try {
            const response = await api.getCustomers({ active: true });
            const select = document.getElementById('orderCustomer');
            
            if (response.customers.length === 0) {
                select.innerHTML = '<option value="">No active customers found</option>';
                return;
            }
            
            select.innerHTML = '<option value="">Select a customer...</option>' +
                response.customers
                    .map(customer => `<option value="${customer.id}" ${customer.id === selectedId ? 'selected' : ''}>${customer.displayName}</option>`)
                    .join('');
        } catch (error) {
            console.error('Failed to load customers:', error);
            document.getElementById('orderCustomer').innerHTML = '<option value="">Failed to load customers</option>';
        }
    }

    async loadEmployeesForSelect(selectedId = null) {
        try {
            const response = await api.getEmployees({ active: true });
            const select = document.getElementById('orderEmployee');
            
            if (response.employees.length === 0) {
                select.innerHTML = '<option value="">No active employees found</option>';
                return;
            }
            
            select.innerHTML = '<option value="">Select an employee...</option>' +
                response.employees
                    .map(employee => `<option value="${employee.id}" ${employee.id === selectedId ? 'selected' : ''}>${employee.fullName}</option>`)
                    .join('');
        } catch (error) {
            console.error('Failed to load employees:', error);
            document.getElementById('orderEmployee').innerHTML = '<option value="">Failed to load employees</option>';
        }
    }

    async saveOrder(id = null) {
        const form = document.getElementById('orderForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        const formData = {
            customerId: parseInt(document.getElementById('orderCustomer').value),
            salesPersonId: parseInt(document.getElementById('orderEmployee').value),
            startDate: document.getElementById('orderStartDate').value,
            returnDueDate: document.getElementById('orderReturnDate').value,
            notes: document.getElementById('orderNotes').value || null
        };

        // Extended window values
        const setupStart = document.getElementById('orderSetupStart').value;
        const orderStart = document.getElementById('orderOrderStart').value;
        const orderEnd = document.getElementById('orderOrderEnd').value;
        const cleanupEnd = document.getElementById('orderCleanupEnd').value;
        if (setupStart) formData.setupStart = setupStart;
        if (orderStart) formData.orderStart = orderStart;
        if (orderEnd) formData.orderEnd = orderEnd;
        if (cleanupEnd) formData.cleanupEnd = cleanupEnd;
        
        try {
            let order;
            if (id) {
                order = await api.updateOrder(id, formData);
                this.showSuccess('Order updated successfully');
            } else {
                order = await api.createOrder(formData);
                this.showSuccess('Order created successfully');
            }
            
            this.hideModal();
            this.loadOrders(); // Refresh the list
            
            // If this is a new order, show the order details modal to add line items
            if (!id) {
                setTimeout(() => this.showOrderDetailsModal(order), 500);
            }
        } catch (error) {
            if (error && Array.isArray(error.details) && error.details.length > 0) {
                const detailsText = error.details.map(d => d.message || d.code).join('; ');
                this.showError('Failed to save order: ' + error.message + ' — ' + detailsText);
            } else {
                this.showError('Failed to save order: ' + error.message);
            }
        }
    }

    showOrderDetailsModal(order) {
        const body = `
            <div class="order-details">
                <div class="order-header">
                    <div class="order-info">
                        <h4>Order #${order.id}</h4>
                        <p><strong>Customer:</strong> ${order.customerName}</p>
                        <p><strong>Period:</strong> ${new Date(order.startDate).toLocaleDateString()} - ${new Date(order.returnDueDate).toLocaleDateString()}</p>
                        ${order.orderStart || order.orderEnd || order.setupStart || order.cleanupEnd ? `
                        <p><strong>Window:</strong> ${order.setupStart ? new Date(order.setupStart).toLocaleString() + ' → ' : ''}${order.orderStart ? new Date(order.orderStart).toLocaleString() + ' → ' : ''}${order.orderEnd ? new Date(order.orderEnd).toLocaleString() : ''}${order.cleanupEnd ? ' → ' + new Date(order.cleanupEnd).toLocaleString() : ''}</p>
                        ` : ''}
                        <p><strong>Status:</strong> <span class="status-badge status-${order.status.toLowerCase().replace(' ', '-')}">${order.status}</span></p>
                    </div>
                    <div class="order-actions">
                        ${order.status === 'Draft' ? `<button onclick="app.editOrder(${order.id})" class="btn btn-sm btn-outline">Edit Order</button>` : ''}
                        <div class="status-controls">
                            ${this.getStatusTransitionButtons(order)}
                        </div>
                    </div>
                </div>
                
                <div class="line-items-section">
                    <div class="section-header">
                        <h5>Line Items</h5>
                        ${order.status === 'Draft' ? `<button onclick="app.showAddLineItemModal(${order.id})" class="btn btn-sm btn-primary">Add Item</button>` : ''}
                    </div>
                    <div id="orderLineItems">
                        <div class="loading">Loading line items...</div>
                    </div>
                </div>
                
                <div class="order-totals">
                    <div class="totals-row">
                        <span>Subtotal:</span>
                        <span>$${(order.subtotal || 0).toFixed(2)}</span>
                    </div>
                    ${order.discountAmount > 0 ? `
                        <div class="totals-row">
                            <span>Discount:</span>
                            <span>-$${order.discountAmount.toFixed(2)}</span>
                        </div>
                    ` : ''}
                    ${order.taxAmount > 0 ? `
                        <div class="totals-row">
                            <span>Tax:</span>
                            <span>$${order.taxAmount.toFixed(2)}</span>
                        </div>
                    ` : ''}
                    <div class="totals-row total-row">
                        <span>Total:</span>
                        <span>$${(order.total || 0).toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
        
        const buttons = [
            { text: 'Close', class: 'btn-outline', action: 'close' },
            { text: 'Generate Receipt', class: 'btn-primary', action: () => this.generateReceipt(order.id) }
        ];
        
        this.showModal(this.createModal(`Order Details - #${order.id}`, body, buttons));
        
        // Load line items
        this.loadOrderLineItems(order.id);
    }

    getStatusTransitionButtons(order) {
        const currentStatus = order.status;
        let buttons = [];
        
        switch (currentStatus) {
            case 'Draft':
                buttons.push(`<button onclick="app.reserveOrder(${order.id})" class="btn btn-sm btn-success">Reserve</button>`);
                buttons.push(`<button onclick="app.cancelOrder(${order.id})" class="btn btn-sm btn-danger">Cancel</button>`);
                break;
            case 'Reserved':
                buttons.push(`<button onclick="app.checkoutOrder(${order.id})" class="btn btn-sm btn-warning">Check Out</button>`);
                buttons.push(`<button onclick="app.cancelOrder(${order.id})" class="btn btn-sm btn-danger">Cancel</button>`);
                break;
            case 'Checked Out':
                buttons.push(`<button onclick="app.returnOrder(${order.id})" class="btn btn-sm btn-info">Return</button>`);
                break;
        }
        
        return buttons.join(' ');
    }

    async editOrder(id) {
        try {
            const order = await api.getOrderWithDetails(id);
            this.hideModal(); // Close current modal
            setTimeout(() => this.showOrderModal(order), 100);
        } catch (error) {
            this.showError('Failed to load order: ' + error.message);
        }
    }

    async loadOrderLineItems(orderId) {
        try {
            const response = await api.getOrderLineItems(orderId);
            this.renderOrderLineItems(response.lineItems || [], orderId);
        } catch (error) {
            console.error('Failed to load line items:', error);
            document.getElementById('orderLineItems').innerHTML = '<div class="text-red-500">Failed to load line items</div>';
        }
    }

    renderOrderLineItems(lineItems, orderId) {
        const container = document.getElementById('orderLineItems');
        
        if (lineItems.length === 0) {
            container.innerHTML = '<div class="text-gray-500">No items added yet. Click "Add Item" to start building this order.</div>';
            return;
        }
        
        const html = `
            <table class="line-items-table">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Price/Day</th>
                        <th>Days</th>
                        <th>Subtotal</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${lineItems.map(item => `
                        <tr>
                            <td>
                                <div class="item-info">
                                    <span class="item-name">${item.itemName}</span>
                                    <span class="item-sku">${item.itemSku}</span>
                                </div>
                            </td>
                            <td>${item.quantity}</td>
                            <td>$${item.pricePerDay.toFixed(2)}</td>
                            <td>${item.rentalDays}</td>
                            <td>$${item.lineTotal.toFixed(2)}</td>
                            <td>
                                <button onclick="app.editLineItem(${orderId}, ${item.id})" class="btn btn-xs btn-outline">Edit</button>
                                <button onclick="app.removeLineItem(${orderId}, ${item.id})" class="btn btn-xs btn-danger">Remove</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = html;
    }

    async editLineItem(orderId, lineId) {
        try {
            // Load current line data
            const linesResp = await api.getOrderLineItems(orderId);
            const line = (linesResp.lineItems || []).find(li => li.id === lineId);
            if (!line) {
                this.showError('Line item not found');
                return;
            }

            const body = `
                <form id="editLineForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Item</label>
                            <input type="text" class="form-input" value="${line.itemName} (${line.itemSku})" disabled>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editLineQuantity">Quantity *</label>
                            <input type="number" id="editLineQuantity" class="form-input" min="1" value="${line.quantity}" required>
                        </div>
                        <div class="form-group">
                            <label for="editLinePrice">Price/Day *</label>
                            <input type="number" id="editLinePrice" class="form-input" min="0" step="0.01" value="${line.pricePerDay}" required>
                        </div>
                    </div>
                </form>
            `;

            const buttons = [
                { text: 'Cancel', class: 'btn-outline', action: 'close' },
                { text: 'Update', class: 'btn-primary', action: async () => {
                    const form = document.getElementById('editLineForm');
                    if (!form.checkValidity()) { form.reportValidity(); return; }
                    const quantity = parseInt(document.getElementById('editLineQuantity').value);
                    const pricePerDay = Number(document.getElementById('editLinePrice').value);
                    try {
                        await api.editLineItem(orderId, lineId, { quantity, pricePerDay });
                        this.showSuccess('Line item updated');
                        this.hideModal();
                        await this.loadOrderLineItems(orderId);
                        // Update totals
                        const order = await api.getOrderWithDetails(orderId);
                        this.updateOrderTotalsInModal(order);
                    } catch (error) {
                        if (error && Array.isArray(error.details) && error.details.length > 0) {
                            const detailsText = error.details.map(d => d.message || d.code).join('; ');
                            this.showError('Failed to update line: ' + error.message + ' — ' + detailsText);
                        } else {
                            this.showError('Failed to update line: ' + error.message);
                        }
                    }
                } }
            ];

            this.showModal(this.createModal('Edit Line Item', body, buttons));
        } catch (error) {
            this.showError('Failed to load line item: ' + error.message);
        }
    }

    async removeLineItem(orderId, lineId) {
        if (!confirm('Remove this line item?')) return;
        try {
            await api.removeOrderLineItem(orderId, lineId);
            this.showSuccess('Line item removed');
            await this.loadOrderLineItems(orderId);
            const order = await api.getOrderWithDetails(orderId);
            this.updateOrderTotalsInModal(order);
        } catch (error) {
            if (error && Array.isArray(error.details) && error.details.length > 0) {
                const detailsText = error.details.map(d => d.message || d.code).join('; ');
                this.showError('Failed to remove line: ' + error.message + ' — ' + detailsText);
            } else {
                this.showError('Failed to remove line: ' + error.message);
            }
        }
    }

    updateOrderTotalsInModal(order) {
        try {
            const totalsEl = document.querySelector('.order-totals');
            if (!totalsEl) return;
            const totalsHtml = `
                <div class="totals-row">
                    <span>Subtotal:</span>
                    <span>$${(order.subtotal || 0).toFixed(2)}</span>
                </div>
                ${order.discountAmount > 0 ? `
                    <div class=\"totals-row\">
                        <span>Discount:</span>
                        <span>-$${order.discountAmount.toFixed(2)}</span>
                    </div>
                ` : ''}
                ${order.taxAmount > 0 ? `
                    <div class=\"totals-row\">
                        <span>Tax:</span>
                        <span>$${order.taxAmount.toFixed(2)}</span>
                    </div>
                ` : ''}
                <div class="totals-row total-row">
                    <span>Total:</span>
                    <span>$${(order.total || 0).toFixed(2)}</span>
                </div>
            `;
            totalsEl.innerHTML = totalsHtml;
        } catch (_) { /* ignore */ }
    }

    showAddLineItemModal(orderId) {
        const body = `
            <form id="lineItemForm">
                <div class="form-group">
                    <label for="lineItemSelect">Select Item *</label>
                    <select id="lineItemSelect" class="form-select" required>
                        <option value="">Loading items...</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="lineItemQuantity">Quantity *</label>
                    <input type="number" id="lineItemQuantity" class="form-input" min="1" value="1" required>
                </div>
                
                <div id="availabilityCheck" class="info-box" style="display: none;">
                    <p class="availability-status">Checking availability...</p>
                </div>
                
                <div id="pricingPreview" class="info-box" style="display: none;">
                    <div class="pricing-details">
                        <p>Price per day: <span id="pricePerDay">-</span></p>
                        <p>Rental period: <span id="rentalPeriod">-</span> days</p>
                        <p>Line total: <span id="lineTotal">-</span></p>
                    </div>
                </div>
            </form>
        `;
        
        const buttons = [
            { text: 'Cancel', class: 'btn-outline', action: 'close' },
            { text: 'Add Item', class: 'btn-primary', action: () => this.addLineItem(orderId) }
        ];
        
        this.showModal(this.createModal('Add Item to Order', body, buttons));
        
        // Load available items for the order period
        this.loadItemsForLineItem(orderId);
        
        // Add change handlers for availability and pricing
        document.getElementById('lineItemSelect').addEventListener('change', () => this.checkLineItemAvailability(orderId));
        document.getElementById('lineItemQuantity').addEventListener('input', () => {
            this.loadItemsForLineItem(orderId).then(() => this.checkLineItemAvailability(orderId));
        });
    }

    async loadItemsForLineItem(orderId) {
        try {
            const select = document.getElementById('lineItemSelect');
            const qty = parseInt(document.getElementById('lineItemQuantity').value) || 1;
            const order = await api.getOrder(orderId);
            const response = await api.getAvailableItems(order.startDate, order.returnDueDate, qty, orderId);
            const items = response.items || [];
            if (items.length === 0) {
                select.innerHTML = '<option value="">No items available for this period</option>';
                return;
            }
            const prev = select.value;
            select.innerHTML = '<option value="">Select an item...</option>' +
                items.map(item => `<option value="${item.id}" data-price="${item.pricePerDay || 0}">${item.name} — available: ${item.available ?? ''}</option>`).join('');
            if (prev) {
                const opt = Array.from(select.options).find(o => o.value === String(prev));
                if (opt) select.value = prev;
            }
        } catch (error) {
            console.error('Failed to load items:', error);
            document.getElementById('lineItemSelect').innerHTML = '<option value="">Failed to load items</option>';
        }
    }

    async checkLineItemAvailability(orderId) {
        const itemId = document.getElementById('lineItemSelect').value;
        const quantity = parseInt(document.getElementById('lineItemQuantity').value) || 0;
        
        if (!itemId || !quantity) {
            document.getElementById('availabilityCheck').style.display = 'none';
            document.getElementById('pricingPreview').style.display = 'none';
            return;
        }
        
        try {
            // Get order details for dates
            const order = await api.getOrder(orderId);
            
            // Check availability
            const availability = await api.getItemAvailability(itemId, order.startDate, order.returnDueDate, orderId);
            
            // Update availability display
            const availabilityDiv = document.getElementById('availabilityCheck');
            const statusElement = availabilityDiv.querySelector('.availability-status');
            
            if (availability.available >= quantity) {
                statusElement.innerHTML = `✓ Available: ${availability.available} units available`;
                statusElement.className = 'availability-status text-green-600';
            } else {
                statusElement.innerHTML = `⚠ Insufficient stock: Only ${availability.available} of ${quantity} requested available`;
                statusElement.className = 'availability-status text-red-600';
            }
            
            availabilityDiv.style.display = 'block';
            
            // Update pricing
            const selectedOption = document.getElementById('lineItemSelect').selectedOptions[0];
            const pricePerDay = parseFloat(selectedOption.dataset.price);
            const rentalDays = Math.ceil((new Date(order.returnDueDate) - new Date(order.startDate)) / (1000 * 60 * 60 * 24));
            const lineTotal = quantity * pricePerDay * rentalDays;
            
            document.getElementById('pricePerDay').textContent = `$${pricePerDay.toFixed(2)}`;
            document.getElementById('rentalPeriod').textContent = rentalDays;
            document.getElementById('lineTotal').textContent = `$${lineTotal.toFixed(2)}`;
            document.getElementById('pricingPreview').style.display = 'block';
            
        } catch (error) {
            console.error('Failed to check availability:', error);
            document.getElementById('availabilityCheck').innerHTML = '<p class="text-red-500">Failed to check availability</p>';
        }
    }

    async addLineItem(orderId) {
        const form = document.getElementById('lineItemForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        const itemId = parseInt(document.getElementById('lineItemSelect').value);
        const quantity = parseInt(document.getElementById('lineItemQuantity').value);
        
        try {
            await api.addOrderLineItem(orderId, { itemId, quantity });
            this.showSuccess('Item added to order');
            this.hideModal();
            
            // Reload line items and order details
            this.loadOrderLineItems(orderId);
            
        } catch (error) {
            if (error && Array.isArray(error.details) && error.details.length > 0) {
                const detailsText = error.details.map(d => d.message || d.code).join('; ');
                this.showError('Failed to add item: ' + error.message + ' — ' + detailsText);
            } else {
                this.showError('Failed to add item: ' + error.message);
            }
        }
    }

    async reserveOrder(orderId) {
        try {
            await api.reserveOrder(orderId);
            this.showSuccess('Order reserved successfully');
            this.hideModal();
            this.loadOrders();
        } catch (error) {
            this.showError('Failed to reserve order: ' + error.message);
        }
    }

    async checkoutOrder(orderId) {
        try {
            await api.checkoutOrder(orderId);
            this.showSuccess('Order checked out successfully');
            this.hideModal();
            this.loadOrders();
        } catch (error) {
            this.showError('Failed to check out order: ' + error.message);
        }
    }

    async returnOrder(orderId) {
        try {
            await api.returnOrder(orderId);
            this.showSuccess('Order returned successfully');
            this.hideModal();
            this.loadOrders();
        } catch (error) {
            this.showError('Failed to return order: ' + error.message);
        }
    }

    async cancelOrder(orderId) {
        if (!confirm('Are you sure you want to cancel this order?')) {
            return;
        }
        
        try {
            await api.cancelOrder(orderId);
            this.showSuccess('Order cancelled successfully');
            this.hideModal();
            this.loadOrders();
        } catch (error) {
            this.showError('Failed to cancel order: ' + error.message);
        }
    }

    async generateReceipt(orderId) {
        try {
            const response = await api.generateReceipt(orderId);
            // The API should return a PDF blob or URL
            if (response.url) {
                window.open(response.url, '_blank');
            } else {
                this.showInfo('Receipt generation not fully implemented');
            }
        } catch (error) {
            this.showError('Failed to generate receipt: ' + error.message);
        }
    }

    async viewCustomerOrders(id) {
        try {
            const response = await api.getCustomerWithOrders(id);
            this.showCustomerOrdersModal(response);
        } catch (error) {
            this.showError('Failed to load customer orders: ' + error.message);
        }
    }

    showCustomerOrdersModal(customerData) {
        const customer = customerData.customer;
        const orders = customerData.orders || [];
        
        const body = `
            <div class="customer-orders">
                <div class="customer-header">
                    <div class="customer-info">
                        <h4>${customer.displayName}</h4>
                        ${customer.organizationName ? `<p><strong>Organization:</strong> ${customer.organizationName}</p>` : ''}
                        ${customer.email ? `<p><strong>Email:</strong> ${customer.email}</p>` : ''}
                        ${customer.phone ? `<p><strong>Phone:</strong> ${customer.phone}</p>` : ''}
                        <p><strong>Status:</strong> <span class="status-badge ${customer.isActive ? 'status-returned' : 'status-cancelled'}">${customer.isActive ? 'Active' : 'Inactive'}</span></p>
                    </div>
                    <div class="customer-stats">
                        <div class="stat-item">
                            <span class="stat-number">${orders.length}</span>
                            <span class="stat-label">Total Orders</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">$${orders.reduce((total, order) => total + (order.total || 0), 0).toFixed(2)}</span>
                            <span class="stat-label">Total Value</span>
                        </div>
                    </div>
                </div>
                
                <div class="orders-section">
                    <h5>Order History</h5>
                    <div id="customerOrdersList">
                        ${this.renderCustomerOrdersList(orders)}
                    </div>
                </div>
            </div>
        `;
        
        const buttons = [
            { text: 'Close', class: 'btn-outline', action: 'close' },
            { text: 'Edit Customer', class: 'btn-primary', action: () => { this.hideModal(); this.editCustomer(customer.id); } }
        ];
        
        this.showModal(this.createModal(`Customer Orders - ${customer.displayName}`, body, buttons));
    }

    renderCustomerOrdersList(orders) {
        if (orders.length === 0) {
            return '<div class="text-gray-500">No orders found for this customer.</div>';
        }
        
        return `
            <table class="orders-table">
                <thead>
                    <tr>
                        <th>Order #</th>
                        <th>Start Date</th>
                        <th>Return Date</th>
                        <th>Status</th>
                        <th>Total</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map(order => `
                        <tr>
                            <td class="font-mono">#${order.id}</td>
                            <td>${new Date(order.startDate).toLocaleDateString()}</td>
                            <td>${new Date(order.returnDueDate).toLocaleDateString()}</td>
                            <td>
                                <span class="status-badge status-${order.status.toLowerCase().replace(' ', '-')}">
                                    ${order.status}
                                </span>
                            </td>
                            <td>$${(order.total || 0).toFixed(2)}</td>
                            <td>
                                <button onclick="app.viewOrder(${order.id})" class="btn btn-xs btn-outline">View</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // Modal utilities
    createModal(title, body, buttons = []) {
        // Store actions for later invocation
        this.modalActions = buttons;
        return `
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close" onclick="app.hideModal()">&times;</button>
                </div>
                <div class="modal-body">
                    ${body}
                </div>
                <div class="modal-footer">
                    ${buttons.map((btn, idx) => `
                        <button class="btn ${btn.class}" onclick="app.modalClick(${idx})">${btn.text}</button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    showModal(content) {
        const overlay = document.getElementById('modalOverlay');
        overlay.innerHTML = content;
        overlay.classList.add('active');
    }

    hideModal() {
        document.getElementById('modalOverlay').classList.remove('active');
    }

    modalClick(index) {
        const btn = (this.modalActions || [])[index];
        if (!btn) return;
        if (typeof btn.action === 'string' && btn.action === 'close') {
            this.hideModal();
            return;
        }
        if (typeof btn.action === 'function') {
            try {
                btn.action();
            } catch (e) {
                console.error('Modal action failed:', e);
                this.showError('Action failed: ' + e.message);
            }
        }
    }

    // Notification utilities
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showInfo(message) {
        this.showNotification(message, 'info');
    }

    showNotification(message, type = 'info') {
        const alertClass = type === 'success' ? 'alert-success' : 
                          type === 'error' ? 'alert-error' : 
                          'alert-warning';
        
        const alert = document.createElement('div');
        alert.className = `alert ${alertClass}`;
        alert.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
            ${message}
        `;

        document.body.appendChild(alert);

        // Position the alert
        alert.style.position = 'fixed';
        alert.style.top = '20px';
        alert.style.right = '20px';
        alert.style.zIndex = '10000';
        alert.style.maxWidth = '400px';

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 5000);

        // Allow manual close
        alert.addEventListener('click', () => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        });
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
