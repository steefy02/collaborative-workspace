import React from 'react';
import ReactDOM from 'react-dom/client';
import LoginForm from './LoginForm';

// Standalone mode: renders the auth microfrontend independently for development
const rootElement = document.getElementById('auth-root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <LoginForm
        onLogin={(token) => {
          console.log('Token received (standalone mode):', token);
          localStorage.setItem('token', token);
          alert('Login successful! Token stored.');
        }}
      />
    </React.StrictMode>
  );
}
