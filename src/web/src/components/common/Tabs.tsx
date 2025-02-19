import React, { useState, useCallback, useRef, useEffect } from 'react';
import styles from '../../styles/components.css';
import { useTheme } from '../../hooks/useTheme';

/**
 * Interface for individual tab item configuration
 */
interface TabItem {
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
}

/**
 * Props interface for the Tabs component
 */
interface TabsProps {
  tabs: TabItem[];
  defaultTab?: number;
  onChange?: (index: number) => void;
  className?: string;
  ariaLabel?: string;
  circularNavigation?: boolean;
  allowSwipe?: boolean;
  lazyLoad?: boolean;
}

/**
 * A Material Design 3.0 compliant tabbed interface component with enhanced accessibility
 * Supports RTL, keyboard navigation, touch gestures, and responsive design
 * @version 1.0.0
 */
const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultTab = 0,
  onChange,
  className = '',
  ariaLabel = 'Content Tabs',
  circularNavigation = true,
  allowSwipe = true,
  lazyLoad = true,
}) => {
  // Theme and direction context
  const { theme, isRTL } = useTheme();

  // State management
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Validate and normalize active tab index
  useEffect(() => {
    if (activeTab >= tabs.length) {
      setActiveTab(0);
    }
  }, [tabs.length, activeTab]);

  /**
   * Handles tab selection with accessibility announcements
   */
  const handleTabClick = useCallback((index: number) => {
    if (index === activeTab || tabs[index]?.disabled) return;

    setActiveTab(index);
    onChange?.(index);

    // Announce tab change to screen readers
    const announcement = `Selected tab ${tabs[index]?.label}`;
    const announcer = document.createElement('div');
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    announcer.className = styles.srOnly;
    announcer.textContent = announcement;
    document.body.appendChild(announcer);
    setTimeout(() => document.body.removeChild(announcer), 1000);
  }, [activeTab, onChange, tabs]);

  /**
   * Enhanced keyboard navigation handler with RTL support
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const { key } = event;
    let nextIndex = activeTab;

    switch (key) {
      case 'ArrowRight':
      case 'ArrowLeft': {
        const isNext = (isRTL ? key === 'ArrowLeft' : key === 'ArrowRight');
        if (isNext) {
          nextIndex = activeTab + 1;
          if (nextIndex >= tabs.length) {
            nextIndex = circularNavigation ? 0 : tabs.length - 1;
          }
        } else {
          nextIndex = activeTab - 1;
          if (nextIndex < 0) {
            nextIndex = circularNavigation ? tabs.length - 1 : 0;
          }
        }
        break;
      }
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    // Find next non-disabled tab
    while (nextIndex !== activeTab && tabs[nextIndex]?.disabled) {
      nextIndex = nextIndex + 1 >= tabs.length ? 0 : nextIndex + 1;
    }

    if (nextIndex !== activeTab && !tabs[nextIndex]?.disabled) {
      event.preventDefault();
      handleTabClick(nextIndex);
      tabRefs.current[nextIndex]?.focus();
    }
  }, [activeTab, circularNavigation, handleTabClick, isRTL, tabs]);

  /**
   * Touch gesture handlers for swipe navigation
   */
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (!allowSwipe) return;
    setTouchStart(event.touches[0].clientX);
    setTouchStartTime(Date.now());
  }, [allowSwipe]);

  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    if (!allowSwipe || touchStart === null || touchStartTime === null) return;

    const touchEnd = event.changedTouches[0].clientX;
    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - touchStartTime;
    const touchDistance = touchEnd - touchStart;
    const minSwipeDistance = 50;
    const maxSwipeDuration = 300;

    if (Math.abs(touchDistance) > minSwipeDistance && touchDuration < maxSwipeDuration) {
      const isNext = isRTL ? touchDistance > 0 : touchDistance < 0;
      const nextIndex = isNext
        ? (activeTab + 1) % tabs.length
        : (activeTab - 1 + tabs.length) % tabs.length;

      if (!tabs[nextIndex]?.disabled) {
        handleTabClick(nextIndex);
      }
    }

    setTouchStart(null);
    setTouchStartTime(null);
  }, [allowSwipe, activeTab, handleTabClick, isRTL, tabs, touchStart, touchStartTime]);

  // Combine class names
  const tabsClassName = `${styles.tabs} ${isRTL ? styles.tabsRTL : ''} ${className}`.trim();

  return (
    <div className={tabsClassName} ref={tabsRef}>
      {/* Tab List */}
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={styles.tabsScroll}
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab, index) => (
          <button
            key={`tab-${index}`}
            ref={el => (tabRefs.current[index] = el)}
            role="tab"
            aria-selected={index === activeTab}
            aria-controls={`tabpanel-${index}`}
            aria-disabled={tab.disabled}
            id={`tab-${index}`}
            className={`${styles.tab} ${index === activeTab ? styles.activeTab : ''}`}
            onClick={() => handleTabClick(index)}
            disabled={tab.disabled}
            tabIndex={index === activeTab ? 0 : -1}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div
        className={styles.tabContent}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {tabs.map((tab, index) => (
          <div
            key={`tabpanel-${index}`}
            role="tabpanel"
            id={`tabpanel-${index}`}
            aria-labelledby={`tab-${index}`}
            hidden={index !== activeTab}
            className={styles.tabPanel}
          >
            {(!lazyLoad || index === activeTab) && tab.content}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Tabs;