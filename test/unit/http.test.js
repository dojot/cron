const mockLogger = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};

const mockAxios = jest.fn();
jest.mock('axios', () => mockAxios);

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

const { HttpHandler } = require('../../src/external/http-handler');

const tenant = {
  id: 'tenant',
  session: {
    getTokenSet: () => ({
      access_token: 'access_token',
    }),
  },
};

const mockTenantManager = {
  findTenant: () => tenant,
};

describe('HttpHandler', () => {
  let httpHandler;

  beforeEach(() => {
    httpHandler = new HttpHandler(mockTenantManager);
  });

  describe('constructor', () => {
    it('should successfully create a new instance', () => {
      expect(httpHandler.config).toEqual(mockDefaultConfig);
      expect(httpHandler.logger).toBeDefined();
    });
  });

  describe('Send', () => {
    it('should  successfully send external HTTP request', async () => {
      expect.assertions(1);
      const fakeResponse = { data: { response: true } };
      mockAxios.mockResolvedValue(fakeResponse);
      const request = { internal: false };

      await httpHandler.send(0, request);
      expect(fakeResponse).toEqual(fakeResponse);
    });

    it('should successfully send internal HTTP request', async () => {
      expect.assertions(2);
      const fakeResponse = { data: { response: true } };
      mockAxios.mockResolvedValue(fakeResponse);
      const request = { headers: {}, internal: true };

      await httpHandler.send(tenant, request);
      expect(request.headers.authorization).toEqual('Bearer access_token');
      expect(fakeResponse).toEqual(fakeResponse);
    });
  });
});
