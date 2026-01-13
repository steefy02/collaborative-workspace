const amqp = require('amqplib');
const { pool } = require('../config/database');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672';
const NOTIFICATION_QUEUE = 'notification_queue';

let channel = null;
let connection = null;

async function startRabbitMQConsumer() {
  try {
    // Connect to RabbitMQ
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // Assert queue exists
    await channel.assertQueue(NOTIFICATION_QUEUE, { durable: true });

    // Set prefetch to 1 - process one message at a time
    channel.prefetch(1);

    console.log(`Waiting for messages in ${NOTIFICATION_QUEUE}...`);

    // Consume messages
    channel.consume(NOTIFICATION_QUEUE, async (msg) => {
      if (msg !== null) {
        try {
          const message = JSON.parse(msg.content.toString());
          console.log('Received message from RabbitMQ:', message);

          await processNotification(message);

          // Acknowledge message
          channel.ack(msg);
          console.log('Message processed and acknowledged');
        } catch (error) {
          console.error('Error processing message:', error);
          // Reject and requeue the message
          channel.nack(msg, false, true);
        }
      }
    });

    // Handle connection errors
    connection.on('error', (err) => {
      console.error('RabbitMQ connection error:', err);
    });

    connection.on('close', () => {
      console.log('RabbitMQ connection closed, attempting to reconnect...');
      setTimeout(startRabbitMQConsumer, 5000);
    });

  } catch (error) {
    console.error('Failed to start RabbitMQ consumer:', error);
    setTimeout(startRabbitMQConsumer, 5000);
  }
}

async function processNotification(message) {
  const client = await pool.connect();
  
  try {
    let notification;

    switch (message.type) {
      case 'document.shared':
        notification = {
          userId: message.sharedWithUserId,
          type: 'document_shared',
          title: 'Document Shared With You',
          message: `A document "${message.documentTitle}" has been shared with you`,
          data: {
            documentId: message.documentId,
            documentTitle: message.documentTitle,
            sharedBy: message.ownerId
          }
        };
        break;

      case 'document.mentioned':
        notification = {
          userId: message.mentionedUserId,
          type: 'mention',
          title: 'You Were Mentioned',
          message: `${message.mentionedBy} mentioned you in "${message.documentTitle}"`,
          data: {
            documentId: message.documentId,
            documentTitle: message.documentTitle,
            mentionedBy: message.mentionedBy
          }
        };
        break;

      case 'document.commented':
        notification = {
          userId: message.userId,
          type: 'comment',
          title: 'New Comment',
          message: `New comment on "${message.documentTitle}"`,
          data: {
            documentId: message.documentId,
            documentTitle: message.documentTitle,
            commentBy: message.commentBy
          }
        };
        break;

      default:
        console.log('Unknown message type:', message.type);
        return;
    }

    // Insert notification into database
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, data) 
       VALUES ($1, $2, $3, $4, $5)`,
      [notification.userId, notification.type, notification.title, notification.message, JSON.stringify(notification.data)]
    );

    console.log('Notification created for user:', notification.userId);
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  } finally {
    client.release();
  }
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
  startRabbitMQConsumer,
  closeConnection
};