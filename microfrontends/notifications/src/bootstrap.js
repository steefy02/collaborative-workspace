import React from 'react';
import ReactDOM from 'react-dom/client';
import NotificationsWidget from './NotificationsWidget';

// Standalone mode: renders the microfrontend independently for development
const rootElement = document.getElementById('notifications-root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <div style={{ width: 300, height: '100vh', borderLeft: '1px solid #ddd' }}>
        <NotificationsWidget token={localStorage.getItem('token') || ''} />
      </div>
    </React.StrictMode>
  );
}
