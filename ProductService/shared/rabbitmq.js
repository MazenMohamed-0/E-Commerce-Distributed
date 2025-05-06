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
        return;
      }

      // Get the RabbitMQ URL from environment variable or use Docker service name as fallback
      const rabbitMqUrl = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';
      
      console.log(`Connecting to RabbitMQ using: ${rabbitMqUrl}`);
      
      // Connect using the URL directly for Docker compatibility
      this.connection = await amqp.connect(rabbitMqUrl);
      this.channel = await this.connection.createChannel();
      
      console.log('Successfully connected to RabbitMQ');

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;

      // Handle connection errors
      this.connection.on('error', async (err) => {
        console.error('RabbitMQ connection error:', err.message);
        await this.handleConnectionFailure();
      });

      // Handle connection close
      this.connection.on('close', async () => {
        console.log('RabbitMQ connection closed');
        await this.handleConnectionFailure();
      });

      // Handle channel errors
      this.channel.on('error', async (err) => {
        console.error('RabbitMQ channel error:', err.message);
        await this.handleChannelFailure();
      });

      // Handle channel close
      this.channel.on('close', async () => {
        console.log('RabbitMQ channel closed');
        await this.handleChannelFailure();
      });

    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error.message);
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
      await this.handleConnectionFailure();
    }
  }

  async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      throw new Error('Failed to reconnect to RabbitMQ after max attempts');
    }

    this.reconnectAttempts += 1;

    await new Promise((resolve) => setTimeout(resolve, this.reconnectInterval));

    try {
      await this.connect();
    } catch (error) {
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
    } catch (error) {
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
        return true;
      } else {
        // Wait for drain event before considering the operation complete
        await new Promise(resolve => {
          this.channel.once('drain', resolve);
        });
        return true;
      }
    } catch (error) {
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

      const { consumerTag } = await this.channel.consume(q.queue, (msg) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            callback(content);
            this.channel.ack(msg);
          } catch (error) {
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
      throw error;
    }
  }

  async resubscribeConsumer(queue, consumer) {
    try {
      const { exchange, routingKey, callback, options } = consumer;
      await this.subscribe(exchange, queue, routingKey, callback, options);
    } catch (error) {
    }
  }

  async unsubscribe(queue) {
    try {
      if (!this.channel) {
        return;
      }

      const consumer = this.consumers.get(queue);
      if (consumer) {
        try {
          await this.channel.cancel(consumer.consumerTag);
        } catch (error) {
        }

        try {
          await this.channel.deleteQueue(queue);
        } catch (error) {
        }

        this.consumers.delete(queue);
      }
    } catch (error) {
    }
  }

  async createTemporaryResponseQueue(exchange, correlationId, callback) {
    try {
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
      
      const q = await this.channel.assertQueue(queueName, queueOptions);
      
      // Bind the queue to the specific routing key
      await this.channel.bindQueue(q.queue, exchange, routingKey);
      
      // Set up the consumer for this queue
      const { consumerTag } = await this.channel.consume(q.queue, (msg) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            
            // Invoke the callback with the message content
            callback(content);
            this.channel.ack(msg);
          } catch (error) {
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
      
      return queueName;
    } catch (error) {
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
    } catch (error) {
    }
  }
}

// Create and export an instance of RabbitMQ
const rabbitmq = new RabbitMQ();
module.exports = rabbitmq;