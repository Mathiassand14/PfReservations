const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const { adminTokenMiddleware, errorHandler } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3456;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
}));

// CORS configuration for internal network access
app.use(cors({
  origin: true, // Allow all origins for internal network
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Admin token middleware removed; all API routes are open within internal network
// In tests, enforce admin token if configured
if (process.env.NODE_ENV === 'test') {
  app.use(adminTokenMiddleware);
}

// API routes
app.use('/api/employees', require('./routes/employees'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/items', require('./routes/items'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/stock-movements', require('./routes/stock-movements'));

// Calendar ICS feed endpoint (public, no auth required)
app.get('/calendar.ics', require('./routes/calendar-feed'));

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use(errorHandler);

// Start server unless under test (Supertest/Jest) — avoid port collisions
const isTestEnv = process.env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID !== 'undefined';
if (require.main === module && !isTestEnv) {
  app.listen(PORT, () => {
    console.log(`Equipment Rental Management Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}

module.exports = app;
