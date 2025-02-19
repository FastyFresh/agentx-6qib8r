-- Initialize database with required extensions, configurations, and security settings
-- Version: 1.0.0
-- Dependencies: PostgreSQL 15+

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";     -- v15
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- v15
CREATE EXTENSION IF NOT EXISTS "citext";        -- v15
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- v15

-- Database configuration settings
ALTER DATABASE agent_platform SET timezone TO 'UTC';
ALTER DATABASE agent_platform SET client_encoding TO 'UTF8';
ALTER DATABASE agent_platform SET default_transaction_isolation TO 'read committed';
ALTER DATABASE agent_platform SET statement_timeout TO '30s';
ALTER DATABASE agent_platform SET idle_in_transaction_session_timeout TO '60s';
ALTER DATABASE agent_platform SET work_mem TO '64MB';
ALTER DATABASE agent_platform SET maintenance_work_mem TO '256MB';
ALTER DATABASE agent_platform SET random_page_cost TO 1.1;
ALTER DATABASE agent_platform SET effective_cache_size TO '16GB';
ALTER DATABASE agent_platform SET effective_io_concurrency TO 200;

-- Security configurations
ALTER DATABASE agent_platform SET ssl TO on;
ALTER DATABASE agent_platform SET row_level_security TO on;
ALTER DATABASE agent_platform SET log_statement TO 'all';
ALTER DATABASE agent_platform SET password_encryption TO 'scram-sha-256';
ALTER DATABASE agent_platform SET connection_limit TO 100;
ALTER DATABASE agent_platform SET log_min_duration_statement TO 1000;
ALTER DATABASE agent_platform SET log_line_prefix TO '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';

-- Initialize database schemas
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS security;
CREATE SCHEMA IF NOT EXISTS integration;

-- Set default privileges
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES FROM PUBLIC;

-- Create database initialization function
CREATE OR REPLACE FUNCTION init_database()
RETURNS void AS $$
BEGIN
    -- Verify extensions
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
        RAISE EXCEPTION 'Required extension uuid-ossp is not installed';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
        RAISE EXCEPTION 'Required extension pgcrypto is not installed';
    END IF;

    -- Set search path
    PERFORM set_config('search_path', 'public, audit, security, integration', false);

    -- Initialize connection pooling
    SET max_connections = '200';
    SET superuser_reserved_connections = '3';
    SET max_prepared_transactions = '100';

    -- Configure query planning
    SET constraint_exclusion = 'partition';
    SET default_statistics_target = 100;
    
    -- Enable parallel query execution
    SET max_parallel_workers_per_gather = '4';
    SET max_parallel_workers = '8';
    SET max_parallel_maintenance_workers = '4';

    -- Configure WAL and checkpoints
    SET checkpoint_timeout = '5min';
    SET checkpoint_completion_target = '0.9';
    SET wal_buffers = '16MB';
    
    -- Enable point-in-time recovery
    SET archive_mode = 'on';
    SET archive_command = 'test ! -f /archive/%f && cp %p /archive/%f';
END;
$$ LANGUAGE plpgsql;

-- Create schema initialization function
CREATE OR REPLACE FUNCTION create_schemas()
RETURNS void AS $$
BEGIN
    -- Set up audit schema
    CREATE TABLE IF NOT EXISTS audit.audit_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        table_name TEXT NOT NULL,
        action TEXT NOT NULL,
        old_data JSONB,
        new_data JSONB,
        user_id UUID,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Create audit indexes
    CREATE INDEX IF NOT EXISTS idx_audit_table ON audit.audit_log(table_name);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit.audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit.audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit.audit_log(user_id);

    -- Set up security schema
    CREATE TABLE IF NOT EXISTS security.access_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID,
        ip_address INET,
        action TEXT,
        resource TEXT,
        success BOOLEAN,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Create security indexes
    CREATE INDEX IF NOT EXISTS idx_access_user ON security.access_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_access_ip ON security.access_log(ip_address);
    CREATE INDEX IF NOT EXISTS idx_access_timestamp ON security.access_log(timestamp);
END;
$$ LANGUAGE plpgsql;

-- Create security configuration function
CREATE OR REPLACE FUNCTION configure_security()
RETURNS void AS $$
BEGIN
    -- Configure SSL
    ALTER SYSTEM SET ssl = on;
    ALTER SYSTEM SET ssl_ciphers = 'HIGH:!aNULL:!MD5';
    
    -- Configure connection security
    ALTER SYSTEM SET password_encryption = 'scram-sha-256';
    ALTER SYSTEM SET authentication_timeout = '1min';
    ALTER SYSTEM SET log_connections = on;
    ALTER SYSTEM SET log_disconnections = on;
    
    -- Configure rate limiting
    ALTER SYSTEM SET max_connections = 100;
    ALTER SYSTEM SET superuser_reserved_connections = 3;
    
    -- Enable encryption for sensitive columns
    CREATE OR REPLACE FUNCTION encrypt_sensitive_data() 
    RETURNS trigger AS $$
    BEGIN
        NEW.sensitive_data = encode(
            encrypt(
                NEW.sensitive_data::bytea,
                current_setting('app.encryption_key'),
                'aes-gcm'
            ),
            'base64'
        );
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    
    -- Set up audit logging
    CREATE OR REPLACE FUNCTION audit_changes()
    RETURNS trigger AS $$
    BEGIN
        INSERT INTO audit.audit_log(
            table_name,
            action,
            old_data,
            new_data,
            user_id
        ) VALUES (
            TG_TABLE_NAME,
            TG_OP,
            row_to_json(OLD),
            row_to_json(NEW),
            current_setting('app.current_user_id')::UUID
        );
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
END;
$$ LANGUAGE plpgsql;

-- Initialize database
SELECT init_database();
SELECT create_schemas();
SELECT configure_security();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO agent_platform_user;
GRANT USAGE ON SCHEMA audit TO agent_platform_user;
GRANT USAGE ON SCHEMA security TO agent_platform_user;
GRANT USAGE ON SCHEMA integration TO agent_platform_user;

-- Revoke public schema usage from public role
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;

-- Create maintenance function for regular cleanup
CREATE OR REPLACE FUNCTION perform_maintenance()
RETURNS void AS $$
BEGIN
    -- Clean up audit logs older than 90 days
    DELETE FROM audit.audit_log 
    WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '90 days';
    
    -- Clean up access logs older than 30 days
    DELETE FROM security.access_log 
    WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    -- Vacuum analyze tables
    VACUUM ANALYZE audit.audit_log;
    VACUUM ANALYZE security.access_log;
END;
$$ LANGUAGE plpgsql;

-- Schedule maintenance job
SELECT cron.schedule('0 0 * * *', 'SELECT perform_maintenance()');