# Equipment Rental Management - Deployment Guide

## Prerequisites

- Docker and Docker Compose
- PostgreSQL 15+ (if not using Docker)
- Node.js 18+ (if not using Docker)

## Docker Deployment (Recommended)

### Quick Start

1. Clone the repository and navigate to the project directory
2. Copy the environment configuration:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` file with your production settings:
   - Change `X_ADMIN_TOKEN` to a secure random token
   - Update database credentials if needed
   - Set appropriate network configuration

4. Start the application:
   ```bash
   docker-compose up -d
   ```

5. (Optional) Seed with sample data:
   ```bash
   docker-compose exec app npm run seed
   ```

The application will be available at http://localhost:3456. Migrations auto-run on container start.

### Production Configuration

For production deployment:

1. **Database**: Use an external PostgreSQL instance for better reliability
2. **Admin Token**: Generate a strong random token
3. **Network**: Configure firewall rules for internal LAN/VPN access only
4. **Backups**: Set up regular database backups
5. **Monitoring**: Monitor container health and application logs

Example production docker-compose.yml:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3456:3456"
    environment:
      - DATABASE_URL=postgresql://user:pass@external-db:5432/equipment_rental
      - X_ADMIN_TOKEN=${X_ADMIN_TOKEN}
      - NODE_ENV=production
    restart: unless-stopped
    depends_on:
      - db
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3456/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"]
      interval: 30s
      timeout: 3s
      retries: 3
```

## Manual Deployment

### Database Setup

1. Create PostgreSQL database:
   ```sql
   CREATE DATABASE equipment_rental;
   CREATE USER equipment_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE equipment_rental TO equipment_user;
   ```

2. Set environment variables:
   ```bash
   export DATABASE_URL=postgresql://equipment_user:secure_password@localhost:5432/equipment_rental
   export X_ADMIN_TOKEN=your-secure-admin-token
   export NODE_ENV=production
   ```

### Application Setup

1. Install dependencies:
   ```bash
   npm install --only=production
   ```

2. Run database migrations:
   ```bash
   npm run migrate
   ```

3. (Optional) Seed database:
   ```bash
   npm run seed
   ```

4. Start application:
   ```bash
   npm start
   ```

## Security Considerations

### Admin Token Protection

The application supports optional admin token protection for write operations:

- **No Token**: All operations allowed (development mode)
- **Token Set**: Write operations require `X-Admin-Token` header
- **Frontend**: Stores admin token in localStorage for convenience

### Network Security

- Deploy on internal LAN/VPN networks only
- Use firewall rules to restrict access
- Consider reverse proxy with SSL termination for HTTPS

### Database Security

- Use strong passwords
- Enable PostgreSQL SSL in production
- Regular security updates
- Database backups with encryption

## Monitoring and Maintenance

### Health Checks

The application provides a health check endpoint at `/health`:

```bash
curl http://localhost:3456/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

### Logs

Application logs are written to stdout/stderr. In Docker:

```bash
docker-compose logs -f app
```

### Database Maintenance

- Monitor database size and performance
- Regular VACUUM and ANALYZE operations
- Archive old stock movements and completed orders as needed

### Backup Strategy

1. **Database Backups**: Daily automated backups
2. **Configuration**: Backup environment files
3. **Application**: Version control handles code backups

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Check DATABASE_URL configuration
   - Verify PostgreSQL is running
   - Check network connectivity

2. **Permission Denied Errors**:
   - Verify admin token configuration
   - Check X-Admin-Token header in requests

3. **Port Already in Use**:
   - Change PORT environment variable
   - Check for other applications on port 3000

### Support

- Check application logs for error messages
- Verify environment configuration
- Test database connectivity separately
- Review Docker container health status

## API Documentation

The application provides REST APIs for:

- **Employees**: `/api/employees`
- **Customers**: `/api/customers`  
- **Items**: `/api/items`
- **Orders**: `/api/orders`
- **Calendar**: `/api/calendar`
- **Stock Movements**: `/api/stock-movements`

All write operations (POST, PUT, PATCH, DELETE) require admin token when configured.

## Calendar Integration

The application provides ICS calendar feeds:

1. Create calendar token via web interface
2. Copy ICS feed URL
3. Import into calendar application (Google Calendar, Outlook, etc.)

Feed URL format: `http://your-server:3000/calendar.ics?token=your-token`
