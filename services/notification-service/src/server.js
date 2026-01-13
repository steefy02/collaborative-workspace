require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const notificationRoutes = require('./routes/notificationRoutes');
const { initializeDatabase } = require('./config/database');
const { startRabbitMQConsumer } = require('./consumers/rabbitmqConsumer');
const { startKafkaConsumer } = require('./consumers/kafkaConsumer');

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'notification-service', 
    timestamp: new Date().toISOString() 
  });
});

// Routes
app.use('/api/notifications', notificationRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    console.log('Database initialized successfully');

    // Start RabbitMQ consumer
    await startRabbitMQConsumer();
    console.log('RabbitMQ consumer started');

    // Start Kafka consumer
    await startKafkaConsumer();
    console.log('Kafka consumer started');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Notification Service running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});

startServer();