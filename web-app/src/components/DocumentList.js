import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './DocumentList.css';

function DocumentList({ token }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await axios.get('/api/documents', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(response.data.documents);
    } catch (err) {
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const createDocument = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/documents', 
        { title: newDocTitle, content: '' },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      navigate(`/documents/${response.data.document._id}`);
    } catch (err) {
      setError('Failed to create document');
    }
  };

  const deleteDocument = async (id) => {
    if (!window.confirm('Delete this document?')) return;
    
    try {
      await axios.delete(`/api/documents/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDocuments();
    } catch (err) {
      setError('Failed to delete document');
    }
  };

  if (loading) return <div className="loading">Loading documents...</div>;

  return (
    <div className="document-list">
      <div className="list-header">
        <h2>My Documents</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="primary">
          + New Document
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {showCreate && (
        <div className="card create-form">
          <form onSubmit={createDocument}>
            <input
              type="text"
              placeholder="Document title"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              required
            />
            <div className="form-buttons">
              <button type="submit" className="primary">Create</button>
              <button type="button" onClick={() => setShowCreate(false)} className="secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="documents-grid">
        {documents.length === 0 ? (
          <p className="empty-state">No documents yet. Create your first one!</p>
        ) : (
          documents.map(doc => (
            <div key={doc._id} className="document-card">
              <h3 onClick={() => navigate(`/documents/${doc._id}`)}>{doc.title}</h3>
              <p className="doc-meta">
                Last edited: {new Date(doc.updatedAt).toLocaleDateString()}
              </p>
              <div className="doc-actions">
                <button 
                  onClick={() => navigate(`/documents/${doc._id}`)} 
                  className="secondary"
                >
                  Open
                </button>
                <button 
                  onClick={() => deleteDocument(doc._id)} 
                  className="danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default DocumentList;