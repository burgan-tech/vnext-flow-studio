/**
 * Auto-mapping functionality for the mapper
 * Provides intelligent field matching between source and target schemas
 */

import type { TreeNode, Edge } from './types';
import { getLeafNodes } from './adapter';
import { areTypesCompatible } from './mapperAdapter';

/**
 * Configuration for auto-mapping behavior
 */
export interface AutoMapConfig {
  /** Minimum similarity score to consider a match (0-1) */
  minSimilarity?: number;
  /** Enable fuzzy matching */
  fuzzyMatch?: boolean;
  /** Enable context-aware matching */
  contextMatch?: boolean;
  /** Skip fields that are already mapped */
  skipExisting?: boolean;
}

/**
 * Result of auto-mapping with confidence score
 */
export interface AutoMapResult {
  source: string;        // Source field JSONPath
  target: string;        // Target field JSONPath
  confidence: number;    // Confidence score (0-1)
  reason: string;       // Reason for match
}

/**
 * Calculate Levenshtein distance between two strings
 * Lower distance means more similar strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create a 2D array for dynamic programming
  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill in the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,    // deletion
          matrix[i][j - 1] + 1,    // insertion
          matrix[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate string similarity score (0-1) using Levenshtein distance
 */
function stringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (!str1 || !str2) return 0;

  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);

  // Normalize to 0-1 range
  return 1 - (distance / maxLength);
}

/**
 * Normalize a field name for comparison
 * Handles camelCase, snake_case, kebab-case, etc.
 */
function normalizeFieldName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase -> camel Case
    .replace(/[_-]/g, ' ')                 // snake_case/kebab-case -> space separated
    .toLowerCase()
    .trim();
}

/**
 * Extract context from a JSONPath
 * E.g., "$.customer.address.city" -> ["customer", "address"]
 */
function extractContextFromPath(path: string): string[] {
  const parts = path.split('.');
  // Remove $ at start and field name at end
  return parts.slice(1, -1).filter(p => !p.includes('['));
}

/**
 * Calculate context similarity bonus
 * Gives bonus points if parent paths are similar
 */
function calculateContextBonus(sourcePath: string, targetPath: string): number {
  const sourceContext = extractContextFromPath(sourcePath);
  const targetContext = extractContextFromPath(targetPath);

  if (sourceContext.length === 0 || targetContext.length === 0) {
    return 0;
  }

  // Check if any context parts match
  let bonus = 0;
  for (const sourcePart of sourceContext) {
    for (const targetPart of targetContext) {
      const similarity = stringSimilarity(sourcePart, targetPart);
      if (similarity > 0.7) {
        bonus = Math.max(bonus, similarity * 0.2); // Max 20% bonus
      }
    }
  }

  return bonus;
}

/**
 * Check if a field name suggests it's an identifier
 */
function isLikelyIdentifier(name: string): boolean {
  const normalized = normalizeFieldName(name);
  const idPatterns = ['id', 'key', 'code', 'identifier', 'uuid', 'guid'];

  return idPatterns.some(pattern =>
    normalized === pattern ||
    normalized.endsWith(' ' + pattern) ||
    normalized.startsWith(pattern + ' ')
  );
}

/**
 * Check if field names are semantically related
 * Uses common synonyms and patterns
 */
