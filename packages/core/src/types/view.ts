// TypeScript types for view-definition.schema.json

import type { Label } from './workflow';

// View content type enum
export enum ViewType {
  JSON = 1,
  HTML = 2,
  Markdown = 3
}

// View target enum
export enum ViewTarget {
  State = 1,
  Transition = 2,
  Task = 3
}

// View display mode
export type ViewDisplayMode =
  | 'full-page'
  | 'popup'
  | 'bottom-sheet'
  | 'top-sheet'
  | 'drawer'
  | 'inline';

// View animation type
export type ViewAnimation = 'slide' | 'fade' | 'scale' | 'none';

// View metadata (design-time extension, not in schema)
export interface ViewMetadata {
  dismissible?: boolean;
  backdrop?: boolean;
  animation?: ViewAnimation;
}

// Platform-specific view override
export interface PlatformViewOverride {
  type?: ViewType;
  content: string;
  display: ViewDisplayMode;
}

// Platform overrides for views
export interface ViewPlatformOverrides {
  android?: PlatformViewOverride | null;
  ios?: PlatformViewOverride | null;
  web?: PlatformViewOverride | null;
}

// View attributes
export interface ViewAttributes {
  type: ViewType;
  target?: ViewTarget; // Optional design-time field
  content: string;
  labels?: Label[];
  display?: ViewDisplayMode;
  platformOverrides?: ViewPlatformOverrides | null;
  metadata?: ViewMetadata; // Optional design-time extension
  _comment?: string;
}

// Main view definition interface
export interface ViewDefinition {
  $schema?: string;
  key: string;
  version: string;
  domain: string;
  flow: 'sys-views';
  flowVersion: string;
  tags: string[];
  attributes: ViewAttributes;
}