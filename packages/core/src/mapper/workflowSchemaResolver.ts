/**
 * Workflow Schema Resolution
 * Resolves workflow:// URIs to JSON Schemas and creates overlays for Instance.Data
 */

import type { JSONSchema } from './types';
import type { WorkflowSchemasConfig } from './contractTypes';
import { parseWorkflowSchemaUri } from './contractTypes';
import type { IComponentResolver } from '../model/types';

/**
 * Resolve workflow schema from URI using ComponentResolver
 *
 * @param uri - Workflow schema URI (workflow://domain/key@version)
 * @param resolver - ComponentResolver instance
 * @returns Resolved JSON Schema or undefined
 */
export async function resolveWorkflowSchema(
  uri: string,
  resolver: IComponentResolver
): Promise<JSONSchema | undefined> {
  try {
    const ref = parseWorkflowSchemaUri(uri);

    // Use ComponentResolver to get schema component
    // Pass as ComponentRef object so it searches with all patterns and validates by content
    const schemaDef = await resolver.resolveSchema({
      domain: ref.domain,
      flow: 'sys-schemas',
      key: ref.key,
      version: ref.version
    });

    if (!schemaDef) {
      console.warn(`Workflow schema not found: ${uri}`);
      return undefined;
    }

    // Extract actual JSON Schema from SchemaDefinition
    if (schemaDef.attributes?.schema) {
      return schemaDef.attributes.schema as JSONSchema;
    }

    console.warn(`Schema definition missing attributes.schema: ${uri}`);
    return undefined;
  } catch (error) {
    console.error(`Failed to resolve workflow schema: ${uri}`, error);
    return undefined;
  }
}

/**
 * Apply workflow schema to ScriptContext Instance.Data
 * Directly modifies the schema to constrain Instance.Data
 *
 * @param scriptContextSchema - ScriptContext JSON Schema
 * @param workflowSchema - Resolved workflow schema
 * @returns Modified ScriptContext schema
 */
export function applyWorkflowSchemaToContext(
  scriptContextSchema: JSONSchema,
  workflowSchema: JSONSchema
): JSONSchema {
  // Deep clone to avoid mutating original
  const modifiedSchema = JSON.parse(JSON.stringify(scriptContextSchema)) as JSONSchema;

  // Apply workflow schema to Instance.Data
  if (modifiedSchema.properties && modifiedSchema.properties.Instance) {
    const instanceSchema = modifiedSchema.properties.Instance as JSONSchema;
    if (instanceSchema.properties) {
      instanceSchema.properties.Data = workflowSchema;
    }
  }

  return modifiedSchema;
}

/**
 * Resolve and apply workflow schemas to ScriptContext
 *
 * @param workflowSchemas - Workflow schemas configuration
 * @param resolver - ComponentResolver instance
 * @param scriptContextSchema - ScriptContext schema to modify
 * @returns Modified ScriptContext schema or original if no workflow schemas
 */
export async function resolveAndApplyWorkflowSchemas(
  workflowSchemas: WorkflowSchemasConfig | undefined,
  resolver: IComponentResolver,
  scriptContextSchema: JSONSchema
): Promise<JSONSchema> {
  if (!workflowSchemas || !workflowSchemas.parent) {
    return scriptContextSchema;
  }

  // Resolve parent workflow schema
  const parentSchema = await resolveWorkflowSchema(
    workflowSchemas.parent.uri,
    resolver
  );

  if (!parentSchema) {
    console.warn(`Failed to resolve parent workflow schema: ${workflowSchemas.parent.uri}`);
    return scriptContextSchema;
  }

  // Apply workflow schema to Instance.Data
  return applyWorkflowSchemaToContext(scriptContextSchema, parentSchema);

  // Note: Child workflow schema would be used in a different context
  // (when mapping child workflow's ScriptContext in SubFlow scenarios)
}
