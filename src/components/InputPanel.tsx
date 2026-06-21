import { useState, useRef } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Clipboard, FileUp, Sparkles } from 'lucide-react';

interface InputPanelProps {
  value: string;
  onChange: (val: string) => void;
  onParse: (text: string) => void;
  onClear: () => void;
  isParsing: boolean;
  addToast: (msg: string, type: 'success' | 'warning' | 'info' | 'error') => void;
}

export function InputPanel({
  value,
  onChange,
  onParse,
  onClear,
  isParsing,
  addToast,
}: InputPanelProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await handleFile(file);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await handleFile(file);
    }
  };

  const handleFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      addToast('File is too large (> 5MB). Please use a smaller log file.', 'error');
      return;
    }

    addToast(`Loading file: ${file.name}...`, 'info');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      onChange(text);
      onParse(text);
      addToast('File loaded and parsed!', 'success');
    };
    reader.onerror = () => {
      addToast('Error reading file.', 'error');
    };
    reader.readAsText(file);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onChange(text);
        onParse(text);
        addToast('Pasted and parsed logs from clipboard! 📋', 'success');
      } else {
        addToast('Clipboard is empty.', 'warning');
      }
    } catch {
      addToast('Could not read from clipboard. Try manually pasting.', 'error');
    }
  };

  const handleParseClick = () => {
    if (!value.trim()) {
      addToast('Please paste or load some logs first!', 'warning');
      return;
    }
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
    onParse(value);
  };

  const handleScroll = () => {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Stats
  const lineCount = value ? value.split(/\r?\n/).length : 0;
  const sizeKb = value ? (value.length / 1024).toFixed(1) : '0';

  return (
    <div className="panel-content" style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div 
        className={`textarea-container ${isFocused ? 'focused' : ''} ${isDragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative' }}
      >
        <div className="textarea-wrapper" style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
          <div ref={gutterRef} className="cosmetic-gutter">
            {Array.from({ length: Math.max(25, lineCount) }).map((_, i) => (
              <span key={i} className="gutter-num">{i + 1}</span>
            ))}
          </div>
          
          <textarea
            ref={textareaRef}
            onScroll={handleScroll}
            className="log-textarea"
            placeholder={`Paste raw cloud logs here... E.g.,
2026-06-21 INFO POST /api/v1/users {"user":"admin"}
{"severity":"INFO", "message":"Response: {\\"status\\":200}"}

Or drag & drop any log file (.log, .txt, .json)`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
          
          {value && (
            <div className="textarea-badge">
              {lineCount} lines • {sizeKb} KB
            </div>
          )}
        </div>
        
        {isDragActive && (
          <div className="drop-zone-overlay">
            <FileUp size={48} className="animate-bounce" />
            <p>Drop your log file here!</p>
          </div>
        )}

        <div className="textarea-toolbar">
          <div className="toolbar-group-left" style={{ display: 'flex', gap: 8 }}>
            <button 
              onClick={handlePaste} 
              className="btn btn-secondary btn-sm" 
              title="Paste from clipboard (Ctrl+V)"
            >
              <Clipboard size={14} />
              Paste
            </button>

            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="btn btn-secondary btn-sm"
              title="Upload file"
            >
              <FileUp size={14} />
              Upload
            </button>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".log,.txt,.json" 
              style={{ display: 'none' }} 
            />
          </div>

          <div className="toolbar-group-right" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button 
              onClick={onClear} 
              className="btn btn-danger btn-icon btn-sm" 
              title="Clear all (Ctrl+L)"
            >
              <Trash2 size={14} />
            </button>

            <motion.button
              onClick={handleParseClick}
              disabled={isParsing}
              animate={isShaking ? { 
                x: [0, -5, 5, -5, 5, 0],
                y: [0, -2, 2, -2, 2, 0],
                rotate: [0, -1, 1, -1, 1, 0]
              } : {}}
              transition={{ duration: 0.4 }}
              className="btn btn-primary btn-sm btn-extract"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Sparkles size={14} className="sparkle-icon" />
              {isParsing ? 'Parsing...' : 'Extract JSON'}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
