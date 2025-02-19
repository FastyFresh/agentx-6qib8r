import React, { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import FocusTrap from 'focus-trap-react'; // ^10.0.0
import { BaseComponentProps, Size } from '../../types/common.types';
import Button from './Button';
import { useTheme } from '../../hooks/useTheme';
import styles from './Modal.module.css';

interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  size?: Size;
  title?: string;
  closeOnEsc?: boolean;
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement>;
  returnFocusRef?: React.RefObject<HTMLElement>;
  animationDuration?: number;
  overlayOpacity?: number;
  zIndex?: number;
}

const useModalAnimation = (isOpen: boolean, duration: number) => {
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), duration);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setIsVisible(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration]);

  const animationClasses = classNames({
    [styles.modalEntering]: isOpen && isAnimating,
    [styles.modalEntered]: isOpen && !isAnimating,
    [styles.modalExiting]: !isOpen && isAnimating,
  });

  return { isVisible, animationClasses };
};

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  size = Size.MEDIUM,
  title,
  closeOnEsc = true,
  closeOnOverlayClick = true,
  showCloseButton = true,
  initialFocusRef,
  returnFocusRef,
  animationDuration = 200,
  overlayOpacity = 0.5,
  zIndex = 1000,
  className,
  children,
  testId,
}) => {
  const { theme, isDarkMode, prefersReducedMotion } = useTheme();
  const modalRef = useRef<HTMLDivElement>(null);
  const { isVisible, animationClasses } = useModalAnimation(
    isOpen,
    prefersReducedMotion ? 0 : animationDuration
  );

  const handleEscapeKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEsc) {
        onClose();
      }
    },
    [closeOnEsc, onClose]
  );

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (
        closeOnOverlayClick &&
        event.target === event.currentTarget
      ) {
        event.preventDefault();
        onClose();
      }
    },
    [closeOnOverlayClick, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscapeKey]);

  if (!isVisible) return null;

  const modalContent = (
    <div
      className={styles.modalRoot}
      style={{ zIndex }}
      data-testid={testId}
      role="presentation"
    >
      <div
        className={classNames(styles.modalOverlay, {
          [styles.modalOverlayDark]: isDarkMode,
        })}
        style={{ opacity: overlayOpacity }}
        onClick={handleOverlayClick}
        onTouchEnd={handleOverlayClick}
      />
      <FocusTrap
        active={isOpen}
        initialFocus={initialFocusRef}
        returnFocus={returnFocusRef}
        focusTrapOptions={{
          allowOutsideClick: true,
          fallbackFocus: () => modalRef.current || document.body,
        }}
      >
        <div
          ref={modalRef}
          className={classNames(
            styles.modalContainer,
            styles[`modal${size}`],
            animationClasses,
            className
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
        >
          {title && (
            <div className={styles.modalHeader}>
              <h2 id="modal-title" className={styles.modalTitle}>
                {title}
              </h2>
              {showCloseButton && (
                <Button
                  variant="tertiary"
                  size={Size.SMALL}
                  onClick={onClose}
                  ariaLabel="Close modal"
                  className={styles.closeButton}
                >
                  <span aria-hidden="true">&times;</span>
                </Button>
              )}
            </div>
          )}
          <div className={styles.modalContent}>{children}</div>
        </div>
      </FocusTrap>
    </div>
  );

  return createPortal(modalContent, document.body);
};

Modal.displayName = 'Modal';

export default Modal;