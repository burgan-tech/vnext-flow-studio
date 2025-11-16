/**
 * Validation utilities for workflow settings
 */

/**
 * Validate workflow key (lowercase with hyphens)
 */
export function validateKey(key: string): { valid: boolean; error?: string } {
  if (!key || !key.trim()) {
    return { valid: false, error: 'Key is required' };
  }
  if (!/^[a-z0-9-]+$/.test(key)) {
    return { valid: false, error: 'Key must be lowercase with hyphens only (e.g., loan-approval)' };
  }
  return { valid: true };
}

/**
 * Validate workflow domain (lowercase with hyphens)
 */
export function validateDomain(domain: string): { valid: boolean; error?: string } {
  if (!domain || !domain.trim()) {
    return { valid: false, error: 'Domain is required' };
  }
  if (!/^[a-z0-9-]+$/.test(domain)) {
    return { valid: false, error: 'Domain must be lowercase with hyphens only (e.g., finance)' };
  }
  return { valid: true };
}


/**
 * Validate workflow version (semantic versioning)
 */
export function validateVersion(version: string): { valid: boolean; error?: string } {
  if (!version || !version.trim()) {
    return { valid: false, error: 'Version is required' };
  }
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    return { valid: false, error: 'Version must be in format X.Y.Z (e.g., 1.0.0)' };
  }
  return { valid: true };
}

/**
 * Validate tag (non-empty string)
 */
export function validateTag(tag: string): { valid: boolean; error?: string } {
  if (!tag || !tag.trim()) {
    return { valid: false, error: 'Tag cannot be empty' };
  }
  return { valid: true };
}

/**
 * Validate workflow type
 */
export function validateType(type: string): { valid: boolean; error?: string } {
  const validTypes = ['C', 'F', 'S', 'P'];
  if (!validTypes.includes(type)) {
    return { valid: false, error: 'Type must be one of: C (Core), F (Flow), S (SubFlow), P (Sub Process)' };
  }
  return { valid: true };
}

/**
 * Validate subFlowType (only valid when type is S or P)
 */
export function validateSubFlowType(subFlowType: string | undefined, workflowType: string): { valid: boolean; error?: string } {
  if (workflowType === 'S' || workflowType === 'P') {
    // SubFlowType is optional but if provided must be S or P
    if (subFlowType && !['S', 'P'].includes(subFlowType)) {
      return { valid: false, error: 'SubFlow Type must be S (SubFlow) or P (Sub Process)' };
    }
  }
  return { valid: true };
}

/**
 * Validate timeout configuration
 */
export function validateTimeout(timeout: any): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!timeout) {
    return { valid: true, errors };
  }

  // Validate timeout key
  if (!timeout.key || !timeout.key.trim()) {
    errors.timeoutKey = 'Timeout key is required';
  } else if (!/^[a-z0-9-]+$/.test(timeout.key)) {
    errors.timeoutKey = 'Key must be lowercase with hyphens only (e.g., timeout-state)';
  }

  // Validate target state
  if (!timeout.target || !timeout.target.trim()) {
    errors.timeoutTarget = 'Target state is required';
  }

  // Validate timer duration
  if (!timeout.timer?.duration || !timeout.timer.duration.trim()) {
    errors.timeoutDuration = 'Duration is required';
  } else {
    const iso8601Pattern = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;
    if (!iso8601Pattern.test(timeout.timer.duration)) {
      errors.timeoutDuration = 'Duration must be in ISO 8601 format (e.g., PT1H30M)';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validate all workflow settings
 */
export function validateAllSettings(settings: {
  key: string;
  domain: string;
  version: string;
  tags?: string[];
  type: string;
  subFlowType?: string;
  timeout?: any;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const keyResult = validateKey(settings.key);
  if (!keyResult.valid) errors.key = keyResult.error!;

  const domainResult = validateDomain(settings.domain);
  if (!domainResult.valid) errors.domain = domainResult.error!;

  const versionResult = validateVersion(settings.version);
  if (!versionResult.valid) errors.version = versionResult.error!;

  const typeResult = validateType(settings.type);
  if (!typeResult.valid) errors.type = typeResult.error!;

  if (settings.subFlowType) {
    const subFlowTypeResult = validateSubFlowType(settings.subFlowType, settings.type);
    if (!subFlowTypeResult.valid) errors.subFlowType = subFlowTypeResult.error!;
  }

  if (settings.tags) {
    const invalidTags = settings.tags.filter(tag => !validateTag(tag).valid);
    if (invalidTags.length > 0) {
      errors.tags = `${invalidTags.length} invalid tag(s): tags cannot be empty`;
    }
  }

  // Validate timeout if present
  if (settings.timeout) {
    const timeoutResult = validateTimeout(settings.timeout);
    if (!timeoutResult.valid) {
      Object.assign(errors, timeoutResult.errors);
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}
