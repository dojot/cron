const mockLogger = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};

const mockMockronManager = {
  JobNotFound: jest.fn(),
};

const mockDefaultConfig = {
  actions: {},
};

const { Logger } = require('@dojot/microservice-sdk');

jest.mock('@dojot/microservice-sdk', () => ({
  ConfigManager: {
    getConfig: jest.fn(() => mockDefaultConfig),
    loadSettings: jest.fn(),
  },
  Kafka: {
    Consumer: jest.fn(),
  },
  Logger: jest.fn(() => mockLogger),
}));

const routes = require('../../src/app/api')(mockMockronManager, Logger);

describe('CreateModule', () => {
  it('should  successfully return an array of routes', () => {
    expect(routes).toBeTruthy();
    expect(typeof routes).toBe('object');
  });
});
