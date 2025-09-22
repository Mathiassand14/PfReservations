const EmployeeRepository = require('./EmployeeRepository');
const CustomerRepository = require('./CustomerRepository');
const ItemRepository = require('./ItemRepository');
const OrderRepository = require('./OrderRepository');
const OrderRowRepository = require('./OrderRowRepository');
const OrderLineRepository = require('./OrderLineRepository');
const StockMovementRepository = require('./StockMovementRepository');
const CalendarTokenRepository = require('./CalendarTokenRepository');
const PriceRepository = require('./PriceRepository');
const RebateGroupRepository = require('./RebateGroupRepository');

// Create singleton instances
const employeeRepository = new EmployeeRepository();
const customerRepository = new CustomerRepository();
const itemRepository = new ItemRepository();
const orderRepository = new OrderRepository();
const orderRowRepository = new OrderRowRepository();
const orderLineRepository = new OrderLineRepository();
const stockMovementRepository = new StockMovementRepository();
const calendarTokenRepository = new CalendarTokenRepository();
const priceRepository = new PriceRepository();
const rebateGroupRepository = new RebateGroupRepository();

module.exports = {
  employeeRepository,
  customerRepository,
  itemRepository,
  orderRepository,
  orderRowRepository,
  orderLineRepository,
  stockMovementRepository,
  calendarTokenRepository,
  priceRepository,
  rebateGroupRepository
};
