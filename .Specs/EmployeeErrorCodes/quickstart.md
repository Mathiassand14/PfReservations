Quickstart

Create employee with missing name

POST /api/employees
{ "email": "x@example.com", "role": "Staff" }

Response 400
{
  "error": {
    "code": "EMPLOYEE_VALIDATION_FAILED",
    "message": "Invalid employee data",
    "details": [
      { "code": "EMPLOYEE_FULL_NAME_REQUIRED", "field": "fullName", "message": "Full name is required" }
    ]
  }
}

Duplicate email

Response 409
{ "error": { "code": "EMPLOYEE_EMAIL_EXISTS", "message": "Employee with this email already exists" } }

