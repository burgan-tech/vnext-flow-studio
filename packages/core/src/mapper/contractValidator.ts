/**
 * Contract Validator
 * Validates that ContractMapSpec conforms to contract signatures
 * and that generated code will implement the contract correctly
 */

import type { ContractMapSpec, HandlerMapSpec } from './contractTypes';
import { getContractDefinition, isMultiMethodContract } from './contractTypes';

/**
 * Validation severity level
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Validation issue
 */
export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  location?: string;
  suggestion?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/**
 * Validate ContractMapSpec against contract definition
 */
export function validateContractMapSpec(mapSpec: ContractMapSpec): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Validate contract type exists
  if (!mapSpec.contractType) {
    issues.push({
      severity: 'error',
      code: 'MISSING_CONTRACT_TYPE',
      message: 'ContractMapSpec must have a contractType',
      suggestion: 'Specify a contract type (IMapping, IConditionMapping, etc.)'
    });
    return { valid: false, issues };
  }

  // Get contract definition
  const contractDef = getContractDefinition(mapSpec.contractType);

  // Validate metadata
  validateMetadata(mapSpec, issues);

  // Validate handler structure
  if (isMultiMethodContract(mapSpec.contractType)) {
    validateMultiHandlerStructure(mapSpec, contractDef.methods, issues);
  } else {
    validateSingleHandlerStructure(mapSpec, issues);
  }

  // Validate schema parts
  validateSchemaParts(mapSpec, issues);

  // Validate contract-specific rules
  validateContractSpecificRules(mapSpec, issues);

  const valid = !issues.some(issue => issue.severity === 'error');
  return { valid, issues };
}

/**
 * Validate metadata fields
 */
function validateMetadata(mapSpec: ContractMapSpec, issues: ValidationIssue[]): void {
  const metadata = mapSpec.metadata;

  if (!metadata) {
    issues.push({
      severity: 'error',
      code: 'MISSING_METADATA',
      message: 'ContractMapSpec must have metadata'
    });
    return;
  }

  // Validate key-based identity
  if (!metadata.key) {
    issues.push({
      severity: 'error',
      code: 'MISSING_KEY',
      message: 'Metadata must have a key',
      suggestion: 'Provide a unique key for this mapper (e.g., "http-task-mapping")'
    });
  }

  if (!metadata.domain) {
    issues.push({
      severity: 'error',
      code: 'MISSING_DOMAIN',
      message: 'Metadata must have a domain',
      suggestion: 'Specify a domain (e.g., "core", "ecommerce")'
    });
  }

  if (!metadata.flow) {
    issues.push({
      severity: 'error',
      code: 'MISSING_FLOW',
      message: 'Metadata must have a flow',
      suggestion: 'Specify a flow category (e.g., "mappers", "sys-mappers")'
    });
  }

  if (!metadata.version) {
    issues.push({
      severity: 'warning',
      code: 'MISSING_VERSION',
      message: 'Metadata should have a version',
      suggestion: 'Provide a semantic version (e.g., "1.0.0")'
    });
  }

  if (!metadata.name) {
    issues.push({
      severity: 'warning',
      code: 'MISSING_NAME',
      message: 'Metadata should have a display name'
    });
  }

  // Validate key format
  if (metadata.key && !/^[a-z0-9-]+$/.test(metadata.key)) {
    issues.push({
      severity: 'warning',
      code: 'INVALID_KEY_FORMAT',
      message: 'Key should contain only lowercase letters, numbers, and hyphens',
      location: `metadata.key: "${metadata.key}"`,
      suggestion: 'Use kebab-case format (e.g., "http-task-mapping")'
    });
  }

  // Validate version format
  if (metadata.version && !/^\d+\.\d+\.\d+$/.test(metadata.version)) {
    issues.push({
      severity: 'info',
      code: 'INVALID_VERSION_FORMAT',
      message: 'Version should follow semantic versioning (major.minor.patch)',
      location: `metadata.version: "${metadata.version}"`,
      suggestion: 'Use format like "1.0.0"'
    });
  }
}

/**
 * Validate multi-handler contract structure
 */
