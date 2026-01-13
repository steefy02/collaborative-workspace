const { validationResult } = require('express-validator');
const { pool } = require('../config/database');

// Get all notifications for the authenticated user
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT id, type, title, message, data, is_read, created_at 
       FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit), parseInt(offset)]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1',
      [userId]
    );

    res.json({
      notifications: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to retrieve notifications' });
  }
};

// Get unread notifications
exports.getUnreadNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT id, type, title, message, data, is_read, created_at 
       FROM notifications 
       WHERE user_id = $1 AND is_read = FALSE 
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({
      notifications: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Get unread notifications error:', error);
    res.status(500).json({ error: 'Failed to retrieve unread notifications' });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const notificationId = req.params.id;
    const userId = req.user.userId;

    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = TRUE 
       WHERE id = $1 AND user_id = $2 
       RETURNING id, is_read`,
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({
      message: 'Notification marked as read',
      notification: result.rows[0]
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
      [userId]
    );

    res.json({
      message: 'All notifications marked as read',
      updated: result.rowCount
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
};

// Delete a notification
exports.deleteNotification = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const notificationId = req.params.id;
    const userId = req.user.userId;

    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

// Get analytics data (from Kafka events)
exports.getAnalytics = async (req, res) => {
  try {
    const { eventType, documentId, limit = 100 } = req.query;

    let query = 'SELECT * FROM document_analytics WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (eventType) {
      query += ` AND event_type = $${paramCount}`;
      params.push(eventType);
      paramCount++;
    }

    if (documentId) {
      query += ` AND document_id = $${paramCount}`;
      params.push(documentId);
      paramCount++;
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    // Get event type counts
    const statsResult = await pool.query(
      'SELECT event_type, COUNT(*) as count FROM document_analytics GROUP BY event_type ORDER BY count DESC'
    );

    res.json({
      events: result.rows,
      statistics: statsResult.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to retrieve analytics' });
  }
};