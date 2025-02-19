import React, { useEffect, useCallback, useRef } from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { motion, AnimatePresence } from 'framer-motion'; // ^10.12.16
import { BaseComponentProps, Severity } from '../../types/common.types';
import IconButton from './IconButton';
import styles from './Toast.module.css';

// Material Design Icons for each severity level
const SEVERITY_ICONS = {
  [Severity.INFO]: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
    </svg>
  ),
  [Severity.SUCCESS]: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  ),
  [Severity.WARNING]: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
    </svg>
  ),
  [Severity.ERROR]: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
    </svg>
  ),
};

export interface ToastProps extends BaseComponentProps {
  message: string;
  severity: Severity;
  duration?: number;
  onClose: () => void;
  autoClose?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  theme?: 'light' | 'dark' | 'system';
  reduceMotion?: boolean;
  stackIndex?: number;
  role?: 'alert' | 'status';
  closeOnEscape?: boolean;
}

const Toast: React.FC<ToastProps> = ({
  message,
  severity = Severity.INFO,
  duration = 5000,
  onClose,
  autoClose = true,
  position = 'top-right',
  theme = 'system',
  reduceMotion = false,
  stackIndex = 0,
  role = 'alert',
  closeOnEscape = true,
  className,
  testId,
}) => {
  const timerRef = useRef<NodeJS.Timeout>();
  const toastRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (autoClose && duration > 0) {
      timerRef.current = setTimeout(handleClose, duration);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [autoClose, duration, handleClose]);

  useEffect(() => {
    if (closeOnEscape) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          handleClose();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [closeOnEscape, handleClose]);

  const toastClasses = classNames(
    styles.toast,
    styles[`severity${severity}`],
    styles[`position${position}`],
    styles[theme],
    {
      [styles.reduceMotion]: reduceMotion,
    },
    className
  );

  const motionVariants = {
    initial: {
      opacity: 0,
      y: position.includes('top') ? -20 : 20,
      scale: 0.95,
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: reduceMotion ? 0 : 0.2,
        ease: [0.4, 0, 0.2, 1],
      },
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: reduceMotion ? 0 : 0.15,
        ease: [0.4, 0, 1, 1],
      },
    },
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={toastRef}
        role={role}
        aria-live={severity === Severity.ERROR ? 'assertive' : 'polite'}
        className={toastClasses}
        style={{ zIndex: 1200 + stackIndex }}
        data-testid={testId}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={motionVariants}
      >
        <div className={styles.icon}>
          {SEVERITY_ICONS[severity]}
        </div>
        <div className={styles.content}>
          <span className={styles.message}>{message}</span>
        </div>
        <IconButton
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          }
          onClick={handleClose}
          ariaLabel="Close notification"
          size="small"
          variant="tertiary"
          className={styles.closeButton}
        />
      </motion.div>
    </AnimatePresence>
  );
};

Toast.displayName = 'Toast';

export default Toast;