Title: Employee API — Structured Error Codes

Status: Accepted

Summary:
- Improve POST/PUT /api/employees error responses with structured, field-specific codes while preserving human-readable messages.

Acceptance Criteria:
- When validation fails on employee create/update, API returns 400 with:
  - error.code = 'EMPLOYEE_VALIDATION_FAILED'
  - error.details = array of { code, field, message }
  - Known codes include: EMPLOYEE_FULL_NAME_REQUIRED, EMPLOYEE_FULL_NAME_TOO_LONG, EMPLOYEE_EMAIL_INVALID, EMPLOYEE_EMAIL_TOO_LONG, EMPLOYEE_ROLE_INVALID, EMPLOYEE_PHONE_TOO_LONG.
- Duplicate email returns 409 with error.code = 'EMPLOYEE_EMAIL_EXISTS'.

Out of Scope:
- Changing model validation return type; mapping occurs at route layer.
- UI redesign; minimal improvement to show error details appended.

