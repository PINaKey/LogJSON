import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import type { UserDetail } from '../parsers/types';
import { JsonTree } from './JsonTree';
import { copyToClipboard } from '../utils/clipboard';

interface UserDetailCardProps {
  detail: UserDetail;
  index: number;
  addToast: (msg: string, type: 'success' | 'warning' | 'info' | 'error') => void;
  onLocateInput: (line: number) => void;
}

const TYPE_CONFIG: Record<UserDetail['type'], { icon: string; color: string; label: string }> = {
  bearer_token: { icon: '🔑', color: 'var(--color-warning)', label: 'Bearer Token' },
  api_key: { icon: '🗝️', color: 'var(--color-danger)', label: 'API Key' },
  email: { icon: '📧', color: 'var(--color-info)', label: 'Email' },
  user_id: { icon: '👤', color: 'var(--color-accent)', label: 'User ID' },
  username: { icon: '👤', color: 'var(--color-accent)', label: 'Username' },
  session_id: { icon: '🎫', color: 'var(--color-primary)', label: 'Session ID' },
  phone: { icon: '📱', color: 'var(--color-success)', label: 'Phone' },
  ip_address: { icon: '🌐', color: 'var(--color-text-secondary)', label: 'IP Address' },
};

function formatTimestamp(epoch: number): string {
  try {
    const date = new Date(epoch * 1000);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
  } catch {
    return '';
  }
}

function truncateToken(value: string, maxLen = 40): string {
  if (value.length <= maxLen) return value;
  const half = Math.floor((maxLen - 3) / 2);
  return value.substring(0, half) + '...' + value.substring(value.length - half);
}

export function UserDetailCard({ detail, index, addToast, onLocateInput }: UserDetailCardProps) {
  const [isJwtOpen, setIsJwtOpen] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  const config = TYPE_CONFIG[detail.type];

  const handleCopy = async () => {
    const text = detail.value;
    const success = await copyToClipboard(text);
    if (success) {
      setIsCopied(true);
      addToast(`Copied ${config.label} to clipboard!`, 'success');
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const isToken = detail.type === 'bearer_token' || detail.type === 'api_key' || detail.type === 'session_id';
  const displayValue = isToken ? truncateToken(detail.value, 48) : detail.value;

  return (
    <motion.div
      className="result-card user-detail-card"
      style={{ borderLeftColor: config.color }}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(0.15, index * 0.03) }}
    >
      <div className="card-header">
        <div className="card-title-group" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            className="card-index-badge"
            style={{ cursor: 'pointer' }}
            onClick={() => onLocateInput(detail.sourceLines[0])}
            title={`Jump to line ${detail.sourceLines[0]} in source logs`}
          >
            #{index + 1}
          </span>
          <span className="user-type-badge" style={{ backgroundColor: config.color + '22', color: config.color, borderColor: config.color + '44' }}>
            {config.icon} {config.label}
          </span>
          <span
            className="card-index-badge"
            style={{
              backgroundColor: detail.confidence === 'high' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: detail.confidence === 'high' ? 'var(--color-success)' : 'var(--color-warning)',
              border: `1px solid ${detail.confidence === 'high' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
            }}
          >
            {detail.confidence === 'high' ? 'High' : 'Med'}
          </span>
        </div>

        <div className="card-actions">
          <button onClick={handleCopy} className="card-action-btn" title="Copy value">
            {isCopied ? <Check size={14} style={{ color: 'var(--color-success)' }} /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      <div className="card-body">
        {/* Value display */}
        <div className="user-detail-value-row">
          {detail.label && (
            <span className="user-detail-label">{detail.label}</span>
          )}
          {detail.jsonPath && !detail.label && (
            <span className="user-detail-label">{detail.jsonPath}</span>
          )}
          <code className="user-detail-value" title={detail.value}>
            {displayValue}
          </code>
        </div>

        {/* Source lines */}
        {detail.sourceLines.length > 0 && (
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', marginTop: 6 }}>
            Found on line{detail.sourceLines.length > 1 ? 's' : ''}{' '}
            {detail.sourceLines.map((ln, i) => (
              <span key={ln}>
                {i > 0 && ', '}
                <span
                  style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--color-primary)' }}
                  onClick={() => onLocateInput(ln)}
                >
                  {ln}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* JWT Claims section */}
        {detail.jwtPayload && (
          <div className="api-subsection" style={{ marginTop: 10, borderLeftColor: 'var(--color-warning)' }}>
            <div className="api-subsection-header" onClick={() => setIsJwtOpen(!isJwtOpen)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="subsection-dot" style={{ backgroundColor: 'var(--color-warning)' }} />
                <span style={{ fontWeight: 600 }}>JWT Claims</span>
              </div>
              {isJwtOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
            {isJwtOpen && (
              <div className="api-subsection-body">
                {/* Annotate well-known timestamp claims */}
                {typeof detail.jwtPayload['exp'] === 'number' && (
                  <div style={{ fontSize: '0.75rem', marginBottom: 4, color: 'var(--color-text-secondary)' }}>
                    <b>Expires:</b> {formatTimestamp(detail.jwtPayload['exp'] as number)}
                    {(detail.jwtPayload['exp'] as number) * 1000 < Date.now() && (
                      <span style={{ color: 'var(--color-danger)', marginLeft: 6, fontWeight: 600 }}>⚠ EXPIRED</span>
                    )}
                  </div>
                )}
                {typeof detail.jwtPayload['iat'] === 'number' && (
                  <div style={{ fontSize: '0.75rem', marginBottom: 4, color: 'var(--color-text-secondary)' }}>
                    <b>Issued At:</b> {formatTimestamp(detail.jwtPayload['iat'] as number)}
                  </div>
                )}
                <JsonTree data={detail.jwtPayload} />
              </div>
            )}
          </div>
        )}

        {/* jwt.io link */}
        {detail.jwtInspectUrl && (
          <a
            href={detail.jwtInspectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="jwt-inspect-btn"
          >
            <ExternalLink size={14} />
            Inspect on jwt.io
          </a>
        )}
      </div>
    </motion.div>
  );
}
