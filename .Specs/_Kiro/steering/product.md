# Product Overview

## Internal Equipment Rental & Stock Management App

A web-based application designed for internal networks to manage equipment rental operations and inventory tracking. The system handles both atomic items (individual pieces of equipment) and composite items (equipment bundles made from multiple components).

### Key Features
- Equipment inventory management with real-time availability tracking
- Customer and employee management with role-based access control
- Order lifecycle management (Draft → Reserved → Checked Out → Returned)
- Automatic stock movement tracking with audit trails
- PDF receipt generation for orders
- Calendar integration via ICS feeds for external calendar apps
- Bill of Materials (BOM) support for composite equipment bundles

### Target Environment
- Internal LAN/VPN deployment only
- No external authentication required
- PostgreSQL database backend
- Docker containerized deployment