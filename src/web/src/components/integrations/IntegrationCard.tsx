import React from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { formatDistanceToNow } from 'date-fns'; // ^2.30.0
import { Skeleton } from '@mui/material'; // ^5.0.0
import { Card } from '../common/Card';
import { IconButton } from '../common/IconButton';
import { Integration, IntegrationStatus, IntegrationServiceType } from '../../types/integration.types';
import { Size } from '../../types/common.types';

// Icons for different service types
import { ReactComponent as ZohoCRMIcon } from '../../assets/icons/zoho-crm.svg';
import { ReactComponent as RMSIcon } from '../../assets/icons/rms.svg';
import { ReactComponent as EditIcon } from '../../assets/icons/edit.svg';
import { ReactComponent as DeleteIcon } from '../../assets/icons/delete.svg';

export interface IntegrationCardProps {
  integration: Integration;
  onEdit: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  className?: string;
  isLoading?: boolean;
  error?: Error | null;
  locale?: string;
  direction?: 'ltr' | 'rtl';
}

/**
 * Returns the appropriate color class based on integration status
 * @param status - Current integration status
 */
const getStatusColor = (status: IntegrationStatus): string => {
  switch (status) {
    case IntegrationStatus.ACTIVE:
      return 'text-success bg-success-light';
    case IntegrationStatus.ERROR:
      return 'text-error bg-error-light';
    case IntegrationStatus.INACTIVE:
      return 'text-warning bg-warning-light';
    default:
      return 'text-secondary bg-secondary-light';
  }
};

/**
 * Returns the appropriate icon component for the integration service type
 * @param serviceType - Type of integration service
 */
const getServiceIcon = (serviceType: IntegrationServiceType): JSX.Element => {
  switch (serviceType) {
    case IntegrationServiceType.ZOHO_CRM:
      return <ZohoCRMIcon aria-label="Zoho CRM" role="img" />;
    case IntegrationServiceType.RMS:
      return <RMSIcon aria-label="Restaurant Management System" role="img" />;
    default:
      return <div aria-label="Unknown Service" role="img" />;
  }
};

export const IntegrationCard: React.FC<IntegrationCardProps> = React.memo(({
  integration,
  onEdit,
  onDelete,
  className = '',
  isLoading = false,
  error = null,
  locale = 'en',
  direction = 'ltr'
}) => {
  const [isEditLoading, setIsEditLoading] = React.useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = React.useState(false);

  /**
   * Handles edit button click with loading state and error handling
   */
  const handleEdit = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isEditLoading) return;

    try {
      setIsEditLoading(true);
      await onEdit(integration.id);
    } catch (err) {
      console.error('Error editing integration:', err);
    } finally {
      setIsEditLoading(false);
    }
  };

  /**
   * Handles delete button click with confirmation and error handling
   */
  const handleDelete = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isDeleteLoading) return;

    const confirmed = window.confirm('Are you sure you want to delete this integration?');
    if (!confirmed) return;

    try {
      setIsDeleteLoading(true);
      await onDelete(integration.id);
    } catch (err) {
      console.error('Error deleting integration:', err);
    } finally {
      setIsDeleteLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className={classNames('integration-card-skeleton', className)}>
        <Skeleton variant="rectangular" width="100%" height={120} />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={classNames('integration-card-error', className)}>
        <div role="alert" className="error-message">
          {error.message}
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={classNames('integration-card', className)}
      variant="outlined"
      focusable
      testId={`integration-card-${integration.id}`}
      direction={direction}
    >
      <div className="integration-card-content">
        <div className="integration-card-header">
          <div className="service-icon" aria-hidden="true">
            {getServiceIcon(integration.serviceType)}
          </div>
          <div className="integration-details">
            <h3 className="integration-name">{integration.name}</h3>
            <span className={classNames('status-badge', getStatusColor(integration.status))}>
              {integration.status}
            </span>
          </div>
        </div>

        <div className="integration-info">
          <span className="last-sync">
            {integration.lastSyncAt
              ? `Last synced ${formatDistanceToNow(integration.lastSyncAt, { addSuffix: true, locale })}` 
              : 'Never synced'}
          </span>
          {integration.errorMessage && (
            <span className="error-message" role="alert">
              {integration.errorMessage}
            </span>
          )}
        </div>

        <div className="action-buttons" dir={direction}>
          <IconButton
            icon={<EditIcon />}
            onClick={handleEdit}
            loading={isEditLoading}
            disabled={integration.status === IntegrationStatus.ERROR}
            size={Size.SMALL}
            ariaLabel="Edit integration"
            testId={`edit-integration-${integration.id}`}
          />
          <IconButton
            icon={<DeleteIcon />}
            onClick={handleDelete}
            loading={isDeleteLoading}
            variant="secondary"
            size={Size.SMALL}
            ariaLabel="Delete integration"
            testId={`delete-integration-${integration.id}`}
          />
        </div>
      </div>
    </Card>
  );
});

IntegrationCard.displayName = 'IntegrationCard';

export default IntegrationCard;