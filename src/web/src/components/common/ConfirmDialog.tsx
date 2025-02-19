import React, { useCallback, useRef, useEffect } from 'react';
import classNames from 'classnames'; // ^2.3.2
import Modal from './Modal';
import Button from './Button';
import { BaseComponentProps, Size } from '../../types/common.types';
import { useTheme } from '../../hooks/useTheme';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps extends BaseComponentProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
  autoFocus?: boolean;
  role?: 'alertdialog' | 'dialog';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = React.memo(({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = false,
  autoFocus = true,
  role = 'dialog',
  className,
  testId,
}) => {
  const { theme, isDarkMode, prefersReducedMotion, isRTL } = useTheme();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store the previously focused element when dialog opens
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }
  }, [isOpen]);

  // Handle keyboard interactions
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onConfirm();
    }
  }, [onConfirm]);

  // Enhanced confirm handler with focus management
  const handleConfirm = useCallback(() => {
    onConfirm();
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [onConfirm]);

  // Enhanced cancel handler with focus management
  const handleCancel = useCallback(() => {
    onCancel();
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [onCancel]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      className={classNames(
        styles.confirmDialog,
        {
          [styles.confirmDialogDark]: isDarkMode,
          [styles.confirmDialogRTL]: isRTL,
          [styles.confirmDialogDestructive]: isDestructive,
          [styles.confirmDialogReducedMotion]: prefersReducedMotion,
        },
        className
      )}
      closeOnEsc={true}
      closeOnOverlayClick={true}
      initialFocusRef={autoFocus ? confirmButtonRef : undefined}
      testId={testId}
      size={Size.SMALL}
      role={role}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div className={styles.confirmDialogContent}>
        <h2
          id="confirm-dialog-title"
          className={styles.confirmDialogTitle}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {title}
        </h2>
        <p
          id="confirm-dialog-message"
          className={styles.confirmDialogMessage}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {message}
        </p>
        <div
          className={classNames(styles.confirmDialogActions, {
            [styles.confirmDialogActionsRTL]: isRTL,
          })}
        >
          <Button
            variant="secondary"
            onClick={handleCancel}
            className={styles.confirmDialogButton}
            testId={`${testId}-cancel`}
            ariaLabel={cancelLabel}
            theme={isDarkMode ? 'dark' : 'light'}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmButtonRef}
            variant={isDestructive ? 'tertiary' : 'primary'}
            onClick={handleConfirm}
            className={classNames(styles.confirmDialogButton, {
              [styles.confirmDialogButtonDestructive]: isDestructive,
            })}
            testId={`${testId}-confirm`}
            ariaLabel={confirmLabel}
            theme={isDarkMode ? 'dark' : 'light'}
            onKeyDown={handleKeyDown}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
});

ConfirmDialog.displayName = 'ConfirmDialog';

export default ConfirmDialog;