-- Create enhanced metric type enum
CREATE TYPE metric_type AS ENUM (
    'system',
    'agent',
    'integration',
    'api'
);

-- Create partitioned metrics table with enhanced schema
CREATE TABLE metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type metric_type NOT NULL,
    name VARCHAR(100) NOT NULL,
    value NUMERIC NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
    labels JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (recorded_at);

-- Create metric aggregations table for efficient historical analysis
CREATE TABLE metric_aggregations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type metric_type NOT NULL,
    name VARCHAR(100) NOT NULL,
    interval VARCHAR(50) NOT NULL,
    min_value NUMERIC,
    max_value NUMERIC,
    avg_value NUMERIC,
    sum_value NUMERIC,
    count INTEGER,
    labels JSONB DEFAULT '{}'::jsonb,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create optimized indexes for metrics table
CREATE INDEX idx_metrics_type ON metrics(type);
CREATE INDEX idx_metrics_name ON metrics(name);
CREATE INDEX idx_metrics_agent ON metrics(agent_id);
CREATE INDEX idx_metrics_integration ON metrics(integration_id);
CREATE INDEX idx_metrics_recorded ON metrics(recorded_at);
CREATE INDEX idx_metrics_labels ON metrics USING gin(labels);

-- Create optimized indexes for metric_aggregations table
CREATE INDEX idx_aggregations_type ON metric_aggregations(type);
CREATE INDEX idx_aggregations_name ON metric_aggregations(name);
CREATE INDEX idx_aggregations_interval ON metric_aggregations(interval);
CREATE INDEX idx_aggregations_period ON metric_aggregations(period_start, period_end);
CREATE INDEX idx_aggregations_labels ON metric_aggregations USING gin(labels);

-- Add constraints for data integrity
ALTER TABLE metrics ADD CONSTRAINT ck_metric_reference 
    CHECK ((agent_id IS NOT NULL AND type = 'agent') OR 
           (integration_id IS NOT NULL AND type = 'integration') OR 
           (type IN ('system', 'api')));

ALTER TABLE metrics ADD CONSTRAINT ck_metric_value 
    CHECK (value >= 0);

ALTER TABLE metric_aggregations ADD CONSTRAINT ck_aggregation_period 
    CHECK (period_end > period_start);

ALTER TABLE metric_aggregations ADD CONSTRAINT uq_metric_aggregation 
    UNIQUE (type, name, interval, period_start, period_end);

ALTER TABLE metrics ADD CONSTRAINT ck_metric_labels 
    CHECK (jsonb_typeof(labels) = 'object');

-- Create initial partitions for metrics table (3 months)
CREATE TABLE metrics_current_month PARTITION OF metrics
    FOR VALUES FROM (DATE_TRUNC('month', CURRENT_DATE))
    TO (DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month'));

CREATE TABLE metrics_next_month PARTITION OF metrics
    FOR VALUES FROM (DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month'))
    TO (DATE_TRUNC('month', CURRENT_DATE + INTERVAL '2 months'));

CREATE TABLE metrics_future_month PARTITION OF metrics
    FOR VALUES FROM (DATE_TRUNC('month', CURRENT_DATE + INTERVAL '2 months'))
    TO (DATE_TRUNC('month', CURRENT_DATE + INTERVAL '3 months'));

-- Create function for efficient metric aggregation
CREATE OR REPLACE FUNCTION aggregate_metrics(
    p_type metric_type,
    p_name VARCHAR,
    p_interval VARCHAR,
    p_start TIMESTAMP,
    p_end TIMESTAMP
) RETURNS void AS $$
BEGIN
    -- Validate input parameters
    IF p_end <= p_start THEN
        RAISE EXCEPTION 'End time must be after start time';
    END IF;

    -- Delete existing aggregation for the same period if exists
    DELETE FROM metric_aggregations
    WHERE type = p_type
        AND name = p_name
        AND interval = p_interval
        AND period_start = p_start
        AND period_end = p_end;

    -- Insert aggregated metrics
    INSERT INTO metric_aggregations (
        type,
        name,
        interval,
        min_value,
        max_value,
        avg_value,
        sum_value,
        count,
        labels,
        period_start,
        period_end
    )
    SELECT
        p_type,
        p_name,
        p_interval,
        MIN(value),
        MAX(value),
        AVG(value),
        SUM(value),
        COUNT(*),
        jsonb_agg(DISTINCT labels) AS labels,
        p_start,
        p_end
    FROM metrics
    WHERE type = p_type
        AND name = p_name
        AND recorded_at >= p_start
        AND recorded_at < p_end;

    -- Clean up old detailed metrics based on retention policy (90 days)
    DELETE FROM metrics
    WHERE type = p_type
        AND name = p_name
        AND recorded_at < (CURRENT_TIMESTAMP - INTERVAL '90 days');

EXCEPTION
    WHEN OTHERS THEN
        -- Log error and re-raise
        RAISE EXCEPTION 'Error aggregating metrics: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Create function to manage partition maintenance
CREATE OR REPLACE FUNCTION maintain_metric_partitions() RETURNS void AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
BEGIN
    -- Create next month's partition if it doesn't exist
    partition_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '3 months');
    partition_name := 'metrics_' || TO_CHAR(partition_date, 'YYYY_MM');
    
    IF NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = partition_name
    ) THEN
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF metrics
            FOR VALUES FROM (%L)
            TO (%L)',
            partition_name,
            partition_date,
            partition_date + INTERVAL '1 month'
        );
    END IF;

    -- Drop old partitions (beyond 90 days)
    FOR partition_name IN (
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname LIKE 'metrics_%'
        AND TO_DATE(SPLIT_PART(c.relname, '_', 2) || '_' || SPLIT_PART(c.relname, '_', 3), 'YYYY_MM')
        < (CURRENT_DATE - INTERVAL '90 days')
    )
    LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I', partition_name);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to automatically aggregate metrics on schedule
CREATE OR REPLACE FUNCTION schedule_metric_aggregation() RETURNS void AS $$
DECLARE
    metric_record RECORD;
BEGIN
    FOR metric_record IN (
        SELECT DISTINCT type, name
        FROM metrics
        WHERE recorded_at >= (CURRENT_TIMESTAMP - INTERVAL '1 hour')
    )
    LOOP
        -- Hourly aggregation
        PERFORM aggregate_metrics(
            metric_record.type,
            metric_record.name,
            'hourly',
            DATE_TRUNC('hour', CURRENT_TIMESTAMP - INTERVAL '1 hour'),
            DATE_TRUNC('hour', CURRENT_TIMESTAMP)
        );

        -- Daily aggregation (for previous day)
        IF EXTRACT(HOUR FROM CURRENT_TIMESTAMP) = 0 THEN
            PERFORM aggregate_metrics(
                metric_record.type,
                metric_record.name,
                'daily',
                DATE_TRUNC('day', CURRENT_TIMESTAMP - INTERVAL '1 day'),
                DATE_TRUNC('day', CURRENT_TIMESTAMP)
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;