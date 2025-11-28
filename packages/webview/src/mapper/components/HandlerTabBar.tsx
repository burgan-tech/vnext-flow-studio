/**
 * HandlerTabBar Component
 * Tab navigation for switching between handlers in multi-method contracts
 * (e.g., InputHandler vs OutputHandler in IMapping)
 */

import React from 'react';
import './HandlerTabBar.css';

export interface HandlerTabBarProps {
  /** List of handler names (e.g., ['InputHandler', 'OutputHandler']) */
  handlers: string[];

  /** Currently active handler */
  activeHandler: string;

  /** Callback when handler changes */
  onHandlerChange: (handler: string) => void;

  /** Contract type for display */
  contractType?: string;

  /** Optional class name */
  className?: string;
}

/**
 * Tab bar for switching between contract handlers
 */
export function HandlerTabBar({
  handlers,
  activeHandler,
  onHandlerChange,
  contractType,
  className = ''
}: HandlerTabBarProps) {
  if (handlers.length === 0) {
    return null;
  }

  // Single handler - no tabs needed
  if (handlers.length === 1) {
    return (
      <div className={`handler-tab-bar single-handler ${className}`}>
        <div className="contract-info">
          {contractType && <span className="contract-type-badge">{contractType}</span>}
          <span className="handler-label">{handlers[0]}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`handler-tab-bar ${className}`}>
      <div className="tab-bar-header">
        {contractType && (
          <div className="contract-info">
            <span className="contract-type-badge">{contractType}</span>
          </div>
        )}
      </div>

      <div className="tab-list" role="tablist">
        {handlers.map((handler) => (
          <button
            key={handler}
            role="tab"
            aria-selected={activeHandler === handler}
            className={`tab-button ${activeHandler === handler ? 'active' : ''}`}
            onClick={() => onHandlerChange(handler)}
          >
            <span className="tab-label">{handler}</span>
            {activeHandler === handler && <div className="tab-indicator" />}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Get friendly display name for handler
 */
export function getHandlerDisplayName(handlerName: string): string {
  const displayNames: Record<string, string> = {
    InputHandler: 'Input',
    OutputHandler: 'Output',
    Handler: 'Handler'
  };

  return displayNames[handlerName] || handlerName;
}

/**
 * Get description for handler
 */
export function getHandlerDescription(handlerName: string, contractType?: string): string {
  if (contractType === 'IMapping') {
    if (handlerName === 'InputHandler') {
      return 'Prepare data before task execution';
    }
    if (handlerName === 'OutputHandler') {
      return 'Process results after task execution';
    }
  }

  if (contractType === 'ISubFlowMapping') {
    if (handlerName === 'InputHandler') {
      return 'Prepare data for subflow creation';
    }
    if (handlerName === 'OutputHandler') {
      return 'Process subflow completion results';
    }
  }

  return '';
}
