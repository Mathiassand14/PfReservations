Plan

Steps:
1) Add mapper in routes/employees.js to convert validation messages into { code, field, message }.
2) Use mapper for POST and PUT responses (400s), and refine duplicate email code to EMPLOYEE_EMAIL_EXISTS.
3) Enhance public/api.js to surface error.code/details; update employee save flow to display details.

Notes:
- Avoids changing model.validate() contract to preserve existing tests.
- Can extend to other resources later.

