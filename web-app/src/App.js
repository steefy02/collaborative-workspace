import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import DocumentList from './components/DocumentList';
import DocumentEditor from './components/DocumentEditor';
import './App.css';

// Load NotificationsWidget from the remote notifications microfrontend
// Fetched at runtime from the independently deployed notifications_mfe container
const RemoteNotificationsWidget = React.lazy(() =>
  import('notifications_mfe/NotificationsWidget').catch(() => ({
    default: () => (
      <div className="notifications-widget">
        <h3>🔔 Notifications</h3>
        <p className="mfe-error">Notifications service unavailable</p>
      </div>
    ),
  }))
);

// Load LoginForm from the remote auth microfrontend
// Fetched at runtime from the independently deployed auth_mfe container
const RemoteLoginForm = React.lazy(() =>
  import('auth_mfe/LoginForm').catch(() => ({
    default: ({ onLogin }) => (
      <div className="login-container">
        <div className="login-card">
          <h2>Collaborative Workspace</h2>
          <p className="mfe-error">Auth service unavailable. Please try again later.</p>
        </div>
      </div>
    ),
  }))
);

// Error boundary for microfrontends - isolates failures from crashing the shell
class MicroFrontendErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Microfrontend load error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <p className="mfe-error">Failed to load microfrontend</p>
          <button
            className="secondary"
            onClick={() => this.setState({ hasError: false })}
            style={{ fontSize: '12px' }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
      } catch (e) {
        console.error('Invalid token');
        handleLogout();
      }
    }
  }, [token]);

  const handleLogin = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  if (!token) {
    return (
      <BrowserRouter>
        <MicroFrontendErrorBoundary
          fallback={
            <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <div style={{ background: 'white', padding: 40, borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.2)', width: '100%', maxWidth: 400, textAlign: 'center' }}>
                <h2 style={{ color: '#2c3e50', marginBottom: 10 }}>Collaborative Workspace</h2>
                <p className="mfe-error">Auth service failed to load. Please refresh.</p>
              </div>
            </div>
          }
        >
          <Suspense
            fallback={
              <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <div style={{ background: 'white', padding: 40, borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.2)', width: '100%', maxWidth: 400, textAlign: 'center' }}>
                  <h2 style={{ color: '#2c3e50', marginBottom: 10 }}>Collaborative Workspace</h2>
                  <p style={{ color: '#666' }}>Loading...</p>
                </div>
              </div>
            }
          >
            <Routes>
              <Route path="/login" element={<RemoteLoginForm onLogin={handleLogin} />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </MicroFrontendErrorBoundary>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div className="App">
        <header className="app-header">
          <h1>Collaborative Workspace</h1>
          <div className="header-right">
            <span>Welcome, {user?.username}!</span>
            <button onClick={handleLogout} className="secondary">Logout</button>
          </div>
        </header>

        <div className="app-layout">
          <aside className="sidebar">
            <nav>
              <Link to="/documents" className="nav-link">📄 My Documents</Link>
            </nav>
          </aside>

          <main className="main-content">
            <Routes>
              <Route path="/" element={<Navigate to="/documents" replace />} />
              <Route path="/documents" element={<DocumentList token={token} />} />
              <Route path="/documents/:id" element={<DocumentEditor token={token} user={user} />} />
            </Routes>
          </main>

          {/* Notifications Microfrontend - loaded remotely via Module Federation */}
          <aside className="notifications-sidebar">
            <MicroFrontendErrorBoundary>
              <Suspense
                fallback={
                  <div className="notifications-widget">
                    <h3>🔔 Notifications</h3>
                    <p className="loading-text">Loading microfrontend...</p>
                  </div>
                }
              >
                <RemoteNotificationsWidget token={token} />
              </Suspense>
            </MicroFrontendErrorBoundary>
          </aside>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;