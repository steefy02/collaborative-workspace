import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import Login from './components/Login';
import DocumentList from './components/DocumentList';
import DocumentEditor from './components/DocumentEditor';
import NotificationsWidget from './microfrontends/NotificationsWidget';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (token) {
      // Decode JWT to get user info (simple decode, no verification needed on client)
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
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div className="App">
        <header className="app-header">
          <h1>📝 Collaborative Workspace</h1>
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

          <aside className="notifications-sidebar">
            <NotificationsWidget token={token} />
          </aside>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;