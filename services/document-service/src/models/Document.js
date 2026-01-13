const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    default: ''
  },
  ownerId: {
    type: Number,
    required: true,
    index: true
  },
  ownerUsername: {
    type: String,
    required: true
  },
  collaborators: [{
    userId: Number,
    username: String,
    permission: {
      type: String,
      enum: ['read', 'write', 'admin'],
      default: 'read'
    }
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  folder: {
    type: String,
    default: 'root'
  },
  tags: [{
    type: String,
    trim: true
  }],
  version: {
    type: Number,
    default: 1
  },
  lastEditedBy: {
    userId: Number,
    username: String,
    timestamp: Date
  }
}, {
  timestamps: true
});

// Index for searching
documentSchema.index({ title: 'text', content: 'text' });
documentSchema.index({ ownerId: 1, createdAt: -1 });

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;