import React, { useState, useCallback, useMemo } from 'react';
import classNames from 'classnames'; // ^2.3.2
import { useVirtual } from 'react-virtual'; // ^2.10.4
import LoadingSpinner from './LoadingSpinner';
import { useTheme } from '../../hooks/useTheme';
import { SortDirection, BaseComponentProps } from '../../types/common.types';

// Table column configuration interface
interface TableColumn {
  field: string;
  header: string;
  width?: string;
  sortable?: boolean;
  renderCell?: (value: any) => React.ReactNode;
}

// Table component props interface
interface TableProps extends BaseComponentProps {
  data: Array<any>;
  columns: Array<TableColumn>;
  loading?: boolean;
  sortable?: boolean;
  virtualScroll?: boolean;
  onSort?: (field: string, direction: SortDirection) => void;
  emptyMessage?: string;
  ariaLabel?: string;
  maxHeight?: string;
  rowHeight?: number;
}

/**
 * A responsive and accessible table component implementing Material Design 3.0
 * Features include virtual scrolling, sorting, and comprehensive ARIA support
 */
const Table: React.FC<TableProps> = ({
  data,
  columns,
  loading = false,
  sortable = false,
  virtualScroll = false,
  onSort,
  emptyMessage = 'No data available',
  ariaLabel = 'Data table',
  maxHeight = '400px',
  rowHeight = 48,
  className,
  testId = 'table',
}) => {
  const { theme, isDarkMode } = useTheme();
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<SortDirection>(SortDirection.ASC);

  // Virtual scrolling configuration
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtual({
    size: data.length,
    parentRef,
    estimateSize: useCallback(() => rowHeight, [rowHeight]),
    overscan: 5,
  });

  // Memoized table styles
  const tableStyles = useMemo(() => ({
    container: classNames(
      'relative overflow-hidden rounded-md border',
      isDarkMode ? 'border-gray-700' : 'border-gray-200',
      className
    ),
    header: classNames(
      'sticky top-0 z-10',
      isDarkMode ? 'bg-gray-800' : 'bg-gray-50'
    ),
    headerCell: classNames(
      'px-4 py-3 text-left font-medium text-sm',
      isDarkMode ? 'text-gray-200' : 'text-gray-600'
    ),
    row: classNames(
      'transition-colors',
      isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
    ),
    cell: classNames(
      'px-4 py-3 text-sm',
      isDarkMode ? 'text-gray-300' : 'text-gray-800'
    ),
    sortIcon: classNames(
      'ml-1 inline-block transition-transform',
      isDarkMode ? 'text-gray-400' : 'text-gray-500'
    ),
  }), [isDarkMode, className]);

  // Handle sort click with keyboard support
  const handleSort = useCallback((column: TableColumn) => {
    if (!sortable || !column.sortable || !onSort) return;

    const newDirection = 
      sortField === column.field && sortDirection === SortDirection.ASC
        ? SortDirection.DESC
        : SortDirection.ASC;

    setSortField(column.field);
    setSortDirection(newDirection);
    onSort(column.field, newDirection);
  }, [sortable, sortField, sortDirection, onSort]);

  // Render table header with accessibility support
  const renderHeader = useCallback((column: TableColumn) => {
    const isSorted = sortField === column.field;
    const sortIndicator = isSorted
      ? sortDirection === SortDirection.ASC ? '↑' : '↓'
      : '↕';

    return (
      <th
        key={column.field}
        className={tableStyles.headerCell}
        style={{ width: column.width }}
        role="columnheader"
        aria-sort={isSorted 
          ? sortDirection === SortDirection.ASC ? 'ascending' : 'descending'
          : 'none'
        }
      >
        {column.sortable ? (
          <button
            className="w-full text-left font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
            onClick={() => handleSort(column)}
            onKeyPress={(e) => e.key === 'Enter' && handleSort(column)}
            aria-label={`Sort by ${column.header}`}
          >
            {column.header}
            <span className={tableStyles.sortIcon} aria-hidden="true">
              {sortIndicator}
            </span>
          </button>
        ) : (
          column.header
        )}
      </th>
    );
  }, [tableStyles, sortField, sortDirection, handleSort]);

  // Render table body with virtual scrolling support
  const renderBody = useCallback(() => {
    if (loading) {
      return (
        <tr>
          <td colSpan={columns.length} className="text-center py-8">
            <LoadingSpinner size={32} />
          </td>
        </tr>
      );
    }

    if (!data.length) {
      return (
        <tr>
          <td 
            colSpan={columns.length} 
            className="text-center py-8 text-gray-500"
            role="cell"
          >
            {emptyMessage}
          </td>
        </tr>
      );
    }

    if (virtualScroll) {
      return rowVirtualizer.virtualItems.map(virtualRow => (
        <tr
          key={virtualRow.index}
          className={tableStyles.row}
          style={{
            height: `${virtualRow.size}px`,
            transform: `translateY(${virtualRow.start}px)`,
          }}
        >
          {columns.map(column => (
            <td key={column.field} className={tableStyles.cell}>
              {column.renderCell 
                ? column.renderCell(data[virtualRow.index][column.field])
                : data[virtualRow.index][column.field]}
            </td>
          ))}
        </tr>
      ));
    }

    return data.map((row, index) => (
      <tr key={index} className={tableStyles.row}>
        {columns.map(column => (
          <td key={column.field} className={tableStyles.cell}>
            {column.renderCell 
              ? column.renderCell(row[column.field])
              : row[column.field]}
          </td>
        ))}
      </tr>
    ));
  }, [data, columns, loading, virtualScroll, rowVirtualizer, tableStyles, emptyMessage]);

  return (
    <div 
      className={tableStyles.container}
      data-testid={testId}
      role="region"
      aria-label={ariaLabel}
      aria-busy={loading}
    >
      <div 
        ref={parentRef}
        className="overflow-auto"
        style={{ maxHeight }}
      >
        <table className="w-full border-collapse">
          <thead className={tableStyles.header}>
            <tr>
              {columns.map(renderHeader)}
            </tr>
          </thead>
          <tbody>
            {renderBody()}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default React.memo(Table);