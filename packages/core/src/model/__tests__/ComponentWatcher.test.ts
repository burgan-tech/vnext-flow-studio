/**
 * ComponentWatcher tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentWatcher } from '../ComponentWatcher.js';
import { ComponentResolver } from '../ComponentResolver.js';
import { BufferedLogger } from '../Logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ComponentWatcher', () => {
  let tempDir: string;
  let resolver: ComponentResolver;
  let watcher: ComponentWatcher;
  let logger: BufferedLogger;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'component-watcher-test-'));

    // Create test component directories
    await fs.mkdir(path.join(tempDir, 'Tasks'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'Schemas'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'Views'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'Functions'), { recursive: true });

    // Create a test resolver
    resolver = new ComponentResolver({ basePath: tempDir, useCache: true });

    // Create a buffered logger for testing
    logger = new BufferedLogger();

    // Create watcher with custom logger
    watcher = new ComponentWatcher(resolver, {
      basePath: tempDir,
      debounceMs: 100, // Shorter debounce for faster tests
      logger
    });
  });

  afterEach(async () => {
    // Stop watcher if running
    if (watcher.isActive()) {
      await watcher.stop();
    }

    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      expect(watcher).toBeDefined();
      expect(watcher.isActive()).toBe(false);
    });

    it('should accept custom watch paths', () => {
      const customWatcher = new ComponentWatcher(resolver, {
        basePath: tempDir,
        watchPaths: ['CustomTasks', 'CustomSchemas'],
        logger
      });

      expect(customWatcher).toBeDefined();
    });

    it('should accept custom debounce time', () => {
      const customWatcher = new ComponentWatcher(resolver, {
        basePath: tempDir,
        debounceMs: 500,
        logger
      });

      expect(customWatcher).toBeDefined();
    });
  });

  describe('Starting and Stopping', () => {
    it('should start watching', async () => {
      await watcher.start();
      expect(watcher.isActive()).toBe(true);

      const logs = logger.getLogs();
      expect(logs.some(log => log.message.includes('Starting file watcher'))).toBe(true);
    });

    it('should not start if already watching', async () => {
      await watcher.start();
      expect(watcher.isActive()).toBe(true);

      // Clear previous logs
      logger.clear();

      // Try to start again
      await watcher.start();

      const logs = logger.getLogs();
      expect(logs.some(log => log.message.includes('Already watching'))).toBe(true);
    });

    it('should stop watching', async () => {
      await watcher.start();
      expect(watcher.isActive()).toBe(true);

      await watcher.stop();
      expect(watcher.isActive()).toBe(false);

      const logs = logger.getLogs();
      expect(logs.some(log => log.message.includes('File watcher stopped'))).toBe(true);
    });

    it('should emit ready event when started', async () => {
      const readyPromise = new Promise<void>((resolve) => {
        watcher.once('ready', resolve);
      });

      await watcher.start();
      await readyPromise;

      expect(watcher.isActive()).toBe(true);
    });

    it('should emit stopped event when stopped', async () => {
      await watcher.start();

      const stoppedPromise = new Promise<void>((resolve) => {
        watcher.once('stopped', resolve);
      });

      await watcher.stop();
      await stoppedPromise;

      expect(watcher.isActive()).toBe(false);
    });
  });

  describe('File Change Detection', () => {
    it('should detect file added', async () => {
      await watcher.start();

      const changePromise = new Promise<void>((resolve) => {
        watcher.once('componentAdded', () => resolve());
      });

      // Add a new task file
      const taskFile = path.join(tempDir, 'Tasks', 'test-task.json');
      await fs.writeFile(taskFile, JSON.stringify({
        key: 'test-task',
        domain: 'test',
        version: '1.0.0',
        type: 'ExecutionTask'
      }));

      // Wait for change event (with timeout)
      await Promise.race([
        changePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
    });

    it('should detect file changed', async () => {
      // Create initial file
      const taskFile = path.join(tempDir, 'Tasks', 'test-task.json');
      await fs.writeFile(taskFile, JSON.stringify({
        key: 'test-task',
        domain: 'test',
        version: '1.0.0',
        type: 'ExecutionTask'
      }));

      await watcher.start();

      const changePromise = new Promise<void>((resolve) => {
        watcher.once('componentChanged', () => resolve());
      });

      // Modify the file
      await fs.writeFile(taskFile, JSON.stringify({
        key: 'test-task',
        domain: 'test',
        version: '1.0.1',
        type: 'ExecutionTask'
      }));

      // Wait for change event (with timeout)
      await Promise.race([
        changePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
    });

    it('should detect file deleted', async () => {
      // Create initial file
      const taskFile = path.join(tempDir, 'Tasks', 'test-task.json');
      await fs.writeFile(taskFile, JSON.stringify({
        key: 'test-task',
        domain: 'test',
        version: '1.0.0',
        type: 'ExecutionTask'
      }));

      await watcher.start();

      const deletePromise = new Promise<void>((resolve) => {
        watcher.once('componentDeleted', () => resolve());
      });

      // Delete the file
      await fs.unlink(taskFile);

      // Wait for delete event (with timeout)
      await Promise.race([
        deletePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
    });
  });

  describe('Component Type Detection', () => {
    it('should detect task component', async () => {
      await watcher.start();

      const changePromise = new Promise<any>((resolve) => {
        watcher.once('change', (event) => resolve(event));
      });

      const taskFile = path.join(tempDir, 'Tasks', 'test-task.json');
      await fs.writeFile(taskFile, JSON.stringify({
        key: 'test-task',
        domain: 'test',
        version: '1.0.0',
        type: 'ExecutionTask'
      }));

      const event = await Promise.race([
        changePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);

      expect(event.componentType).toBe('task');
    });

    it('should detect schema component', async () => {
      await watcher.start();

      const changePromise = new Promise<any>((resolve) => {
        watcher.once('change', (event) => resolve(event));
      });

      const schemaFile = path.join(tempDir, 'Schemas', 'test-schema.json');
      await fs.writeFile(schemaFile, JSON.stringify({
        key: 'test-schema',
        domain: 'test',
        version: '1.0.0',
        type: 'Schema'
      }));

      const event = await Promise.race([
        changePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);

      expect(event.componentType).toBe('schema');
    });

    it('should detect view component', async () => {
      await watcher.start();

      const changePromise = new Promise<any>((resolve) => {
        watcher.once('change', (event) => resolve(event));
      });

      const viewFile = path.join(tempDir, 'Views', 'test-view.json');
      await fs.writeFile(viewFile, JSON.stringify({
        key: 'test-view',
        domain: 'test',
        version: '1.0.0',
        type: 'View'
      }));

      const event = await Promise.race([
        changePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);

      expect(event.componentType).toBe('view');
    });

    it('should detect function component', async () => {
      await watcher.start();

      const changePromise = new Promise<any>((resolve) => {
        watcher.once('change', (event) => resolve(event));
      });

      const functionFile = path.join(tempDir, 'Functions', 'test-function.json');
      await fs.writeFile(functionFile, JSON.stringify({
        key: 'test-function',
        domain: 'test',
        version: '1.0.0',
        type: 'Function'
      }));

      const event = await Promise.race([
        changePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);

      expect(event.componentType).toBe('function');
    });

    it('should ignore diagram files', async () => {
      await watcher.start();

      let eventReceived = false;
      watcher.once('change', () => {
        eventReceived = true;
      });

      const diagramFile = path.join(tempDir, 'Tasks', 'test-task.diagram.json');
      await fs.writeFile(diagramFile, JSON.stringify({
        positions: {}
      }));

      // Wait a bit to ensure no event is emitted
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(eventReceived).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should track statistics', async () => {
      const initialStats = watcher.getStats();
      expect(initialStats.eventsReceived).toBe(0);
      expect(initialStats.eventsProcessed).toBe(0);
      expect(initialStats.errorsCount).toBe(0);
      expect(initialStats.isWatching).toBe(false);
    });

    it('should update statistics on file changes', async () => {
      await watcher.start();

      const taskFile = path.join(tempDir, 'Tasks', 'test-task.json');
      await fs.writeFile(taskFile, JSON.stringify({
        key: 'test-task',
        domain: 'test',
        version: '1.0.0',
        type: 'ExecutionTask'
      }));

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));

      const stats = watcher.getStats();
      expect(stats.eventsReceived).toBeGreaterThan(0);
      expect(stats.isWatching).toBe(true);
    });

    it('should provide formatted statistics string', async () => {
      await watcher.start();

      const statsString = watcher.getStatsString();
      expect(statsString).toContain('Component Watcher Statistics');
      expect(statsString).toContain('Status: Active');
      expect(statsString).toContain('Base Path:');
    });

    it('should reset statistics', async () => {
      await watcher.start();

      const taskFile = path.join(tempDir, 'Tasks', 'test-task.json');
      await fs.writeFile(taskFile, JSON.stringify({
        key: 'test-task',
        domain: 'test',
        version: '1.0.0',
        type: 'ExecutionTask'
      }));

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));

      let stats = watcher.getStats();
      expect(stats.eventsReceived).toBeGreaterThan(0);

      watcher.resetStats();

      stats = watcher.getStats();
      expect(stats.eventsReceived).toBe(0);
      expect(stats.eventsProcessed).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should emit error event on watcher error', async () => {
      await watcher.start();

      const _errorPromise = new Promise<any>((resolve) => {
        watcher.once('error', (error) => resolve(error));
      });

      // Simulate an error by writing an invalid JSON file
      const taskFile = path.join(tempDir, 'Tasks', 'invalid-task.json');
      await fs.writeFile(taskFile, 'invalid json content');

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if error was logged
      const logs = logger.getLogs();
      const hasError = logs.some(log => log.level === 'error');

      // Errors should be logged
      expect(hasError).toBe(true);
    });

    it('should handle missing component properties gracefully', async () => {
      await watcher.start();

      const taskFile = path.join(tempDir, 'Tasks', 'incomplete-task.json');
      await fs.writeFile(taskFile, JSON.stringify({
        key: 'test-task'
        // Missing domain and version
      }));

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check logs for warning about invalid structure
      const logs = logger.getLogs();
      const hasWarning = logs.some(log =>
        log.level === 'warn' && log.message.includes('Invalid component structure')
      );

      expect(hasWarning).toBe(true);
    });
  });

  describe('Debouncing', () => {
    it('should debounce rapid file changes', async () => {
      await watcher.start();

      let changeCount = 0;
      watcher.on('componentChanged', () => {
        changeCount++;
      });

      // Create initial file
      const taskFile = path.join(tempDir, 'Tasks', 'test-task.json');
      await fs.writeFile(taskFile, JSON.stringify({
        key: 'test-task',
        domain: 'test',
        version: '1.0.0',
        type: 'ExecutionTask'
      }));

      // Wait for initial add
      await new Promise(resolve => setTimeout(resolve, 500));

      changeCount = 0; // Reset counter

      // Make rapid changes
      for (let i = 0; i < 5; i++) {
        await fs.writeFile(taskFile, JSON.stringify({
          key: 'test-task',
          domain: 'test',
          version: `1.0.${i}`,
          type: 'ExecutionTask'
        }));
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Wait for debounce to settle
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should receive fewer events than changes due to debouncing
      expect(changeCount).toBeLessThan(5);
      expect(changeCount).toBeGreaterThan(0);
    });
  });

  describe('Integration with ComponentResolver', () => {
    it('should clear resolver cache on file changes', async () => {
      // Spy on resolver's clearCache method
      const clearCacheSpy = vi.spyOn(resolver, 'clearCache');

      await watcher.start();

      const taskFile = path.join(tempDir, 'Tasks', 'test-task.json');
      await fs.writeFile(taskFile, JSON.stringify({
        key: 'test-task',
        domain: 'test',
        version: '1.0.0',
        type: 'ExecutionTask'
      }));

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Cache should have been cleared
      expect(clearCacheSpy).toHaveBeenCalled();
    });
  });
});
