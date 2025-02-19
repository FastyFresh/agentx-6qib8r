import winston from 'winston';  // v3.10.0
import DailyRotateFile from 'winston-daily-rotate-file';  // v4.7.1

// Define log levels with numeric priorities
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// Configuration constants
const LOG_DIRECTORY = 'logs';
const MAX_FILE_SIZE = '20m';
const MAX_FILES = '14d';

/**
 * Enterprise-grade singleton logger class providing structured logging capabilities
 * with ELK Stack integration, multiple transports, and comprehensive error tracking.
 */
export class Logger {
  private logger: winston.Logger;
  private static instance: Logger;
  private defaultMetadata: Record<string, any>;

  /**
   * Private constructor initializing Winston logger with advanced configuration
   * for ELK Stack compatibility and multiple transports.
   */
  private constructor() {
    this.defaultMetadata = {
      service: 'monitoring-service',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.SERVICE_VERSION || '1.0.0',
      hostname: require('os').hostname()
    };

    // Configure console transport with JSON formatting
    const consoleTransport = new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.errors({ stack: true }),
        winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
      )
    });

    // Configure file transport with daily rotation
    const fileTransport = new DailyRotateFile({
      dirname: LOG_DIRECTORY,
      filename: 'monitoring-service-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: MAX_FILE_SIZE,
      maxFiles: MAX_FILES,
      zippedArchive: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    });

    // Initialize Winston logger with custom configuration
    this.logger = winston.createLogger({
      levels: LOG_LEVELS,
      level: process.env.LOG_LEVEL || 'info',
      defaultMeta: this.defaultMetadata,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.errors({ stack: true })
      ),
      transports: [consoleTransport, fileTransport],
      exitOnError: false
    });

    // Handle transport errors
    fileTransport.on('error', (error) => {
      console.error('Error in file transport:', error);
      // Fallback to console logging if file transport fails
      this.logger.add(consoleTransport);
    });
  }

  /**
   * Returns the singleton instance of the logger with thread-safe initialization.
   * @returns Thread-safe singleton logger instance
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Logs error level messages with comprehensive error tracking and metadata.
   * @param message - Error message to log
   * @param error - Error object containing stack trace
   * @param metadata - Additional contextual metadata
   */
  public error(message: string, error?: Error, metadata: Record<string, any> = {}): void {
    const errorMetadata = {
      correlationId: this.generateCorrelationId(),
      stack: error?.stack,
      code: error?.name,
      timestamp: new Date().toISOString(),
      ...metadata
    };

    this.logger.error(message, {
      ...this.defaultMetadata,
      ...errorMetadata,
      level: 'error'
    });
  }

  /**
   * Logs warning level messages with enhanced context and metadata.
   * @param message - Warning message to log
   * @param metadata - Additional contextual metadata
   */
  public warn(message: string, metadata: Record<string, any> = {}): void {
    const warnMetadata = {
      correlationId: this.generateCorrelationId(),
      timestamp: new Date().toISOString(),
      ...metadata
    };

    this.logger.warn(message, {
      ...this.defaultMetadata,
      ...warnMetadata,
      level: 'warn'
    });
  }

  /**
   * Logs informational messages with structured data and context.
   * @param message - Info message to log
   * @param metadata - Additional contextual metadata
   */
  public info(message: string, metadata: Record<string, any> = {}): void {
    const infoMetadata = {
      timestamp: new Date().toISOString(),
      ...metadata
    };

    this.logger.info(message, {
      ...this.defaultMetadata,
      ...infoMetadata,
      level: 'info'
    });
  }

  /**
   * Logs debug level messages with detailed execution context.
   * @param message - Debug message to log
   * @param metadata - Additional contextual metadata
   */
  public debug(message: string, metadata: Record<string, any> = {}): void {
    const debugMetadata = {
      timestamp: new Date().toISOString(),
      ...metadata
    };

    this.logger.debug(message, {
      ...this.defaultMetadata,
      ...debugMetadata,
      level: 'debug'
    });
  }

  /**
   * Generates a unique correlation ID for log tracking.
   * @private
   * @returns Unique correlation ID
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export default Logger.getInstance();