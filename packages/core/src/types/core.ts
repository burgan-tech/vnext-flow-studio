// TypeScript types for core-schema.schema.json

import type { Label, VersionStrategy } from './workflow';

// Core reference type (can be either explicit reference or ref)
export type CoreReference =
  | {
      key: string;
      domain: string;
      flow: string;
      version: string;
      id?: string;
    }
  | {
      id: string;
      domain: string;
      flow: string;
      version: string;
      key?: string;
    }
  | {
      ref: string;
    };

// Task reference with mapping
export interface CoreTaskReference {
  order: number;
  task: CoreReference;
  mapping?: {
    location: string;
    code: string;
  };
}

// State attributes for core schema
export interface CoreStateAttributes {
  key: string;
  labels: Label[];
  type: 'start' | 'normal' | 'finish';
  transitions?: CoreReference[];
  views?: CoreReference[];
  responses?: CoreReference[];
}

// Transition attributes for core schema
export interface CoreTransitionAttributes {
  key: string;
  labels: Label[];
  versionStrategy: VersionStrategy;
  type: 'manual' | 'automatic' | 'timeout';
  onExecutionTasks?: CoreTaskReference[];
}

// Base core schema definition
export interface CoreSchemaDefinition {
  key: string;
  version: string;
  domain: string;
  flow: string;
  flowVersion: string;
  tags: string[];
  attributes: CoreStateAttributes | CoreTransitionAttributes | Record<string, any>;
}