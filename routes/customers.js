const express = require('express');
const router = express.Router();
const { customerRepository, orderRepository } = require('../repositories');
const { Customer } = require('../models');
const { asyncHandler } = require('../middleware/auth');

function mapCustomerValidationErrors(errors = []) {
  const mapped = [];
  for (const msg of errors) {
    if (msg.includes('Display name is required')) {
      mapped.push({ code: 'CUSTOMER_DISPLAY_NAME_REQUIRED', field: 'displayName', message: msg });
    } else if (msg.includes('Display name must be 255')) {
      mapped.push({ code: 'CUSTOMER_DISPLAY_NAME_TOO_LONG', field: 'displayName', message: msg });
    } else if (msg.includes('Organization must be 255')) {
      mapped.push({ code: 'CUSTOMER_ORGANIZATION_TOO_LONG', field: 'organization', message: msg });
    } else if (msg.includes('Contact email must be a valid')) {
      mapped.push({ code: 'CUSTOMER_CONTACT_EMAIL_INVALID', field: 'contactInfo.email', message: msg });
    } else if (msg.includes('Contact phone must be a string')) {
      mapped.push({ code: 'CUSTOMER_CONTACT_PHONE_TYPE', field: 'contactInfo.phone', message: msg });
    } else if (msg.includes('Contact address must be a string')) {
      mapped.push({ code: 'CUSTOMER_CONTACT_ADDRESS_TYPE', field: 'contactInfo.address', message: msg });
    } else if (msg.includes('Billing email must be a valid')) {
      mapped.push({ code: 'CUSTOMER_BILLING_EMAIL_INVALID', field: 'billingInfo.billing_email', message: msg });
    } else if (msg.includes('Tax ID must be a string')) {
      mapped.push({ code: 'CUSTOMER_TAX_ID_TYPE', field: 'billingInfo.tax_id', message: msg });
    } else {
      mapped.push({ code: 'CUSTOMER_VALIDATION_ERROR', field: null, message: msg });
    }
  }
  return mapped;
}

// GET /api/customers - List all customers
router.get('/', asyncHandler(async (req, res) => {
  const { active, organization, search, limit = 50, offset = 0 } = req.query;
  
  let customers;
  
  if (search) {
    customers = await customerRepository.searchByName(search);
  } else if (organization) {
    customers = await customerRepository.findByOrganization(organization);
  } else if (active === 'true') {
    customers = await customerRepository.findActive();
  } else {
    customers = await customerRepository.findAll({
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy: 'display_name ASC'
    });
  }

  const customerObjects = customers.map(cust => Customer.fromDatabaseRow(cust).toJSON());
  
  res.json({
    customers: customerObjects,
    count: customerObjects.length
  });
}));

// GET /api/customers/top - Get top customers by revenue
router.get('/top', asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const topCustomers = await customerRepository.getTopCustomers(parseInt(limit));
  
  res.json({
    customers: topCustomers.map(cust => Customer.fromDatabaseRow(cust).toJSON()),
    count: topCustomers.length
  });
}));

// GET /api/customers/:id - Get customer by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const customer = await customerRepository.findById(req.params.id);
  
  if (!customer) {
    return res.status(404).json({
      error: {
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer not found'
      }
    });
  }

  const obj = Customer.fromDatabaseRow(customer).toJSON();
  res.json({ customer: obj, ...obj });
}));

// GET /api/customers/:id/details - Get customer with order statistics
router.get('/:id/details', asyncHandler(async (req, res) => {
  const customerDetails = await customerRepository.getCustomerWithOrders(req.params.id);
  
  if (!customerDetails) {
    return res.status(404).json({
      error: {
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer not found'
      }
    });
  }

  const obj = Customer.fromDatabaseRow(customerDetails).toJSON();
  res.json({ customer: obj, ...obj });
}));

// GET /api/customers/:id/orders - Get customer's order history
router.get('/:id/orders', asyncHandler(async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  
  const customer = await customerRepository.findById(req.params.id);
  if (!customer) {
    return res.status(404).json({
      error: {
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer not found'
      }
    });
  }

  const orders = await orderRepository.findByCustomer(req.params.id);
  
  res.json({
    customer: Customer.fromDatabaseRow(customer).toJSON(),
    orders: orders.slice(parseInt(offset), parseInt(offset) + parseInt(limit)),
    totalOrders: orders.length
  });
}));

// POST /api/customers - Create new customer (requires admin token)
router.post('/', asyncHandler(async (req, res) => {
  const customer = new Customer(req.body);
  
  const validation = customer.validate();
  if (!validation.isValid) {
    return res.status(400).json({
      error: {
        code: 'CUSTOMER_VALIDATION_FAILED',
        message: 'Invalid customer data',
        details: mapCustomerValidationErrors(validation.errors)
      }
    });
  }

  const createdCustomer = await customerRepository.create(customer.toDatabaseObject());
  const obj = Customer.fromDatabaseRow(createdCustomer).toJSON();
  res.status(201).json({ customer: obj, ...obj });
}));

