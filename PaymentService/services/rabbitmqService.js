const rabbitmq = require('../../shared/rabbitmq');

class RabbitMQService {
  async connect() {
    await rabbitmq.connect();
  }

  async publishPaymentEvent(routingKey, data) {
    try {
      const message = {
        service: 'payment-service',
        timestamp: new Date().toISOString(),
        data
      };
      
      await rabbitmq.publish('payment-events', routingKey, message);
    } catch (error) {
      console.error(`Error publishing payment event: ${routingKey}`, error);
      throw error;
    }
  }

  async publishToQueue(queueName, message) {
    try {
      return await rabbitmq.publishToQueue(queueName, message);
    } catch (error) {
      console.error(`Error publishing to queue ${queueName}:`, error);
      throw error;
    }
  }

  async subscribeToOrderEvents(routingKey, callback) {
    try {
      const queueName = `payment_service_orders`;
      
      await rabbitmq.subscribe(
        'payment-events', 
        queueName, 
        routingKey, 
        (content) => {
          callback(content);
        }
      );
      
      console.log(`Subscribed to payment events: ${routingKey}`);
    } catch (error) {
      console.error(`Error subscribing to payment events: ${routingKey}`, error);
      throw error;
    }
  }

  async close() {
    await rabbitmq.close();
  }
}

module.exports = new RabbitMQService(); 