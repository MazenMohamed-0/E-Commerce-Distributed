const amqp = require('amqplib');

class RabbitMQ {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 3000; // 3 seconds
    this.consumers = new Map(); // Track active consumers
    this.exchanges = new Map(); // Track exchange configurations
  }

  async connect() {
    try {
      if (this.connection && this.channel) {
        console.log('RabbitMQ connection already established');
        return;
      }

      const connectionOptions = {
        protocol: 'amqp',
        hostname: 'localhost',
        port: 5672,
        username: 'guest',
        password: 'guest',
        vhost: '/',
        frameMax: 8192
      };

      console.log('Attempting to connect to RabbitMQ with options:', {
        ...connectionOptions,
        password: '***'
      });

      this.connection = await amqp.connect(connectionOptions);
      this.channel = await this.connection.createChannel();
      console.log('Connected to RabbitMQ');

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;

      // Handle connection errors
      this.connection.on('error', async (err) => {
        console.error('RabbitMQ connection error:', err);
        await this.handleConnectionFailure();
      });

      // Handle connection close
      this.connection.on('close', async () => {
        console.log('RabbitMQ connection closed');
        await this.handleConnectionFailure();
      });

      // Handle channel errors
      this.channel.on('error', async (err) => {
        console.error('RabbitMQ channel error:', err);
        await this.handleChannelFailure();
      });

      // Handle channel close
      this.channel.on('close', async () => {
        console.log('RabbitMQ channel closed');
        await this.handleChannelFailure();
      });

    } catch (error) {
      console.error('Error connecting to RabbitMQ:', error);
      await this.handleConnectionFailure();
    }
  }

  async handleConnectionFailure() {
    this.connection = null;
    this.channel = null;
    await this.reconnect();
  }

  async handleChannelFailure() {
    try {
      if (this.connection && !this.channel) {
        console.log('Attempting to recreate channel...');
        this.channel = await this.connection.createChannel();
        
        // Reassert exchanges and queues
        for (const [exchange, config] of this.exchanges) {
          await this.channel.assertExchange(exchange, 'topic', config);
        }
        
        // Resubscribe consumers
        for (const [queue, consumer] of this.consumers) {
          await this.resubscribeConsumer(queue, consumer);
        }
      } else {
        await this.handleConnectionFailure();
      }
    } catch (error) {
      console.error('Error recreating channel:', error);
      await this.handleConnectionFailure();
    }
  }

  async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached. Giving up.');
      throw new Error('Failed to reconnect to RabbitMQ after max attempts');
    }

    this.reconnectAttempts += 1;
    console.log(`Reconnecting to RabbitMQ (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    await new Promise((resolve) => setTimeout(resolve, this.reconnectInterval));

    try {
      await this.connect();
    } catch (error) {
      console.error('Reconnection attempt failed:', error);
      await this.reconnect();
    }
  }

  async publish(exchange, routingKey, message) {
    try {
      if (!this.channel) {
        await this.connect();
      }

      // Always assert exchange as durable
      const exchangeConfig = { durable: true };
      this.exchanges.set(exchange, exchangeConfig);
      await this.channel.assertExchange(exchange, 'topic', exchangeConfig);
      
      this.channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)));
      console.log(`Published message to exchange ${exchange} with routing key ${routingKey}`);
    } catch (error) {
      console.error('Error publishing message:', error);
      throw error;
    }
  }

  // Add method to publish to a specific queue (used for replies)
  async publishToQueue(queueName, message) {
    try {
      if (!this.channel) {
        await this.connect();
      }
      
      // Assert queue exists with appropriate settings
      // For temporary response queues, they should be durable:false so we need to check 
      // if the queue name starts with 'response' or contains a UUID pattern
      const isDurable = 
        !(queueName.startsWith('response') || 
          queueName.includes('payment-result') || 
          /response\.[0-9]+/.test(queueName));
      
      console.log(`Asserting queue ${queueName} with durable=${isDurable}`);
      await this.channel.assertQueue(queueName, { 
        durable: isDurable,
        autoDelete: !isDurable
      });
      
      // Send the message to the queue with persistent delivery mode for important messages
      const options = {
        persistent: isDurable  // Use persistent delivery mode for durable queues
      };
      
      const success = this.channel.sendToQueue(
        queueName, 
        Buffer.from(JSON.stringify(message)),
        options
      );
      
      if (success) {
        console.log(`Successfully published message to queue ${queueName}`);
      } else {
        console.warn(`Channel write buffer is full - applying backpressure on queue ${queueName}`);
        // Wait for drain event before considering the operation complete
        await new Promise(resolve => {
          this.channel.once('drain', resolve);
        });
        console.log(`Channel drained, message to ${queueName} should now be sent`);
      }
      
      return true;
    } catch (error) {
      console.error(`Error publishing to queue ${queueName}:`, error);
      throw error;
    }
  }

  async subscribe(exchange, queue, routingKey, callback, { temporary = false } = {}) {
    try {
      if (!this.channel) {
        await this.connect();
      }

      // Always assert exchange as durable, regardless of queue durability
      const exchangeConfig = { durable: true };
      this.exchanges.set(exchange, exchangeConfig);
      await this.channel.assertExchange(exchange, 'topic', exchangeConfig);

      // Configure queue options
      const queueOptions = temporary ? 
        { exclusive: true, autoDelete: true } : 
        { durable: true };

      const q = await this.channel.assertQueue(queue, queueOptions);
      await this.channel.bindQueue(q.queue, exchange, routingKey);

      console.log(`Subscribed to queue ${q.queue} on exchange ${exchange} with routing key ${routingKey}`);

      const { consumerTag } = await this.channel.consume(q.queue, (msg) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            callback(content);
            this.channel.ack(msg);
          } catch (error) {
            console.error('Error processing message:', error);
            this.channel.nack(msg);
          }
        }
      });

      // Store consumer information
      this.consumers.set(queue, { 
        consumerTag, 
        exchange,
        routingKey,
        callback,
        options: { temporary }
      });

      return q.queue;
    } catch (error) {
      console.error('Error subscribing to queue:', error);
      throw error;
    }
  }

  async resubscribeConsumer(queue, consumer) {
    try {
      const { exchange, routingKey, callback, options } = consumer;
      await this.subscribe(exchange, queue, routingKey, callback, options);
    } catch (error) {
      console.error(`Error resubscribing consumer for queue ${queue}:`, error);
    }
  }

  async unsubscribe(queue) {
    try {
      if (!this.channel) {
        console.warn('No channel available for unsubscribe operation');
        return;
      }

      const consumer = this.consumers.get(queue);
      if (consumer) {
        try {
          await this.channel.cancel(consumer.consumerTag);
        } catch (error) {
          console.warn(`Error canceling consumer for queue ${queue}:`, error);
        }

        try {
          await this.channel.deleteQueue(queue);
        } catch (error) {
          console.warn(`Error deleting queue ${queue}:`, error);
        }

        this.consumers.delete(queue);
        console.log(`Unsubscribed from queue ${queue}`);
      }
    } catch (error) {
      console.error(`Error unsubscribing from queue ${queue}:`, error);
    }
  }

  async createTemporaryResponseQueue(exchange, correlationId, callback) {
    try {
      console.log(`Creating temporary response queue for correlationId: ${correlationId}`);
      
      // Generate a unique queue name for this response
      const queueName = `response-${correlationId}`;
      const routingKey = `response.${correlationId}`;
      
      // Direct the queue to bind to the specific routing key
      if (!this.channel) {
        await this.connect();
      }
      
      // Assert the exchange
      const exchangeConfig = { durable: true };
      this.exchanges.set(exchange, exchangeConfig);
      await this.channel.assertExchange(exchange, 'topic', exchangeConfig);
      
      // Create a non-durable, auto-delete queue that will be deleted when no longer used
      const queueOptions = { 
        exclusive: false,  // Allow other connections to use (important for services)
        autoDelete: true,  // Auto-delete when no consumers
        durable: false     // Non-durable since it's temporary
      };
      
      console.log(`Asserting temporary queue ${queueName} with options:`, queueOptions);
      const q = await this.channel.assertQueue(queueName, queueOptions);
      
      // Bind the queue to the specific routing key
      await this.channel.bindQueue(q.queue, exchange, routingKey);
      console.log(`Bound queue ${q.queue} to exchange ${exchange} with routing key ${routingKey}`);
      
      // Set up the consumer for this queue
      const { consumerTag } = await this.channel.consume(q.queue, (msg) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            console.log(`Received response on temporary queue ${queueName}:`, {
              correlationId: content.correlationId,
              success: content.data?.success,
              type: content.type
            });
            
            // Invoke the callback with the message content
            callback(content);
            this.channel.ack(msg);
          } catch (error) {
            console.error(`Error processing message on queue ${queueName}:`, error);
            this.channel.nack(msg);
          }
        }
      });
      
      // Store consumer information for cleanup
      this.consumers.set(queueName, { 
        consumerTag, 
        exchange,
        routingKey,
        callback,
        options: { temporary: true }
      });
      
      console.log(`Successfully created temporary response queue: ${queueName}`);
      return queueName;
    } catch (error) {
      console.error('Error creating temporary response queue:', error);
      throw error;
    }
  }

  async close() {
    try {
      // Cancel all consumers first
      for (const [queue] of this.consumers) {
        await this.unsubscribe(queue);
      }

      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      console.log('RabbitMQ connection closed gracefully');
    } catch (error) {
      console.error('Error closing RabbitMQ connection:', error);
    }
  }
}

// Create and export an instance of RabbitMQ
const rabbitmq = new RabbitMQ();
module.exports = rabbitmq;