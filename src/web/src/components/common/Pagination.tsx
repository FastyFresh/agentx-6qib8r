import React, { useMemo, useCallback } from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { BaseComponentProps, PaginationState } from '../../types/common.types';
import Button from './Button';
import styles from './Pagination.module.css';

/**
 * Enhanced props interface for the Pagination component
 * Extends BaseComponentProps for consistent component structure
 */
export interface PaginationProps extends BaseComponentProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  ariaLabel?: string;
  direction?: 'ltr' | 'rtl';
  showFirstLastButtons?: boolean;
  maxVisiblePages?: number;
}

/**
 * Calculates the range of page numbers to display with ellipsis support
 * @param currentPage - Current active page
 * @param totalPages - Total number of pages
 * @param maxVisiblePages - Maximum number of visible page buttons
 */
const calculatePageRange = (
  currentPage: number,
  totalPages: number,
  maxVisiblePages: number
): (number | 'ellipsis')[] => {
  if (totalPages <= maxVisiblePages) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const sidePages = Math.floor((maxVisiblePages - 3) / 2);
  const leftPages = Math.max(2, currentPage - sidePages);
  const rightPages = Math.min(totalPages - 1, currentPage + sidePages);

  const range: (number | 'ellipsis')[] = [1];

  if (leftPages > 2) range.push('ellipsis');
  for (let i = leftPages; i <= rightPages; i++) {
    range.push(i);
  }
  if (rightPages < totalPages - 1) range.push('ellipsis');
  range.push(totalPages);

  return range;
};

/**
 * Validates and sorts page size options
 * @param options - Array of page size options
 */
const getPageSizeOptions = (options: number[] = []): number[] => {
  const defaultOptions = [10, 20, 50, 100];
  const validOptions = [...new Set([...defaultOptions, ...options])]
    .filter(size => size > 0)
    .sort((a, b) => a - b);
  return validOptions.length ? validOptions : defaultOptions;
};

/**
 * Material Design 3.0 Pagination Component
 * Implements accessible pagination with responsive design and RTL support
 */
const Pagination: React.FC<PaginationProps> = React.memo(({
  currentPage = 1,
  pageSize = 10,
  totalItems = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSizeSelector = true,
  ariaLabel = 'Pagination navigation',
  direction = 'ltr',
  showFirstLastButtons = true,
  maxVisiblePages = 5,
  className,
  testId = 'pagination'
}) => {
  // Calculate total pages and validate current page
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validatedCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  // Memoize page range calculation
  const pageRange = useMemo(
    () => calculatePageRange(validatedCurrentPage, totalPages, maxVisiblePages),
    [validatedCurrentPage, totalPages, maxVisiblePages]
  );

  // Memoize page size options
  const validPageSizeOptions = useMemo(
    () => getPageSizeOptions(pageSizeOptions),
    [pageSizeOptions]
  );

  // Handle page change with validation
  const handlePageChange = useCallback((page: number) => {
    if (page !== validatedCurrentPage && page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  }, [validatedCurrentPage, totalPages, onPageChange]);

  // Handle page size change
  const handlePageSizeChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(event.target.value, 10);
    onPageSizeChange?.(newSize);
  }, [onPageSizeChange]);

  return (
    <nav
      className={classNames(styles.pagination, className, {
        [styles.rtl]: direction === 'rtl'
      })}
      aria-label={ariaLabel}
      data-testid={testId}
      dir={direction}
    >
      {showPageSizeSelector && onPageSizeChange && (
        <div className={styles.pageSizeSelector}>
          <label htmlFor="pageSize" className={styles.pageSizeLabel}>
            Items per page:
          </label>
          <select
            id="pageSize"
            className={styles.pageSizeSelect}
            value={pageSize}
            onChange={handlePageSizeChange}
            aria-label="Select number of items per page"
          >
            {validPageSizeOptions.map(size => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.pageControls}>
        {showFirstLastButtons && (
          <Button
            onClick={() => handlePageChange(1)}
            disabled={validatedCurrentPage === 1}
            ariaLabel="Go to first page"
            className={styles.pageButton}
            testId={`${testId}-first`}
          >
            ⟪
          </Button>
        )}

        <Button
          onClick={() => handlePageChange(validatedCurrentPage - 1)}
          disabled={validatedCurrentPage === 1}
          ariaLabel="Go to previous page"
          className={styles.pageButton}
          testId={`${testId}-prev`}
        >
          ‹
        </Button>

        {pageRange.map((page, index) => (
          page === 'ellipsis' ? (
            <span
              key={`ellipsis-${index}`}
              className={styles.ellipsis}
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <Button
              key={page}
              onClick={() => handlePageChange(page)}
              disabled={page === validatedCurrentPage}
              ariaLabel={`Go to page ${page}`}
              className={classNames(styles.pageButton, {
                [styles.active]: page === validatedCurrentPage
              })}
              testId={`${testId}-page-${page}`}
            >
              {page}
            </Button>
          )
        ))}

        <Button
          onClick={() => handlePageChange(validatedCurrentPage + 1)}
          disabled={validatedCurrentPage === totalPages}
          ariaLabel="Go to next page"
          className={styles.pageButton}
          testId={`${testId}-next`}
        >
          ›
        </Button>

        {showFirstLastButtons && (
          <Button
            onClick={() => handlePageChange(totalPages)}
            disabled={validatedCurrentPage === totalPages}
            ariaLabel="Go to last page"
            className={styles.pageButton}
            testId={`${testId}-last`}
          >
            ⟫
          </Button>
        )}
      </div>

      <div className={styles.pageInfo} aria-live="polite">
        {`Page ${validatedCurrentPage} of ${totalPages}`}
      </div>
    </nav>
  );
});

// Display name for debugging
Pagination.displayName = 'Pagination';

export default Pagination;