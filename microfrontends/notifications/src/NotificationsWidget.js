import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './NotificationsWidget.css';

function NotificationsWidget({ token, apiBaseUrl }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const api = axios.create({
    baseURL: apiBaseUrl || '',
    headers: { Authorization: `Bearer ${token}` },
  });

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/api/notifications', {
        params: { limit: 10 },
      });
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.notifications.filter((n) => !n.is_read).length);
    } catch (err) {
      console.error('Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/api/notifications/${id}/read`);
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/api/notifications/read-all');
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
        {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
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
          notifications.map((notif) => (
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
