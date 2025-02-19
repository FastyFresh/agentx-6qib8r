import React, { useCallback } from 'react';
import classNames from 'classnames'; // ^2.3.2
import Modal from './Modal';
import Button from './Button';
import { BaseComponentProps, Severity, Size } from '../../types/common.types';
import { useTheme } from '../../hooks/useTheme';
import styles from './AlertDialog.module.css';

interface AlertDialogProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  severity?: Severity;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  showCancel?: boolean;
  autoFocus?: boolean;
  closeOnEscape?: boolean;
  closeOnOverlayClick?: boolean;
  animationDuration?: number;
  role?: 'dialog' | 'alertdialog';
}

const getSeverityIcon = (severity: Severity): JSX.Element => {
  const iconProps = {
    className: classNames(styles.icon, styles[`icon${severity}`]),
    'aria-hidden': 'true',
  };

  switch (severity) {
    case Severity.ERROR:
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
      );
    case Severity.WARNING:
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
        </svg>
      );
    case Severity.SUCCESS:
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
      );
    default:
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
      );
  }
};

const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  severity = Severity.INFO,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onConfirm,
  showCancel = false,
  autoFocus = true,
  closeOnEscape = true,
  closeOnOverlayClick = true,
  animationDuration = 200,
  role = 'alertdialog',
  className,
  testId,
}) => {
  const { isDarkMode, prefersReducedMotion } = useTheme();

  const handleConfirm = useCallback(() => {
    try {
      onConfirm?.();
      onClose();
    } catch (error) {
      console.error('Error in alert dialog confirmation:', error);
    }
  }, [onConfirm, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={Size.SMALL}
      closeOnEsc={closeOnEscape}
      closeOnOverlayClick={closeOnOverlayClick}
      animationDuration={prefersReducedMotion ? 0 : animationDuration}
      className={classNames(styles.alertDialog, className)}
      testId={testId}
    >
      <div
        role={role}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        className={classNames(styles.container, {
          [styles.darkMode]: isDarkMode,
        })}
      >
        <div className={styles.header}>
          {getSeverityIcon(severity)}
          <h2 id="alert-dialog-title" className={styles.title}>
            {title}
          </h2>
        </div>
        <div
          id="alert-dialog-description"
          className={styles.message}
        >
          {message}
        </div>
        <div className={styles.actions}>
          {showCancel && (
            <Button
              variant="secondary"
              onClick={onClose}
              ariaLabel={cancelLabel}
              className={styles.button}
            >
              {cancelLabel}
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleConfirm}
            ariaLabel={confirmLabel}
            autoFocus={autoFocus}
            className={classNames(styles.button, styles[`button${severity}`])}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

AlertDialog.displayName = 'AlertDialog';

export default AlertDialog;