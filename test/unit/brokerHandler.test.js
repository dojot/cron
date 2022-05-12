const { BrokerProducer } = require('../../src/app/broker-producer');

let mockShouldResolve;
let resolveMock;
let rejectMock;

// MOCKS
const mockConfigManager = {
  messenger: {
    'produce.topic.suffix': 'device-data',
  },
  producer: {
    acks: -1,
  },
  sdkProducer: {
    'batch.num.messages': 100,
  },
  topic: {
    acks: -1,
  },
  healthChecker: { 'kafka.interval.ms': 30000 },
  actions: {
    'broker.allowed.subjects': ['dojot.device-manager.device', 'device-data'],
  },
};

const mockLogger = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};

const mockProducer = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  getStatus: jest.fn(),
  // eslint-disable-next-line no-unused-vars
  produce: jest.fn(
    () =>
      new Promise((resolve, reject) => {
        // eslint-disable-next-line no-param-reassign
        resolve = jest.fn(resolve);
        // eslint-disable-next-line no-param-reassign
        reject = jest.fn(reject);
        resolveMock = resolve;
        rejectMock = reject;

        if (mockShouldResolve) {
          resolve();
        } else {
          reject(new Error('testError'));
        }
      })
  ),
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
  Kafka: {
    Producer: jest.fn(() => mockProducer),
  },
  Logger: jest.fn(() => mockLogger),
  ConfigManager: {
    getConfig: jest.fn(() => mockConfigManager),
  },
}));

jest.mock('../../src/Utils');

describe('BrokerHandler', () => {
  let brokerHandler;

  beforeEach(async () => {
    brokerHandler = new BrokerProducer();
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.clearAllMocks();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should successfully create a new instance', () => {
      expect(brokerHandler.config).toEqual(mockConfigManager);
      expect(brokerHandler.producer).toBeDefined();
      expect(brokerHandler.logger).toBeDefined();
    });
  });

  describe('init', () => {
    it('should correctly initialize', async () => {
      mockProducer.connect.mockReturnValue(Promise.resolve());

      await brokerHandler.init(serviceStateMock);

      expect(mockProducer.connect).toHaveBeenCalled();
      expect(brokerHandler.logger).toBeDefined();
    });

    it('should not correctly initialize - Promise rejected', async () => {
      const reason = 'error';
      mockProducer.connect.mockReturnValue(Promise.reject(reason));

      try {
        await brokerHandler.init(serviceStateMock);
      } catch (error) {
        expect(error).toEqual(reason);
      }
    });
  });

  describe('send', () => {
    const fakeMessage =
      '"message": { "event": "configure", "data": { "attrs": { "message": "keepalive" }, "id": "c2b1a2" }, "meta": { "service": "admin" } }';

    it('should send message', async () => {
      mockShouldResolve = true;

      await brokerHandler.init(serviceStateMock);

      brokerHandler.send('test', fakeMessage);

      expect(brokerHandler.producer.produce).toHaveBeenCalled();
      expect(resolveMock).toHaveBeenCalled();
    });

    it('should not send the message - rejected Promise', async () => {
      expect.assertions(3);
      mockShouldResolve = false;

      await brokerHandler.init(serviceStateMock);
      try {
        await brokerHandler.send('test', fakeMessage);
      } catch (error) {
        expect(error).toBeDefined();
      }

      expect(brokerHandler.producer.produce).toHaveBeenCalled();
      expect(rejectMock).toHaveBeenCalled();
    });

    it('should not send the message - malformed message', async () => {
      try {
        await brokerHandler.send('test', 'error format');
      } catch (error) {
        expect(error).toBeDefined();
      } finally {
        expect(mockProducer.produce).not.toHaveBeenCalled();
      }
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
      mockProducer.connect.mockReturnValue(Promise.resolve());
      await brokerHandler.init(serviceStateMock);
    });

    it('should signal as ready - is connected to Kafka', async () => {
      mockProducer.getStatus.mockReturnValue(
        Promise.resolve({ connected: true })
      );

      brokerHandler.createHealthChecker();

      const callback = mockAddHealthChecker.mock.calls[0][1];
      await callback(signalReady, signalNotReady);

      expect(mockAddHealthChecker).toHaveBeenCalled();
      expect(signalNotReady).not.toHaveBeenCalled();
      expect(signalReady).toHaveBeenCalled();
    });

    it('should signal as not ready - is not connected to Kafka', async () => {
      mockProducer.getStatus.mockReturnValue(
        Promise.resolve({ connected: false })
      );

      brokerHandler.createHealthChecker();

      const callback = mockAddHealthChecker.mock.calls[0][1];
      await callback(signalReady, signalNotReady);

      expect(mockAddHealthChecker).toHaveBeenCalled();
      expect(signalReady).not.toHaveBeenCalled();
      expect(signalNotReady).toHaveBeenCalled();
    });
  });

  describe('shutdownHandler', () => {
    it('should call the disconnect function from the producer', async () => {
      await brokerHandler.init(serviceStateMock);
      await brokerHandler.registerShutdown();
      const callback = mockRegisterShutdownHandler.mock.calls[0][0];
      callback();
      expect(mockRegisterShutdownHandler).toHaveBeenCalled();
    });
  });
});
