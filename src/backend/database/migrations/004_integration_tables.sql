-- Drop existing types if they exist
DROP TYPE IF EXISTS service_type CASCADE;
DROP TYPE IF EXISTS integration_status CASCADE;

-- Create enhanced service type enum
CREATE TYPE service_type AS ENUM (
    'zoho_crm',
    'rms'
);

-- Create enhanced integration status enum
CREATE TYPE integration_status AS ENUM (
    'active',
    'inactive',
    'error',
    'initializing',
    'maintenance'
);

-- Create integrations table with enhanced schema
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    service_type service_type NOT NULL,
    status integration_status NOT NULL DEFAULT 'initializing',
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_sync_at TIMESTAMP,
    error_message TEXT,
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create integration sync logs table
CREATE TABLE integration_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    duration_ms INTEGER,
    records_processed INTEGER,
    error_details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create optimized indexes for integrations table
CREATE INDEX idx_integrations_agent ON integrations(agent_id);
CREATE INDEX idx_integrations_type ON integrations(service_type);
CREATE INDEX idx_integrations_status ON integrations(status);
CREATE INDEX idx_integrations_last_sync ON integrations(last_sync_at);
CREATE INDEX idx_integrations_config ON integrations USING gin (config jsonb_path_ops);
CREATE INDEX idx_integrations_metrics ON integrations USING gin (performance_metrics jsonb_path_ops);

-- Create optimized indexes for integration_sync_logs table
CREATE INDEX idx_sync_logs_integration ON integration_sync_logs(integration_id);
CREATE INDEX idx_sync_logs_type ON integration_sync_logs(sync_type);
CREATE INDEX idx_sync_logs_created ON integration_sync_logs(created_at);
CREATE INDEX idx_sync_logs_metadata ON integration_sync_logs USING gin (metadata jsonb_path_ops);

-- Add constraints for data integrity
ALTER TABLE integrations ADD CONSTRAINT uq_integration_name_agent UNIQUE (name, agent_id);
ALTER TABLE integrations ADD CONSTRAINT ck_config_not_empty CHECK (config != '{}'::jsonb);
ALTER TABLE integrations ADD CONSTRAINT ck_config_required_fields CHECK (config ? 'credentials' AND config ? 'endpoints');
ALTER TABLE integrations ADD CONSTRAINT ck_performance_metrics_structure CHECK (performance_metrics ? 'response_time' AND performance_metrics ? 'success_rate');

-- Create trigger function for timestamp and metrics updates
CREATE OR REPLACE FUNCTION update_integration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    NEW.performance_metrics = jsonb_set(NEW.performance_metrics, '{last_update}', to_jsonb(CURRENT_TIMESTAMP));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic updates
CREATE TRIGGER update_integrations_timestamp
    BEFORE UPDATE ON integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_integration_timestamp();

-- Create function for comprehensive integration status management
CREATE OR REPLACE FUNCTION update_integration_status(
    p_integration_id UUID,
    p_status integration_status,
    p_error_message TEXT DEFAULT NULL,
    p_performance_data JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    -- Validate integration exists
    IF NOT EXISTS (SELECT 1 FROM integrations WHERE id = p_integration_id) THEN
        RAISE EXCEPTION 'Integration with ID % not found', p_integration_id;
    END IF;

    -- Update integration status and related fields
    UPDATE integrations
    SET status = p_status,
        error_message = CASE 
            WHEN p_status = 'error' THEN p_error_message
            ELSE NULL
        END,
        last_sync_at = CASE 
            WHEN p_status IN ('active', 'error') THEN CURRENT_TIMESTAMP
            ELSE last_sync_at
        END,
        performance_metrics = CASE
            WHEN p_performance_data IS NOT NULL THEN 
                jsonb_set(
                    COALESCE(performance_metrics, '{}'::jsonb),
                    '{last_update}',
                    to_jsonb(CURRENT_TIMESTAMP)
                ) || p_performance_data
            ELSE performance_metrics
        END
    WHERE id = p_integration_id;

    -- Create detailed sync log entry
    INSERT INTO integration_sync_logs (
        integration_id,
        sync_type,
        message,
        metadata,
        duration_ms,
        records_processed,
        error_details
    )
    VALUES (
        p_integration_id,
        CASE 
            WHEN p_status = 'error' THEN 'ERROR'
            WHEN p_status = 'active' THEN 'STATUS_UPDATE'
            ELSE 'SYSTEM'
        END,
        CASE 
            WHEN p_status = 'error' THEN COALESCE(p_error_message, 'Unknown error occurred')
            ELSE format('Integration status changed to %s', p_status)
        END,
        COALESCE(p_performance_data, '{}'::jsonb),
        CASE 
            WHEN p_performance_data ? 'duration_ms' THEN (p_performance_data->>'duration_ms')::integer
            ELSE NULL
        END,
        CASE 
            WHEN p_performance_data ? 'records_processed' THEN (p_performance_data->>'records_processed')::integer
            ELSE NULL
        END,
        CASE 
            WHEN p_status = 'error' THEN p_error_message
            ELSE NULL
        END
    );

    -- Clean up old sync logs (retain last 30 days)
    DELETE FROM integration_sync_logs
    WHERE integration_id = p_integration_id
    AND created_at < (CURRENT_TIMESTAMP - INTERVAL '30 days');
END;
$$ LANGUAGE plpgsql;