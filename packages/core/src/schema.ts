import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { join } from 'path';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Load schema from the correct path when running in extension context
function loadSchema() {
  try {
    // Try extension bundle path first (for VS Code extension)
    const extensionSchemaPath = join(__dirname, '..', '..', '..', 'schemas', 'workflow-definition.schema.json');
    return JSON.parse(readFileSync(extensionSchemaPath, 'utf8'));
  } catch {
    try {
      // Fallback to workspace root path (for development)
      const workspaceSchemaPath = join(__dirname, '..', '..', '..', '..', 'schemas', 'workflow-definition.schema.json');
      return JSON.parse(readFileSync(workspaceSchemaPath, 'utf8'));
    } catch {
      // Final fallback - use a minimal schema if file not found
      return {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "title": "BBT Workflow Definition",
        "required": ["key", "attributes"],
        "properties": {
          "key": { "type": "string" },
          "attributes": { "type": "object" }
        }
      };
    }
  }
}

const schemaJson = loadSchema();
export const validateWorkflow = ajv.compile(schemaJson);
