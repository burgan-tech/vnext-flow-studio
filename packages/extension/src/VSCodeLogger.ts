/**
 * VS Code OutputChannel logger implementation
 */

import * as vscode from 'vscode';
import type { ILogger } from '@amorphie-flow-studio/core';

/**
 * Logger that writes to a VS Code OutputChannel
 * Provides a separate stream for logs in VS Code
 */
export class VSCodeOutputChannelLogger implements ILogger {
  private channel: vscode.OutputChannel;
  private showTimestamps: boolean;

  constructor(channelName: string, showTimestamps: boolean = true) {
    this.channel = vscode.window.createOutputChannel(channelName);
    this.showTimestamps = showTimestamps;
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = this.showTimestamps ? `[${new Date().toISOString()}] ` : '';
    return `${timestamp}[${level.toUpperCase()}] ${message}`;
  }

  private write(level: string, message: string, ...args: any[]): void {
    const formatted = this.formatMessage(level, message);

    // Format additional arguments
    let fullMessage = formatted;
    if (args.length > 0) {
      const argsStr = args.map(arg => {
        if (arg instanceof Error) {
          return `\n  Error: ${arg.message}\n  Stack: ${arg.stack}`;
        }
        if (typeof arg === 'object') {
          try {
            return `\n  ${JSON.stringify(arg, null, 2)}`;
          } catch {
            return `\n  ${String(arg)}`;
          }
        }
        return ` ${arg}`;
      }).join('');
      fullMessage += argsStr;
    }

    this.channel.appendLine(fullMessage);
  }

  debug(message: string, ...args: any[]): void {
    this.write('debug', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.write('info', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.write('warn', message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.write('error', message, ...args);
  }

  group(label: string): void {
    this.channel.appendLine('');
    this.channel.appendLine(`┌─ ${label}`);
  }

  groupEnd(): void {
    this.channel.appendLine(`└─`);
    this.channel.appendLine('');
  }

  /**
   * Show the output channel in VS Code
   */
  show(preserveFocus?: boolean): void {
    this.channel.show(preserveFocus);
  }

  /**
   * Hide the output channel
   */
  hide(): void {
    this.channel.hide();
  }

  /**
   * Clear all output
   */
  clear(): void {
    this.channel.clear();
  }

  /**
   * Dispose the output channel
   */
  dispose(): void {
    this.channel.dispose();
  }

  /**
   * Get the underlying VS Code OutputChannel
   */
  getChannel(): vscode.OutputChannel {
    return this.channel;
  }
}
