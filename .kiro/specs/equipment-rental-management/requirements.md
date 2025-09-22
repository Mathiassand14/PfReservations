# Requirements Document

## Introduction

This document outlines the requirements for an Internal Equipment Rental & Stock Management App - a web-based application designed for managing equipment loans within an organization. The system will handle inventory tracking with both atomic and composite items, customer management, order processing with automatic calculations, and calendar integration for reservation visibility. The application is designed for internal LAN/VPN deployment without requiring user authentication.

## Requirements

### Requirement 1

**User Story:** As a staff member, I want to manage inventory items with accurate stock counts, so that I can track equipment availability and prevent overbooking.

#### Acceptance Criteria

1. WHEN I create an atomic item THEN the system SHALL allow me to manually set and edit the quantity on hand
2. WHEN I create a composite item THEN the system SHALL automatically calculate stock quantity based on component availability using the formula: min(floor(on_hand(child)/qty_required))
3. WHEN I view a composite item's stock THEN the system SHALL display the calculated quantity as read-only with a "calculated" label
4. WHEN I add components to a composite item THEN the system SHALL prevent circular dependencies by checking for cycles
5. IF I attempt to create a cycle in the BOM THEN the system SHALL reject the operation and display an error message

### Requirement 2

**User Story:** As a staff member, I want to create and manage customer orders with automatic pricing calculations, so that I can efficiently process equipment rentals.

#### Acceptance Criteria

1. WHEN I create a new order THEN the system SHALL require customer selection, start date, return due date, and sales person assignment
2. WHEN I add items to an order THEN the system SHALL automatically calculate line totals using the formula: qty × price_per_day × rental_days
3. WHEN I change order status from Draft to Reserved THEN the system SHALL create stock movement records and update available quantities
4. WHEN I transition order status to Checked Out THEN the system SHALL create checkout stock movements
5. WHEN I transition order status to Returned THEN the system SHALL create return stock movements and update inventory
6. IF I attempt an invalid status transition THEN the system SHALL reject the change and maintain current status

### Requirement 3

**User Story:** As a staff member, I want to generate PDF receipts for orders, so that I can provide customers with detailed rental information.

#### Acceptance Criteria

1. WHEN I request a receipt for an order THEN the system SHALL generate a PDF containing order items, quantities, pricing, and total worth
2. WHEN generating a receipt THEN the system SHALL include customer contact information and sales person details
3. WHEN generating a receipt THEN the system SHALL include rental period dates and order status

### Requirement 4

**User Story:** As a staff member, I want to provide calendar feeds for equipment reservations, so that stakeholders can subscribe to and view upcoming rentals in their calendar applications.

#### Acceptance Criteria

1. WHEN I generate a calendar token THEN the system SHALL create a unique, unguessable token for ICS feed access
2. WHEN someone accesses the calendar feed with a valid token THEN the system SHALL return an ICS file with all relevant orders as events
3. WHEN creating calendar events THEN the system SHALL include order summary, customer name, worth, and sales person in the event details
4. WHEN creating calendar events THEN the system SHALL use different categories/colors based on order status (Draft, Reserved, Checked Out, Returned, Cancelled)
5. WHEN the calendar feed is accessed THEN the system SHALL cache the response for 1-2 minutes to optimize performance

### Requirement 5

**User Story:** As a staff member, I want to manage customer information and view their rental history, so that I can maintain relationships and track customer activity.

#### Acceptance Criteria

1. WHEN I create a customer record THEN the system SHALL require a display name and allow optional organization, contact, and billing information
2. WHEN I view a customer THEN the system SHALL display their complete rental history with order details
3. WHEN I update customer information THEN the system SHALL maintain data integrity across related orders
4. WHEN I deactivate a customer THEN the system SHALL prevent new orders while preserving historical data

### Requirement 6

**User Story:** As a staff member, I want to track all stock movements with an audit trail, so that I can maintain inventory accuracy and accountability.

#### Acceptance Criteria

1. WHEN order status changes affect inventory THEN the system SHALL automatically create stock movement records
2. WHEN I make manual inventory adjustments THEN the system SHALL create stock movement records with reason codes
3. WHEN creating stock movements THEN the system SHALL record the person making the change in free-text format
4. WHEN viewing stock movements THEN the system SHALL display chronological history with reasons and responsible parties

### Requirement 7

**User Story:** As an administrator, I want to manage employee directory information, so that I can assign sales personnel to orders and maintain contact information.

#### Acceptance Criteria

1. WHEN I create an employee record THEN the system SHALL require full name and allow optional email, phone, and role assignment
2. WHEN I assign roles THEN the system SHALL enforce role constraints (Admin, Staff, ReadOnly)
3. WHEN I deactivate an employee THEN the system SHALL prevent new assignments while preserving historical associations

### Requirement 8

**User Story:** As a system administrator, I want the application to run securely on internal networks without complex authentication, so that it can be easily deployed and maintained.

#### Acceptance Criteria

1. WHEN the application is deployed THEN it SHALL operate without requiring user login or session management
2. WHEN protecting administrative functions THEN the system SHALL optionally use a single X-Admin-Token header for mutating operations
3. WHEN accessing the application THEN it SHALL be restricted to LAN/VPN networks only
4. WHEN performing database operations THEN the system SHALL maintain data integrity through proper constraints and validation

### Requirement 9

**User Story:** As a staff member, I want the system to prevent inventory conflicts and provide accurate availability information, so that I can avoid double-booking equipment.

#### Acceptance Criteria

1. WHEN calculating available quantities THEN the system SHALL account for reserved and checked-out items
2. WHEN creating orders THEN the system SHALL validate item availability against current reservations
3. WHEN items are reserved THEN the system SHALL reduce available quantities for the reservation period
4. IF insufficient inventory is available THEN the system SHALL prevent order creation and display availability information