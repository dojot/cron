// MOCKS
const mockConfigManager = {
  db: {
    'mongodb.url': ' ',
  },
  aptions: {},
  healthChecker: { 'kafka.interval.ms': 30000 },
};

const mockLogger = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};

const mockClient = {
  isConnected: jest.fn(),
  close: jest.fn(),
};

const mockAddHealthChecker = jest.fn();

const mockRegisterShutdownHandler = jest.fn();

const mockSignalReady = jest.fn();

const mockSignalNotReady = jest.fn();

const serviceStateMock = {
  addHealthChecker: mockAddHealthChecker,
  registerShutdownHandler: mockRegisterShutdownHandler,
  signalReady: mockSignalReady,
  signalNotReady: mockSignalNotReady,
};

jest.mock('../../src/Utils');

jest.mock('mongodb');
const {
  MongoClient: { connect },
} = require('mongodb');

jest.mock('../../src/Utils');

jest.mock('@dojot/microservice-sdk', () => ({
  Logger: jest.fn(() => mockLogger),
  ConfigManager: {
    getConfig: jest.fn(() => mockConfigManager),
    transformObjectKeys: jest.fn(),
  },
}));

const { DB } = require('../../src/external/db');

describe('DB', () => {
  let db;

  beforeEach(() => {
    db = new DB();

    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should successfully create a new instance', () => {
      expect(db.config).toEqual(mockConfigManager);
      expect(db.databases).toBeDefined();
      expect(db.logger).toBeDefined();
    });
  });

  describe('init', () => {
    it('should correctly initialize', async () => {
      db.init(serviceStateMock);

      expect(connect).toHaveBeenCalled();
      expect(db.logger).toBeDefined();
    });

    it('should not correctly initialize - Promise rejected', async () => {
      const reason = 'error';

      try {
        db.init(serviceStateMock);
      } catch (error) {
        expect(error).toEqual(reason);
      }
    });
  });

  describe('healthChecker', () => {
    let signalReady;
    let signalNotReady;
    let status;

    afterAll(() => {
      jest.clearAllMocks();
    });

    beforeEach(async () => {
      jest.clearAllMocks();
      signalReady = jest.fn();
      signalNotReady = jest.fn();
      status = jest.spyOn(db, 'status');
      connect.mockReturnValue(mockClient);
      await db.init(serviceStateMock);
    });

    it('should signal as ready - is connected to Kafka', async () => {
      status.mockReturnValue(Promise.resolve({ connected: true }));
      // await db.init(serviceStateMock);
      db.createHealthChecker();

      const callback = mockAddHealthChecker.mock.calls[0][1];
      await callback(signalReady, signalNotReady);

      expect(mockAddHealthChecker).toHaveBeenCalled();
      expect(signalNotReady).not.toHaveBeenCalled();
      expect(signalReady).toHaveBeenCalled();
    });

    it('should signal as not ready - is not connected to Kafka', async () => {
      status.mockReturnValue(Promise.resolve({ connected: false }));

      db.createHealthChecker();

      const callback = mockAddHealthChecker.mock.calls[0][1];
      await callback(signalReady, signalNotReady);

      expect(mockAddHealthChecker).toHaveBeenCalled();
      expect(signalReady).not.toHaveBeenCalled();
      expect(signalNotReady).toHaveBeenCalled();
    });
  });

  describe('shutdownHandler', () => {
    it('should call the disconnect function from the producer', async () => {
      await db.init(serviceStateMock);
      await db.registerShutdown();
      const callback = mockRegisterShutdownHandler.mock.calls[0][0];
      callback();
      expect(mockRegisterShutdownHandler).toHaveBeenCalled();
    });
  });
});
