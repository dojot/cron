const mockProcess = require('jest-mock-process');

const mockExit = mockProcess.mockProcessExit();

// MOCKS
const mock = {
  ConfigManager: {
    db: {
      'mongodb.url': ' ',
      aptions: {},
    },
  },
  Logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
  ServiceStateManager: {
    registerService: jest.fn(),
    registerShutdownHandler: jest.fn(),
    addHealthChecker: jest.fn(),
    signalNotReady: jest.fn(),
    signalReady: jest.fn(),
  },
  Client: {
    close: jest.fn(),
  },
};

jest.mock('mongodb');
const {
  MongoClient: { connect },
} = require('mongodb');

jest.mock('../../app/Utils');

jest.mock('@dojot/microservice-sdk', () => ({
  Logger: jest.fn(() => mock.Logger),
  ConfigManager: {
    getConfig: jest.fn(() => mock.ConfigManager),
    transformObjectKeys: jest.fn(),
  },
}));

const { DB } = require('./../../app/db');

describe('DB', () => {
  let db;

  beforeEach(() => {
    db = new DB(mock.ServiceStateManager);

    jest.clearAllMocks();
  });

  afterAll(() => {
    mockExit.mockRestore();
  });

  describe('constructor', () => {
    it('should successfully create a new instance', () => {
      expect(db.config).toEqual(mock.ConfigManager);
      expect(db.databases).toBeDefined();
      expect(db.logger).toBeDefined();
    });
  });

  describe('init', () => {
    it('should correctly initialize', async () => {
      db.init();

      expect(connect).toHaveBeenCalled();
      expect(db.logger).toBeDefined();
    });

    it('should not correctly initialize - Promise rejected', async () => {
      const reason = 'error';

      try {
        db.init();
      } catch (error) {
        expect(error).toEqual(reason);
      }
    });
  });

  describe('healthChecker', () => {
    let signalReady;
    let signalNotReady;

    afterAll(() => {
      mockExit.mockRestore();
    });

    beforeEach(() => {
      signalReady = jest.fn();
      signalNotReady = jest.fn();
      db = new DB(mock.ServiceStateManager);
      jest.clearAllMocks();
    });

    it('should signal as not ready - is not connected to Kafka', async () => {
      db.init();
      await db.healthChecker(signalReady, signalNotReady);

      expect(signalNotReady).toHaveBeenCalled();
    });

    it('should signal as not ready - Promise was rejected', async () => {
      db.init();
      await db.healthChecker(signalReady, signalNotReady);

      expect(signalNotReady).toHaveBeenCalled();
    });
  });
});
