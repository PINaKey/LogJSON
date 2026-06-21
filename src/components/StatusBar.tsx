import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface StatusBarProps {
  jsonsCount: number;
  apisCount: number;
  usersCount: number;
  parseTime: number;
  isParsing: boolean;
}

export function StatusBar({ jsonsCount, apisCount, usersCount, parseTime, isParsing }: StatusBarProps) {
  const [displayTime, setDisplayTime] = useState(0);

  useEffect(() => {
    if (parseTime === 0) {
      setDisplayTime(0);
      return;
    }
    
    let start = 0;
    const end = parseTime;
    if (start === end) {
      setDisplayTime(end);
      return;
    }

    const duration = 250; // ms
    const stepTime = Math.max(12, Math.floor(duration / end));
    const timer = setInterval(() => {
      start += Math.ceil(end / (duration / stepTime));
      if (start >= end) {
        clearInterval(timer);
        setDisplayTime(end);
      } else {
        setDisplayTime(start);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [parseTime]);

  return (
    <footer className="status-bar">
      <div className="status-stats">
        <div className="status-stat-item">
          <span className="status-indicator-dot"></span>
          <span>Stateless Parser Ready</span>
        </div>
        
        {isParsing && (
          <div className="status-stat-item" style={{ color: 'var(--color-primary)' }}>
            <span>Parsing logs... ⚙️</span>
          </div>
        )}

        {!isParsing && (jsonsCount > 0 || apisCount > 0 || usersCount > 0) && (
          <>
            <div className="status-stat-item">
              <span>JSONs: <b>{jsonsCount}</b></span>
            </div>
            <div className="status-stat-item">
              <span>APIs: <b>{apisCount}</b></span>
            </div>
            {usersCount > 0 && (
              <div className="status-stat-item">
                <span>Users: <b>{usersCount}</b></span>
              </div>
            )}
          </>
        )}
      </div>

      <div>
        {!isParsing && parseTime > 0 && (
          <motion.span
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Speed: <b>{displayTime}ms</b>
          </motion.span>
        )}
      </div>
    </footer>
  );
}
