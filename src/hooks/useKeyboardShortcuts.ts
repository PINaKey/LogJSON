import { useEffect } from 'react';

interface ShortcutHandlers {
  onPaste: (text: string) => void;
  onCopyAll: () => void;
  onClear: () => void;
  onDownloadAll: () => void;
  onToggleTheme: () => void;
  onSwitchTab: (tabIndex: number) => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const isInputFocused = document.activeElement?.tagName === 'INPUT' || 
                             document.activeElement?.tagName === 'TEXTAREA';

      // 1. Ctrl/Cmd + L -> Clear All
      if (isCmdOrCtrl && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        handlers.onClear();
        return;
      }

      // 2. Ctrl/Cmd + K -> Toggle Theme
      if (isCmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handlers.onToggleTheme();
        return;
      }

      // 3. Ctrl/Cmd + Shift + C -> Copy All JSONs
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handlers.onCopyAll();
        return;
      }

      // 4. Ctrl/Cmd + D -> Download All
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handlers.onDownloadAll();
        return;
      }

      // 5. Tabs switching 1, 2, 3 (when not typing in an input/textarea)
      if (!isInputFocused) {
        if (e.key === '1') {
          e.preventDefault();
          handlers.onSwitchTab(0);
        } else if (e.key === '2') {
          e.preventDefault();
          handlers.onSwitchTab(1);
        } else if (e.key === '3') {
          e.preventDefault();
          handlers.onSwitchTab(2);
        }
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      const isInputFocused = document.activeElement?.tagName === 'INPUT' || 
                             document.activeElement?.tagName === 'TEXTAREA';
      
      // Intercept paste only when not typing in textareas
      if (!isInputFocused) {
        const text = e.clipboardData?.getData('text');
        if (text) {
          e.preventDefault();
          handlers.onPaste(text);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
    };
  }, [handlers]);
}
