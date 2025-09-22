# Implementation Plan

- [-] 0. Complete Internal Equipment Rental & Stock Management App Implementation
  - Implement full-stack web application with Node.js/Express backend, PostgreSQL database, and vanilla JavaScript frontend
  - Build comprehensive equipment rental system with inventory management, order processing, PDF receipts, and calendar integration
  - Deploy containerized application for internal LAN/VPN networks with optional admin token security
  - _Requirements: All requirements 1.1-9.4_

  - [x] 1. Set up project structure and database foundation
    - Initialize Node.js project with Express.js framework, PostgreSQL driver, and essential dependencies
    - Create database schema with tables: employees, customers, items, item_components, orders, order_rows, stock_movements, calendar_tokens
    - Set up database connection pooling with environment-based configuration
    - Configure project structure with models/, repositories/, services/, routes/, and public/ directories
    - Add database migration scripts and seed data for testing
    - _Requirements: 8.1, 8.3, 8.4_

  - [x] 2. Implement core data models and validation
    - [x] 2.1 Create database repository classes with CRUD operations
      - Implement EmployeeRepository with role management (Admin, Staff, ReadOnly) and activation status
      - Create CustomerRepository with activation status and complete order history tracking
      - Add ItemRepository with BOM cycle detection and composite stock calculations
      - Implement OrderRepository with availability validation and status transition logic
      - Add StockMovementRepository with audit trail and reason code validation
      - Create CalendarTokenRepository for secure token generation and management
      - Include comprehensive error handling and database constraint validation
      - _Requirements: 7.1, 7.2, 7.3, 5.1, 5.4, 1.1, 1.4, 1.5, 2.1, 6.1, 6.2, 6.3_

    - [x] 2.2 Implement business logic models with validation
      - Create Item model with composite/atomic distinction and availability calculation methods
      - Implement Order model with status transition validation (Draft→Reserved→Checked Out→Returned)
      - Create Customer model with activation status validation and order history access
      - Add Employee model with role-based permission methods and activation status checks
      - Implement StockMovement model with reason code validation and audit trail support
      - Add comprehensive validation for business rules, data integrity, and role-based access
      - Implement model relationships with proper foreign key constraints and cascade rules
      - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.6, 5.1, 5.4, 7.1, 7.2, 7.3, 6.1, 6.2, 6.3_

  - [ ] 3. Build inventory management system
    - [x] 3.1 Implement atomic item stock management
      - Create InventoryService with manual stock quantity update methods
      - Add validation for stock quantity changes with audit trail creation
      - Implement stock movement tracking for manual adjustments with reason codes
      - Create stock adjustment endpoints with proper validation and error handling
      - _Requirements: 1.1, 6.2, 6.3_

