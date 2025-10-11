/**
 * UI-specific helper types and constants for the webview
 * These are presentation-layer utilities not part of the core domain model
 */

import type { State, Workflow, TaskComponentDefinition } from '@amorphie-flow-studio/core';

// Enhanced IntelliSense suggestions
export interface IntelliSenseItem {
  label: string;
  kind: 'Variable' | 'Property' | 'Method' | 'Class' | 'Interface' | 'Enum' | 'Keyword';
  insertText: string;
  documentation?: string;
  detail?: string;
  sortText?: string;
}

// Trigger type information with descriptions for UI display
export const TriggerTypeInfo = {
  0: { label: 'Manual', icon: '👤', description: 'Triggered manually by user action', supportsTimeout: false },
  1: { label: 'Automatic', icon: '⚡', description: 'Triggered automatically by system', supportsTimeout: false },
  2: { label: 'Timeout', icon: '⏰', description: 'Triggered after a specified duration', supportsTimeout: true },
  3: { label: 'Event', icon: '📥', description: 'Triggered by system events', supportsTimeout: false }
} as const;

// State type information for UI display
export const StateTypeInfo = {
  1: { label: 'Initial', icon: '🚀', description: 'Starting state of the workflow' },
  2: { label: 'Intermediate', icon: '⚙️', description: 'Processing state' },
  3: { label: 'Final', icon: '🏁', description: 'End state of the workflow' },
  4: { label: 'SubFlow', icon: '🔗', description: 'State that triggers a sub-workflow' }
} as const;

// Task type information with better descriptions for UI display
export const TaskTypeInfo = {
  '1': { label: 'Dapr HTTP', icon: '🌐', description: 'Call external HTTP endpoints via Dapr' },
  '2': { label: 'Dapr Binding', icon: '🔗', description: 'Execute Dapr binding operations' },
  '3': { label: 'Dapr Service', icon: '🎯', description: 'Call other Dapr services' },
  '4': { label: 'Dapr PubSub', icon: '📢', description: 'Publish/subscribe to topics' },
  '5': { label: 'Human Task', icon: '👥', description: 'Assign task to human operators' },
  '6': { label: 'HTTP Task', icon: '📡', description: 'Direct HTTP calls without Dapr' },
  '7': { label: 'Script Task', icon: '📜', description: 'Execute custom C# scripts' }
} as const;

// UI-specific helper types for editors
export interface MappingConfiguration {
  location: string;
  code: string;
  enabled?: boolean;
  type?: string;
  description?: string;
}

// Context information for IntelliSense
export interface WorkflowContext {
  workflow?: Workflow;
  currentState?: State;
  currentTask?: TaskComponentDefinition;
  availableTasks?: TaskComponentDefinition[];
  availableStates?: State[];
  workflowVariables?: Record<string, any>;
}
