# Project References

## .kiro Configuration Files

### Product Overview (.kiro/steering/product.md)
- Internal Equipment Rental & Stock Management App
- Web-based application for internal LAN/VPN deployment
- Handles atomic items (individual equipment) and composite items (equipment bundles)
- Key features: inventory tracking, order lifecycle, stock movements, PDF receipts, calendar integration
- No external authentication required

### Project Structure (.kiro/steering/structure.md)
- Layered architecture: Data Access Layer � Business Logic Layer � API Layer � Presentation Layer
- Directory structure: models/, repositories/, services/, routes/, public/, migrations/, seeds/, tests/
- Repository pattern for database operations, Service layer for business logic
- Naming conventions: snake_case for DB, PascalCase for classes, RESTful API endpoints

### Technology Stack (.kiro/steering/tech.md)
- Backend: Node.js 18+ with Express.js, PostgreSQL with connection pooling
- Frontend: Vanilla JavaScript (ES6+), HTML5, CSS3 - no external frameworks
- Tools: PDFKit for receipts, native ICS generation, Docker containerization
- Commands: npm run dev/test/migrate/seed, Docker builds for production

### Requirements (.kiro/specs/equipment-rental-management/requirements.md)
- 9 core requirements covering inventory, orders, receipts, calendar, customers, stock tracking, employees, security, availability
- Key business rules: composite stock = min(floor(child_available/qty_required))
- Order lifecycle: Draft � Reserved � Checked Out � Returned
- Automatic pricing: qty � price_per_day � rental_days
- Role-based access: Admin, Staff, ReadOnly

### Design Document (.kiro/specs/equipment-rental-management/design.md)
- PostgreSQL database with tables: employees, customers, items, item_components, orders, order_rows, stock_movements, calendar_tokens
- Core models: Item, Employee, Customer, Order, StockMovement with business logic methods
- Availability validation algorithms and conflict detection
- Cycle detection for composite item BOMs to prevent circular dependencies
- ICS feed caching (1-2 min TTL) for calendar integration

### Implementation Tasks (.kiro/specs/equipment-rental-management/tasks.md)
Status as of current implementation:
-  Completed: Project structure, database foundation, core data models, inventory management
- ✅ Completed: Order management system (4.1-4.3) - OrderService, OrderStatusService, StockMovementService 
- ✅ Completed: PDF receipt generation (5.1) - ReceiptService with PDFKit integration
- ✅ Completed: Calendar integration (6.1-6.3) - CalendarService, token management, ICS feeds with caching
- ✅ Completed: REST API endpoints (7.1-7.5) - Employee, Customer, Item, Order, Calendar APIs with admin token middleware
- ✅ Completed: Frontend UI (8.1-8.2) - Inventory management interface, Order management interface with line items & status transitions
- 🚧 In Progress: Customer/Employee management interface (8.3), Calendar/Reporting interface (8.4) 
- ⏳ Pending: Security/deployment, comprehensive testing

### Key Algorithms & Business Logic
- Composite stock calculation with cycle detection using depth-first search
- Real-time availability calculations accounting for reservations and date ranges
- Order status transitions with automatic stock movement creation
- Audit trail creation for all inventory changes with reason codes
- when doing task always read the task first then set the status of the task to "~" then do the task then mark the task as completed with "X"
- when a task is finished continue to next taks automaticly
- after doing a task update the task part of your memory