const express = require('express');
const { param } = require('express-validator');
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Routes
router.get('/', notificationController.getNotifications);
router.get('/unread', notificationController.getUnreadNotifications);
router.put('/:id/read', param('id').isInt(), notificationController.markAsRead);
router.put('/read-all', notificationController.markAllAsRead);
router.delete('/:id', param('id').isInt(), notificationController.deleteNotification);
router.get('/analytics', notificationController.getAnalytics);

module.exports = router;