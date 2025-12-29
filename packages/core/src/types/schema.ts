// TypeScript types for schema-definition.schema.json

import type { Label } from './workflow';

// Schema component type (what the schema validates)
export type SchemaComponentType =
  | 'workflow'
  | 'task'
  | 'function'
  | 'view'
  | 'schema'
  | 'extension'
  | 'headers';

// JSON Schema type enum
export type JsonSchemaType =
  | 'object'
  | 'array'
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'null';

// JSON Schema format types
export type JsonSchemaFormat =
  | 'date-time'
  | 'date'
  | 'time'
  | 'email'
  | 'hostname'
  | 'ipv4'
  | 'ipv6'
  | 'uri'
  | 'uri-reference'
  | 'uuid'
  | 'regex';

// JSON Schema definition (simplified, actual JSON Schema is more complex)
export interface JsonSchema {
  $schema: 'https://json-schema.org/draft/2020-12/schema';
  $id: string;
  title: string;
  description?: string;
  type: JsonSchemaType;
  properties?: Record<string, any>;
  items?: any;
  required?: string[];
  additionalProperties?: boolean;
  enum?: any[];
  oneOf?: any[];
  anyOf?: any[];
  allOf?: any[];
  if?: any;
  then?: any;
  else?: any;
  format?: JsonSchemaFormat;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  $ref?: string;
  const?: any;
  default?: any;
  examples?: any[];
}

// Schema attributes
export interface SchemaAttributes {
  type: SchemaComponentType;
  schema: JsonSchema;
  labels?: Label[];
}

// Main schema definition interface
export interface SchemaDefinition {
  $schema?: string;
  key: string;
  version: string;
  domain: string;
  flow: 'sys-schemas';
  flowVersion: string;
  tags: string[];
  attributes: SchemaAttributes;
  __filePath?: string; // Actual file path where schema was loaded from
}