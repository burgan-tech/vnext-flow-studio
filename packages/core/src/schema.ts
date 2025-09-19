import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { join } from 'path';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Load schema from file system
const schemaPath = join(__dirname, '../../../schemas/workflow-definition.schema.json');
const schemaJson = JSON.parse(readFileSync(schemaPath, 'utf-8'));

export const validateWorkflow = ajv.compile(schemaJson);