c    - [x] 3.2 Implement composite item BOM system
      - Create ItemComponentService for managing parent-child relationships
      - Add cycle detection algorithm using depth-first search to prevent circular dependencies
      - Implement automatic stock calculation: min(floor(child_available/qty_required))
      - Create BOM management endpoints with cycle validation
      - _Requirements: 1.2, 1.3, 1.4, 1.5_

    - [x] 3.3 Build availability calculation engine
      - Implement AvailabilityService with real-time calculations accounting for reservations
      - Create functions to calculate available quantities for specific date ranges
      - Add conflict detection for overlapping reservations with detailed error reporting
      - Implement availability validation for order creation and updates
      - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 4. Develop order management system
    - [x] 4.1 Create order creation and line item management
      - Implement OrderService with order creation, customer validation, and date validation
      - Add order line item management with automatic pricing: qty × price_per_day × rental_days
      - Create order total calculation including discount and tax handling
      - Add validation to prevent orders for inactive customers
      - _Requirements: 2.1, 2.2, 5.4_

    - [x] 4.2 Implement order status transition system
      - Create OrderStatusService with transition validation (Draft→Reserved→Checked Out→Returned)
      - Implement automatic stock movement creation on status changes
      - Add business logic for each transition with proper validation
      - Create status transition endpoints with role-based access control
      - _Requirements: 2.3, 2.4, 2.5, 2.6, 6.1_

    - [x] 4.3 Build stock movement automation
      - Create StockMovementService for automatic movements during order transitions
      - Implement reserve/release logic for Draft→Reserved and cancellation flows
      - Add checkout/return stock movement creation with audit trails
      - Create manual stock adjustment functionality with reason codes
      - _Requirements: 6.1, 6.3, 9.2, 9.3_

  - [x] 5. Create PDF receipt generation system
    - [x] 5.1 Implement PDF receipt generator
      - Set up PDFKit library and create ReceiptService for PDF generation
      - Create receipt template with order details, customer info, and complete pricing breakdown
      - Add order summary with line items, totals, rental period, and sales person details
      - Implement PDF generation endpoint with proper error handling and content-type headers
      - _Requirements: 3.1, 3.2, 3.3_

  - [x] 6. Build calendar integration system
    - [x] 6.1 Implement calendar token management
      - Create CalendarTokenService with unique, unguessable token generation
      - Add token validation and CRUD operations for token management
      - Implement token-based access control middleware for ICS feeds
      - Create token management endpoints for creation, listing, and revocation
      - _Requirements: 4.1_

    - [x] 6.2 Create ICS feed generation
      - Implement ICSService for generating ICS file format from orders
      - Add event creation with order summary, customer name, worth, and sales person details
      - Create color-coded events based on order status (Draft, Reserved, Checked Out, Returned, Cancelled)
      - Implement ICS feed endpoint with token validation
      - _Requirements: 4.2, 4.3, 4.4_

    - [x] 6.3 Add ICS feed caching system
      - Implement in-memory response caching with 1-2 minute TTL
      - Add cache invalidation triggers on order changes and status transitions
      - Optimize feed generation performance with efficient database queries
      - Create cache management utilities for monitoring and manual invalidation
      - _Requirements: 4.5_

  - [x] 7. Develop REST API endpoints
    - [x] 7.1 Create employee management API
      - Implement GET/POST /api/employees with role-based filtering and validation
      - Add PUT/PATCH /api/employees/:id for updates with role constraint enforcement
      - Create POST /api/employees/:id/activate and /api/employees/:id/deactivate endpoints
      - Add role validation middleware enforcing Admin, Staff, ReadOnly permissions
      - Implement employee directory functionality with search and filtering
      - _Requirements: 7.1, 7.2, 7.3_

    - [x] 7.2 Create customer management API
      - Implement GET/POST /api/customers with CRUD operations and activation status filtering
      - Add PUT/PATCH /api/customers/:id with data integrity validation
      - Create POST /api/customers/:id/activate and /api/customers/:id/deactivate endpoints
      - Add GET /api/customers/:id/orders for complete rental history with order details
      - Implement validation preventing new orders for inactive customers
      - _Requirements: 5.1, 5.2, 5.3, 5.4_

    - [x] 7.3 Create item management API
      - Implement GET/POST /api/items with atomic/composite distinction and validation
      - Add PUT/PATCH /api/items/:id with stock quantity management for atomic items
      - Create POST /api/items/:id/components for BOM management with cycle detection
      - Add DELETE /api/items/:id/components/:componentId with dependency validation
      - Implement GET /api/items/:id/availability for real-time availability queries
      - Create POST /api/items/:id/stock-adjustment for manual stock updates with audit trails
      - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.2_

    - [x] 7.4 Create order management API
      - Implement GET/POST /api/orders with availability validation and conflict detection
      - Add PATCH /api/orders/:id for updates with availability revalidation
      - Create POST /api/orders/:id/lines and DELETE /api/orders/:id/lines/:lineId for line management
      - Implement POST /api/orders/:id/transition for status changes with business rule validation
      - Add GET /api/orders/:id/availability for current order availability checking
      - Create comprehensive validation preventing invalid transitions and inventory conflicts
      - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 9.1, 9.2, 9.4_

    - [x] 7.5 Create calendar and receipt API endpoints
      - Implement GET /calendar.ics?token=... with token validation and caching
      - Add POST /api/orders/:id/receipt for PDF generation with complete order details
      - Create POST /api/calendar/tokens, GET /api/calendar/tokens, DELETE /api/calendar/tokens/:id
      - Add GET /api/stock-movements with filtering, pagination, and audit trail display
      - Implement proper error handling and response formatting for all endpoints
      - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.5, 6.3_

