# Use PostgreSQL 15 Alpine as the base image for a lightweight container
FROM postgres:15-alpine

# Set environment variables for PostgreSQL configuration
ENV POSTGRES_USER=${POSTGRES_USER} \
    POSTGRES_PASSWORD=${POSTGRES_PASSWORD} \
    POSTGRES_DB=${POSTGRES_DB} \
    PGDATA=/var/lib/postgresql/data/pgdata \
    POSTGRES_INITDB_ARGS="--data-checksums" \
    POSTGRES_HOST_AUTH_METHOD="scram-sha-256" \
    SSL_CERT_DAYS=365

# Install required packages for security and monitoring
RUN apk add --no-cache \
    openssl \
    ca-certificates \
    tzdata \
    postgresql-contrib

# Create necessary directories with proper permissions
RUN mkdir -p /var/lib/postgresql/data && \
    mkdir -p /var/lib/postgresql/archive && \
    mkdir -p /etc/postgresql/ssl && \
    chown -R postgres:postgres /var/lib/postgresql && \
    chmod 700 /var/lib/postgresql/data && \
    chmod 700 /var/lib/postgresql/archive

# Generate SSL certificates for secure connections
RUN openssl req -x509 -nodes \
    -days ${SSL_CERT_DAYS} \
    -newkey rsa:4096 \
    -keyout /etc/postgresql/ssl/server.key \
    -out /etc/postgresql/ssl/server.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" && \
    chown postgres:postgres /etc/postgresql/ssl/server.* && \
    chmod 600 /etc/postgresql/ssl/server.key

# Copy initialization scripts
COPY --chown=postgres:postgres init.sql /docker-entrypoint-initdb.d/
RUN chmod 755 /docker-entrypoint-initdb.d/init.sql

# Create and configure PostgreSQL configuration file
RUN echo "ssl = on" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "ssl_cert_file = '/etc/postgresql/ssl/server.crt'" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "ssl_key_file = '/etc/postgresql/ssl/server.key'" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "ssl_ciphers = 'HIGH:!aNULL:!MD5'" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "password_encryption = scram-sha-256" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "shared_buffers = 256MB" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "work_mem = 64MB" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "maintenance_work_mem = 256MB" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "effective_cache_size = 1GB" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "synchronous_commit = on" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "wal_buffers = 16MB" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "checkpoint_timeout = 5min" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "archive_mode = on" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "archive_command = 'test ! -f /var/lib/postgresql/archive/%f && cp %p /var/lib/postgresql/archive/%f'" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "log_destination = 'csvlog'" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "logging_collector = on" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "log_directory = 'pg_log'" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "log_rotation_age = 1d" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "log_rotation_size = 100MB" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "log_min_duration_statement = 1000" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "log_checkpoints = on" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "log_connections = on" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "log_disconnections = on" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "log_lock_waits = on" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "log_temp_files = 0" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "log_autovacuum_min_duration = 0" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "track_activities = on" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "track_counts = on" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "track_io_timing = on" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "track_functions = all" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "autovacuum = on" >> /usr/local/share/postgresql/postgresql.conf.sample && \
    echo "max_connections = 100" >> /usr/local/share/postgresql/postgresql.conf.sample

# Create pg_hba.conf with secure authentication settings
RUN echo "local all all scram-sha-256" > /usr/local/share/postgresql/pg_hba.conf.sample && \
    echo "host all all 127.0.0.1/32 scram-sha-256" >> /usr/local/share/postgresql/pg_hba.conf.sample && \
    echo "host all all ::1/128 scram-sha-256" >> /usr/local/share/postgresql/pg_hba.conf.sample && \
    echo "hostssl all all 0.0.0.0/0 scram-sha-256" >> /usr/local/share/postgresql/pg_hba.conf.sample

# Expose PostgreSQL port
EXPOSE 5432

# Set default command
CMD ["postgres"]