import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import type { ApiDetail } from '../parsers/types';
import { JsonTree } from './JsonTree';
import { copyToClipboard } from '../utils/clipboard';

interface ApiCardProps {
  api: ApiDetail;
  index: number;
  addToast: (msg: string, type: 'success' | 'warning' | 'info' | 'error') => void;
  onLocateInput: (line: number) => void;
}

export function ApiCard({ api, index, addToast, onLocateInput }: ApiCardProps) {
  const [isReqOpen, setIsReqOpen] = useState(false);
  const [isResOpen, setIsResOpen] = useState(false);
  const [isHeadersOpen, setIsHeadersOpen] = useState(false);
  const [isErrorOpen, setIsErrorOpen] = useState(true);
  const [isQueryParamsOpen, setIsQueryParamsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const getStatusClass = (code?: number) => {
    if (!code) return 'api-status-badge';
    if (code >= 200 && code < 300) return 'api-status-badge status-2xx';
    if (code >= 300 && code < 400) return 'api-status-badge status-3xx';
    if (code >= 400 && code < 500) return 'api-status-badge status-4xx';
    return 'api-status-badge status-5xx';
  };

  const handleCopyDetails = async () => {
    const lines = [
      `${api.method || 'GET'} ${api.url || '/'}`,
      api.statusCode ? `Status: ${api.statusCode}` : '',
      api.latency ? `Latency: ${api.latency}` : '',
      '',
    ];

    if (api.headers) {
      lines.push('Headers:');
      lines.push(JSON.stringify(api.headers, null, 2));
      lines.push('');
    }

    if (api.requestBody) {
      lines.push('Request Body:');
      lines.push(JSON.stringify(api.requestBody, null, 2));
      lines.push('');
    }

    if (api.responseBody) {
      lines.push('Response Body:');
      lines.push(JSON.stringify(api.responseBody, null, 2));
      lines.push('');
    }

    const text = lines.filter(Boolean).join('\n');
    const success = await copyToClipboard(text);
    if (success) {
      setIsCopied(true);
      addToast('Copied API details! 📋', 'success');
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const methodLower = (api.method || 'GET').toLowerCase();

  const renderHighlightedUrl = (url?: string) => {
    if (!url) return <span className="api-url-path">/</span>;
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const parsed = new URL(url);
        return (
          <span className="api-url-wrapper font-mono">
            <span className="api-url-domain">{parsed.protocol}//{parsed.host}</span>
            <span className="api-url-path">{parsed.pathname}</span>
            {parsed.search && <span className="api-url-query">{parsed.search}</span>}
          </span>
        );
      }
    } catch {
      // ignore
    }

    const qMarkIdx = url.indexOf('?');
    if (qMarkIdx !== -1) {
      return (
        <span className="api-url-wrapper font-mono">
          <span className="api-url-path">{url.substring(0, qMarkIdx)}</span>
          <span className="api-url-query">{url.substring(qMarkIdx)}</span>
        </span>
      );
    }
    return <span className="api-url-wrapper font-mono"><span className="api-url-path">{url}</span></span>;
  };

  const renderConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.7) {
      return <span className="card-index-badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>High</span>;
    }
    if (confidence >= 0.4) {
      return <span className="card-index-badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-warning)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>Med</span>;
    }
    return <span className="card-index-badge" style={{ backgroundColor: 'rgba(107, 114, 128, 0.15)', color: 'var(--color-text-dim)', border: '1px solid rgba(107, 114, 128, 0.3)' }}>Low</span>;
  };

  return (
    <motion.div 
      className={`result-card api-card-container method-card-${methodLower}`}
      style={{ opacity: api.confidence < 0.4 ? 0.7 : 1 }}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: api.confidence < 0.4 ? 0.7 : 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(0.15, index * 0.03) }}
    >
      <div className="card-header">
        <div className="card-title-group" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="card-index-badge">#{index + 1}</span>
          {api.confidence !== undefined && renderConfidenceBadge(api.confidence)}
          <span 
            className={`api-method-badge ${methodLower}`}
            style={{ cursor: 'pointer' }}
            onClick={() => onLocateInput(api.sourceLines[0])}
            title={api.rawContext || `Jump to line ${api.sourceLines[0]} in source logs`}
          >
            {api.method || 'UNKNOWN'}
          </span>
          {renderHighlightedUrl(api.url)}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {api.statusCode && (
            <span className={getStatusClass(api.statusCode)}>
              {api.statusCode}
            </span>
          )}
          {api.latency && (
            <span className="api-latency-text">
              ⏱️ {api.latency}
            </span>
          )}
          {api.timestamp && (
            <span className="api-latency-text" style={{ marginLeft: 8 }}>
              🕒 {api.timestamp}
            </span>
          )}
          
          <div className="card-actions">
            <button onClick={handleCopyDetails} className="card-action-btn" title="Copy API Details">
              {isCopied ? <Check size={14} style={{ color: 'var(--color-success)' }} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      </div>

      <div className="card-body">
        <div className="api-subsections">
          {/* Error Section */}
          {!!api.error && (
            <div className="api-subsection" style={{ borderLeftColor: 'var(--color-error)' }}>
              <div 
                className="api-subsection-header"
                onClick={() => setIsErrorOpen(!isErrorOpen)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="subsection-dot" style={{ backgroundColor: 'var(--color-error)' }} />
                  <span style={{ color: 'var(--color-error)', fontWeight: 600 }}>Error Details</span>
                </div>
                {isErrorOpen ? <ChevronUp size={14} style={{ color: 'var(--color-error)' }} /> : <ChevronDown size={14} style={{ color: 'var(--color-error)' }} />}
              </div>
              {isErrorOpen && (
                <div className="api-subsection-body">
                  {api.error.code && <div style={{ marginBottom: 4, fontWeight: 'bold' }}>Code: {api.error.code}</div>}
                  {api.error.message && <div style={{ marginBottom: 8 }}>{api.error.message}</div>}
                  {api.error.stackTrace && (
                    <pre style={{ fontSize: '0.75rem', overflowX: 'auto', backgroundColor: 'rgba(0,0,0,0.05)', padding: 8, borderRadius: 4, color: 'var(--color-error)' }}>
                      {api.error.stackTrace}
                    </pre>
                  )}
                  {!api.error.code && !api.error.message && !api.error.stackTrace && <JsonTree data={api.error} />}
                </div>
              )}
            </div>
          )}

          {/* Query Params Section */}
          {!!api.queryParams && Object.keys(api.queryParams).length > 0 && (
            <div className="api-subsection">
              <div 
                className="api-subsection-header"
                onClick={() => setIsQueryParamsOpen(!isQueryParamsOpen)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="subsection-dot" style={{ backgroundColor: 'var(--color-warning)' }} />
                  <span>Query Params ({Object.keys(api.queryParams).length})</span>
                </div>
                {isQueryParamsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
              {isQueryParamsOpen && (
                <div className="api-subsection-body">
                  <JsonTree data={api.queryParams} />
                </div>
              )}
            </div>
          )}

          {/* Headers Section */}
          {!!api.headers && (
            <div className="api-subsection">
              <div 
                className="api-subsection-header"
                onClick={() => setIsHeadersOpen(!isHeadersOpen)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="subsection-dot" style={{ backgroundColor: 'var(--color-info)' }} />
                  <span>Headers ({Object.keys(api.headers).length})</span>
                </div>
                {isHeadersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
              {isHeadersOpen && (
                <div className="api-subsection-body">
                  <JsonTree data={api.headers} />
                </div>
              )}
            </div>
          )}

          {/* Request Body Section */}
          {!!api.requestBody && (
            <div className="api-subsection">
              <div 
                className="api-subsection-header"
                onClick={() => setIsReqOpen(!isReqOpen)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="subsection-dot" style={{ backgroundColor: 'var(--color-accent)' }} />
                  <span>Request Payload</span>
                </div>
                {isReqOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
              {isReqOpen && (
                <div className="api-subsection-body">
                  <JsonTree data={api.requestBody} />
                </div>
              )}
            </div>
          )}

          {/* Response Body Section */}
          {!!api.responseBody && (
            <div className="api-subsection">
              <div 
                className="api-subsection-header"
                onClick={() => setIsResOpen(!isResOpen)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="subsection-dot" style={{ backgroundColor: 'var(--color-primary)' }} />
                  <span>Response Payload</span>
                </div>
                {isResOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
              {isResOpen && (
                <div className="api-subsection-body">
                  <JsonTree data={api.responseBody} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