function areFieldsRelated(field1: string, field2: string): boolean {
  const synonymGroups = [
    ['email', 'mail', 'emailaddress', 'email_address'],
    ['phone', 'tel', 'telephone', 'mobile', 'cell'],
    ['address', 'addr', 'location'],
    ['name', 'title', 'label'],
    ['description', 'desc', 'details', 'summary'],
    ['price', 'cost', 'amount', 'value', 'total'],
    ['quantity', 'qty', 'count', 'number'],
    ['date', 'time', 'timestamp', 'datetime', 'created', 'updated'],
    ['user', 'person', 'customer', 'client', 'buyer'],
    ['product', 'item', 'article', 'sku'],
    ['order', 'purchase', 'transaction'],
    ['status', 'state', 'condition'],
    ['active', 'enabled', 'available'],
    ['url', 'link', 'href', 'uri'],
    ['image', 'picture', 'photo', 'img', 'avatar'],
    ['first', 'given', 'firstname', 'first_name'],
    ['last', 'family', 'surname', 'lastname', 'last_name'],
    ['middle', 'middlename', 'middle_name'],
    ['full', 'fullname', 'full_name', 'display_name'],
    ['company', 'organization', 'org', 'business'],
    ['country', 'nation'],
    ['city', 'town', 'municipality'],
    ['state', 'province', 'region'],
    ['zip', 'postal', 'postcode', 'zipcode'],
    ['street', 'road', 'avenue'],
    ['note', 'notes', 'comment', 'comments', 'remark']
  ];

  const norm1 = normalizeFieldName(field1).replace(/\s+/g, '');
  const norm2 = normalizeFieldName(field2).replace(/\s+/g, '');

  for (const group of synonymGroups) {
    const hasField1 = group.some(synonym => norm1.includes(synonym));
    const hasField2 = group.some(synonym => norm2.includes(synonym));

    if (hasField1 && hasField2) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate field similarity with multiple strategies
 */
export function calculateFieldSimilarity(
  sourceField: string,
  targetField: string,
  sourcePath: string,
  targetPath: string,
  config: AutoMapConfig = {}
): { score: number; reason: string } {
  const { fuzzyMatch = true, contextMatch = true } = config;

  // Exact match
  if (sourceField === targetField) {
    return { score: 1.0, reason: 'Exact match' };
  }

  // Case-insensitive match
  if (sourceField.toLowerCase() === targetField.toLowerCase()) {
    return { score: 0.95, reason: 'Case-insensitive match' };
  }

  // Check if both are likely identifiers
  if (isLikelyIdentifier(sourceField) && isLikelyIdentifier(targetField)) {
    return { score: 0.85, reason: 'Both are identifier fields' };
  }

  let score = 0;
  let reason = '';

  if (fuzzyMatch) {
    // Fuzzy string matching
    const similarity = stringSimilarity(sourceField, targetField);

    // Check semantic relationships
    if (areFieldsRelated(sourceField, targetField)) {
      score = Math.max(similarity, 0.7);
      reason = 'Semantically related fields';
    } else if (similarity > 0.6) {
      score = similarity;
      reason = 'Fuzzy match';
    }
  }

  if (contextMatch && score > 0.3) {
    // Add context bonus
    const contextBonus = calculateContextBonus(sourcePath, targetPath);
    if (contextBonus > 0) {
      score = Math.min(1.0, score + contextBonus);
      reason += ' with context similarity';
    }
  }

  return { score, reason };
}


/**
 * Find automatic mappings between source and target schemas
 */
export function findAutoMappings(
  sourceTree: TreeNode,
  targetTree: TreeNode,
  existingEdges: Edge[] = [],
  config: AutoMapConfig = {}
): AutoMapResult[] {
  const { minSimilarity = 0.5, skipExisting = false } = config;

  // Get all leaf nodes
  const sourceLeaves = getLeafNodes(sourceTree);
  const targetLeaves = getLeafNodes(targetTree);

  console.log(`🌿 Found ${sourceLeaves.length} source and ${targetLeaves.length} target leaf nodes`);

  // Build set of already mapped target fields
  const mappedTargets = new Set<string>();
  if (skipExisting) {
    for (const edge of existingEdges) {
      if (edge.targetHandle) {
        mappedTargets.add(edge.targetHandle);
      }
    }
  }

  // First pass: calculate ALL possible matches
  const allCandidates: AutoMapResult[] = [];

  for (const sourceNode of sourceLeaves) {
    if (!sourceNode.id) continue;

    for (const targetNode of targetLeaves) {
      if (!targetNode.id) continue;

      // Skip if already mapped (if configured)
      if (skipExisting && mappedTargets.has(targetNode.id)) {
        continue;
      }

      // Check type compatibility
      if (!areTypesCompatible(sourceNode.type || null, targetNode.type || null)) {
        continue;
      }

      // Calculate similarity
      const { score, reason } = calculateFieldSimilarity(
        sourceNode.name,
        targetNode.name,
        sourceNode.path,
        targetNode.path,
        config
      );

      // Only consider matches above minimum threshold
      if (score >= minSimilarity) {
        allCandidates.push({
          source: sourceNode.id,
          target: targetNode.id,
          confidence: score,
          reason
        });
      }
    }
  }

  // Sort all candidates by confidence (highest first)
  // Use stable sort with path as tiebreaker for deterministic results
  allCandidates.sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    // Tiebreaker: alphabetical by source then target
    const sourceCompare = a.source.localeCompare(b.source);
    return sourceCompare !== 0 ? sourceCompare : a.target.localeCompare(b.target);
  });

  // Second pass: greedily assign matches, ensuring each source and target used once
  const results: AutoMapResult[] = [];
  const usedSources = new Set<string>();
  const usedTargets = new Set<string>();

  for (const candidate of allCandidates) {
    // Skip if source or target already used
    if (usedSources.has(candidate.source) || usedTargets.has(candidate.target)) {
      continue;
    }

    // Add this match
    results.push(candidate);
    usedSources.add(candidate.source);
    usedTargets.add(candidate.target);
  }

  return results;
}

/**
 * Generate a short summary of auto-mapping results
 */
export function summarizeAutoMapResults(results: AutoMapResult[]): string {
  if (results.length === 0) {
    return 'No automatic mappings found';
  }

  const highConfidence = results.filter(r => r.confidence >= 0.8).length;
  const mediumConfidence = results.filter(r => r.confidence >= 0.6 && r.confidence < 0.8).length;
  const lowConfidence = results.filter(r => r.confidence < 0.6).length;

  const parts = [];
  if (highConfidence > 0) parts.push(`${highConfidence} high confidence`);
  if (mediumConfidence > 0) parts.push(`${mediumConfidence} medium confidence`);
  if (lowConfidence > 0) parts.push(`${lowConfidence} low confidence`);

  return `Found ${results.length} mappings: ${parts.join(', ')}`;
}