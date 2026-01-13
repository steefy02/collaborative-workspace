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
  const [title, setTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUsername, setShareUsername] = useState('');
  const [shareUserId, setShareUserId] = useState('');
  const [sharePermission, setSharePermission] = useState('write');
  const socketRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const textareaRef = useRef(null);

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
      setTitle(response.data.document.title);
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
      setTitle(data.title);
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
      setSaving(true);
      const response = await axios({
        method: 'post',
        url: `/api/documents/${id}/export`,
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        responseType: 'blob'
      });
      
      // Create blob URL and trigger download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      // Simplified filename without version/timestamp
      a.setAttribute('download', `${document.title.replace(/[^a-z0-9]/gi, '_')}.pdf`);
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      alert('PDF exported successfully!');
    } catch (err) {
      console.error('PDF export error:', err);
      alert('PDF export failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const shareDocument = async () => {
    if (!shareUsername || !shareUserId) {
      alert('Please enter both username and user ID');
      return;
    }

    try {
      await axios.post(`/api/documents/${id}/share`, 
        {
          userId: parseInt(shareUserId),
          username: shareUsername,
          permission: sharePermission
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      alert(`Document shared with ${shareUsername}!`);
      setShowShareModal(false);
      setShareUsername('');
      setShareUserId('');
    } catch (err) {
      alert('Failed to share document: ' + (err.response?.data?.error || err.message));
    }
  };

  const updateTitle = async () => {
    if (!title.trim()) {
      alert('Title cannot be empty');
      setTitle(document.title);
      setIsEditingTitle(false);
      return;
    }

    try {
      await axios.put(`/api/documents/${id}`, 
        { title: title.trim() },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setDocument(prev => ({ ...prev, title: title.trim() }));
      setIsEditingTitle(false);
    } catch (err) {
      alert('Failed to update title');
      setTitle(document.title);
      setIsEditingTitle(false);
    }
  };

  if (!document) return <div className="loading">Loading...</div>;

  return (
    <div className="document-editor">
      <div className="editor-header">
        <button onClick={() => navigate('/documents')} className="secondary">
          ← Back
        </button>
        {isEditingTitle ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={updateTitle}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                updateTitle();
              }
            }}
            autoFocus
            className="title-input"
          />
        ) : (
          <h2 onClick={() => setIsEditingTitle(true)} className="editable-title" style={{ cursor: 'pointer' }}>
            {document.title}
          </h2>
        )}
        <div className="editor-actions">
          <span className={`save-status ${saving ? 'saving' : 'saved'}`}>
            {saving ? '💾 Saving...' : '✓ Saved'}
          </span>
          <button onClick={() => setShowShareModal(true)} className="secondary">
            👥 Share
          </button>
          <button onClick={exportPDF} className="secondary">
            📄 Export PDF
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Share Document</h3>
            <input
              type="number"
              placeholder="User ID (e.g., 2)"
              value={shareUserId}
              onChange={(e) => setShareUserId(e.target.value)}
            />
            <input
              type="text"
              placeholder="Username"
              value={shareUsername}
              onChange={(e) => setShareUsername(e.target.value)}
            />
            <select value={sharePermission} onChange={(e) => setSharePermission(e.target.value)}>
              <option value="read">Read Only</option>
              <option value="write">Can Edit</option>
              <option value="admin">Admin</option>
            </select>
            <div className="modal-buttons">
              <button onClick={shareDocument} className="primary">Share</button>
              <button onClick={() => setShowShareModal(false)} className="secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="active-users">
        <strong>Active Users ({activeUsers.length}):</strong>
        {activeUsers.map(userId => (
          <span key={userId} className="user-badge">User {userId}</span>
        ))}
      </div>

      <textarea
        ref={textareaRef}
        className="editor-textarea"
        value={content}
        onChange={handleContentChange}
        placeholder="Start typing..."
      />
    </div>
  );
}

export default DocumentEditor;