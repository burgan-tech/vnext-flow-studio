import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { join } from 'path';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Load schema from the git submodule
function loadSchema() {
  try {
    // Load from schemas submodule (schemas/schemas/workflow-definition.schema.json)
    const schemaPath = join(__dirname, '..', '..', '..', 'schemas', 'schemas', 'workflow-definition.schema.json');
    return JSON.parse(readFileSync(schemaPath, 'utf8'));
  } catch {
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
}

const schemaJson = loadSchema();
export const validateWorkflow = ajv.compile(schemaJson);
