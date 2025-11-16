/**
 * Database query utilities for change detection
 */

import type { DatabaseConfig } from '@amorphie-flow-studio/graph-core';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Component data from database
 */
export interface ComponentDatabaseData {
  /** Component attributes (from Data column) */
  data: any;

  /** Component key (from Instances.Key) */
  key: string;

  /** Flow name (from Instances.Flow) */
  flow: string;

  /** When this version was created */
  enteredAt: Date;

  /** ETag for versioning */
  etag: string;

  /** Version string (from InstancesData.Version) */
  version: string;

  /** Whether this exists in database */
  exists: boolean;
}

/**
 * Get component data from database
 * Note: domain is part of component identity but not stored in database
 */
export async function getComponentData(
  dbConfig: DatabaseConfig,
  flow: string,
  key: string,
  version?: string,
  _domain?: string  // Not currently stored in DB, but part of component identity
): Promise<ComponentDatabaseData> {
  const dbSchema = flow.replace(/-/g, '_');

  if (dbConfig.useDocker) {
    // Use Docker exec
    const cmd = version
      ? `docker exec ${dbConfig.dockerContainer} psql -U ${dbConfig.user} -d ${dbConfig.database} -t -c "SELECT i.\\"Key\\", i.\\"Flow\\", d.\\"Data\\", d.\\"EnteredAt\\", d.\\"ETag\\", d.\\"Version\\" FROM \\"${dbSchema}\\".\\"Instances\\" i JOIN \\"${dbSchema}\\".\\"InstancesData\\" d ON i.\\"Id\\" = d.\\"InstanceId\\" WHERE i.\\"Key\\" = '${key}' AND d.\\"Version\\" = '${version}'"`
      : `docker exec ${dbConfig.dockerContainer} psql -U ${dbConfig.user} -d ${dbConfig.database} -t -c "SELECT i.\\"Key\\", i.\\"Flow\\", d.\\"Data\\", d.\\"EnteredAt\\", d.\\"ETag\\", d.\\"Version\\" FROM \\"${dbSchema}\\".\\"Instances\\" i JOIN \\"${dbSchema}\\".\\"InstancesData\\" d ON i.\\"Id\\" = d.\\"InstanceId\\" WHERE i.\\"Key\\" = '${key}' AND d.\\"IsLatest\\" = true"`;

    try {
      const { stdout } = await execAsync(cmd);
      const line = stdout.trim();

      if (!line) {
        return {
          data: null,
          key: '',
          flow: '',
          enteredAt: new Date(0),
          etag: '',
          version: '',
          exists: false
        };
      }

      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 6) {
        return {
          key: parts[0],
          flow: parts[1],
          data: parts[2] ? JSON.parse(parts[2]) : null,
          enteredAt: new Date(parts[3]),
          etag: parts[4],
          version: parts[5],
          exists: true
        };
      }

      return {
        data: null,
        key: '',
        flow: '',
        enteredAt: new Date(0),
        etag: '',
        version: '',
        exists: false
      };
    } catch (error) {
      console.error('[DatabaseQuery] Error querying database:', error);
      return {
        data: null,
        key: '',
        flow: '',
        enteredAt: new Date(0),
        etag: '',
        version: '',
        exists: false
      };
    }
  } else {
    // Direct connection not supported without pg module
    console.error('[DatabaseQuery] Direct database connections are not supported.');
    console.error('[DatabaseQuery] Please use Docker connection (set useDocker: true in database config).');
    return {
      data: null,
      key: '',
      flow: '',
      enteredAt: new Date(0),
      etag: '',
      version: '',
      exists: false
    };
  }
}

/**
 * Batch query multiple components
 * Note: domain is part of component identity but not currently stored in database
 */
export async function getComponentDataBatch(
  dbConfig: DatabaseConfig,
  components: Array<{ flow: string; key: string; version?: string; domain?: string }>
): Promise<Map<string, ComponentDatabaseData>> {
  const results = new Map<string, ComponentDatabaseData>();

  if (!dbConfig.useDocker) {
    console.error('[DatabaseQuery] Direct database connections are not supported.');
    console.error('[DatabaseQuery] Please use Docker connection (set useDocker: true in database config).');
    return results;
  }

  // Check if any component specifies a version
  const hasVersions = components.some(c => c.version);

  if (hasVersions) {
    // Query each component individually when versions are specified
    for (const comp of components) {
      const data = await getComponentData(dbConfig, comp.flow, comp.key, comp.version, comp.domain);
      const compKey = `${comp.flow.replace(/-/g, '_')}/${comp.key}`;
      results.set(compKey, data);
    }
    return results;
  }

  // Group by schema for efficient batch querying (when no versions specified)
  const bySchema = new Map<string, string[]>();
  for (const comp of components) {
    const schema = comp.flow.replace(/-/g, '_');
    if (!bySchema.has(schema)) {
      bySchema.set(schema, []);
    }
    bySchema.get(schema)!.push(comp.key);
  }

  // Query each schema
  for (const [schema, keys] of bySchema) {
    const keysArray = keys.map(k => `'${k}'`).join(',');
    const cmd = `docker exec ${dbConfig.dockerContainer} psql -U ${dbConfig.user} -d ${dbConfig.database} -t -c "SELECT i.\\"Key\\", i.\\"Flow\\", d.\\"Data\\", d.\\"EnteredAt\\", d.\\"ETag\\", d.\\"Version\\" FROM \\"${schema}\\".\\"Instances\\" i JOIN \\"${schema}\\".\\"InstancesData\\" d ON i.\\"Id\\" = d.\\"InstanceId\\" WHERE i.\\"Key\\" IN (${keysArray}) AND d.\\"IsLatest\\" = true"`;

    try {
      const { stdout } = await execAsync(cmd);
      const lines = stdout.trim().split('\n').filter(l => l.trim());

      // Map results
      const found = new Set<string>();
      for (const line of lines) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 6) {
          const key = parts[0];
          const compKey = `${schema}/${key}`;
          results.set(compKey, {
            key: parts[0],
            flow: parts[1],
            data: parts[2] ? JSON.parse(parts[2]) : null,
            enteredAt: new Date(parts[3]),
            etag: parts[4],
            version: parts[5],
            exists: true
          });
          found.add(key);
        }
      }

      // Add missing components
      for (const key of keys) {
        if (!found.has(key)) {
          const compKey = `${schema}/${key}`;
          results.set(compKey, {
            data: null,
            key: '',
            flow: '',
            enteredAt: new Date(0),
            etag: '',
            version: '',
            exists: false
          });
        }
      }
    } catch (error) {
      console.error('[DatabaseQuery] Error querying schema:', schema, error);
      // Add all as missing
      for (const key of keys) {
        const compKey = `${schema}/${key}`;
        results.set(compKey, {
          data: null,
          key: '',
          flow: '',
          enteredAt: new Date(0),
          etag: '',
          version: '',
          exists: false
        });
      }
    }
  }

  return results;
}