function validateMultiHandlerStructure(
  mapSpec: ContractMapSpec,
  methods: Array<{ methodName: string }>,
  issues: ValidationIssue[]
): void {
  if (!mapSpec.handlers) {
    issues.push({
      severity: 'error',
      code: 'MISSING_HANDLERS',
      message: `Multi-method contract ${mapSpec.contractType} requires handlers`,
      suggestion: 'Define handlers for each method (e.g., InputHandler, OutputHandler)'
    });
    return;
  }

  // Check all required methods have handlers
  for (const method of methods) {
    if (!mapSpec.handlers[method.methodName]) {
      issues.push({
        severity: 'error',
        code: 'MISSING_HANDLER',
        message: `Missing handler for method ${method.methodName}`,
        location: `handlers.${method.methodName}`,
        suggestion: `Add a handler definition for ${method.methodName}`
      });
    }
  }

  // Check for unexpected handlers
  const expectedHandlers = new Set(methods.map(m => m.methodName));
  for (const handlerName of Object.keys(mapSpec.handlers)) {
    if (!expectedHandlers.has(handlerName)) {
      issues.push({
        severity: 'warning',
        code: 'UNEXPECTED_HANDLER',
        message: `Unexpected handler ${handlerName} for contract ${mapSpec.contractType}`,
        location: `handlers.${handlerName}`,
        suggestion: `Remove this handler or check contract type`
      });
    }
  }

  // Validate each handler
  for (const [handlerName, handler] of Object.entries(mapSpec.handlers)) {
    validateHandler(handler, `handlers.${handlerName}`, issues);
  }
}

/**
 * Validate single-handler contract structure
 */
function validateSingleHandlerStructure(
  mapSpec: ContractMapSpec,
  issues: ValidationIssue[]
): void {
  // Single-handler contracts should NOT have handlers property
  if (mapSpec.handlers) {
    issues.push({
      severity: 'warning',
      code: 'UNEXPECTED_HANDLERS_PROPERTY',
      message: `Single-method contract ${mapSpec.contractType} should not use handlers property`,
      suggestion: 'Use base nodes/edges properties instead'
    });
  }

  // Check if base properties are empty
  if ((!mapSpec.nodes || mapSpec.nodes.length === 0) &&
      (!mapSpec.edges || mapSpec.edges.length === 0)) {
    issues.push({
      severity: 'info',
      code: 'EMPTY_MAPPING',
      message: 'Mapper has no nodes or edges defined',
      suggestion: 'Add mappings using the visual editor'
    });
  }
}

/**
 * Validate individual handler
 */
function validateHandler(
  handler: HandlerMapSpec,
  location: string,
  issues: ValidationIssue[]
): void {
  if (!handler.methodName) {
    issues.push({
      severity: 'error',
      code: 'MISSING_METHOD_NAME',
      message: 'Handler must have a methodName',
      location
    });
  }

  if (!handler.schemaParts) {
    issues.push({
      severity: 'error',
      code: 'MISSING_SCHEMA_PARTS',
      message: 'Handler must have schemaParts',
      location
    });
  }

  if (!handler.nodes) {
    issues.push({
      severity: 'warning',
      code: 'MISSING_NODES',
      message: 'Handler should have nodes array (can be empty)',
      location
    });
  }

  if (!handler.edges) {
    issues.push({
      severity: 'warning',
      code: 'MISSING_EDGES',
      message: 'Handler should have edges array (can be empty)',
      location
    });
  }
}

/**
 * Validate schema parts
 */
function validateSchemaParts(mapSpec: ContractMapSpec, issues: ValidationIssue[]): void {
  const validateParts = (schemaParts: any, location: string) => {
    if (!schemaParts) return;

    if (!schemaParts.source || Object.keys(schemaParts.source).length === 0) {
      issues.push({
        severity: 'warning',
        code: 'EMPTY_SOURCE_SCHEMA',
        message: 'Schema parts should define source parts',
        location: `${location}.source`,
        suggestion: 'Define source schema parts for input data'
      });
    }

    if (!schemaParts.target || Object.keys(schemaParts.target).length === 0) {
      issues.push({
        severity: 'warning',
        code: 'EMPTY_TARGET_SCHEMA',
        message: 'Schema parts should define target parts',
        location: `${location}.target`,
        suggestion: 'Define target schema parts for output data'
      });
    }

    // Validate individual parts
    for (const [partName, partDef] of Object.entries(schemaParts.source || {})) {
      validatePartDefinition(partDef as any, `${location}.source.${partName}`, issues);
    }

    for (const [partName, partDef] of Object.entries(schemaParts.target || {})) {
      validatePartDefinition(partDef as any, `${location}.target.${partName}`, issues);
    }
  };

  if (mapSpec.handlers) {
    // Multi-handler contract
    for (const [handlerName, handler] of Object.entries(mapSpec.handlers)) {
      validateParts(handler.schemaParts, `handlers.${handlerName}.schemaParts`);
    }
  } else {
    // Single-handler contract
    validateParts(mapSpec.schemaParts, 'schemaParts');
  }
}

