// Test setup and global configurations

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  // Uncomment to disable logging during tests
  // log: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Global test utilities
global.delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Setup and teardown for database tests
beforeAll(async () => {
  // Database setup would go here if using a test database
});

afterAll(async () => {
  // Database cleanup would go here
});