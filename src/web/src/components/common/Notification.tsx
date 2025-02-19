import React, { memo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // ^10.12.0
import classnames from 'classnames'; // ^2.3.2
import { useNotification } from '../../hooks/useNotification';
import { Severity } from '../../types/common.types';

// Position options for the notification
type NotificationPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

// Props interface with strict typing
interface NotificationProps {
  id: string;
  message: string;
  severity: Severity;
  duration?: number;
  position?: NotificationPosition;
  onClose: () => void;
  ariaLabel?: string;
  reducedMotion?: boolean;
}

// Animation variants with reduced motion support
const variants = {
  initial: (position: NotificationPosition) => ({
    opacity: 0,
    x: position.includes('right') ? 100 : position.includes('left') ? -100 : 0,
    y: position.includes('top') ? -100 : position.includes('bottom') ? 100 : 0,
  }),
  animate: {
    opacity: 1,
    x: 0,
    y: 0,
  },
  exit: (position: NotificationPosition) => ({
    opacity: 0,
    x: position.includes('right') ? 100 : position.includes('left') ? -100 : 0,
    y: position.includes('top') ? -100 : position.includes('bottom') ? 100 : 0,
  }),
};

// Memoized icon component for performance
const NotificationIcon = memo(({ severity }: { severity: Severity }) => {
  const iconClass = classnames('notification-icon', {
    'text-blue-500': severity === Severity.INFO,
    'text-green-500': severity === Severity.SUCCESS,
    'text-yellow-500': severity === Severity.WARNING,
    'text-red-500': severity === Severity.ERROR,
  });

  switch (severity) {
    case Severity.INFO:
      return <svg className={iconClass} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>;
    case Severity.SUCCESS:
      return <svg className={iconClass} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>;
    case Severity.WARNING:
      return <svg className={iconClass} viewBox="0 0 24 24" aria-hidden="true"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>;
    case Severity.ERROR:
      return <svg className={iconClass} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>;
  }
});

NotificationIcon.displayName = 'NotificationIcon';

// Main notification component
const Notification = memo(({
  id,
  message,
  severity,
  duration = 5000,
  position = 'top-right',
  onClose,
  ariaLabel,
  reducedMotion = false,
}: NotificationProps) => {
  const { hideNotification } = useNotification();

  // Auto-dismiss handler
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        hideNotification(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, hideNotification, id]);

  // Keyboard handler for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Position-based styles
  const containerStyles = classnames(
    'fixed z-50 flex items-center p-4 rounded-lg shadow-lg max-w-md',
    {
      'top-4 right-4': position === 'top-right',
      'top-4 left-4': position === 'top-left',
      'bottom-4 right-4': position === 'bottom-right',
      'bottom-4 left-4': position === 'bottom-left',
      'top-4 left-1/2 transform -translate-x-1/2': position === 'top-center',
      'bottom-4 left-1/2 transform -translate-x-1/2': position === 'bottom-center',
      'bg-blue-50': severity === Severity.INFO,
      'bg-green-50': severity === Severity.SUCCESS,
      'bg-yellow-50': severity === Severity.WARNING,
      'bg-red-50': severity === Severity.ERROR,
    }
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        role="alert"
        aria-label={ariaLabel || `${severity.toLowerCase()} notification`}
        className={containerStyles}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        custom={position}
        transition={{ duration: reducedMotion ? 0 : 0.2 }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className="flex items-center space-x-3">
          <NotificationIcon severity={severity} />
          <span className="text-sm font-medium">{message}</span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto -mx-1.5 -my-1.5 rounded-lg p-1.5 inline-flex items-center justify-center h-8 w-8 focus:outline-none focus:ring-2 focus:ring-offset-2"
            aria-label="Close notification"
          >
            <span className="sr-only">Close</span>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

Notification.displayName = 'Notification';

export default Notification;