// PUT /api/customers/:id - Update customer (requires admin token)
router.put('/:id', asyncHandler(async (req, res) => {
  const existingCustomer = await customerRepository.findById(req.params.id);
  if (!existingCustomer) {
    return res.status(404).json({
      error: {
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer not found'
      }
    });
  }

  const updatedData = { ...existingCustomer, ...req.body };
  const customer = Customer.fromDatabaseRow(updatedData);
  
  const validation = customer.validate();
  if (!validation.isValid) {
    return res.status(400).json({
      error: {
        code: 'CUSTOMER_VALIDATION_FAILED',
        message: 'Invalid customer data',
        details: mapCustomerValidationErrors(validation.errors)
      }
    });
  }

  const updatedCustomer = await customerRepository.update(req.params.id, customer.toDatabaseObject());
  const obj = Customer.fromDatabaseRow(updatedCustomer).toJSON();
  res.json({ customer: obj, ...obj });
}));

// PATCH /api/customers/:id/contact - Update customer contact info (requires admin token)
router.patch('/:id/contact', asyncHandler(async (req, res) => {
  const customer = await customerRepository.findById(req.params.id);
  if (!customer) {
    return res.status(404).json({
      error: {
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer not found'
      }
    });
  }

  const customerObj = Customer.fromDatabaseRow(customer);
  
  const contactValidation = customerObj.validateContactInfo(req.body || {});
  if (!contactValidation.isValid) {
    return res.status(400).json({
      error: {
        code: 'CUSTOMER_CONTACT_VALIDATION_FAILED',
        message: 'Invalid contact info',
        details: mapCustomerValidationErrors(contactValidation.errors)
      }
    });
  }
  customerObj.updateContactInfo(req.body);

  const updatedCustomer = await customerRepository.update(req.params.id, customerObj.toDatabaseObject());
  const obj = Customer.fromDatabaseRow(updatedCustomer).toJSON();
  res.json({ customer: obj, ...obj });
}));

// PATCH /api/customers/:id/billing - Update customer billing info (requires admin token)
router.patch('/:id/billing', asyncHandler(async (req, res) => {
  const customer = await customerRepository.findById(req.params.id);
  if (!customer) {
    return res.status(404).json({
      error: {
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer not found'
      }
    });
  }

  const customerObj = Customer.fromDatabaseRow(customer);
  
  const billingValidation = customerObj.validateBillingInfo(req.body || {});
  if (!billingValidation.isValid) {
    return res.status(400).json({
      error: {
        code: 'CUSTOMER_BILLING_VALIDATION_FAILED',
        message: 'Invalid billing info',
        details: mapCustomerValidationErrors(billingValidation.errors)
      }
    });
  }
  customerObj.updateBillingInfo(req.body);

  const updatedCustomer = await customerRepository.update(req.params.id, customerObj.toDatabaseObject());
  const obj = Customer.fromDatabaseRow(updatedCustomer).toJSON();
  res.json({ customer: obj, ...obj });
}));

// POST /api/customers/:id/activate - Activate customer (requires admin token)
router.post('/:id/activate', asyncHandler(async (req, res) => {
  const customer = await customerRepository.activate(req.params.id);
  
  if (!customer) {
    return res.status(404).json({
      error: {
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer not found'
      }
    });
  }

  res.json(Customer.fromDatabaseRow(customer).toJSON());
}));

// POST /api/customers/:id/deactivate - Deactivate customer (requires admin token)
router.post('/:id/deactivate', asyncHandler(async (req, res) => {
  const customer = await customerRepository.deactivate(req.params.id);
  
  if (!customer) {
    return res.status(404).json({
      error: {
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer not found'
      }
    });
  }

  res.json(Customer.fromDatabaseRow(customer).toJSON());
}));

// DELETE /api/customers/:id - Delete customer (requires admin token, only if no associated orders)
router.delete('/:id', asyncHandler(async (req, res) => {
  // First check if customer has any orders
  const orders = await orderRepository.findByCustomer(req.params.id);
  
  if (orders.length > 0) {
    return res.status(409).json({
      error: {
        code: 'CUSTOMER_HAS_ORDERS',
        message: 'Cannot delete customer with associated orders. Consider deactivating instead.'
      }
    });
  }

  const deletedCustomer = await customerRepository.delete(req.params.id);
  
  if (!deletedCustomer) {
    return res.status(404).json({
      error: {
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer not found'
      }
    });
  }

  const obj = Customer.fromDatabaseRow(deletedCustomer).toJSON();
  res.json({
    message: 'Customer deleted successfully',
    customer: obj,
    ...obj
  });
}));

module.exports = router;