- [x] 8. Build frontend user interface
  - [x] 8.1 Create inventory management interface
    - Build responsive item listing with atomic/composite indicators and availability display
    - Add item creation and editing forms with BOM management and cycle detection feedback
    - Create stock quantity display showing calculated vs manual quantities with clear indicators
    - Implement stock adjustment interface with reason codes and audit trail display
    - _Requirements: 1.1, 1.2, 1.3, 6.2_

  - [x] 8.2 Create order management interface
    - Build responsive order creation form with customer selection, date inputs, and availability validation
    - Add line item management with real-time pricing calculations and availability checking
    - Create order status transition controls with validation feedback and history display
    - Implement order search and filtering with status-based organization
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.1, 9.4_

  - [x] 8.3 Create customer and employee management interface
    - Build responsive customer listing with activation status filtering and search functionality
    - Add customer creation and editing forms with activation controls and validation feedback
    - Create customer order history display with detailed order information and status tracking
    - Implement employee directory with role assignment, activation controls, and search
    - Add employee creation and editing forms with role validation and permission display
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 7.1, 7.2, 7.3_

  - [x] 8.4 Create calendar and reporting interface
    - Build calendar view for order visualization with status-based color coding
    - Add PDF receipt generation interface with order selection and download handling
    - Create stock movement history display with filtering, sorting, and audit trail information
    - Implement calendar token management interface for ICS feed access
    - _Requirements: 3.1, 4.2, 4.3, 4.4, 6.3_

- [x] 9. Implement security and deployment features
  - [x] 9.1 Add optional admin token protection
    - Implement X-Admin-Token header validation middleware for write operations
    - Add token configuration through environment variables with fallback defaults
    - Create admin-only endpoint protection with proper error responses
    - Add token validation to all mutating operations (POST, PUT, PATCH, DELETE)
    - _Requirements: 8.2_

  - [x] 9.2 Create deployment configuration
    - Set up Docker containerization with multi-stage builds for production optimization
    - Add environment configuration for database connections, tokens, and network settings
    - Create database migration scripts and seed data for initial deployment
    - Add production-ready logging, error handling, and health check endpoints
    - _Requirements: 8.1, 8.3_

- [x] 10. Add comprehensive testing suite
  - [x] 10.1 Create unit tests for business logic
    - Write tests for composite item stock calculations and cycle detection
    - Add tests for order status transitions, validations, and business rules
    - Create tests for availability calculations, conflict detection, and reservation logic
    - Test stock movement automation and audit trail creation
    - _Requirements: 1.2, 1.4, 1.5, 2.3, 2.6, 6.1, 9.1, 9.4_

  - [x] 10.2 Create integration tests for API endpoints
    - Write end-to-end tests for complete order workflow from creation to return
    - Add tests for PDF generation with various order configurations
    - Create tests for ICS feed generation, caching, and token validation
    - Test stock movement automation across all order status transitions
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 4.2, 4.5, 6.1_

  - [x] 10.3 Add performance and security tests
    - Create load tests for concurrent order operations and availability calculations
    - Add tests for calendar feed caching performance and cache invalidation
    - Write security tests for input validation, SQL injection prevention, and token protection
    - Test role-based access control and admin token validation
    - _Requirements: 4.5, 7.2, 7.3, 8.2, 8.4_