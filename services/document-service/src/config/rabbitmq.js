const amqp = require('amqplib');

let channel = null;
let connection = null;

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672';
const EXCHANGE_NAME = 'document_events';
const NOTIFICATION_QUEUE = 'notification_queue';

async function initializeRabbitMQ() {
  try {
    // Connect to RabbitMQ
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // Create exchange
    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

    // Create queue for notifications
    await channel.assertQueue(NOTIFICATION_QUEUE, { durable: true });

    // Bind queue to exchange with routing keys
    await channel.bindQueue(NOTIFICATION_QUEUE, EXCHANGE_NAME, 'document.shared');
    await channel.bindQueue(NOTIFICATION_QUEUE, EXCHANGE_NAME, 'document.mentioned');
    await channel.bindQueue(NOTIFICATION_QUEUE, EXCHANGE_NAME, 'document.commented');

    console.log('RabbitMQ: Exchange and queues created');

    // Handle connection errors
    connection.on('error', (err) => {
      console.error('RabbitMQ connection error:', err);
    });

    connection.on('close', () => {
      console.log('RabbitMQ connection closed');
    });

  } catch (error) {
    console.error('Failed to initialize RabbitMQ:', error);
    throw error;
  }
}

async function publishToQueue(routingKey, message) {
  try {
    if (!channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    const messageBuffer = Buffer.from(JSON.stringify(message));
    
    channel.publish(
      EXCHANGE_NAME,
      routingKey,
      messageBuffer,
      { 
        persistent: true,
        timestamp: Date.now(),
        contentType: 'application/json'
      }
    );

    console.log(`Published message to RabbitMQ: ${routingKey}`, message);
  } catch (error) {
    console.error('Failed to publish to RabbitMQ:', error);
  }
}

// Helper functions for specific events
async function notifyDocumentShared(documentId, documentTitle, ownerId, sharedWithUserId, sharedWithUsername) {
  await publishToQueue('document.shared', {
    type: 'document.shared',
    documentId,
    documentTitle,
    ownerId,
    sharedWithUserId,
    sharedWithUsername,
    timestamp: new Date().toISOString()
  });
}

async function notifyUserMentioned(documentId, documentTitle, mentionedUserId, mentionedUsername, mentionedBy) {
  await publishToQueue('document.mentioned', {
    type: 'document.mentioned',
    documentId,
    documentTitle,
    mentionedUserId,
    mentionedUsername,
    mentionedBy,
    timestamp: new Date().toISOString()
  });
}

async function closeConnection() {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
  } catch (error) {
    console.error('Error closing RabbitMQ connection:', error);
  }
}

module.exports = {
  initializeRabbitMQ,
  publishToQueue,
  notifyDocumentShared,
  notifyUserMentioned,
  closeConnection
};