class Customer {
  constructor(data = {}) {
    this.id = data.id || null;
    this.displayName = data.display_name || data.displayName || '';
    this.organization = data.organization || null;
    this.contactInfo = data.contact_info || data.contactInfo || {};
    this.billingInfo = data.billing_info || data.billingInfo || {};
    this.isActive = data.is_active !== undefined ? data.is_active : data.isActive !== undefined ? data.isActive : true;
    this.createdAt = data.created_at || data.createdAt || null;
    this.updatedAt = data.updated_at || data.updatedAt || null;
  }

  // Validation methods
  validate() {
    const errors = [];

    if (!this.displayName || this.displayName.trim().length === 0) {
      errors.push('Display name is required');
    }

    if (this.displayName && this.displayName.length > 255) {
      errors.push('Display name must be 255 characters or less');
    }

    if (this.organization && this.organization.length > 255) {
      errors.push('Organization must be 255 characters or less');
    }

    // Validate contact info structure
    if (this.contactInfo && typeof this.contactInfo === 'object') {
      const contactValidation = this.validateContactInfo(this.contactInfo);
      if (!contactValidation.isValid) {
        errors.push(...contactValidation.errors);
      }
    }

    // Validate billing info structure
    if (this.billingInfo && typeof this.billingInfo === 'object') {
      const billingValidation = this.validateBillingInfo(this.billingInfo);
      if (!billingValidation.isValid) {
        errors.push(...billingValidation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  validateContactInfo(contactInfo) {
    const errors = [];

    if (contactInfo.email && !this.isValidEmail(contactInfo.email)) {
      errors.push('Contact email must be a valid email address');
    }

    if (contactInfo.phone && typeof contactInfo.phone !== 'string') {
      errors.push('Contact phone must be a string');
    }

    if (contactInfo.address && typeof contactInfo.address !== 'string') {
      errors.push('Contact address must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  validateBillingInfo(billingInfo) {
    const errors = [];

    if (billingInfo.billing_email && !this.isValidEmail(billingInfo.billing_email)) {
      errors.push('Billing email must be a valid email address');
    }

    if (billingInfo.tax_id && typeof billingInfo.tax_id !== 'string') {
      errors.push('Tax ID must be a string');
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

  // Business logic methods
  activate() {
    this.isActive = true;
  }

  deactivate() {
    this.isActive = false;
  }

  canCreateOrders() {
    return this.isActive;
  }

  updateContactInfo(newContactInfo) {
    const validation = this.validateContactInfo(newContactInfo);
    if (!validation.isValid) {
      throw new Error(`Invalid contact info: ${validation.errors.join(', ')}`);
    }
    this.contactInfo = { ...this.contactInfo, ...newContactInfo };
  }

  updateBillingInfo(newBillingInfo) {
    const validation = this.validateBillingInfo(newBillingInfo);
    if (!validation.isValid) {
      throw new Error(`Invalid billing info: ${validation.errors.join(', ')}`);
    }
    this.billingInfo = { ...this.billingInfo, ...newBillingInfo };
  }

  getContactEmail() {
    return this.contactInfo?.email || null;
  }

  getContactPhone() {
    return this.contactInfo?.phone || null;
  }

  getContactAddress() {
    return this.contactInfo?.address || null;
  }

  getBillingEmail() {
    return this.billingInfo?.billing_email || this.getContactEmail();
  }

  getTaxId() {
    return this.billingInfo?.tax_id || null;
  }

  getDisplayNameWithOrganization() {
    if (this.organization) {
      return `${this.displayName} (${this.organization})`;
    }
    return this.displayName;
  }

  // Data transformation methods
  toJSON() {
    return {
      id: this.id,
      displayName: this.displayName,
      organization: this.organization,
      contactInfo: this.contactInfo,
      billingInfo: this.billingInfo,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toDatabaseObject() {
    return {
      display_name: this.displayName,
      organization: this.organization || null,
      contact_info: Object.keys(this.contactInfo).length > 0 ? this.contactInfo : null,
      billing_info: Object.keys(this.billingInfo).length > 0 ? this.billingInfo : null,
      is_active: this.isActive
    };
  }

  static fromDatabaseRow(row) {
    return new Customer({
      ...row,
      contact_info: row.contact_info || {},
      billing_info: row.billing_info || {}
    });
  }

  static createContactInfoTemplate() {
    return {
      email: '',
      phone: '',
      address: ''
    };
  }

  static createBillingInfoTemplate() {
    return {
      billing_email: '',
      tax_id: ''
    };
  }
}

module.exports = Customer;