// TypeScript types for function-definition.schema.json

import type { Label, TaskRef, Mapping } from './workflow';

// Function scope enum values
export enum FunctionScope {
  StateOnEntry = 1,
  StateOnExit = 2,
  TransitionOnExecute = 3,
  WorkflowOnStart = 4,
  WorkflowOnEnd = 5
}

export interface FunctionExecutionTask {
  order: number;
  task: TaskRef;
  mapping: Mapping;
}

export interface FunctionAttributes {
  scope: FunctionScope;
  task: FunctionExecutionTask;
  labels?: Label[];
}

export interface FunctionDefinition {
  $schema?: string;
  key: string;
  version: string;
  domain: string;
  flow: 'sys-functions';
  flowVersion: string;
  tags: string[];
  attributes: FunctionAttributes;
}