/**
 * Validate individual part definition
 */
function validatePartDefinition(
  partDef: any,
  location: string,
  issues: ValidationIssue[]
): void {
  if (!partDef.schemaRef) {
    issues.push({
      severity: 'error',
      code: 'MISSING_SCHEMA_REF',
      message: 'Part definition must have schemaRef',
      location
    });
  }

  // If it's a custom schema, it should have the schema embedded
  if (partDef.schemaRef === 'custom' && !partDef.schema) {
    issues.push({
      severity: 'error',
      code: 'MISSING_CUSTOM_SCHEMA',
      message: 'Custom schema part must have embedded schema',
      location,
      suggestion: 'Provide a JSON schema or use a file reference'
    });
  }

  // Warn if platform schema not loaded
  if (partDef.schemaRef?.startsWith('platform://') && !partDef.schema) {
    issues.push({
      severity: 'info',
      code: 'PLATFORM_SCHEMA_NOT_LOADED',
      message: 'Platform schema not loaded yet',
      location,
      suggestion: 'Schema will be loaded at runtime'
    });
  }
}

/**
 * Validate contract-specific rules
 */
function validateContractSpecificRules(
  mapSpec: ContractMapSpec,
  issues: ValidationIssue[]
): void {
  switch (mapSpec.contractType) {
    case 'IConditionMapping':
      validateConditionMapping(mapSpec, issues);
      break;

    case 'ITimerMapping':
      validateTimerMapping(mapSpec, issues);
      break;

    case 'IMapping':
      validateIMapping(mapSpec, issues);
      break;

    // Add more contract-specific validations as needed
  }
}

/**
 * Validate IConditionMapping specific rules
 */
function validateConditionMapping(mapSpec: ContractMapSpec, issues: ValidationIssue[]): void {
  // Condition mappings should return boolean
  if (mapSpec.returnType && mapSpec.returnType !== 'boolean') {
    issues.push({
      severity: 'warning',
      code: 'INVALID_RETURN_TYPE',
      message: 'IConditionMapping should return boolean',
      location: 'returnType',
      suggestion: 'Set returnType to "boolean" or omit for default'
    });
  }
}

/**
 * Validate ITimerMapping specific rules
 */
function validateTimerMapping(mapSpec: ContractMapSpec, issues: ValidationIssue[]): void {
  // Timer mappings should return TimerSchedule
  if (mapSpec.returnType && mapSpec.returnType !== 'TimerSchedule') {
    issues.push({
      severity: 'warning',
      code: 'INVALID_RETURN_TYPE',
      message: 'ITimerMapping should return TimerSchedule',
      location: 'returnType',
      suggestion: 'Set returnType to "TimerSchedule" or omit for default'
    });
  }
}

/**
 * Validate IMapping specific rules
 */
function validateIMapping(mapSpec: ContractMapSpec, issues: ValidationIssue[]): void {
  // IMapping must have both InputHandler and OutputHandler
  if (!mapSpec.handlers || !mapSpec.handlers.InputHandler || !mapSpec.handlers.OutputHandler) {
    issues.push({
      severity: 'error',
      code: 'INCOMPLETE_IMAPPING',
      message: 'IMapping requires both InputHandler and OutputHandler',
      suggestion: 'Define both handlers in the handlers property'
    });
  }
}

/**
 * Format validation issues for display
 */
export function formatValidationIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) {
    return '✓ No validation issues';
  }

  const lines: string[] = [];
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  lines.push(`Validation Issues: ${errorCount} errors, ${warningCount} warnings, ${infoCount} info`);
  lines.push('');

  for (const issue of issues) {
    const icon = issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '⚠' : 'ℹ';
    const prefix = `${icon} [${issue.code}]`;

    lines.push(`${prefix} ${issue.message}`);

    if (issue.location) {
      lines.push(`  Location: ${issue.location}`);
    }

    if (issue.suggestion) {
      lines.push(`  Suggestion: ${issue.suggestion}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}
