import type { JSONSchema } from './types';

/**
 * Recursively sort all object keys for consistent hashing
 */
function sortObjectKeys(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  if (typeof obj === 'object') {
    const sorted: any = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      sorted[key] = sortObjectKeys(obj[key]);
    }
    return sorted;
  }

  return obj;
}

/**
 * Calculate SHA256 hash of a JSON Schema
 * Works in both browser (Web Crypto API) and Node.js (crypto module)
 */
export async function calculateSchemaHash(schema: JSONSchema): Promise<string> {
  // Deep sort all keys recursively for consistent ordering
  const sortedSchema = sortObjectKeys(schema);

  // Normalize to consistent JSON string (no whitespace)
  const normalized = JSON.stringify(sortedSchema);

  // Detect environment and use appropriate hashing method
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    // Browser environment - use Web Crypto API
    return await hashWithWebCrypto(normalized);
  } else {
    // Node.js environment - use crypto module
    return await hashWithNodeCrypto(normalized);
  }
}

/**
 * Hash using Web Crypto API (browser)
 */
async function hashWithWebCrypto(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash using Node.js crypto module
 */
async function hashWithNodeCrypto(data: string): Promise<string> {
  // Dynamic import to avoid bundling in browser
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

/**
 * Compare two schema hashes
 */
export function compareSchemaHashes(hash1: string, hash2: string): boolean {
  return hash1 === hash2;
}
