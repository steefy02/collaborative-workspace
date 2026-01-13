const { Kafka } = require('kafkajs');
const { pool } = require('../config/database');

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const TOPIC_NAME = 'document-events';
const GROUP_ID = 'notification-service-group';

let kafka = null;
let consumer = null;

async function startKafkaConsumer() {
  try {
    kafka = new Kafka({
      clientId: 'notification-service',
      brokers: [KAFKA_BROKER],
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    consumer = kafka.consumer({ groupId: GROUP_ID });

    await consumer.connect();
    console.log('Kafka consumer connected');

    await consumer.subscribe({ topic: TOPIC_NAME, fromBeginning: false });
    console.log(`Subscribed to topic: ${TOPIC_NAME}`);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const event = JSON.parse(message.value.toString());
          console.log('Received event from Kafka:', event);

          await processKafkaEvent(event);
        } catch (error) {
          console.error('Error processing Kafka message:', error);
        }
      }
    });

  } catch (error) {
    console.error('Failed to start Kafka consumer:', error);
    // Retry connection after delay
    setTimeout(startKafkaConsumer, 5000);
  }
}

async function processKafkaEvent(event) {
  const client = await pool.connect();
  
  try {
    // Store analytics data
    await client.query(
      `INSERT INTO document_analytics (event_type, document_id, user_id, username, data) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        event.eventType,
        event.documentId || null,
        event.userId || event.ownerId || null,
        event.username || event.ownerUsername || null,
        JSON.stringify(event)
      ]
    );

    console.log(`Analytics stored: ${event.eventType} for document ${event.documentId}`);
  } catch (error) {
    console.error('Error storing analytics:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function disconnectConsumer() {
  try {
    if (consumer) {
      await consumer.disconnect();
      console.log('Kafka consumer disconnected');
    }
  } catch (error) {
    console.error('Error disconnecting Kafka consumer:', error);
  }
}

module.exports = {
  startKafkaConsumer,
  disconnectConsumer
};