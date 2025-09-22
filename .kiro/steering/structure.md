# Project Structure & Organization

## Directory Layout
```
/
├── models/           # Data models and business logic classes
├── repositories/     # Database access layer (DAL)
├── services/         # Business logic layer (BLL)
├── routes/          # REST API endpoints
├── public/          # Static frontend files (HTML, CSS, JS)
├── migrations/      # Database schema migrations
├── seeds/           # Test data and initial setup
├── tests/           # Unit and integration tests
├── docker/          # Docker configuration files
└── docs/            # API documentation
```

## Architecture Patterns

### Layered Architecture
- **Data Access Layer (DAL)**: Repository classes handle all database operations
- **Business Logic Layer (BLL)**: Service classes implement business rules and calculations
- **API Layer**: Express routes provide RESTful endpoints
- **Presentation Layer**: Vanilla JS frontend components

### Key Design Principles
- **Separation of Concerns**: Clear boundaries between data, business logic, and presentation
- **Repository Pattern**: Database operations abstracted through repository classes
- **Service Layer**: Business logic centralized in service classes
- **Model Validation**: Data integrity enforced at model level

## Naming Conventions

### Files & Classes
- Repository classes: `ItemRepository`, `OrderRepository`
- Service classes: `InventoryService`, `OrderService`
- Model classes: `Item`, `Order`, `Customer`
- Route files: `items.js`, `orders.js`, `customers.js`

### Database Tables
- Snake case: `items`, `order_rows`, `stock_movements`, `item_components`
- Foreign keys: `customer_id`, `sales_person_id`
- Timestamps: `created_at`, `updated_at`

### API Endpoints
- RESTful conventions: `/api/items`, `/api/orders/:id/lines`
- Status transitions: `POST /api/orders/:id/transition`
- Special actions: `POST /api/items/:id/stock-adjustment`

## Code Organization Rules

### Models
- Include validation methods and business logic
- Implement calculated properties (e.g., `calculateAvailableQuantity()`)
- Define static helper methods for constants

### Services
- Handle complex business operations
- Coordinate between multiple repositories
- Implement transaction management
- Contain algorithms for stock calculations and availability

### Repositories
- One repository per main entity
- Include CRUD operations and specialized queries
- Handle database connection management
- Implement proper error handling

### Frontend Components
- Modular JavaScript files per feature area
- Shared utilities in separate files
- Event-driven architecture for UI updates
- Responsive design with mobile-first approach