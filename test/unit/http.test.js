const { HttpHandler } = require('../../app/http');
const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');

const mockConfigManager = {
  actions: {
    'broker.allowedSubjects': ['dojot.device-manager.device', 'device-data'],
  },
};

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

jest.mock('mongodb');

describe('HttpHandler', () => {
  let httpHandler;

  beforeEach(() => {
    httpHandler = new HttpHandler();
  });

  describe('constructor', () => {
    it('should successfully create a new instance', () => {
      expect(httpHandler.config).toEqual(mockDefaultConfig);
      expect(httpHandler.logger).toBeDefined();
    });
  });

  describe('Send', () => {
    it('should  successfully send HTTP request', () => {
      var mock = new MockAdapter(axios);
      const data = { response: true };
      mock
        .onGet('https://us-central1-hutoma-backend.cloudfunctions.net/chat')
        .reply(200, data);

      httpHandler.send(0, 'any').then((response) => {
        expect(response).toEqual(data);
        done();
      });
    });
  });
});
