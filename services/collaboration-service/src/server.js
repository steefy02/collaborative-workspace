require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { initializeRedis, getRedisClient } = require('./config/redis');
const CollaborationHandler = require('./handlers/collaborationHandler');

const app = express();
const server = http.createServer(app);

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// CORS configuration
app.use(cors());

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'collaboration-service', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    redis: getRedisClient() ? 'connected' : 'disconnected'
  });
});

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.query.token;
  
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
});

// Initialize collaboration handler
let collaborationHandler;

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.username} (${socket.user.userId})`);
  
  collaborationHandler.handleConnection(socket);

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.username}`);
    collaborationHandler.handleDisconnection(socket);
  });
});

// Initialize and start server
async function startServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Initialize Redis
    await initializeRedis();
    console.log('Redis initialized');

    // Initialize collaboration handler
    collaborationHandler = new CollaborationHandler(io, getRedisClient());

    const PORT = process.env.PORT || 3003;
    server.listen(PORT, () => {
      console.log(`Collaboration Service running on port ${PORT}`);
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
  await mongoose.connection.close();
  const redis = getRedisClient();
  if (redis) await redis.quit();
  process.exit(0);
});

startServer();