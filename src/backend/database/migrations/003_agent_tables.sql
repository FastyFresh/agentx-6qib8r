-- Drop existing agent_status enum since it's already defined in initial schema
DROP TYPE IF EXISTS agent_status CASCADE;

-- Create agent type enum
CREATE TYPE agent_type AS ENUM (
    'task',
    'integration',
    'scheduled',
    'event_driven',
    'composite',
    'system'
);

-- Create enhanced agent status enum
CREATE TYPE agent_status AS ENUM (
    'initializing',
    'active',
    'paused',
    'error',
    'terminated',
    'maintenance'
);

-- Create agents table with enhanced schema
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type agent_type NOT NULL,
    status agent_status NOT NULL DEFAULT 'initializing',
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
    runtime_state JSONB DEFAULT '{}'::jsonb,
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    version INTEGER DEFAULT 1,
    is_template BOOLEAN DEFAULT false,
    last_execution_at TIMESTAMP,
    next_maintenance_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create agent logs table
CREATE TABLE agent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    log_level VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    performance_data JSONB DEFAULT '{}'::jsonb,
    execution_time_ms INTEGER,
    source_function VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create agent schedules table
CREATE TABLE agent_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    cron_expression VARCHAR(100) NOT NULL,
    schedule_config JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    retry_delay INTERVAL DEFAULT '5 minutes',
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for agents table
CREATE INDEX idx_agents_creator ON agents(creator_id);
CREATE INDEX idx_agents_type ON agents(type);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_last_execution ON agents(last_execution_at);
CREATE INDEX idx_agents_config ON agents USING gin (config jsonb_path_ops);
CREATE INDEX idx_agents_capabilities ON agents USING gin (capabilities jsonb_path_ops);

-- Create indexes for agent_logs table
CREATE INDEX idx_logs_agent ON agent_logs(agent_id);
CREATE INDEX idx_logs_level ON agent_logs(log_level);
CREATE INDEX idx_logs_created ON agent_logs(created_at);
CREATE INDEX idx_logs_metadata ON agent_logs USING gin (metadata jsonb_path_ops);

-- Create indexes for agent_schedules table
CREATE INDEX idx_schedules_agent ON agent_schedules(agent_id);
CREATE INDEX idx_schedules_next_run ON agent_schedules(next_run_at);
CREATE INDEX idx_schedules_active ON agent_schedules(is_active) WHERE is_active = true;

-- Add constraints
ALTER TABLE agents ADD CONSTRAINT uq_agent_name_creator UNIQUE (name, creator_id);
ALTER TABLE agents ADD CONSTRAINT chk_agent_version CHECK (version > 0);
ALTER TABLE agent_schedules ADD CONSTRAINT uq_agent_schedule UNIQUE (agent_id);
ALTER TABLE agent_schedules ADD CONSTRAINT chk_retry_count CHECK (retry_count <= max_retries);

-- Create trigger function for timestamp updates
CREATE OR REPLACE FUNCTION update_agent_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for schedule timestamp updates
CREATE OR REPLACE FUNCTION update_schedule_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_agents_timestamp
    BEFORE UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_timestamp();

CREATE TRIGGER update_schedules_timestamp
    BEFORE UPDATE ON agent_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_schedule_timestamp();

-- Create function for agent status management
CREATE OR REPLACE FUNCTION update_agent_status(
    p_agent_id UUID,
    p_status agent_status,
    p_runtime_state JSONB DEFAULT NULL,
    p_performance_metrics JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    -- Validate agent exists
    IF NOT EXISTS (SELECT 1 FROM agents WHERE id = p_agent_id) THEN
        RAISE EXCEPTION 'Agent with ID % not found', p_agent_id;
    END IF;

    -- Update agent status and related fields
    UPDATE agents
    SET status = p_status,
        runtime_state = COALESCE(p_runtime_state, runtime_state),
        performance_metrics = COALESCE(p_performance_metrics, performance_metrics),
        last_execution_at = CASE 
            WHEN p_status IN ('active', 'error', 'terminated') THEN CURRENT_TIMESTAMP
            ELSE last_execution_at
        END,
        next_maintenance_at = CASE 
            WHEN p_status = 'active' THEN CURRENT_TIMESTAMP + INTERVAL '7 days'
            ELSE next_maintenance_at
        END
    WHERE id = p_agent_id;

    -- Create log entry for status change
    INSERT INTO agent_logs (
        agent_id,
        log_level,
        message,
        metadata,
        performance_data
    )
    VALUES (
        p_agent_id,
        CASE 
            WHEN p_status = 'error' THEN 'ERROR'
            ELSE 'INFO'
        END,
        format('Agent status changed to %s', p_status),
        jsonb_build_object('previous_state', (SELECT runtime_state FROM agents WHERE id = p_agent_id)),
        p_performance_metrics
    );

    -- Update schedule if status affects scheduling
    IF p_status IN ('terminated', 'error') THEN
        UPDATE agent_schedules
        SET is_active = false
        WHERE agent_id = p_agent_id;
    END IF;
END;
$$ LANGUAGE plpgsql;