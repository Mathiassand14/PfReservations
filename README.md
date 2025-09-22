# Equipment Rental Management System

Internal web-based application for managing equipment rental operations and inventory tracking.

## 🚀 One-Click Setup

**Get the entire system running with a single command:**

```bash
docker-compose up -d && sleep 5 && docker-compose exec app npm run seed && echo "✅ System ready at http://localhost:3456"
```

> **Note**: If you get a permission error, try running with sudo or ensure Docker has proper permissions.

**Alternative step-by-step approach:**

```bash
# Step 1: Start the containers
docker-compose up -d

# Step 2: Wait a moment for containers to be ready
sleep 5

# Step 3 (optional): Load sample data
docker-compose exec app npm run seed

# Step 4: Access the system
echo "✅ System ready at http://localhost:3456"
```

This will:
- Start PostgreSQL database and the application
- Run database migrations to set up tables
- Seed with sample data (employees, customers, items, orders)
- Launch the web interface at http://localhost:3456

## Features

- Equipment inventory management with atomic and composite items
- Customer and employee management with role-based access
- Order lifecycle management (Draft → Reserved → Checked Out → Returned)
- Automatic stock movement tracking with audit trails
- PDF receipt generation
- Calendar integration via ICS feeds
- Bill of Materials (BOM) support for equipment bundles

## Quick Start

### Development Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database configuration
```

3. Ensure database exists (non-Docker setups):
```bash
npm run db:ensure
```

4. Set up PostgreSQL schema and run migrations:
```bash
npm run migrate
```

5. Seed test data:
```bash
npm run seed
```

6. Start development server:
```bash
npm run dev
```

### Docker Deployment

1. Build and start with Docker Compose (uses named volume `postgres_data`):
```bash
docker-compose up -d
```

2. Migrations auto-run on startup; the app waits for the DB and then serves.
3. (Optional) Seed test data:
   - `docker-compose exec -e ALLOW_DESTRUCTIVE_SEED=true app npm run seed`

### Data Persistence & Backups

- Docker: the `db` service persists data in a Docker-managed named volume `postgres_data` (configured in `docker-compose.yml`). Data survives rebuilds and restarts.
- Manual backup:
  - `npm run db:backup` (writes to `.data/backups/`)
- Manual restore:
  - `npm run db:restore -- <path/to/backup.sql>`
- Non-Docker: ensure your Postgres instance persists data via its data directory; run `npm run db:ensure` once to create the database if missing.

### Troubleshooting (DB ownership/permissions)
- If you previously bound `./.data/postgres` and see `data directory ... has wrong ownership`, switch to the default named volume by using the main `docker-compose.yml` only, and remove the old bind folder:
  - `docker compose down`
  - `rm -rf ./.data/postgres` (only if you don't need that data)
  - `docker compose up -d`

## API Endpoints

- `/health` - Health check
- `/api/employees` - Employee management
- `/api/customers` - Customer management  
- `/api/items` - Item and inventory management
- `/api/orders` - Order management
- `/calendar.ics?token=...` - Calendar feed

## Using the System

### First Steps
1. **Access the web interface** at http://localhost:3456
2. **Explore the dashboard** to see sample data and system overview

### Key Features
- **Dashboard**: Real-time stats, recent orders, low stock alerts
- **Items**: Manage atomic items (with stock) and composite bundles
- **Orders**: Create orders, manage status transitions, generate receipts
- **Customers**: Customer information and order history
- **Employees**: Staff management with role-based permissions
- **Stock Movements**: Complete audit trail of inventory changes
- **Calendar**: Generate ICS feeds for external calendar integration

### Sample Data Included
- **5 Employees** with different roles (Admin, Staff, ReadOnly)
- **4 Customers** including active and inactive accounts  
- **10 Items** including laptops, monitors, bundles, and accessories
- **3 Sample Orders** in different statuses for testing
- **Stock Movements** showing order lifecycle tracking

## API Endpoints

- `/health` - Health check
- `/api/employees` - Employee management
- `/api/customers` - Customer management  
- `/api/items` - Item and inventory management
- `/api/orders` - Order management
- `/api/orders/:id/recalculate` - Recalculate order totals
- `/api/stock-movements` - Stock movement audit trail
- `/api/calendar` - Calendar token management
- `/calendar.ics?token=...` - Calendar feed
 - `/api/calendar/internal` - Internal schedule (Setup/Order/Cleanup blocks)

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `X_ADMIN_TOKEN` - Optional admin token for write operations
- `PORT` - Server port (default: 3456)
- `NODE_ENV` - Environment (development/production)

## Testing

Run the test suite:
```bash
npm test
```

Run tests with coverage:
```bash
npm test -- --coverage
```

## Troubleshooting

### Permission Issues
If you get a "permission denied" error when running Docker commands:

```bash
# Option 1: Run with sudo
sudo docker-compose up -d

# Option 2: Add your user to docker group (requires logout/login)
sudo usermod -aG docker $USER

# Option 3: Fix file permissions
sudo chown -R $USER:$USER .env
```

### Database Connection Issues
If the app can't connect to the database:

```bash
# Check if containers are running
docker-compose ps

# View app logs
docker-compose logs app

# Restart containers
docker-compose restart
```

### Port Already in Use
If port 3456 is already in use:

```bash
# Use a different port
PORT=3001 docker-compose up -d

# Or stop the conflicting service
sudo lsof -ti:3456 | xargs kill -9
```

### Starting Fresh
To completely reset the system:

```bash
# Stop and remove containers
docker-compose down -v

# Remove all data and start over  
docker-compose up -d
docker-compose exec app npm run migrate
docker-compose exec app npm run seed
```
### Running tests in Docker with saved logs

Use the test compose file to run Jest and persist logs to `.data/test-logs`:

```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from app-test
```

Artifacts:
- JSON: `.data/test-logs/<timestamp>/jest-results.json`
- Console: `.data/test-logs/<timestamp>/jest-console.log`
- Latest run shortcut: `.data/test-logs/latest/`
