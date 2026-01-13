import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './NotificationsWidget.css';

function NotificationsWidget({ token }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 10 }
      });
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.notifications.filter(n => !n.is_read).length);
    } catch (err) {
      console.error('Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await axios.put(`/api/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.put('/api/notifications/read-all', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark all as read');
    }
  };

  if (loading) {
    return (
      <div className="notifications-widget">
        <h3>🔔 Notifications</h3>
        <p className="loading-text">Loading...</p>
      </div>
    );
  }

  return (
    <div className="notifications-widget">
      <div className="widget-header">
        <h3>🔔 Notifications</h3>
        {unreadCount > 0 && (
          <span className="unread-badge">{unreadCount}</span>
        )}
      </div>

      {unreadCount > 0 && (
        <button onClick={markAllAsRead} className="mark-all-btn">
          Mark all as read
        </button>
      )}

      <div className="notifications-list">
        {notifications.length === 0 ? (
          <p className="empty-state">No notifications</p>
        ) : (
          notifications.map(notif => (
            <div 
              key={notif.id} 
              className={`notification-item ${notif.is_read ? 'read' : 'unread'}`}
              onClick={() => !notif.is_read && markAsRead(notif.id)}
            >
              <div className="notif-title">{notif.title}</div>
              <div className="notif-message">{notif.message}</div>
              <div className="notif-time">
                {new Date(notif.created_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default NotificationsWidget;