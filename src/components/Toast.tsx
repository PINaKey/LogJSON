import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'warning' | 'info' | 'error';
}

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

function Toast({ toast, onDismiss }: ToastProps) {
  const { id, message, type } = toast;

  // Auto-dismiss after 3.5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(id);
    }, 3500);

    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={18} className="text-emerald-500" style={{ color: 'var(--color-success)' }} />;
      case 'warning':
        return <AlertTriangle size={18} className="text-amber-500" style={{ color: 'var(--color-warning)' }} />;
      case 'error':
        return <XCircle size={18} className="text-rose-500" style={{ color: 'var(--color-danger)' }} />;
      case 'info':
      default:
        return <Info size={18} className="text-blue-500" style={{ color: 'var(--color-info)' }} />;
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className={`toast toast-${type}`}
    >
      <div className="toast-icon">{getIcon()}</div>
      <div className="toast-message" style={{ flex: 1 }}>{message}</div>
      <button onClick={() => onDismiss(id)} className="card-action-btn" style={{ marginLeft: 8 }}>
        <X size={14} />
      </button>
    </motion.div>
  );
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
