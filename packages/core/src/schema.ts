import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Load schema from the git submodule
function loadSchema() {
  // Try multiple paths to handle both development and bundled contexts
  const possiblePaths = [
    // For development: from packages/core/dist -> schemas/schemas/
    join(__dirname, '..', '..', '..', 'schemas', 'schemas', 'workflow-definition.schema.json'),
    // For bundled extension: from packages/extension/dist -> packages/extension/schemas/
    join(__dirname, '..', 'schemas', 'workflow-definition.schema.json'),
    // For bundled extension alternative: from dist -> ../schemas/
    join(__dirname, 'schemas', 'workflow-definition.schema.json'),
  ];

  for (const schemaPath of possiblePaths) {
    if (existsSync(schemaPath)) {
      try {
        return JSON.parse(readFileSync(schemaPath, 'utf8'));
      } catch (err) {
        console.warn(`[Schema] Found schema at ${schemaPath} but failed to parse:`, err);
        continue;
      }
    }
  }

  console.warn('[Schema] Could not find workflow-definition.schema.json, using fallback minimal schema');
  // Final fallback - use a minimal schema if file not found
  return {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "title": "Amorphie Workflow Definition",
    "required": ["key", "attributes"],
    "properties": {
      "key": { "type": "string" },
      "attributes": { "type": "object" }
    }
  };
}

const schemaJson = loadSchema();
export const validateWorkflow = ajv.compile(schemaJson);
