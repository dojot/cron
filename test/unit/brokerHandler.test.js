const mockProcess = require('jest-mock-process')
const { BrokerHandler } = require('./../../app/broker')

const mockExit = mockProcess.mockProcessExit()

let mockShouldResolve
let resolveMock
let rejectMock

// MOCKS
const mockConfig = {
  ConfigManager: {
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
    actions: {
      'broker.allowed.subjects': ['dojot.device-manager.device', 'device-data'],
    },
  },

  Logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },

  Producer: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    getStatus: jest.fn(),
    // eslint-disable-next-line no-unused-vars
    produce: jest.fn(
      (topic, message, key) =>
        new Promise((resolve, reject) => {
          // eslint-disable-next-line no-param-reassign
          resolve = jest.fn(resolve)
          // eslint-disable-next-line no-param-reassign
          reject = jest.fn(reject)
          resolveMock = resolve
          rejectMock = reject

          if (mockShouldResolve) {
            resolve()
          } else {
            reject(new Error('testError'))
          }
        })
    ),
  },
  mockServiceStateManager: {
    registerService: jest.fn(),
    registerShutdownHandler: jest.fn(),
    addHealthChecker: jest.fn(),
    signalNotReady: jest.fn(),
    signalReady: jest.fn(),
  },
}

jest.mock('@dojot/microservice-sdk', () => ({
  Kafka: {
    Producer: jest.fn(() => mockConfig.Producer),
  },
  Logger: jest.fn(() => mockConfig.Logger),
  ConfigManager: {
    getConfig: jest.fn(() => mockConfig.ConfigManager),
  },
}))

jest.mock('../../app/Utils')

describe('BrokerHandler', () => {
  let brokerHandler

  beforeEach(() => {
    brokerHandler = new BrokerHandler(mockConfig.mockServiceStateManager)
    jest.clearAllMocks()
  })

  afterAll(() => {
    mockExit.mockRestore()
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should successfully create a new instance', () => {
      expect(brokerHandler.config).toEqual(mockConfig.ConfigManager)
      expect(brokerHandler.producer).toBeDefined()
      expect(brokerHandler.logger).toBeDefined()
    })
  })

  describe('init', () => {
    it('should correctly initialize', async () => {
      mockConfig.Producer.connect.mockReturnValue(Promise.resolve())

      await brokerHandler.init()

      expect(mockConfig.Producer.connect).toHaveBeenCalled()
      expect(brokerHandler.logger).toBeDefined()
    })

    it('should not correctly initialize - Promise rejected', async () => {
      const reason = 'error'
      mockConfig.Producer.connect.mockReturnValue(Promise.reject(reason))

      try {
        await brokerHandler.init()
      } catch (error) {
        expect(error).toEqual(reason)
      }
    })
  })

  describe('send', () => {
    const fakeMessage =
      '"message": { "event": "configure", "data": { "attrs": { "message": "keepalive" }, "id": "c2b1a2" }, "meta": { "service": "admin" } }'

    it('should send message', async () => {
      mockShouldResolve = true

      await brokerHandler.init()

      brokerHandler.send('test', fakeMessage)

      expect(brokerHandler.producer.produce).toHaveBeenCalled()
      expect(resolveMock).toHaveBeenCalled()
    })

    it('should not send the message - rejected Promise', async () => {
      mockShouldResolve = false

      await brokerHandler.init()

      brokerHandler.send('test', fakeMessage)

      expect(brokerHandler.producer.produce).toHaveBeenCalled()
      expect(rejectMock).toHaveBeenCalled()
    })

    it('should not send the message - malformed message', () => {
      try {
        brokerHandler.send('test', 'error format')
      } catch (error) {
        expect(error).toBeDefined()
      } finally {
        expect(mockConfig.Producer.produce).not.toHaveBeenCalled()
      }
    })
  })

  describe('healthChecker', () => {
    let signalReady
    let signalNotReady

    afterAll(() => {
      mockExit.mockRestore()
    })

    beforeEach(() => {
      signalReady = jest.fn()
      signalNotReady = jest.fn()
      brokerHandler = new BrokerHandler(mockConfig.mockServiceStateManager)

      mockConfig.Producer.connect.mockReturnValue(Promise.resolve())
      jest.clearAllMocks()
    })

    it('should signal as ready - is connected to Kafka', async () => {
      mockConfig.Producer.getStatus.mockReturnValue(
        Promise.resolve({ connected: true })
      )

      await brokerHandler.init()
      await brokerHandler.healthChecker(signalReady, signalNotReady)

      expect(signalReady).toHaveBeenCalled()
    })

    it('should signal as not ready - is not connected to Kafka', async () => {
      mockConfig.Producer.getStatus.mockReturnValue(
        Promise.resolve({ connected: false })
      )

      await brokerHandler.init()
      await brokerHandler.healthChecker(signalReady, signalNotReady)

      expect(signalNotReady).toHaveBeenCalled()
    })

    it('should signal as not ready - Promise was rejected', async () => {
      mockConfig.Producer.getStatus.mockReturnValue(Promise.reject())

      await brokerHandler.init()
      await brokerHandler.healthChecker(signalReady, signalNotReady)

      expect(signalNotReady).toHaveBeenCalled()
    })
  })

  describe('shutdownHandler', () => {
    it('should call the disconnect function from the producer', async () => {
      await brokerHandler.init()
      brokerHandler.shutdownHandler()
      expect(brokerHandler.producer.disconnect).toHaveBeenCalled()
    })
  })
})
