const { validationResult } = require('express-validator');
const Document = require('../models/Document');
const { notifyDocumentShared, notifyUserMentioned } = require('../config/rabbitmq');
const { logDocumentCreated, logDocumentUpdated, logDocumentDeleted, logDocumentViewed, logDocumentShared } = require('../config/kafka');
const axios = require('axios');

// List all documents for the authenticated user
exports.listDocuments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { folder, limit = 50, skip = 0 } = req.query;

    const query = {
      $or: [
        { ownerId: userId },
        { 'collaborators.userId': userId },
        { isPublic: true }
      ]
    };

    if (folder) {
      query.folder = folder;
    }

    const documents = await Document.find(query)
      .select('-content') // Don't return full content in list
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Document.countDocuments(query);

    res.json({
      documents,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({ error: 'Failed to retrieve documents' });
  }
};

// Create a new document
exports.createDocument = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, content = '', folder = 'root', tags = [] } = req.body;
    const userId = req.user.userId;
    const username = req.user.username;

    const document = new Document({
      title,
      content,
      ownerId: userId,
      ownerUsername: username,
      folder,
      tags,
      lastEditedBy: {
        userId,
        username,
        timestamp: new Date()
      }
    });

    await document.save();

    // Log to Kafka
    await logDocumentCreated(document._id.toString(), title, userId, username);

    res.status(201).json({
      message: 'Document created successfully',
      document
    });
  } catch (error) {
    console.error('Create document error:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
};

// Get a single document
exports.getDocument = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const documentId = req.params.id;
    const userId = req.user.userId;

    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check permissions
    const isOwner = document.ownerId === userId;
    const isCollaborator = document.collaborators.some(c => c.userId === userId);
    const isPublic = document.isPublic;

    if (!isOwner && !isCollaborator && !isPublic) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Log view to Kafka
    await logDocumentViewed(documentId, document.title, userId, req.user.username);

    res.json({ document });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Failed to retrieve document' });
  }
};

// Update a document
exports.updateDocument = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const documentId = req.params.id;
    const userId = req.user.userId;
    const username = req.user.username;
    const updates = req.body;

    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check permissions
    const isOwner = document.ownerId === userId;
    const collaborator = document.collaborators.find(c => c.userId === userId);
    const hasWriteAccess = isOwner || (collaborator && ['write', 'admin'].includes(collaborator.permission));

    if (!hasWriteAccess) {
      return res.status(403).json({ error: 'No write permission' });
    }

    // Update fields
    if (updates.title !== undefined) document.title = updates.title;
    if (updates.content !== undefined) document.content = updates.content;
    if (updates.folder !== undefined) document.folder = updates.folder;
    if (updates.tags !== undefined) document.tags = updates.tags;

    document.version += 1;
    document.lastEditedBy = {
      userId,
      username,
      timestamp: new Date()
    };

    await document.save();

    // Log to Kafka
    await logDocumentUpdated(documentId, document.title, userId, username, Object.keys(updates));

    res.json({
      message: 'Document updated successfully',
      document
    });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
};

// Delete a document
exports.deleteDocument = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const documentId = req.params.id;
    const userId = req.user.userId;
    const username = req.user.username;

    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Only owner can delete
    if (document.ownerId !== userId) {
      return res.status(403).json({ error: 'Only owner can delete document' });
    }

    await Document.findByIdAndDelete(documentId);

    // Log to Kafka
    await logDocumentDeleted(documentId, document.title, userId, username);

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
};

// Share document with another user
exports.shareDocument = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const documentId = req.params.id;
    const userId = req.user.userId;
    const { userId: sharedUserId, username: sharedUsername, permission } = req.body;

    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Only owner or admin collaborators can share
    const isOwner = document.ownerId === userId;
    const collaborator = document.collaborators.find(c => c.userId === userId);
    const canShare = isOwner || (collaborator && collaborator.permission === 'admin');

    if (!canShare) {
      return res.status(403).json({ error: 'No permission to share document' });
    }

    // Check if already shared
    const existingCollaborator = document.collaborators.find(c => c.userId === sharedUserId);
    if (existingCollaborator) {
      existingCollaborator.permission = permission;
    } else {
      document.collaborators.push({
        userId: sharedUserId,
        username: sharedUsername,
        permission
      });
    }

    await document.save();

    // Notify via RabbitMQ
    await notifyDocumentShared(documentId, document.title, userId, sharedUserId, sharedUsername);

    // Log to Kafka
    await logDocumentShared(documentId, document.title, userId, sharedUserId);

    res.json({
      message: 'Document shared successfully',
      document
    });
  } catch (error) {
    console.error('Share document error:', error);
    res.status(500).json({ error: 'Failed to share document' });
  }
};

// Export document to PDF (FaaS trigger)
exports.exportToPDF = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const documentId = req.params.id;
    const userId = req.user.userId;

    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check permissions
    const isOwner = document.ownerId === userId;
    const isCollaborator = document.collaborators.some(c => c.userId === userId);
    const isPublic = document.isPublic;

    if (!isOwner && !isCollaborator && !isPublic) {
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log(`Calling FaaS to generate PDF for document: ${documentId}`);

    // Call FaaS function for PDF generation
    const faasUrl = process.env.FAAS_URL || 'http://pdf-export-function:8080';
    const response = await axios.post(`${faasUrl}/function/pdf-export`, {
      title: document.title,
      content: document.content,
      metadata: {
        author: document.ownerUsername,
        createdAt: document.createdAt,
        version: document.version
      }
    }, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    // Set headers and send PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${document.title.replace(/[^a-z0-9]/gi, '_')}.pdf"`);
    res.send(response.data);

    console.log(`PDF generated successfully for document: ${documentId}`);
  } catch (error) {
    console.error('Export PDF error:', error);
    if (error.response) {
      res.status(error.response.status).json({ error: 'FaaS function error', details: error.message });
    } else {
      res.status(500).json({ error: 'Failed to export document', details: error.message });
    }
  }
};

// Search documents
exports.searchDocuments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { q, limit = 20 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const documents = await Document.find({
      $and: [
        {
          $or: [
            { ownerId: userId },
            { 'collaborators.userId': userId },
            { isPublic: true }
          ]
        },
        {
          $text: { $search: q }
        }
      ]
    })
    .select('-content')
    .limit(parseInt(limit))
    .sort({ score: { $meta: 'textScore' } });

    res.json({
      query: q,
      documents,
      count: documents.length
    });
  } catch (error) {
    console.error('Search documents error:', error);
    res.status(500).json({ error: 'Failed to search documents' });
  }
};