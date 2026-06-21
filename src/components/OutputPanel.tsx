import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Download, Search, ShieldAlert, HelpCircle } from 'lucide-react';
import type { ExtractedJson, ApiDetail, UserDetail } from '../parsers/types';
import type { NormalizedLine } from '../parsers/log-normalizer';
import { JsonCard } from './JsonCard';
import { ApiCard } from './ApiCard';
import { UserDetailCard } from './UserDetailCard';
import { copyToClipboard } from '../utils/clipboard';
import { downloadAsFile } from '../utils/download';

export type OutputTab = 'json' | 'api' | 'users' | 'raw';

interface OutputPanelProps {
  jsons: ExtractedJson[];
  apis: ApiDetail[];
  userDetails: UserDetail[];
  lines: NormalizedLine[];
  activeTab: OutputTab;
  setActiveTab: (tab: OutputTab) => void;
  addToast: (msg: string, type: 'success' | 'warning' | 'info' | 'error') => void;
  onLocateInput: (line: number) => void;
}

export function OutputPanel({
  jsons,
  apis,
  userDetails,
  lines,
  activeTab,
  setActiveTab,
  addToast,
  onLocateInput,
}: OutputPanelProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [showLowConfidence, setShowLowConfidence] = useState(false);

  const handleCopyAllJson = async () => {
    if (jsons.length === 0) return;
    const combined = jsons.map(j => j.parsed);
    const text = JSON.stringify(combined, null, 2);
    const success = await copyToClipboard(text);
    if (success) {
      addToast('Copied all JSON blocks to clipboard! 📋', 'success');
    }
  };

  const handleDownloadAllJson = () => {
    if (jsons.length === 0) return;
    const combined = jsons.map(j => j.parsed);
    const text = JSON.stringify(combined, null, 2);
    downloadAsFile(text, 'all_extracted_jsons.json', 'application/json');
    addToast('Downloaded all JSON blocks as file! ⬇️', 'success');
  };

  // Filtering logic
  const filteredJsons = jsons.filter((json) => {
    if (!filterQuery) return true;
    const query = filterQuery.toLowerCase();
    
    // Check if query matches raw JSON string or context
    if (json.raw.toLowerCase().includes(query)) return true;
    if (json.context.toLowerCase().includes(query)) return true;
    
    // Check inside parsed keys/values
    try {
      const stringified = JSON.stringify(json.parsed).toLowerCase();
      if (stringified.includes(query)) return true;
    } catch {
      // ignore
    }
    return false;
  });

  const filteredApis = apis.filter((api) => {
    if (!showLowConfidence && api.confidence !== undefined && api.confidence < 0.4) {
      return false;
    }
    
    if (!filterQuery) return true;
    const query = filterQuery.toLowerCase();
    
    if (api.method?.toLowerCase().includes(query)) return true;
    if (api.url?.toLowerCase().includes(query)) return true;
    if (api.statusCode?.toString().includes(query)) return true;
    if (api.latency?.toLowerCase().includes(query)) return true;
    
    // Check request/response body contents
    try {
      if (api.requestBody && JSON.stringify(api.requestBody).toLowerCase().includes(query)) return true;
      if (api.responseBody && JSON.stringify(api.responseBody).toLowerCase().includes(query)) return true;
    } catch {
      // ignore
    }
    return false;
  });

  const filteredUserDetails = userDetails.filter((detail) => {
    if (!filterQuery) return true;
    const query = filterQuery.toLowerCase();
    if (detail.value.toLowerCase().includes(query)) return true;
    if (detail.type.toLowerCase().includes(query)) return true;
    if (detail.label?.toLowerCase().includes(query)) return true;
    if (detail.jsonPath?.toLowerCase().includes(query)) return true;
    return false;
  });

  return (
    <div className="pane pane-right">
      <div className="panel-header">
        <div className="tabs-container">
          <button
            className={`tab-button ${activeTab === 'json' ? 'active' : ''}`}
            onClick={() => setActiveTab('json')}
          >
            <span className="tab-dot" style={{ backgroundColor: 'var(--color-primary)' }} />
            JSONs
            <span className="tab-badge">{jsons.length}</span>
            {activeTab === 'json' && (
              <motion.div 
                className="tab-active-indicator"
                layoutId="activeTab"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </button>
          
          <button
            className={`tab-button ${activeTab === 'api' ? 'active' : ''}`}
            onClick={() => setActiveTab('api')}
          >
            <span className="tab-dot" style={{ backgroundColor: 'var(--color-accent)' }} />
            APIs
            <span className="tab-badge">{apis.length}</span>
            {activeTab === 'api' && (
              <motion.div 
                className="tab-active-indicator"
                layoutId="activeTab"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </button>

          <button
            className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <span className="tab-dot" style={{ backgroundColor: 'var(--color-warning)' }} />
            Users
            {userDetails.length > 0 && <span className="tab-badge">{userDetails.length}</span>}
            {activeTab === 'users' && (
              <motion.div 
                className="tab-active-indicator"
                layoutId="activeTab"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </button>

          <button
            className={`tab-button ${activeTab === 'raw' ? 'active' : ''}`}
            onClick={() => setActiveTab('raw')}
          >
            <span className="tab-dot" style={{ backgroundColor: 'var(--color-text-dim)' }} />
            Normalized
            {activeTab === 'raw' && (
              <motion.div 
                className="tab-active-indicator"
                layoutId="activeTab"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        </div>

        {/* Global Toolbar actions */}
        {jsons.length > 0 && activeTab === 'json' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCopyAllJson} className="file-input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Copy size={12} />
              Copy All
            </button>
            <button onClick={handleDownloadAllJson} className="file-input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={12} />
              Download All
            </button>
          </div>
        )}

        {apis.length > 0 && activeTab === 'api' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: '0.8125rem', color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={showLowConfidence} 
                onChange={(e) => setShowLowConfidence(e.target.checked)} 
                style={{ accentColor: 'var(--color-primary)' }}
              />
              Show low confidence APIs
            </label>
            <div className="tooltip-container">
              <HelpCircle size={14} style={{ color: 'var(--color-text-dim)', cursor: 'pointer' }} />
              <div className="tooltip-text">
                <strong>API Confidence Score:</strong><br />
                • <strong>High (≥70%):</strong> Contains URL, Method, Status Code, and request/response bodies.<br />
                • <strong>Medium (≥40%):</strong> Contains URL and at least Method or Status Code.<br />
                • <strong>Low (&lt;40%):</strong> Contains partial query parameters or unassociated details.
              </div>
            </div>
          </div>
        )}

        {userDetails.length > 0 && activeTab === 'users' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="tooltip-container">
              <HelpCircle size={14} style={{ color: 'var(--color-text-dim)', cursor: 'pointer' }} />
              <div className="tooltip-text">
                <strong>PII Confidence Score:</strong><br />
                • <strong>High:</strong> Matches explicit JSON keys or highly structured regex formats (e.g. bearer tokens, emails, refined phone formats).<br />
                • <strong>Medium:</strong> Matches general patterns on unstructured log lines.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search Bar for results */}
      {(jsons.length > 0 || apis.length > 0 || userDetails.length > 0) && activeTab !== 'raw' && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.02)' }}>
          <Search size={14} style={{ color: 'var(--color-text-dim)' }} />
          <input
            type="text"
            placeholder={`Filter ${activeTab === 'json' ? 'JSON objects' : activeTab === 'api' ? 'API requests' : 'user details'}...`}
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '0.8125rem',
              color: 'var(--color-text)',
              width: '100%',
            }}
          />
          {filterQuery && (
            <button onClick={() => setFilterQuery('')} className="card-action-btn" style={{ fontSize: '0.75rem' }}>✕</button>
          )}
        </div>
      )}

      {/* Main output view content */}
      <div className="panel-content">
        <AnimatePresence mode="wait">
          {activeTab === 'json' && (
            <motion.div
              key="json-view"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="result-card-list"
            >
              {filteredJsons.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-dim)' }}>
                  {filterQuery ? 'No results match your search query.' : 'No JSON blocks found.'}
                </div>
              ) : (
                filteredJsons.map((json, idx) => (
                  <JsonCard
                    key={json.id}
                    json={json}
                    index={idx}
                    addToast={addToast}
                    onLocateInput={onLocateInput}
                  />
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'api' && (
            <motion.div
              key="api-view"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="result-card-list"
            >
              {filteredApis.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-dim)' }}>
                  {filterQuery ? 'No results match your search query.' : 'No API logs found.'}
                </div>
              ) : (
                filteredApis.map((api, idx) => (
                  <ApiCard
                    key={api.id}
                    api={api}
                    index={idx}
                    addToast={addToast}
                    onLocateInput={onLocateInput}
                  />
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div
              key="users-view"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="result-card-list"
            >
              {/* PII Warning Banner */}
              <div className="pii-warning-banner">
                <ShieldAlert size={16} />
                <span>Sensitive data detected. Be cautious when sharing screenshots or copying values — tokens and PII are displayed below.</span>
              </div>

              {filteredUserDetails.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-dim)' }}>
                  {filterQuery ? 'No results match your search query.' : 'No user details or tokens found.'}
                </div>
              ) : (
                filteredUserDetails.map((detail, idx) => (
                  <UserDetailCard
                    key={detail.id}
                    detail={detail}
                    index={idx}
                    addToast={addToast}
                    onLocateInput={onLocateInput}
                  />
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'raw' && (
            <motion.div
              key="raw-view"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8125rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                backgroundColor: 'var(--code-bg)',
                padding: '16px',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--color-text-muted)',
                maxHeight: '100%',
                overflowY: 'auto',
                border: '1px solid var(--color-border)',
              }}
            >
              {lines.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--color-text-dim)', padding: '20px' }}>
                  No lines to display. Paste some logs to see normalized output.
                </div>
              ) : (
                lines.map((line, idx) => {
                  const lineNum = idx + 1;
                  
                  // Check if this line is part of any extracted JSON
                  const isJsonLine = jsons.some(
                    j => lineNum >= j.location.startLine && lineNum <= j.location.endLine
                  );

                  return (
                    <div 
                      key={idx}
                      style={{ 
                        display: 'flex', 
                        backgroundColor: isJsonLine ? 'rgba(20, 184, 166, 0.06)' : 'transparent',
                        padding: '1px 4px',
                        borderLeft: isJsonLine ? '2px solid var(--color-primary)' : '2px solid transparent'
                      }}
                    >
                      <span style={{ 
                        width: '40px', 
                        color: 'var(--color-text-dim)', 
                        userSelect: 'none', 
                        display: 'inline-block',
                        flexShrink: 0,
                      }}>
                        {lineNum}
                      </span>
                      
                      {line.metadata?.prefix && (
                        <span style={{ color: 'var(--color-text-dim)', opacity: 0.6, marginRight: 4 }}>
                          {line.metadata.prefix}
                        </span>
                      )}
                      
                      <span style={{ color: isJsonLine ? 'var(--color-text)' : 'inherit' }}>
                        {line.normalizedText}
                      </span>
                    </div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
