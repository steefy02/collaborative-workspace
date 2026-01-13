const express = require('express');
const { body, param, query } = require('express-validator');
const documentController = require('../controllers/documentController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Validation rules
const createDocumentValidation = [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title must be 1-200 characters'),
  body('content').optional().isString(),
  body('folder').optional().trim(),
  body('tags').optional().isArray()
];

const updateDocumentValidation = [
  param('id').isMongoId().withMessage('Invalid document ID'),
  body('title').optional().trim().isLength({ min: 1, max: 200 }),
  body('content').optional().isString(),
  body('folder').optional().trim(),
  body('tags').optional().isArray()
];

const shareDocumentValidation = [
  param('id').isMongoId().withMessage('Invalid document ID'),
  body('userId').isInt().withMessage('User ID must be an integer'),
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('permission').isIn(['read', 'write', 'admin']).withMessage('Invalid permission')
];

// Routes
router.get('/', documentController.listDocuments);
router.post('/', createDocumentValidation, documentController.createDocument);
router.get('/:id', param('id').isMongoId(), documentController.getDocument);
router.put('/:id', updateDocumentValidation, documentController.updateDocument);
router.delete('/:id', param('id').isMongoId(), documentController.deleteDocument);
router.post('/:id/share', shareDocumentValidation, documentController.shareDocument);
router.post('/:id/export', param('id').isMongoId(), documentController.exportToPDF);
router.get('/search/query', query('q').notEmpty(), documentController.searchDocuments);

module.exports = router;