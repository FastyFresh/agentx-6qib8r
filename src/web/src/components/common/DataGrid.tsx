import React, { useCallback, useMemo, useState } from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import LoadingSpinner from './LoadingSpinner';
import Pagination from './Pagination';
import { LoadingState, SortDirection } from '../../types/common.types';

/**
 * Interface defining the structure of a data grid column with enhanced accessibility
 */
interface DataGridColumn {
  field: string;
  headerName: string;
  width?: number | string;
  sortable?: boolean;
  renderCell?: (value: any, row: any) => React.ReactNode;
  priority?: number;
  minWidth?: number;
  headerAriaLabel?: string;
  cellAriaLabel?: (value: any) => string;
}

/**
 * Props interface for DataGrid component with enhanced accessibility and responsive features
 */
interface DataGridProps {
  columns: DataGridColumn[];
  rows: any[];
  loading?: boolean;
  pagination?: boolean;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onSortChange?: (field: string, direction: SortDirection) => void;
  virtualization?: boolean;
  rowHeight?: number;
  ariaLabel?: string;
  errorState?: { message: string; retry: () => void };
  responsiveBreakpoint?: 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'light' | 'dark' | 'system';
  className?: string;
  testId?: string;
}

/**
 * Generates class names for the data grid with responsive and theme support
 */
const getGridClasses = (props: DataGridProps): string => {
  const { theme, responsiveBreakpoint, loading, className } = props;
  
  return classNames(
    'data-grid',
    {
      'data-grid--loading': loading,
      'data-grid--dark': theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches),
      [`data-grid--${responsiveBreakpoint}`]: responsiveBreakpoint,
      'data-grid--rtl': document.dir === 'rtl'
    },
    className
  );
};

/**
 * Material Design 3.0 DataGrid Component
 * Implements accessible data grid with sorting, pagination, and responsive design
 */
const DataGrid: React.FC<DataGridProps> = ({
  columns,
  rows = [],
  loading = false,
  pagination = true,
  pageSize = 10,
  onPageChange,
  onSortChange,
  virtualization = false,
  rowHeight = 48,
  ariaLabel = 'Data grid',
  errorState,
  responsiveBreakpoint = 'md',
  theme = 'system',
  className,
  testId = 'data-grid'
}) => {
  // State management
  const [currentPage, setCurrentPage] = useState(1);
  const [sortState, setSortState] = useState<{ field: string; direction: SortDirection } | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<DataGridColumn[]>(columns);

  // Calculate visible rows based on pagination
  const visibleRows = useMemo(() => {
    if (!pagination) return rows;
    const startIndex = (currentPage - 1) * pageSize;
    return rows.slice(startIndex, startIndex + pageSize);
  }, [rows, currentPage, pageSize, pagination]);

  // Handle responsive column visibility
  useCallback(() => {
    const handleResize = () => {
      const breakpoints = {
        sm: 320,
        md: 768,
        lg: 1024,
        xl: 1440
      };
      
      const currentWidth = window.innerWidth;
      const breakpointWidth = breakpoints[responsiveBreakpoint];
      
      const newVisibleColumns = columns.filter(column => 
        !column.priority || currentWidth >= breakpointWidth || column.priority <= 2
      );
      
      setVisibleColumns(newVisibleColumns);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [columns, responsiveBreakpoint]);

  // Handle sort change
  const handleSort = useCallback((field: string) => {
    const column = columns.find(col => col.field === field);
    if (!column?.sortable) return;

    const newDirection = sortState?.field === field && sortState.direction === SortDirection.ASC
      ? SortDirection.DESC
      : SortDirection.ASC;

    setSortState({ field, direction: newDirection });
    onSortChange?.(field, newDirection);

    // Announce sort change to screen readers
    const announcer = document.createElement('div');
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    announcer.textContent = `Table sorted by ${column.headerName} in ${newDirection.toLowerCase()} order`;
    document.body.appendChild(announcer);
    setTimeout(() => document.body.removeChild(announcer), 1000);
  }, [columns, sortState, onSortChange]);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    onPageChange?.(page);
  }, [onPageChange]);

  if (loading) {
    return (
      <div className={getGridClasses({ ...arguments[0], loading: true })} data-testid={`${testId}-loading`}>
        <LoadingSpinner size={48} color="var(--color-primary)" ariaLabel="Loading data" />
      </div>
    );
  }

  if (errorState) {
    return (
      <div className={classNames('data-grid--error', className)} data-testid={`${testId}-error`}>
        <p role="alert">{errorState.message}</p>
        <button onClick={errorState.retry} className="data-grid__retry-button">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div 
      className={getGridClasses({ columns, rows, theme, responsiveBreakpoint, className })}
      data-testid={testId}
      role="grid"
      aria-label={ariaLabel}
    >
      <div className="data-grid__table-container" role="presentation">
        <table className="data-grid__table">
          <thead>
            <tr role="row">
              {visibleColumns.map(column => (
                <th
                  key={column.field}
                  role="columnheader"
                  aria-sort={sortState?.field === column.field 
                    ? sortState.direction.toLowerCase()
                    : 'none'
                  }
                  style={{ width: column.width, minWidth: column.minWidth }}
                  className={classNames('data-grid__header-cell', {
                    'data-grid__header-cell--sortable': column.sortable
                  })}
                  onClick={() => column.sortable && handleSort(column.field)}
                  aria-label={column.headerAriaLabel || column.headerName}
                >
                  {column.headerName}
                  {column.sortable && (
                    <span className="data-grid__sort-icon" aria-hidden="true">
                      {sortState?.field === column.field && (
                        sortState.direction === SortDirection.ASC ? '↑' : '↓'
                      )}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
              <tr
                key={row.id || rowIndex}
                role="row"
                style={{ height: rowHeight }}
                className="data-grid__row"
              >
                {visibleColumns.map(column => (
                  <td
                    key={column.field}
                    role="gridcell"
                    className="data-grid__cell"
                    aria-label={column.cellAriaLabel?.(row[column.field])}
                  >
                    {column.renderCell 
                      ? column.renderCell(row[column.field], row)
                      : row[column.field]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && (
        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={rows.length}
          onPageChange={handlePageChange}
          ariaLabel="Data grid navigation"
          direction={document.dir as 'ltr' | 'rtl'}
          testId={`${testId}-pagination`}
        />
      )}
    </div>
  );
};

// Display name for debugging
DataGrid.displayName = 'DataGrid';

export default React.memo(DataGrid);