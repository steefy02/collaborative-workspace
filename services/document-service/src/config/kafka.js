const { Kafka } = require('kafkajs');

let producer = null;
let kafka = null;

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const TOPIC_NAME = 'document-events';

async function initializeKafka() {
  try {
    kafka = new Kafka({
      clientId: 'document-service',
      brokers: [KAFKA_BROKER],
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    producer = kafka.producer();
    await producer.connect();

    // Create topic if it doesn't exist
    const admin = kafka.admin();
    await admin.connect();
    
    const topics = await admin.listTopics();
    if (!topics.includes(TOPIC_NAME)) {
      await admin.createTopics({
        topics: [{
          topic: TOPIC_NAME,
          numPartitions: 3,
          replicationFactor: 1
        }]
      });
      console.log(`Kafka: Topic '${TOPIC_NAME}' created`);
    }

    await admin.disconnect();
    console.log('Kafka producer connected');

  } catch (error) {
    console.error('Failed to initialize Kafka:', error);
    throw error;
  }
}

async function streamEvent(event) {
  try {
    if (!producer) {
      throw new Error('Kafka producer not initialized');
    }

    const message = {
      key: event.documentId?.toString() || 'system',
      value: JSON.stringify({
        ...event,
        timestamp: new Date().toISOString(),
        service: 'document-service'
      }),
      headers: {
        'event-type': event.eventType || 'unknown'
      }
    };

    await producer.send({
      topic: TOPIC_NAME,
      messages: [message]
    });

    console.log(`Kafka: Event streamed - ${event.eventType}`, event);
  } catch (error) {
    console.error('Failed to stream event to Kafka:', error);
  }
}

// Helper functions for specific events
async function logDocumentCreated(documentId, title, ownerId, ownerUsername) {
  await streamEvent({
    eventType: 'document.created',
    documentId,
    title,
    ownerId,
    ownerUsername
  });
}

async function logDocumentUpdated(documentId, title, userId, username, changes) {
  await streamEvent({
    eventType: 'document.updated',
    documentId,
    title,
    userId,
    username,
    changes
  });
}

async function logDocumentDeleted(documentId, title, userId, username) {
  await streamEvent({
    eventType: 'document.deleted',
    documentId,
    title,
    userId,
    username
  });
}

async function logDocumentViewed(documentId, title, userId, username) {
  await streamEvent({
    eventType: 'document.viewed',
    documentId,
    title,
    userId,
    username
  });
}

async function logDocumentShared(documentId, title, ownerId, sharedWithUserId) {
  await streamEvent({
    eventType: 'document.shared',
    documentId,
    title,
    ownerId,
    sharedWithUserId
  });
}

async function disconnectProducer() {
  try {
    if (producer) {
      await producer.disconnect();
      console.log('Kafka producer disconnected');
    }
  } catch (error) {
    console.error('Error disconnecting Kafka producer:', error);
  }
}

module.exports = {
  initializeKafka,
  streamEvent,
  logDocumentCreated,
  logDocumentUpdated,
  logDocumentDeleted,
  logDocumentViewed,
  logDocumentShared,
  disconnectProducer
};