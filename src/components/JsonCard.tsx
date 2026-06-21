import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Download, Eye, Code, ChevronDown, ChevronUp } from 'lucide-react';
import type { ExtractedJson } from '../parsers/types';
import { JsonTree } from './JsonTree';
import { copyToClipboard } from '../utils/clipboard';
import { downloadAsFile } from '../utils/download';

interface JsonCardProps {
  json: ExtractedJson;
  index: number;
  addToast: (msg: string, type: 'success' | 'warning' | 'info' | 'error') => void;
  onLocateInput: (line: number) => void;
}

export function JsonCard({ json, index, addToast, onLocateInput }: JsonCardProps) {
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree');
  const [isCopied, setIsCopied] = useState(false);
  const [globalExpand, setGlobalExpand] = useState<boolean | undefined>(undefined);

  const handleCopy = async () => {
    const text = JSON.stringify(json.parsed, null, 2);
    const success = await copyToClipboard(text);
    if (success) {
      setIsCopied(true);
      addToast('Copied JSON to clipboard! 📋', 'success');
      setTimeout(() => setIsCopied(false), 2000);
    } else {
      addToast('Failed to copy JSON.', 'error');
    }
  };

  const handleDownload = () => {
    const text = JSON.stringify(json.parsed, null, 2);
    downloadAsFile(text, `extracted_${index + 1}.json`, 'application/json');
    addToast('Downloaded JSON file! ⬇️', 'success');
  };

  const handleExpandAll = () => {
    setGlobalExpand(true);
    setTimeout(() => setGlobalExpand(undefined), 100);
  };

  const handleCollapseAll = () => {
    setGlobalExpand(false);
    setTimeout(() => setGlobalExpand(undefined), 100);
  };

  const lineSpan = json.location.startLine === json.location.endLine
    ? `Line ${json.location.startLine}`
    : `Lines ${json.location.startLine}-${json.location.endLine}`;

  let cardType = 'normal';
  if (json.isNested) cardType = 'nested';
  else if (json.isEscaped) cardType = 'escaped';

  return (
    <motion.div 
      className={`result-card card-type-${cardType}`}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(0.15, index * 0.03) }}
    >
      <div className="card-header">
        <div className="card-title-group">
          <span className="card-index-badge">#{index + 1}</span>
          <span 
            className="card-context-text" 
            title="Click to jump to this line in log input"
            onClick={() => onLocateInput(json.location.startLine)}
          >
            {lineSpan}: <span className="context-highlight">{json.context}</span>
          </span>
        </div>

        <div className="card-header-actions-group">
          <div className="card-badges">
            {json.isEscaped && <span className="badge badge-escaped">Escaped</span>}
            {json.isNested && <span className="badge badge-nested">Nested</span>}
          </div>

          {viewMode === 'tree' && (
            <div className="card-expand-controls">
              <button 
                onClick={handleExpandAll}
                className="btn-text-action"
                title="Expand All Nodes"
              >
                <ChevronDown size={12} />
                Expand
              </button>
              <button 
                onClick={handleCollapseAll}
                className="btn-text-action"
                title="Collapse All Nodes"
              >
                <ChevronUp size={12} />
                Collapse
              </button>
            </div>
          )}

          <div className="segmented-control">
            <button 
              className={`segmented-btn ${viewMode === 'tree' ? 'active' : ''}`}
              onClick={() => setViewMode('tree')}
              title="Tree View"
            >
              <Eye size={12} />
              <span>Tree</span>
            </button>
            <button 
              className={`segmented-btn ${viewMode === 'raw' ? 'active' : ''}`}
              onClick={() => setViewMode('raw')}
              title="Raw Prettified"
            >
              <Code size={12} />
              <span>Raw</span>
            </button>
          </div>

          <div className="card-actions-divider" />
          
          <div className="card-actions">
            <button onClick={handleCopy} className="card-action-btn" title="Copy JSON">
              {isCopied ? <Check size={14} style={{ color: 'var(--color-success)' }} /> : <Copy size={14} />}
            </button>
            <button onClick={handleDownload} className="card-action-btn" title="Download JSON">
              <Download size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="card-body">
        {viewMode === 'tree' ? (
          <JsonTree data={json.parsed} globalExpandState={globalExpand} />
        ) : (
          <pre className="raw-json-pre">
            <code>
              {JSON.stringify(json.parsed, null, 2)}
            </code>
          </pre>
        )}
      </div>
    </motion.div>
  );
}
