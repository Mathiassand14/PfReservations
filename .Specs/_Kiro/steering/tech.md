# Technology Stack & Build System

## Backend Stack
- **Runtime**: Node.js 18+ with Express.js framework
- **Database**: PostgreSQL with connection pooling
- **PDF Generation**: PDFKit library
- **Calendar**: Native ICS generation with in-memory caching (1-2 min TTL)

## Frontend Stack
- **Framework**: Vanilla JavaScript with modern ES6+ features
- **Styling**: HTML5 + CSS3 (responsive design)
- **Architecture**: Modular components without external frameworks

## Development Tools
- **Containerization**: Docker with multi-stage builds
- **Database Migrations**: Custom migration scripts
- **Testing**: Unit and integration tests for business logic

## Common Commands

### Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run database migrations
npm run migrate

# Seed test data
npm run seed
```

### Testing
```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration
```

### Production
```bash
# Build Docker image
docker build -t equipment-rental .

# Run with Docker Compose
docker-compose up -d

# Database backup
pg_dump equipment_rental > backup.sql
```

## Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `X_ADMIN_TOKEN`: Optional admin token for write operations
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)