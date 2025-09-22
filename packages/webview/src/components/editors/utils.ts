import type { SchemaRef, TaskDefinition, TaskRef } from '@amorphie-flow-studio/core';

export type SchemaMode = 'none' | 'ref' | 'full';

export function isSchemaRef(
  value?: SchemaRef | null
): value is { key: string; domain: string; version: string; flow: string } {
  return Boolean(value && 'key' in value && 'domain' in value && 'version' in value);
}

export function isSchemaInlineRef(value?: SchemaRef | null): value is { ref: string } {
  return Boolean(value && 'ref' in value);
}

export function isTaskRef(
  task: TaskRef
): task is { key: string; domain: string; flow: string; version: string } {
  return Boolean(task && 'key' in task && 'domain' in task && 'flow' in task && 'version' in task);
}

export function isTaskInlineRef(task: TaskRef): task is { ref: string } {
  return Boolean(task && 'ref' in task);
}

export function makeTaskIdentifier(task: {
  key?: string;
  domain?: string;
  flow?: string;
  version?: string;
}): string {
  const key = task.key ?? '';
  const domain = task.domain ?? '';
  const version = task.version ?? '';
  return `${domain}/${key}@${version}`;
}

export function formatTaskOptionLabel(task: TaskDefinition): string {
  return `${task.key} (${task.version})`;
}