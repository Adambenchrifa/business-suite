export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export class Logger {
  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>) {
    const payload = {
      timestamp: new Date().toISOString(),
      severity: level, // severity is the standard field name for Google Cloud Logging
      service: this.service,
      message,
      ...context,
    };

    if (process.env.NODE_ENV === 'production' || process.env.LOG_JSON === 'true') {
      console.log(JSON.stringify(payload));
    } else {
      const colorMap = {
        [LogLevel.DEBUG]: '\x1b[36m', // Cyan
        [LogLevel.INFO]: '\x1b[32m',  // Green
        [LogLevel.WARN]: '\x1b[33m',  // Yellow
        [LogLevel.ERROR]: '\x1b[31m', // Red
      };
      const resetColor = '\x1b[0m';
      const color = colorMap[level] || resetColor;
      
      console.log(
        `[${payload.timestamp}] ${color}${payload.severity}${resetColor} [${this.service}]: ${message}`,
        context && Object.keys(context).length ? '\n' + JSON.stringify(context, null, 2) : ''
      );
    }
  }

  debug(message: string, context?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: unknown, context?: Record<string, any>) {
    const errorDetails = error instanceof Error 
      ? { errorName: error.name, errorMessage: error.message, stack: error.stack }
      : { rawError: String(error) };

    this.log(LogLevel.ERROR, message, {
      ...errorDetails,
      ...context,
    });
  }
}

export const sysLogger = new Logger('System');
