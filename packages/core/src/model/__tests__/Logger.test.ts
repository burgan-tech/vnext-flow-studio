/**
 * Logger tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ConsoleLogger,
  SilentLogger,
  MultiLogger,
  BufferedLogger,
  createLogger,
  type LogLevel,
  type ILogger
} from '../Logger.js';

describe('Logger', () => {
  describe('ConsoleLogger', () => {
    let consoleSpy: any;

    beforeEach(() => {
      // Spy on console methods
      consoleSpy = {
        log: vi.spyOn(console, 'log').mockImplementation(() => {}),
        info: vi.spyOn(console, 'info').mockImplementation(() => {}),
        warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
        error: vi.spyOn(console, 'error').mockImplementation(() => {})
      };
    });

    it('should log debug messages when minLevel is debug', () => {
      const logger = new ConsoleLogger('Test', 'debug');
      logger.debug('debug message');

      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should not log debug messages when minLevel is info', () => {
      const logger = new ConsoleLogger('Test', 'info');
      logger.debug('debug message');

      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should log info messages', () => {
      const logger = new ConsoleLogger('Test', 'info');
      logger.info('info message');

      expect(consoleSpy.info).toHaveBeenCalled();
    });

    it('should log warn messages', () => {
      const logger = new ConsoleLogger('Test', 'warn');
      logger.warn('warn message');

      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      const logger = new ConsoleLogger('Test', 'error');
      logger.error('error message');

      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should include prefix in messages', () => {
      const logger = new ConsoleLogger('MyPrefix', 'info');
      logger.info('test message');

      expect(consoleSpy.info).toHaveBeenCalled();
      const call = consoleSpy.info.mock.calls[0][0];
      expect(call).toContain('MyPrefix');
    });

    it('should include timestamp in messages', () => {
      const logger = new ConsoleLogger('Test', 'info');
      logger.info('test message');

      expect(consoleSpy.info).toHaveBeenCalled();
      const call = consoleSpy.info.mock.calls[0][0];
      // Check for ISO timestamp format
      expect(call).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should log additional arguments', () => {
      const logger = new ConsoleLogger('Test', 'info');
      logger.info('message', { data: 'value' }, 123);

      expect(consoleSpy.info).toHaveBeenCalled();
      const calls = consoleSpy.info.mock.calls[0];
      expect(calls.length).toBeGreaterThan(1);
    });

    it('should format Error objects', () => {
      const logger = new ConsoleLogger('Test', 'error');
      const error = new Error('Test error');
      logger.error('error occurred', error);

      expect(consoleSpy.error).toHaveBeenCalled();
      const calls = consoleSpy.error.mock.calls[0];
      expect(calls.some((arg: any) => arg instanceof Error)).toBe(true);
    });

    it('should support group and groupEnd', () => {
      const logger = new ConsoleLogger('Test', 'info');

      if (logger.group) {
        logger.group('Test Group');
        expect(consoleSpy.log).toHaveBeenCalled();
      }

      if (logger.groupEnd) {
        logger.groupEnd();
        expect(consoleSpy.log).toHaveBeenCalled();
      }
    });
  });

  describe('SilentLogger', () => {
    it('should not log anything', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger: ILogger = new SilentLogger();

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should support group methods', () => {
      const logger: ILogger = new SilentLogger();

      expect(() => {
        if (logger.group) logger.group('test');
        if (logger.groupEnd) logger.groupEnd();
      }).not.toThrow();
    });
  });

  describe('BufferedLogger', () => {
    let logger: BufferedLogger;

    beforeEach(() => {
      logger = new BufferedLogger();
    });

    it('should store log messages', () => {
      logger.info('test message');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('test message');
      expect(logs[0].level).toBe('info');
    });

    it('should store multiple log levels', () => {
      logger.debug('debug msg');
      logger.info('info msg');
      logger.warn('warn msg');
      logger.error('error msg');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(4);
      expect(logs[0].level).toBe('debug');
      expect(logs[1].level).toBe('info');
      expect(logs[2].level).toBe('warn');
      expect(logs[3].level).toBe('error');
    });

    it('should store additional arguments', () => {
      logger.info('message', { key: 'value' }, 123);

      const logs = logger.getLogs();
      expect(logs[0].args).toEqual([{ key: 'value' }, 123]);
    });

    it('should include timestamp', () => {
      logger.info('test');

      const logs = logger.getLogs();
      expect(logs[0].timestamp).toBeInstanceOf(Date);
    });

    it('should clear logs', () => {
      logger.info('message 1');
      logger.info('message 2');

      expect(logger.getLogs()).toHaveLength(2);

      logger.clear();

      expect(logger.getLogs()).toHaveLength(0);
    });

    it('should filter logs by level', () => {
      logger.debug('debug msg');
      logger.info('info msg');
      logger.warn('warn msg');
      logger.error('error msg');

      const infoLogs = logger.getLogsByLevel('info');
      expect(infoLogs).toHaveLength(1);
      expect(infoLogs[0].message).toBe('info msg');

      const errorLogs = logger.getLogsByLevel('error');
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].message).toBe('error msg');
    });

    it('should check if contains message', () => {
      logger.info('test message');
      logger.warn('another message');

      expect(logger.hasMessage('test message')).toBe(true);
      expect(logger.hasMessage('another')).toBe(true);
      expect(logger.hasMessage('nonexistent')).toBe(false);
    });

    it('should support group methods', () => {
      if (logger.group) {
        logger.group('Test Group');
        const logs = logger.getLogs();
        expect(logs.some(log => log.message.includes('Test Group'))).toBe(true);
      }

      if (logger.groupEnd) {
        logger.groupEnd();
      }
    });
  });

  describe('MultiLogger', () => {
    it('should broadcast to all loggers', () => {
      const buffer1 = new BufferedLogger();
      const buffer2 = new BufferedLogger();

      const multiLogger = new MultiLogger([buffer1, buffer2]);
      multiLogger.info('test message');

      expect(buffer1.getLogs()).toHaveLength(1);
      expect(buffer2.getLogs()).toHaveLength(1);
      expect(buffer1.getLogs()[0].message).toBe('test message');
      expect(buffer2.getLogs()[0].message).toBe('test message');
    });

    it('should broadcast all log levels', () => {
      const buffer = new BufferedLogger();
      const multiLogger = new MultiLogger([buffer]);

      multiLogger.debug('debug');
      multiLogger.info('info');
      multiLogger.warn('warn');
      multiLogger.error('error');

      const logs = buffer.getLogs();
      expect(logs).toHaveLength(4);
    });

    it('should broadcast to multiple logger types', () => {
      const buffer = new BufferedLogger();
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const consoleLogger = new ConsoleLogger('Test', 'info');

      const multiLogger = new MultiLogger([buffer, consoleLogger]);
      multiLogger.info('test message');

      expect(buffer.getLogs()).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should support group methods', () => {
      const buffer = new BufferedLogger();
      const multiLogger = new MultiLogger([buffer]);

      if (multiLogger.group) {
        multiLogger.group('Test Group');
        expect(buffer.getLogs().length).toBeGreaterThan(0);
      }

      if (multiLogger.groupEnd) {
        multiLogger.groupEnd();
      }
    });
  });

  describe('createLogger', () => {
    it('should create logger with info level by default', () => {
      const logger = createLogger('Test');
      expect(logger).toBeInstanceOf(ConsoleLogger);
    });

    it('should create logger with custom level', () => {
      const logger = createLogger('Test', 'debug');
      expect(logger).toBeInstanceOf(ConsoleLogger);
    });

    it('should create silent logger for "silent" level', () => {
      const logger = createLogger('Test', 'silent');
      expect(logger).toBeInstanceOf(SilentLogger);
    });

    it('should work with all log levels', () => {
      const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent'];

      levels.forEach(level => {
        const logger = createLogger('Test', level);
        expect(logger).toBeDefined();
      });
    });
  });
});
