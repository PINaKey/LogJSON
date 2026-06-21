import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { LogoBanner } from './components/LogoBanner';
import { InputPanel } from './components/InputPanel';
import { OutputPanel } from './components/OutputPanel';
import type { OutputTab } from './components/OutputPanel';
import { StatusBar } from './components/StatusBar';
import { EmptyState } from './components/EmptyState';
import { ToastContainer } from './components/Toast';
import type { ToastItem } from './components/Toast';
import { useTheme } from './hooks/useTheme';
import { useParser } from './hooks/useParser';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { SAMPLE_LOGS } from './utils/sample-logs';
import { downloadAsFile } from './utils/download';
import { copyToClipboard } from './utils/clipboard';

export default function App() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [activeTab, setActiveTab] = useState<OutputTab>('json');
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [textareaVal, setTextareaVal] = useState('');

  // 1. Toast managers
  const addToast = (message: string, type: 'success' | 'warning' | 'info' | 'error') => {
    const id = `toast_${Math.random().toString(36).substring(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 2. Parsers hook
  const {
    normalizedLines,
    extractedJsons,
    apis,
    userDetails,
    isParsing,
    parseTime,
    handleParse,
    clearAll,
  } = useParser(addToast);

  // 3. Theme hook
  const { theme, toggleTheme } = useTheme();

  // 4. Action helpers
  const handleLoadSample = () => {
    setTextareaVal(SAMPLE_LOGS);
    handleParse(SAMPLE_LOGS);
    addToast('Loaded sample logs! 🚀 Try inspecting the parsed JSON and API tabs.', 'success');
  };

  const handleClear = () => {
    setTextareaVal('');
    clearAll();
    addToast('Cleared all inputs and results.', 'info');
  };

  const handleCopyAll = async () => {
    if (extractedJsons.length === 0) {
      addToast('No JSON blocks extracted to copy.', 'warning');
      return;
    }
    const combined = extractedJsons.map(j => j.parsed);
    const text = JSON.stringify(combined, null, 2);
    const success = await copyToClipboard(text);
    if (success) {
      addToast('Copied all JSON blocks to clipboard! 📋', 'success');
    }
  };

  const handleDownloadAll = () => {
    if (extractedJsons.length === 0) {
      addToast('No JSON blocks extracted to download.', 'warning');
      return;
    }
    const combined = extractedJsons.map(j => j.parsed);
    const text = JSON.stringify(combined, null, 2);
    downloadAsFile(text, 'logjson_extracted.json', 'application/json');
    addToast('Downloaded all JSON blocks! ⬇️', 'success');
  };

  const handlePasteShortcut = (text: string) => {
    setTextareaVal(text);
    handleParse(text);
    addToast('Pasted and parsed logs! 📋', 'success');
  };

  // Highlight / jump to line in source logs
  const handleLocateInput = (lineNum: number) => {
    const textarea = document.querySelector('.log-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const text = textarea.value;
    const lines = text.split(/\r?\n/);
    if (lineNum > lines.length) return;

    let startIndex = 0;
    for (let i = 0; i < lineNum - 1; i++) {
      startIndex += lines[i].length + 1; // +1 for the newline
    }
    const endIndex = startIndex + lines[lineNum - 1].length;

    textarea.focus();
    textarea.setSelectionRange(startIndex, endIndex);
    
    // Auto-scroll logic for textarea
    const lineHeight = 22.4; // roughly 1.6em of font size 14px
    textarea.scrollTop = (lineNum - 5) * lineHeight;

    addToast(`Selected line ${lineNum} in log input!`, 'info');
  };

  // 5. Register Keyboard Shortcuts
  const switchTabIdx = (idx: number) => {
    if (idx === 0) setActiveTab('json');
    else if (idx === 1) setActiveTab('api');
    else if (idx === 2) setActiveTab('users');
    else if (idx === 3) setActiveTab('raw');
  };

  useKeyboardShortcuts({
    onPaste: handlePasteShortcut,
    onCopyAll: handleCopyAll,
    onClear: handleClear,
    onDownloadAll: handleDownloadAll,
    onToggleTheme: toggleTheme,
    onSwitchTab: switchTabIdx,
  });

  const hasResults = extractedJsons.length > 0 || apis.length > 0 || userDetails.length > 0;

  return (
    <div className="app-container">
      {/* 1. Header Banner */}
      <LogoBanner 
        theme={theme} 
        onToggleTheme={toggleTheme} 
        onOpenShortcuts={() => setIsShortcutsOpen(true)} 
      />

      {/* 2. Main Work Split Area */}
      <main className="main-content">
        {/* Left Pane: Input */}
        <section className="pane pane-left">
          <div className="panel-header">
            <h2 className="panel-title">
              Logs Raw Input
            </h2>
            {textareaVal && (
              <button onClick={handleClear} className="file-input-label" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                Clear
              </button>
            )}
          </div>
          <InputPanel
            value={textareaVal}
            onChange={setTextareaVal}
            onParse={handleParse}
            onClear={handleClear}
            isParsing={isParsing}
            addToast={addToast}
          />
        </section>

        {/* Right Pane: Parsed Output / Empty State */}
        <section className="pane pane-right" style={{ display: 'flex', flexDirection: 'column' }}>
          {hasResults ? (
            <OutputPanel
              jsons={extractedJsons}
              apis={apis}
              userDetails={userDetails}
              lines={normalizedLines}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              addToast={addToast}
              onLocateInput={handleLocateInput}
            />
          ) : (
            <EmptyState 
              onLoadSample={handleLoadSample} 
              onPasteClipboard={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (text) handlePasteShortcut(text);
                  else addToast('Clipboard is empty.', 'warning');
                } catch {
                  addToast('Could not read clipboard. Try manual pasting.', 'error');
                }
              }}
            />
          )}
        </section>
      </main>

      {/* 3. Bottom Status Bar */}
      <StatusBar 
        jsonsCount={extractedJsons.length}
        apisCount={apis.length}
        usersCount={userDetails.length}
        parseTime={parseTime}
        isParsing={isParsing}
      />

      {/* 4. Toasts Notification Center */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* 5. Shortcuts Cheat Sheet Dialog */}
      <AnimatePresence>
        {isShortcutsOpen && (
          <div className="shortcuts-overlay" onClick={() => setIsShortcutsOpen(false)}>
            <div className="shortcuts-dialog" onClick={(e) => e.stopPropagation()}>
              <h3 className="shortcuts-title">
                ⌨️ Keyboard Shortcuts
              </h3>
              
              <div className="shortcut-row">
                <span className="shortcut-label">Paste & Parse Logs</span>
                <span className="shortcut-keys">
                  <kbd className="shortcut-key">Cmd/Ctrl</kbd>
                  <kbd className="shortcut-key">V</kbd>
                </span>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-label">Copy All JSONs</span>
                <span className="shortcut-keys">
                  <kbd className="shortcut-key">Cmd/Ctrl</kbd>
                  <kbd className="shortcut-key">Shift</kbd>
                  <kbd className="shortcut-key">C</kbd>
                </span>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-label">Download All JSONs</span>
                <span className="shortcut-keys">
                  <kbd className="shortcut-key">Cmd/Ctrl</kbd>
                  <kbd className="shortcut-key">D</kbd>
                </span>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-label">Clear All</span>
                <span className="shortcut-keys">
                  <kbd className="shortcut-key">Cmd/Ctrl</kbd>
                  <kbd className="shortcut-key">L</kbd>
                </span>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-label">Toggle Theme (Light/Dark)</span>
                <span className="shortcut-keys">
                  <kbd className="shortcut-key">Cmd/Ctrl</kbd>
                  <kbd className="shortcut-key">K</kbd>
                </span>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-label">Switch Output Tabs</span>
                <span className="shortcut-keys">
                  <kbd className="shortcut-key">1</kbd>
                  <kbd className="shortcut-key">2</kbd>
                  <kbd className="shortcut-key">3</kbd>
                </span>
              </div>

              <button 
                onClick={() => setIsShortcutsOpen(false)} 
                className="btn btn-secondary" 
                style={{ width: '100%', marginTop: 20 }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
