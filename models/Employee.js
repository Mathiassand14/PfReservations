class Employee {
  constructor(data = {}) {
    this.id = data.id || null;
    this.fullName = data.full_name || data.fullName || '';
    // Accept split name fields from UI
    const first = data.first_name || data.firstName || '';
    const last = data.last_name || data.lastName || '';
    if ((!this.fullName || this.fullName.trim().length === 0) && (first || last)) {
      this.fullName = [first, last].filter(Boolean).join(' ').trim();
    }
    this.email = data.email || '';
    this.phone = data.phone || '';
    this.role = data.role || 'ReadOnly';
    this.isActive = data.is_active !== undefined ? data.is_active : data.isActive !== undefined ? data.isActive : true;
    this.createdAt = data.created_at || data.createdAt || null;
    this.updatedAt = data.updated_at || data.updatedAt || null;
  }

  // Validation methods
  validate() {
    const errors = [];

    if (!this.fullName || this.fullName.trim().length === 0) {
      errors.push('Full name is required');
    }

    if (this.fullName && this.fullName.length > 255) {
      errors.push('Full name must be 255 characters or less');
    }

    if (this.email && !this.isValidEmail(this.email)) {
      errors.push('Email must be a valid email address');
    }

    if (this.email && this.email.length > 255) {
      errors.push('Email must be 255 characters or less');
    }

    if (!this.isValidRole(this.role)) {
      errors.push('Role must be one of: Admin, Staff, ReadOnly');
    }

    if (this.phone && this.phone.length > 50) {
      errors.push('Phone must be 50 characters or less');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidRole(role) {
    const validRoles = ['Admin', 'Staff', 'ReadOnly'];
    return validRoles.includes(role);
  }

  // Permission methods
  canManageEmployees() {
    return this.role === 'Admin';
  }

  canManageCustomers() {
    return this.role === 'Admin' || this.role === 'Staff';
  }

  canManageItems() {
    return this.role === 'Admin' || this.role === 'Staff';
  }

  canManageOrders() {
    return this.role === 'Admin' || this.role === 'Staff';
  }

  canViewReports() {
    return this.role === 'Admin' || this.role === 'Staff';
  }

  canPerformStockAdjustments() {
    return this.role === 'Admin' || this.role === 'Staff';
  }

  canManageCalendarTokens() {
    return this.role === 'Admin';
  }

  hasWriteAccess() {
    return this.role === 'Admin' || this.role === 'Staff';
  }

  hasReadOnlyAccess() {
    return this.role === 'ReadOnly';
  }

  // Business logic methods
  activate() {
    this.isActive = true;
  }

  deactivate() {
    this.isActive = false;
  }

  updateRole(newRole) {
    if (!this.isValidRole(newRole)) {
      throw new Error('Invalid role specified');
    }
    this.role = newRole;
  }

  // Data transformation methods
  toJSON() {
    // Derive first/last for UI compatibility
    let firstName = '';
    let lastName = '';
    if (this.fullName && this.fullName.trim().length > 0) {
      const trimmed = this.fullName.trim();
      const idx = trimmed.lastIndexOf(' ');
      if (idx > 0) {
        firstName = trimmed.substring(0, idx);
        lastName = trimmed.substring(idx + 1);
      } else {
        firstName = trimmed;
      }
    }

    return {
      id: this.id,
      fullName: this.fullName,
      firstName,
      lastName,
      email: this.email,
      phone: this.phone,
      role: this.role,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toDatabaseObject() {
    return {
      full_name: this.fullName,
      email: this.email || null,
      phone: this.phone || null,
      role: this.role,
      is_active: this.isActive
    };
  }

  static fromDatabaseRow(row) {
    return new Employee(row);
  }

  static getValidRoles() {
    return ['Admin', 'Staff', 'ReadOnly'];
  }

  static getRolePermissions() {
    return {
      Admin: {
        canManageEmployees: true,
        canManageCustomers: true,
        canManageItems: true,
        canManageOrders: true,
        canViewReports: true,
        canPerformStockAdjustments: true,
        canManageCalendarTokens: true
      },
      Staff: {
        canManageEmployees: false,
        canManageCustomers: true,
        canManageItems: true,
        canManageOrders: true,
        canViewReports: true,
        canPerformStockAdjustments: true,
        canManageCalendarTokens: false
      },
      ReadOnly: {
        canManageEmployees: false,
        canManageCustomers: false,
        canManageItems: false,
        canManageOrders: false,
        canViewReports: false,
        canPerformStockAdjustments: false,
        canManageCalendarTokens: false
      }
    };
  }
}

module.exports = Employee;
