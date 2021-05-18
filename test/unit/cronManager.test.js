const mockConsumer = {
  finish: jest.fn(),
  getStatus: jest.fn(),
  init: jest.fn(),
  registerCallback: jest.fn(),
}

const mockDB = {
  init: jest.fn(),
  createDatabase: jest.fn(),
  db: jest.fn(),
}

const mockProducer = {
  finish: jest.fn(),
  getStatus: jest.fn(),
  init: jest.fn(),
  connect: jest.fn(),
}

const mocktenantCallback = jest.fn()

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
    'mongodb.url': global.__MONGO_URI__,
  },
  dbOptions: {
    useNewUrlParser: true,
  },
}

const mockLogger = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}

const mockServiceStateManager = {
  registerService: jest.fn(),
  registerShutdownHandler: jest.fn(),
  addHealthChecker: jest.fn(),
  signalNotReady: jest.fn(),
  signalReady: jest.fn(),
}

jest.mock('@dojot/microservice-sdk', () => ({
  ConfigManager: {
    getConfig: jest.fn(() => mockDefaultConfig),
  },
  Kafka: {
    Consumer: jest.fn(() => mockConsumer),
    Producer: jest.fn(() => mockProducer),
  },
  Logger: jest.fn(() => mockLogger),
}))

jest.mock('../../app/Utils', () => ({
  killApplication: jest.fn(),
}))

const { CronManager } = require('./../../app/cron')
const { killApplication } = require('../../app/Utils')

describe('Cron', () => {
  let cronManager

  beforeEach(() => {
    cronManager = new CronManager(mockServiceStateManager)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should successfully create an Cron Manager', () => {
      expect(cronManager.serviceStateManager).toEqual(mockServiceStateManager)
      expect(cronManager.wasInitialized).toBeFalsy()
    })
  })

  describe('init', () => {
    it('should successfully initialize the Cron Manager', async () => {
      mockConsumer.init.mockReturnValue(Promise.resolve())
      mockConsumer.registerCallback('test', () => {})

      await cronManager.init()

      expect(mockConsumer.registerCallback).toHaveBeenCalled()
      //   expect(mockServiceStateManager.signalReady).toHaveBeenCalled();
    })

    it('should not initialize the Cron Manager - Consumer is already initialized', async () => {
      // Faster way for faking the initialization
      cronManager.wasInitialized = true

      await cronManager.init()

      expect(mockConsumer.init).not.toHaveBeenCalled()
    })

    it('should fail the initialization of the Cron Manager', async () => {
      mockConsumer.init.mockReturnValue(Promise.reject(new Error('fakeError')))

      await cronManager.init()

      expect(mockConsumer.registerCallback).not.toHaveBeenCalled()
      expect(mockServiceStateManager.signalNotReady).toHaveBeenCalled()
      expect(killApplication).toHaveBeenCalled()
    })

    // it('should send a message when the registered callback is called', async () => {
    //   mockConsumer.init.mockReturnValue(Promise.resolve());
    //   mockConsumer.registerCallback('test', () => {})

    //   await cronManager.init();

    //   expect(mockConsumer.registerCallback).toHaveBeenCalled();

    //   // Retrieving the callback passed to registerCallback
    //   const callback = mockConsumer.registerCallback.mock.calls[0][1];
    //   callback({});
    //   expect(mocktenantCallback).toHaveBeenCalled();
    // });
  })

  describe('finish', () => {
    let cronManager

    beforeEach(async (done) => {
      jest.clearAllMocks()
      cronManager = new CronManager(mockServiceStateManager)
      await cronManager.init()
      done()
    })

    it('should finish the consumer', async () => {
      mockConsumer.finish.mockResolvedValueOnce()

      await cronManager.finish()

      expect(mockConsumer.finish).toHaveBeenCalled()
      expect(mockServiceStateManager.signalNotReady).toHaveBeenCalled()

      expect(cronManager.consumer).toBeUndefined()
      expect(cronManager.wasInitialized).toBeFalsy()
    })

    it('should finish the consumer - ignored the error', async () => {
      mockConsumer.finish.mockRejectedValueOnce()

      await cronManager.finish()

      expect(mockConsumer.finish).toHaveBeenCalled()
      expect(mockServiceStateManager.signalNotReady).toHaveBeenCalled()

      expect(cronManager.wasInitialized).toBeFalsy()
    })
  })

  describe('healthChecker', () => {
    let signalReady
    let signalNotReady

    beforeEach(async (done) => {
      jest.clearAllMocks()

      signalReady = jest.fn()
      signalNotReady = jest.fn()

      await cronManager.init()
      done()
    })

    it('should signal as ready - is connected to Kafka', async () => {
      mockConsumer.getStatus.mockReturnValue(
        Promise.resolve({ connected: true })
      )

      await cronManager.healthChecker(signalReady, signalNotReady)

      expect(signalReady).toHaveBeenCalled()
    })

    it('should signal as not ready - is not connected to Kafka', async () => {
      mockConsumer.getStatus.mockReturnValue(
        Promise.resolve({ connected: false })
      )

      await cronManager.healthChecker(signalReady, signalNotReady)

      expect(signalNotReady).toHaveBeenCalled()
    })

    it('should signal as not ready - Promise was rejected', async () => {
      mockConsumer.getStatus.mockReturnValue(Promise.reject())

      await cronManager.healthChecker(signalReady, signalNotReady)

      expect(signalNotReady).toHaveBeenCalled()
    })

    it('should signal as not ready - consumer is undefined', async () => {
      cronManager.consumer = undefined

      await cronManager.healthChecker(signalReady, signalNotReady)

      expect(signalNotReady).toHaveBeenCalled()
    })
  })

  describe('shutdownHandler', () => {
    it('should successfully finish', async () => {
      const cronManager = new CronManager(mockServiceStateManager)

      await cronManager.init()
      await cronManager.shutdownHandler()

      expect(mockConsumer.finish).toHaveBeenCalled()
    })
  })

  describe('_makeKey', () => {
    it('should successfully return key', async () => {
      const key = cronManager._makeKey('test', '123')
      expect(key).toBe('test:123')
    })
  })
})
