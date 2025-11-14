/**
 * Database query utilities for change detection
 */

import { Client } from 'pg';
import type { DatabaseConfig } from '@amorphie-flow-studio/graph-core';

/**
 * Component data from database
 */
export interface ComponentDatabaseData {
  /** Full component data (attributes section) */
  data: any;

  /** When this version was created */
  enteredAt: Date;

  /** ETag for versioning */
  etag: string;

  /** Version string */
  version: string;

  /** Whether this exists in database */
  exists: boolean;
}

/**
 * Get component data from database
 */
export async function getComponentData(
  dbConfig: DatabaseConfig,
  flow: string,
  key: string
): Promise<ComponentDatabaseData> {
  const client = new Client({
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password
  });

  try {
    await client.connect();

    // Map flow to database schema (sys-flows → sys_flows)
    const dbSchema = flow.replace(/-/g, '_');

    // Query for latest version
    const result = await client.query(
      `SELECT d."Data", d."EnteredAt", d."ETag", d."Version"
       FROM "${dbSchema}"."Instances" i
       JOIN "${dbSchema}"."InstancesData" d ON i."Id" = d."InstanceId"
       WHERE i."Key" = $1
       AND d."IsLatest" = true`,
      [key]
    );

    if (result.rows.length === 0) {
      return {
        data: null,
        enteredAt: new Date(0),
        etag: '',
        version: '',
        exists: false
      };
    }

    const row = result.rows[0];
    return {
      data: row.Data,
      enteredAt: row.EnteredAt,
      etag: row.ETag,
      version: row.Version,
      exists: true
    };
  } finally {
    await client.end();
  }
}

/**
 * Batch query multiple components
 */
export async function getComponentDataBatch(
  dbConfig: DatabaseConfig,
  components: Array<{ flow: string; key: string }>
): Promise<Map<string, ComponentDatabaseData>> {
  const results = new Map<string, ComponentDatabaseData>();

  // Group by schema for efficient querying
  const bySchema = new Map<string, string[]>();
  for (const comp of components) {
    const schema = comp.flow.replace(/-/g, '_');
    if (!bySchema.has(schema)) {
      bySchema.set(schema, []);
    }
    bySchema.get(schema)!.push(comp.key);
  }

  const client = new Client({
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password
  });

  try {
    await client.connect();

    // Query each schema
    for (const [schema, keys] of bySchema) {
      const result = await client.query(
        `SELECT i."Key", d."Data", d."EnteredAt", d."ETag", d."Version"
         FROM "${schema}"."Instances" i
         JOIN "${schema}"."InstancesData" d ON i."Id" = d."InstanceId"
         WHERE i."Key" = ANY($1::text[])
         AND d."IsLatest" = true`,
        [keys]
      );

      // Map results
      const found = new Set<string>();
      for (const row of result.rows) {
        const compKey = `${schema}/${row.Key}`;
        results.set(compKey, {
          data: row.Data,
          enteredAt: row.EnteredAt,
          etag: row.ETag,
          version: row.Version,
          exists: true
        });
        found.add(row.Key);
      }

      // Add missing components
      for (const key of keys) {
        if (!found.has(key)) {
          const compKey = `${schema}/${key}`;
          results.set(compKey, {
            data: null,
            enteredAt: new Date(0),
            etag: '',
            version: '',
            exists: false
          });
        }
      }
    }

    return results;
  } finally {
    await client.end();
  }
}
