import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import './DocumentEditor.css';

function DocumentEditor({ token, user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [content, setContent] = useState('');
  const [activeUsers, setActiveUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const socketRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    fetchDocument();
    connectWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [id]);

  const fetchDocument = async () => {
    try {
      const response = await axios.get(`/api/documents/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocument(response.data.document);
      setContent(response.data.document.content);
    } catch (err) {
      setError('Failed to load document');
    }
  };

  const connectWebSocket = () => {
    socketRef.current = io('/', { auth: { token } });

    socketRef.current.on('connect', () => {
      console.log('WebSocket connected');
      socketRef.current.emit('document:join', { documentId: id });
    });

    socketRef.current.on('document:content', (data) => {
      setDocument(prev => ({ ...prev, ...data }));
      setContent(data.content);
    });

    socketRef.current.on('document:update', (data) => {
      if (data.userId !== user.userId) {
        setContent(data.content);
      }
    });

    socketRef.current.on('user:presence', (data) => {
      setActiveUsers(data.activeUsers || []);
    });

    socketRef.current.on('error', (err) => {
      console.error('WebSocket error:', err);
    });
  };

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);

    // Debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveDocument(newContent);
    }, 1000);
  };

  const saveDocument = async (newContent) => {
    setSaving(true);
    try {
      await axios.put(`/api/documents/${id}`, 
        { content: newContent },
        { headers: { Authorization: `Bearer ${token}` }}
      );

      if (socketRef.current) {
        socketRef.current.emit('document:edit', {
          documentId: id,
          content: newContent
        });
      }
    } catch (err) {
      setError('Failed to save document');
    } finally {
      setSaving(false);
    }
  };

  const exportPDF = async () => {
    try {
      const response = await axios.post(`/api/documents/${id}/export`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${document.title}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('PDF export failed');
    }
  };

  if (!document) return <div className="loading">Loading...</div>;

  return (
    <div className="document-editor">
      <div className="editor-header">
        <button onClick={() => navigate('/documents')} className="secondary">
          ← Back
        </button>
        <h2>{document.title}</h2>
        <div className="editor-actions">
          <span className={`save-status ${saving ? 'saving' : 'saved'}`}>
            {saving ? '💾 Saving...' : '✓ Saved'}
          </span>
          <button onClick={exportPDF} className="secondary">
            📄 Export PDF
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="active-users">
        <strong>Active Users ({activeUsers.length}):</strong>
        {activeUsers.map(userId => (
          <span key={userId} className="user-badge">User {userId}</span>
        ))}
      </div>

      <textarea
        className="editor-textarea"
        value={content}
        onChange={handleContentChange}
        placeholder="Start typing..."
      />
    </div>
  );
}

export default DocumentEditor;