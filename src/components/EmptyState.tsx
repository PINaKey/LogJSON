import { motion } from 'framer-motion';
import { FileText, ClipboardPaste } from 'lucide-react';

interface EmptyStateProps {
  onLoadSample: () => void;
  onPasteClipboard: () => void;
}

export function EmptyState({ onLoadSample, onPasteClipboard }: EmptyStateProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="empty-state"
    >
      <div className="empty-state-illustration">
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="60" cy="60" r="40" fill="url(#circle-grad)" opacity="0.12" />
          
          <motion.path 
            d="M45 35H38C35.7909 35 34 36.7909 34 39V54C34 56.2091 32.2091 58 30 58C32.2091 58 34 59.7909 34 62V77C34 79.2091 35.7909 81 38 81H45" 
            stroke="url(#svg-grad)" 
            strokeWidth="3.5" 
            strokeLinecap="round"
            animate={{ x: [0, -3, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          />
          
          <motion.path 
            d="M75 35H82C84.2091 35 86 36.7909 86 39V54C86 56.2091 87.7909 58 90 58C87.7909 58 86 59.7909 86 62V77C86 79.2091 84.2091 81 82 81H75" 
            stroke="url(#svg-grad)" 
            strokeWidth="3.5" 
            strokeLinecap="round"
            animate={{ x: [0, 3, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          />
          
          <motion.circle cx="48" cy="48" r="4" fill="var(--color-accent)" 
            animate={{ y: [0, -12, 0], opacity: [0.3, 0.9, 0.3] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", delay: 0.2 }}
          />
          <motion.circle cx="72" cy="72" r="5" fill="var(--color-primary)" 
            animate={{ y: [0, -16, 0], opacity: [0.2, 0.8, 0.2] }}
            transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut", delay: 0.5 }}
          />
          <motion.rect x="54" y="44" width="8" height="8" rx="2" fill="var(--color-info)" 
            animate={{ y: [0, -8, 0], rotate: [0, 90, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 0.8 }}
          />
          
          <defs>
            <radialGradient id="circle-grad" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(60 60) rotate(90) scale(40)">
              <stop offset="0%" stopColor="var(--color-primary)" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="svg-grad" x1="30" y1="35" x2="90" y2="81" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--color-primary)" />
              <stop offset="100%" stopColor="var(--color-accent)" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <h3 className="empty-state-title">Hiding JSON? I'll find it!</h3>
      <p className="empty-state-desc">
        Feed me your messy cloud logs, raw stdout streams, or unescaped strings. I will dig through the noise, extract any hidden JSON blocks, and map out the API requests in a snap.
      </p>
      
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
        <button onClick={onPasteClipboard} className="btn btn-primary btn-lg btn-glow">
          <ClipboardPaste size={16} />
          Paste & Parse Logs
        </button>
        <button onClick={onLoadSample} className="btn btn-secondary btn-lg">
          <FileText size={16} />
          Try a Sample Log
        </button>
      </div>
    </motion.div>
  );
}
