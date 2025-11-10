/**
 * Logger abstraction for model components
 * Allows injecting different logging implementations (console, VS Code OutputChannel, etc.)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface ILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  group?(label: string): void;
  groupEnd?(): void;
}

/**
 * Console logger implementation (default)
 */
export class ConsoleLogger implements ILogger {
  constructor(private prefix: string = '', private minLevel: LogLevel = 'info') {}

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private formatMessage(message: string): string {
    const timestamp = new Date().toISOString();
    return this.prefix ? `[${timestamp}] [${this.prefix}] ${message}` : `[${timestamp}] ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage(message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage(message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage(message), ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage(message), ...args);
    }
  }

  group(label: string): void {
    if (console.group) {
      console.group(this.formatMessage(label));
    }
  }

  groupEnd(): void {
    if (console.groupEnd) {
      console.groupEnd();
    }
  }
}

/**
 * Silent logger (no output)
 */
export class SilentLogger implements ILogger {
  debug(_message: string, ..._args: any[]): void {}
  info(_message: string, ..._args: any[]): void {}
  warn(_message: string, ..._args: any[]): void {}
  error(_message: string, ..._args: any[]): void {}
  group(_label: string): void {}
  groupEnd(): void {}
}

/**
 * Multi-logger (broadcasts to multiple loggers)
 */
export class MultiLogger implements ILogger {
  constructor(private loggers: ILogger[]) {}

  debug(message: string, ...args: any[]): void {
    this.loggers.forEach(logger => logger.debug(message, ...args));
  }

  info(message: string, ...args: any[]): void {
    this.loggers.forEach(logger => logger.info(message, ...args));
  }

  warn(message: string, ...args: any[]): void {
    this.loggers.forEach(logger => logger.warn(message, ...args));
  }

  error(message: string, ...args: any[]): void {
    this.loggers.forEach(logger => logger.error(message, ...args));
  }

  group(label: string): void {
    this.loggers.forEach(logger => logger.group?.(label));
  }

  groupEnd(): void {
    this.loggers.forEach(logger => logger.groupEnd?.());
  }
}

/**
 * Buffered logger (stores logs in memory)
 * Useful for testing or collecting logs for later inspection
 */
export class BufferedLogger implements ILogger {
  private buffer: Array<{ level: LogLevel; message: string; args: any[]; timestamp: Date }> = [];

  debug(message: string, ...args: any[]): void {
    this.buffer.push({ level: 'debug', message, args, timestamp: new Date() });
  }

  info(message: string, ...args: any[]): void {
    this.buffer.push({ level: 'info', message, args, timestamp: new Date() });
  }

  warn(message: string, ...args: any[]): void {
    this.buffer.push({ level: 'warn', message, args, timestamp: new Date() });
  }

  error(message: string, ...args: any[]): void {
    this.buffer.push({ level: 'error', message, args, timestamp: new Date() });
  }

  group(label: string): void {
    this.buffer.push({ level: 'info', message: `┌─ ${label}`, args: [], timestamp: new Date() });
  }

  groupEnd(): void {
    this.buffer.push({ level: 'info', message: `└─`, args: [], timestamp: new Date() });
  }

  /**
   * Get all logs
   */
  getLogs() {
    return [...this.buffer];
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: LogLevel) {
    return this.buffer.filter(entry => entry.level === level);
  }

  /**
   * Check if logs contain a message
   */
  hasMessage(messageFragment: string): boolean {
    return this.buffer.some(entry => entry.message.includes(messageFragment));
  }

  /**
   * Get buffer (alias for getLogs)
   */
  getBuffer() {
    return this.getLogs();
  }

  /**
   * Clear all logs
   */
  clear() {
    this.buffer = [];
  }

  toString(): string {
    return this.buffer
      .map(entry => `[${entry.timestamp.toISOString()}] [${entry.level.toUpperCase()}] ${entry.message}`)
      .join('\n');
  }
}

/**
 * Create a default logger
 */
export function createLogger(prefix?: string, minLevel?: LogLevel): ILogger {
  if (minLevel === 'silent') {
    return new SilentLogger();
  }
  return new ConsoleLogger(prefix, minLevel);
}
