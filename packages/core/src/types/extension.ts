// TypeScript types for extension-definition.schema.json

import type { Label, TaskRef, Mapping } from './workflow';

// Extension type enum
export enum ExtensionType {
  Global = 1,                      // Extension that will work while recording samples are rotating in all streams
  GlobalAndRequested = 2,          // Extension that will work on all streams and when requesting recording samples
  DefinedFlows = 3,                // Extension that will only work on the streams for which it is defined
  DefinedFlowAndRequested = 4      // An extension that will only work on the streams it is defined for and when requested
}

// Extension scope enum
export enum ExtensionScope {
  GetInstance = 1,      // The extension works on {domain}/workflows/{workflow}/instances/{instance} endpoint
  GetAllInstances = 2,  // The extension works on {domain}/workflows/{workflow}/instances endpoint
  Everywhere = 3        // The extension works on all get endpoints
}

// Extension execution task
export interface ExtensionExecutionTask {
  order: number;
  task: TaskRef;
  mapping: Mapping;
}

// Extension attributes
export interface ExtensionAttributes {
  type: ExtensionType;
  scope: ExtensionScope;
  task: ExtensionExecutionTask;
  labels?: Label[];
}

// Main extension definition interface
export interface ExtensionDefinition {
  $schema?: string;
  key: string;
  version: string;
  domain: string;
  flow: 'sys-extensions';
  flowVersion: string;
  tags: string[];
  attributes: ExtensionAttributes;
}