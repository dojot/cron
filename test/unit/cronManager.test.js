const mockConsumer = {
  finish: jest.fn(),
  getStatus: jest.fn(),
  init: jest.fn(),
  registerCallback: jest.fn(),
};

const mockProducer = {
  finish: jest.fn(),
  getStatus: jest.fn(),
  init: jest.fn(),
  connect: jest.fn(),
};

const mockDefaultConfig = {
  consumer: {},
  healthcheck: {
    'kafka.interval.ms': 30000,
  },
  dojot: {
    'subjects.tenancy': 'test',
  },
  sdk: {},
  topic: {},
  actions: {
    'broker.allowed.subjects': ['dojot.device-manager.device', 'device-data'],
  },
  db: {
    'mongodb.url': '',
  },
  dbOptions: {
    useNewUrlParser: true,
  },
  healthChecker: { 'kafka.interval.ms': 30000 },
};

const mockLogger = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
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

jest.mock('@dojot/microservice-sdk', () => ({
  ConfigManager: {
    getConfig: jest.fn(() => mockDefaultConfig),
  },
  Kafka: {
    Consumer: jest.fn(() => mockConsumer),
    Producer: jest.fn(() => mockProducer),
  },
  Logger: jest.fn(() => mockLogger),
}));

jest.mock('../../app/Utils', () => ({
  killApplication: jest.fn(),
}));

const { killApplication } = require('../../app/Utils');

const { CronManager } = require('../../app/cron');

describe('Cron', () => {
  let cronManager;

  beforeEach(() => {
    cronManager = new CronManager(serviceStateMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should successfully create an Cron Manager', () => {
      expect(cronManager.serviceState).toEqual(serviceStateMock);
      expect(cronManager.wasInitialized).toBeFalsy();
    });
  });

  describe('init', () => {
    it('should successfully initialize the Cron Manager', async () => {
      mockConsumer.init.mockReturnValue(Promise.resolve());
      mockConsumer.registerCallback('test', () => {});

      await cronManager.init();

      expect(mockConsumer.registerCallback).toHaveBeenCalled();
      //   expect(serviceStateMock.signalReady).toHaveBeenCalled();
    });

    it('should not initialize the Cron Manager - Consumer is already initialized', async () => {
      // Faster way for faking the initialization
      cronManager.wasInitialized = true;

      await cronManager.init();

      expect(mockConsumer.init).not.toHaveBeenCalled();
    });

    it('should fail the initialization of the Cron Manager', async () => {
      mockConsumer.init.mockReturnValue(Promise.reject(new Error('fakeError')));

      await cronManager.init();

      expect(mockConsumer.registerCallback).not.toHaveBeenCalled();
      expect(killApplication).toHaveBeenCalled();
    });
  });

  describe('finish', () => {
    beforeEach(async (done) => {
      jest.clearAllMocks();
      await cronManager.init();
      done();
    });

    it('should finish the consumer', async () => {
      mockConsumer.finish.mockResolvedValueOnce();

      await cronManager.finish();

      expect(mockConsumer.finish).toHaveBeenCalled();
      expect(cronManager.consumer).toBeUndefined();
      expect(cronManager.wasInitialized).toBeFalsy();
    });
  });

  describe('healthChecker', () => {
    let signalReady;
    let signalNotReady;

    afterAll(() => {
      jest.clearAllMocks();
    });

    beforeEach(async () => {
      jest.clearAllMocks();
      signalReady = jest.fn();
      signalNotReady = jest.fn();
      await cronManager.init();
    });

    it('should signal as ready - is connected to Kafka', async () => {
      mockConsumer.getStatus.mockReturnValue(
        Promise.resolve({ connected: true })
      );

      cronManager.createHealthChecker();

      const callback = mockAddHealthChecker.mock.calls[0][1];
      await callback(signalReady, signalNotReady);

      expect(mockAddHealthChecker).toHaveBeenCalled();
      expect(signalNotReady).not.toHaveBeenCalled();
      expect(signalReady).toHaveBeenCalled();
    });

    it('should signal as not ready - is not connected to Kafka', async () => {
      mockConsumer.getStatus.mockReturnValue(
        Promise.resolve({ connected: false })
      );

      cronManager.createHealthChecker();

      const callback = mockAddHealthChecker.mock.calls[0][1];
      await callback(signalReady, signalNotReady);

      expect(mockAddHealthChecker).toHaveBeenCalled();
      expect(signalReady).not.toHaveBeenCalled();
      expect(signalNotReady).toHaveBeenCalled();
    });
  });

  describe('shutdownHandler', () => {
    test('should successfully finish', async () => {
      await cronManager.registerShutdown();
      const callback = mockRegisterShutdownHandler.mock.calls[0][0];
      callback();
      expect(mockRegisterShutdownHandler).toHaveBeenCalled();
    });
  });

  describe('_makeKey', () => {
    it('should successfully return key', async () => {
      // eslint-disable-next-line no-underscore-dangle
      const key = cronManager._makeKey('test', '123');
      expect(key).toBe('test:123');
    });
  });
});
