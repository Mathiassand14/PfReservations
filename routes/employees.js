const express = require('express');
const router = express.Router();
const { employeeRepository } = require('../repositories');
const { Employee } = require('../models');
const { asyncHandler } = require('../middleware/auth');

// GET /api/employees - List all employees
router.get('/', asyncHandler(async (req, res) => {
  const { active, role, search, limit = 50, offset = 0 } = req.query;
  
  let employees;
  
  if (search) {
    employees = await employeeRepository.searchByName(search);
  } else if (role) {
    employees = await employeeRepository.findByRole(role);
  } else if (active === 'true') {
    employees = await employeeRepository.findActive();
  } else {
    employees = await employeeRepository.findAll({
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy: 'full_name ASC'
    });
  }

  const employeeObjects = employees.map(emp => Employee.fromDatabaseRow(emp).toJSON());
  
  res.json({
    employees: employeeObjects,
    count: employeeObjects.length
  });
}));

// GET /api/employees/stats - Get employee statistics
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await employeeRepository.getEmployeeStats();
  res.json({ stats });
}));

// GET /api/employees/:id - Get employee by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const employee = await employeeRepository.findById(req.params.id);
  
  if (!employee) {
    return res.status(404).json({
      error: {
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'Employee not found'
      }
    });
  }

  const obj = Employee.fromDatabaseRow(employee).toJSON();
  res.json({ employee: obj, ...obj });
}));

function mapEmployeeValidationErrors(errors = []) {
  const mapped = [];
  for (const msg of errors) {
    if (msg.includes('Full name is required')) {
      mapped.push({ code: 'EMPLOYEE_FULL_NAME_REQUIRED', field: 'fullName', message: msg });
    } else if (msg.includes('Full name must be 255')) {
      mapped.push({ code: 'EMPLOYEE_FULL_NAME_TOO_LONG', field: 'fullName', message: msg });
    } else if (msg.includes('Email must be a valid')) {
      mapped.push({ code: 'EMPLOYEE_EMAIL_INVALID', field: 'email', message: msg });
    } else if (msg.includes('Email must be 255')) {
      mapped.push({ code: 'EMPLOYEE_EMAIL_TOO_LONG', field: 'email', message: msg });
    } else if (msg.includes('Role must be one of')) {
      mapped.push({ code: 'EMPLOYEE_ROLE_INVALID', field: 'role', message: msg });
    } else if (msg.includes('Phone must be 50')) {
      mapped.push({ code: 'EMPLOYEE_PHONE_TOO_LONG', field: 'phone', message: msg });
    } else {
      mapped.push({ code: 'EMPLOYEE_VALIDATION_ERROR', field: null, message: msg });
    }
  }
  return mapped;
}

// POST /api/employees - Create new employee (requires admin token)
router.post('/', asyncHandler(async (req, res) => {
  const employee = new Employee(req.body);
  
  const validation = employee.validate();
  if (!validation.isValid) {
    return res.status(400).json({
      error: {
        code: 'EMPLOYEE_VALIDATION_FAILED',
        message: 'Invalid employee data',
        details: mapEmployeeValidationErrors(validation.errors)
      }
    });
  }

  // Check if email already exists (if provided)
  if (employee.email) {
    const existingEmployee = await employeeRepository.findByEmail(employee.email);
    if (existingEmployee) {
      return res.status(409).json({
        error: {
          code: 'EMPLOYEE_EMAIL_EXISTS',
          message: 'Employee with this email already exists'
        }
      });
    }
  }

  const createdEmployee = await employeeRepository.create(employee.toDatabaseObject());
  const obj = Employee.fromDatabaseRow(createdEmployee).toJSON();
  res.status(201).json({ employee: obj, ...obj });
}));

// PUT /api/employees/:id - Update employee (requires admin token)
router.put('/:id', asyncHandler(async (req, res) => {
  const existingEmployee = await employeeRepository.findById(req.params.id);
  if (!existingEmployee) {
    return res.status(404).json({
      error: {
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'Employee not found'
      }
    });
  }

  const updatedData = { ...existingEmployee, ...req.body };
  const employee = Employee.fromDatabaseRow(updatedData);
  
  const validation = employee.validate();
  if (!validation.isValid) {
    return res.status(400).json({
      error: {
        code: 'EMPLOYEE_VALIDATION_FAILED',
        message: 'Invalid employee data',
        details: mapEmployeeValidationErrors(validation.errors)
      }
    });
  }

  // Check if email already exists (if being changed)
  if (employee.email && employee.email !== existingEmployee.email) {
    const existingByEmail = await employeeRepository.findByEmail(employee.email);
    if (existingByEmail && existingByEmail.id !== parseInt(req.params.id)) {
      return res.status(409).json({
        error: {
          code: 'EMPLOYEE_EMAIL_EXISTS',
          message: 'Employee with this email already exists'
        }
      });
    }
  }

  const updatedEmployee = await employeeRepository.update(req.params.id, employee.toDatabaseObject());
  const obj = Employee.fromDatabaseRow(updatedEmployee).toJSON();
  res.json({ employee: obj, ...obj });
}));

// POST /api/employees/:id/activate - Activate employee (requires admin token)
router.post('/:id/activate', asyncHandler(async (req, res) => {
  const employee = await employeeRepository.activate(req.params.id);
  
  if (!employee) {
    return res.status(404).json({
      error: {
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'Employee not found'
      }
    });
  }

  const obj = Employee.fromDatabaseRow(employee).toJSON();
  res.json({ employee: obj, ...obj });
}));

// POST /api/employees/:id/deactivate - Deactivate employee (requires admin token)
router.post('/:id/deactivate', asyncHandler(async (req, res) => {
  const employee = await employeeRepository.deactivate(req.params.id);
  
  if (!employee) {
    return res.status(404).json({
      error: {
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'Employee not found'
      }
    });
  }

  const obj = Employee.fromDatabaseRow(employee).toJSON();
  res.json({ employee: obj, ...obj });
}));

// DELETE /api/employees/:id - Delete employee (requires admin token, only if no associated orders)
router.delete('/:id', asyncHandler(async (req, res) => {
  // First check if employee has any orders
  const { orderRepository } = require('../repositories');
  const orders = await orderRepository.getOrdersByEmployee(req.params.id);
  
  if (orders.length > 0) {
    return res.status(409).json({
      error: {
        code: 'EMPLOYEE_HAS_ORDERS',
        message: 'Cannot delete employee with associated orders. Consider deactivating instead.'
      }
    });
  }

  const deletedEmployee = await employeeRepository.delete(req.params.id);
  
  if (!deletedEmployee) {
    return res.status(404).json({
      error: {
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'Employee not found'
      }
    });
  }

  const obj = Employee.fromDatabaseRow(deletedEmployee).toJSON();
  res.json({
    message: 'Employee deleted successfully',
    employee: obj,
    ...obj
  });
}));

module.exports = router;
