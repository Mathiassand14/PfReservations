const adminTokenMiddleware = (req, res, next) => {
  // Skip auth for GET requests (read-only operations)
  if (req.method === 'GET') {
    return next();
  }

  // Skip auth if no admin token is configured
  const adminToken = process.env.X_ADMIN_TOKEN;
  if (!adminToken) {
    return next();
  }

  // Check for admin token in header for write operations
  const providedToken = req.headers['x-admin-token'];
  
  if (!providedToken) {
    return res.status(401).json({
      error: {
        code: 'MISSING_ADMIN_TOKEN',
        message: 'Admin token required for write operations'
      }
    });
  }

  if (providedToken !== adminToken) {
    return res.status(401).json({
      error: {
        code: 'INVALID_ADMIN_TOKEN',
        message: 'Invalid admin token'
      }
    });
  }

  next();
};

// Strict variant: require admin token for any method, including GET
const requireAdminToken = (req, res, next) => {
  const adminToken = process.env.X_ADMIN_TOKEN;
  if (!adminToken) {
    return next();
  }
  const providedToken = req.headers['x-admin-token'];
  if (!providedToken) {
    return res.status(401).json({
      error: { code: 'MISSING_ADMIN_TOKEN', message: 'Admin token required' }
    });
  }
  if (providedToken !== adminToken) {
    return res.status(401).json({
      error: { code: 'INVALID_ADMIN_TOKEN', message: 'Invalid admin token' }
    });
  }
  next();
};

const errorHandler = (error, req, res, next) => {
  console.error('API Error:', error);

  // Handle validation errors
  if (error.message.includes('Invalid') || error.message.includes('required')) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message
      }
    });
  }

  // Handle not found errors
  if (error.message.includes('not found')) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: error.message
      }
    });
  }

  // Handle availability conflicts
  if (error.message.includes('availability') || error.message.includes('conflict')) {
    return res.status(409).json({
      error: {
        code: 'AVAILABILITY_CONFLICT',
        message: error.message
      }
    });
  }

  // Handle database constraint violations
  if (error.code === '23505') { // Unique violation
    return res.status(409).json({
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'A record with this value already exists'
      }
    });
  }

  // Default server error
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    }
  });
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  adminTokenMiddleware,
  requireAdminToken,
  errorHandler,
  asyncHandler
};
