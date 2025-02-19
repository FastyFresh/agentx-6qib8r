-- Enable required PostgreSQL extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- v15

-- Create enum types for authentication
CREATE TYPE mfa_type AS ENUM (
    'TOTP',
    'SMS',
    'EMAIL',
    'BIOMETRIC',
    'HARDWARE_TOKEN'
);

CREATE TYPE auth_event_type AS ENUM (
    'LOGIN',
    'LOGOUT',
    'TOKEN_REFRESH',
    'MFA_ENABLED',
    'MFA_DISABLED',
    'PASSWORD_RESET',
    'LOGIN_FAILED',
    'SUSPICIOUS_ACTIVITY',
    'ACCOUNT_LOCKED',
    'MFA_FAILED',
    'TOKEN_REVOKED'
);

-- Create user_sessions table for enhanced session tracking
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    jwt_token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    ip_address INET,
    user_agent TEXT,
    is_valid BOOLEAN DEFAULT true,
    device_info JSONB DEFAULT '{}'::jsonb,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create refresh_tokens table for secure token management
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    issued_ip INET,
    issued_user_agent TEXT,
    token_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create mfa_settings table for multi-factor authentication
CREATE TABLE mfa_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT false,
    secret_key TEXT,
    type mfa_type DEFAULT 'TOTP',
    backup_codes_hash JSONB,
    failed_attempts INTEGER DEFAULT 0,
    last_verified TIMESTAMP,
    recovery_options JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create auth_audit_logs table for comprehensive security logging
CREATE TABLE auth_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type auth_event_type NOT NULL,
    ip_address INET,
    user_agent TEXT,
    event_metadata JSONB DEFAULT '{}'::jsonb,
    risk_score INTEGER,
    is_suspicious BOOLEAN DEFAULT false,
    session_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance optimization
CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_valid ON user_sessions(is_valid);
CREATE INDEX idx_sessions_expiry ON user_sessions(expires_at);
CREATE INDEX idx_sessions_ip ON user_sessions(ip_address);
CREATE INDEX idx_sessions_activity ON user_sessions(last_activity);

CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_expiry ON refresh_tokens(expires_at);
CREATE INDEX idx_refresh_revoked ON refresh_tokens(is_revoked);
CREATE INDEX idx_refresh_issued_ip ON refresh_tokens(issued_ip);

CREATE UNIQUE INDEX idx_mfa_user ON mfa_settings(user_id);
CREATE INDEX idx_mfa_type ON mfa_settings(type);

CREATE INDEX idx_audit_user ON auth_audit_logs(user_id);
CREATE INDEX idx_audit_event ON auth_audit_logs(event_type);
CREATE INDEX idx_audit_created ON auth_audit_logs(created_at);
CREATE INDEX idx_audit_ip ON auth_audit_logs(ip_address);
CREATE INDEX idx_audit_suspicious ON auth_audit_logs(is_suspicious);
CREATE INDEX idx_audit_risk ON auth_audit_logs(risk_score);

-- Add constraints for data integrity
ALTER TABLE user_sessions ADD CONSTRAINT uq_user_jwt_token UNIQUE (user_id, jwt_token);
ALTER TABLE refresh_tokens ADD CONSTRAINT uq_user_token_hash UNIQUE (user_id, token_hash);
ALTER TABLE mfa_settings ADD CONSTRAINT uq_user_mfa UNIQUE (user_id);
ALTER TABLE user_sessions ADD CONSTRAINT chk_session_expiry CHECK (expires_at > created_at);
ALTER TABLE refresh_tokens ADD CONSTRAINT chk_token_expiry CHECK (expires_at > created_at);
ALTER TABLE auth_audit_logs ADD CONSTRAINT chk_risk_score CHECK (risk_score BETWEEN 0 AND 100);

-- Create function for secure token hashing
CREATE OR REPLACE FUNCTION hash_token(token TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(digest(token || current_timestamp::text, 'sha256'), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for session cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM user_sessions
        WHERE expires_at < CURRENT_TIMESTAMP
        OR is_valid = false
        RETURNING id
    )
    SELECT COUNT(*) INTO cleaned_count FROM deleted;

    DELETE FROM refresh_tokens
    WHERE expires_at < CURRENT_TIMESTAMP
    OR is_revoked = true;

    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for automatic updates and logging
CREATE TRIGGER update_sessions_timestamp
    BEFORE UPDATE ON user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_refresh_timestamp
    BEFORE UPDATE ON refresh_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_mfa_timestamp
    BEFORE UPDATE ON mfa_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Create trigger function for session audit logging
CREATE OR REPLACE FUNCTION audit_session_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO auth_audit_logs (user_id, event_type, ip_address, session_id)
        VALUES (NEW.user_id, 'LOGIN', NEW.ip_address, NEW.id::text);
    ELSIF TG_OP = 'UPDATE' AND OLD.is_valid = true AND NEW.is_valid = false THEN
        INSERT INTO auth_audit_logs (user_id, event_type, ip_address, session_id)
        VALUES (NEW.user_id, 'LOGOUT', NEW.ip_address, NEW.id::text);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_session_changes
    AFTER INSERT OR UPDATE ON user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION audit_session_changes();

-- Encrypt MFA secrets using pgcrypto
ALTER TABLE mfa_settings
    ALTER COLUMN secret_key SET DATA TYPE TEXT,
    ALTER COLUMN secret_key SET STORAGE EXTERNAL;

UPDATE mfa_settings
SET secret_key = encode(encrypt(
    decode(secret_key, 'base64'),
    current_setting('app.encryption_key'),
    'aes-gcm'
), 'base64')
WHERE secret_key IS NOT NULL;