const { getRedisPub, getRedisSub } = require('../config/redis');
const Document = require('../models/Document');

class CollaborationHandler {
  constructor(io, redisClient) {
    this.io = io;
    this.redis = redisClient;
    this.redisPub = getRedisPub();
    this.redisSub = getRedisSub();
    
    // Store active users per document
    this.activeUsers = new Map(); // documentId -> Set of userIds
    
    // Subscribe to Redis channels for cross-instance communication
    this.setupRedisSubscriptions();
  }

  setupRedisSubscriptions() {
    // Subscribe to document update channel
    this.redisSub.subscribe('document:updates', (message) => {
      const data = JSON.parse(message);
      // Broadcast to all connected clients except the sender
      this.io.to(data.documentId).except(data.socketId).emit('document:update', data);
    });

    // Subscribe to cursor position channel
    this.redisSub.subscribe('document:cursor', (message) => {
      const data = JSON.parse(message);
      this.io.to(data.documentId).except(data.socketId).emit('cursor:move', data);
    });

    // Subscribe to user presence channel
    this.redisSub.subscribe('document:presence', (message) => {
      const data = JSON.parse(message);
      this.io.to(data.documentId).emit('user:presence', data);
    });

    console.log('Redis subscriptions set up');
  }

  handleConnection(socket) {
    console.log(`Socket connected: ${socket.id} (User: ${socket.user.username})`);

    // Join document room
    socket.on('document:join', async (data) => {
      await this.handleDocumentJoin(socket, data);
    });

    // Leave document room
    socket.on('document:leave', async (data) => {
      await this.handleDocumentLeave(socket, data);
    });

    // Handle document updates
    socket.on('document:edit', async (data) => {
      await this.handleDocumentEdit(socket, data);
    });

    // Handle cursor movements
    socket.on('cursor:position', async (data) => {
      await this.handleCursorPosition(socket, data);
    });

    // Handle typing indicator
    socket.on('user:typing', async (data) => {
      await this.handleTypingIndicator(socket, data);
    });
  }

  async handleDocumentJoin(socket, data) {
    try {
      const { documentId } = data;
      
      // Check if user has access to document
      const document = await Document.findById(documentId);
      if (!document) {
        socket.emit('error', { message: 'Document not found' });
        return;
      }

      const userId = socket.user.userId;
      const hasAccess = 
        document.ownerId === userId ||
        document.collaborators.some(c => c.userId === userId) ||
        document.isPublic;

      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Join the document room
      socket.join(documentId);
      socket.currentDocument = documentId;

      // Add user to active users
      if (!this.activeUsers.has(documentId)) {
        this.activeUsers.set(documentId, new Set());
      }
      this.activeUsers.get(documentId).add(userId);

      // Store in Redis for cross-instance awareness
      await this.redis.sAdd(`document:${documentId}:users`, userId.toString());

      // Get all active users for this document
      const activeUserIds = await this.redis.sMembers(`document:${documentId}:users`);
      
      // Notify all users in the room about the new user
      const presenceData = {
        documentId,
        userId: socket.user.userId,
        username: socket.user.username,
        action: 'joined',
        activeUsers: activeUserIds.map(id => parseInt(id))
      };

      // Publish to Redis for other instances
      await this.redisPub.publish('document:presence', JSON.stringify(presenceData));
      
      // Send to current instance
      this.io.to(documentId).emit('user:presence', presenceData);

      // Send current document content to the user
      socket.emit('document:content', {
        documentId,
        content: document.content,
        title: document.title,
        version: document.version
      });

      console.log(`User ${socket.user.username} joined document ${documentId}`);
    } catch (error) {
      console.error('Error in handleDocumentJoin:', error);
      socket.emit('error', { message: 'Failed to join document' });
    }
  }

  async handleDocumentLeave(socket, data) {
    try {
      const { documentId } = data;
      const userId = socket.user.userId;

      // Leave the room
      socket.leave(documentId);
      socket.currentDocument = null;

      // Remove from active users
      if (this.activeUsers.has(documentId)) {
        this.activeUsers.get(documentId).delete(userId);
        if (this.activeUsers.get(documentId).size === 0) {
          this.activeUsers.delete(documentId);
        }
      }

      // Remove from Redis
      await this.redis.sRem(`document:${documentId}:users`, userId.toString());

      // Get remaining active users
      const activeUserIds = await this.redis.sMembers(`document:${documentId}:users`);

      // Notify remaining users
      const presenceData = {
        documentId,
        userId,
        username: socket.user.username,
        action: 'left',
        activeUsers: activeUserIds.map(id => parseInt(id))
      };

      await this.redisPub.publish('document:presence', JSON.stringify(presenceData));
      this.io.to(documentId).emit('user:presence', presenceData);

      console.log(`User ${socket.user.username} left document ${documentId}`);
    } catch (error) {
      console.error('Error in handleDocumentLeave:', error);
    }
  }

  async handleDocumentEdit(socket, data) {
    try {
      const { documentId, content, cursorPosition } = data;

      // Update document in database (optimistic update)
      const document = await Document.findById(documentId);
      if (!document) {
        socket.emit('error', { message: 'Document not found' });
        return;
      }

      // Check write permission
      const userId = socket.user.userId;
      const isOwner = document.ownerId === userId;
      const collaborator = document.collaborators.find(c => c.userId === userId);
      const hasWriteAccess = isOwner || (collaborator && ['write', 'admin'].includes(collaborator.permission));

      if (!hasWriteAccess) {
        socket.emit('error', { message: 'No write permission' });
        return;
      }

      // Update document
      document.content = content;
      document.version += 1;
      document.lastEditedBy = {
        userId,
        username: socket.user.username,
        timestamp: new Date()
      };
      await document.save();

      // Prepare update data
      const updateData = {
        documentId,
        content,
        version: document.version,
        userId: socket.user.userId,
        username: socket.user.username,
        timestamp: new Date().toISOString(),
        socketId: socket.id
      };

      // Publish to Redis for other instances
      await this.redisPub.publish('document:updates', JSON.stringify(updateData));

      // Broadcast to other users in the same room (same instance)
      socket.to(documentId).emit('document:update', updateData);

      console.log(`Document ${documentId} updated by ${socket.user.username}`);
    } catch (error) {
      console.error('Error in handleDocumentEdit:', error);
      socket.emit('error', { message: 'Failed to update document' });
    }
  }

  async handleCursorPosition(socket, data) {
    try {
      const { documentId, position } = data;

      const cursorData = {
        documentId,
        userId: socket.user.userId,
        username: socket.user.username,
        position,
        socketId: socket.id
      };

      // Publish to Redis for other instances
      await this.redisPub.publish('document:cursor', JSON.stringify(cursorData));

      // Broadcast to other users in the same room
      socket.to(documentId).emit('cursor:move', cursorData);
    } catch (error) {
      console.error('Error in handleCursorPosition:', error);
    }
  }

  async handleTypingIndicator(socket, data) {
    try {
      const { documentId, isTyping } = data;

      socket.to(documentId).emit('user:typing', {
        userId: socket.user.userId,
        username: socket.user.username,
        isTyping
      });
    } catch (error) {
      console.error('Error in handleTypingIndicator:', error);
    }
  }

  async handleDisconnection(socket) {
    try {
      // If user was in a document room, clean up
      if (socket.currentDocument) {
        await this.handleDocumentLeave(socket, { documentId: socket.currentDocument });
      }
    } catch (error) {
      console.error('Error in handleDisconnection:', error);
    }
  }
}

module.exports = CollaborationHandler;