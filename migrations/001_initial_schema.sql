-- Initial database schema for Equipment Rental Management System

-- Employees table
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    role VARCHAR(20) NOT NULL CHECK (role IN ('Admin', 'Staff', 'ReadOnly')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Customers table
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    organization VARCHAR(255),
    contact_info JSONB,
    billing_info JSONB,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Items table
CREATE TABLE items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    price_per_day DECIMAL(10,2) NOT NULL,
    is_composite BOOLEAN NOT NULL DEFAULT false,
    quantity_on_hand INTEGER, -- NULL for composite items
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_atomic_has_quantity CHECK (
        (is_composite = false AND quantity_on_hand IS NOT NULL) OR
        (is_composite = true AND quantity_on_hand IS NULL)
    )
);

-- Item components table (for BOM)
CREATE TABLE item_components (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    child_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(parent_id, child_id),
    CONSTRAINT no_self_reference CHECK (parent_id != child_id)
);

-- Orders table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    sales_person_id INTEGER NOT NULL REFERENCES employees(id),
    status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Reserved', 'Checked Out', 'Returned', 'Cancelled')),
    start_date DATE NOT NULL,
    return_due_date DATE NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_date_range CHECK (return_due_date > start_date)
);

-- Order rows table (line items)
CREATE TABLE order_rows (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_per_day DECIMAL(10,2) NOT NULL,
    line_total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Stock movements table (audit trail)
CREATE TABLE stock_movements (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id),
    order_id INTEGER REFERENCES orders(id),
    delta INTEGER NOT NULL, -- positive for returns/adjustments in, negative for checkouts/adjustments out
    reason VARCHAR(20) NOT NULL CHECK (reason IN ('checkout', 'return', 'reserve', 'release', 'adjustment', 'repair', 'loss', 'found')),
    created_by VARCHAR(255) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Calendar tokens table
CREATE TABLE calendar_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    description VARCHAR(255),
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_employees_active ON employees(is_active);
CREATE INDEX idx_customers_active ON customers(is_active);
CREATE INDEX idx_items_composite ON items(is_composite);
CREATE INDEX idx_item_components_parent ON item_components(parent_id);
CREATE INDEX idx_item_components_child ON item_components(child_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_dates ON orders(start_date, return_due_date);
CREATE INDEX idx_order_rows_order ON order_rows(order_id);
CREATE INDEX idx_order_rows_item ON order_rows(item_id);
CREATE INDEX idx_stock_movements_item ON stock_movements(item_id);
CREATE INDEX idx_stock_movements_order ON stock_movements(order_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX idx_calendar_tokens_token ON calendar_tokens(token);