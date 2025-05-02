const rabbitmq = require('../../shared/rabbitmq');
const eventTypes = require('../../shared/eventTypes');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'auth-service-events.log' })
  ]
});

class AuthEventHandler {
  constructor() {
    this.initializeEventHandlers();
  }

  async initializeEventHandlers() {
    try {
      await rabbitmq.connect();

      // Define subscriptions
      const subscriptions = [
        { exchange: 'user-events', queue: 'auth-service-user-queue', routingKey: 'user.#' }
      ];

      // Log all subscriptions
      console.log('\nAuth Service Subscriptions:');
      console.log('------------------------');
      for (const sub of subscriptions) {
        console.log(`Exchange: ${sub.exchange}`);
        console.log(`Queue: ${sub.queue}`);
        console.log(`Routing Key: ${sub.routingKey}`);
        console.log('------------------------');
        await rabbitmq.subscribe(sub.exchange, sub.queue, sub.routingKey, this.handleUserEvent.bind(this));
      }

      logger.info('Auth service event handlers initialized');
    } catch (error) {
      logger.error('Error initializing event handlers:', error);
      throw error;
    }
  }

  async handleUserEvent(event) {
    try {
      const { type, data } = event;
      console.log('\nAuth Service Received Event:');
      console.log('------------------------');
      console.log(`Type: ${type}`);
      console.log(`Data:`, data);
      console.log('------------------------');

      switch (type) {
        case eventTypes.USER_CREATED:
          logger.info(`User created event received: ${data.userId}`);
          break;
        case eventTypes.USER_UPDATED:
          logger.info(`User updated event received: ${data.userId}`);
          break;
        case eventTypes.USER_DELETED:
          logger.info(`User deleted event received: ${data.userId}`);
          break;
      }
    } catch (error) {
      logger.error('Error handling user event:', error);
      throw error;
    }
  }

  async publishUserEvent(type, data) {
    try {
      const exchange = 'user-events';
      console.log('\nAuth Service Publishing Event:');
      console.log('------------------------');
      console.log(`Exchange: ${exchange}`);
      console.log(`Type: ${type}`);
      console.log(`Data:`, data);
      console.log('------------------------');
      
      await rabbitmq.publish(exchange, type, { type, data });
      logger.info(`Published user event: ${type}`);
    } catch (error) {
      logger.error('Error publishing user event:', error);
      throw error;
    }
  }

  async handleUserCreated(user) {
    try {
      await this.publishUserEvent(eventTypes.USER_CREATED, {
        userId: user._id,
        email: user.email,
        role: user.role,
        name: user.name
      });
    } catch (error) {
      logger.error('Error handling user creation:', error);
      throw error;
    }
  }

  async handleUserUpdated(user) {
    try {
      await this.publishUserEvent(eventTypes.USER_UPDATED, {
        userId: user._id,
        email: user.email,
        role: user.role,
        name: user.name
      });
    } catch (error) {
      logger.error('Error handling user update:', error);
      throw error;
    }
  }

  async handleUserDeleted(userId) {
    try {
      await this.publishUserEvent(eventTypes.USER_DELETED, {
        userId
      });
    } catch (error) {
      logger.error('Error handling user deletion:', error);
      throw error;
    }
  }
}

module.exports = new AuthEventHandler(); 