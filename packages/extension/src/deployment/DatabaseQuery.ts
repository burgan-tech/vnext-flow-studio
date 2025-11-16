/**
 * Database query utilities for change detection
 */

import type { DatabaseConfig } from '@amorphie-flow-studio/graph-core';

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
  // Import pg dynamically to avoid activation errors when module is missing
  let pg;
  try {
    pg = await import('pg');
  } catch (importError) {
    console.error('[DatabaseQuery] Failed to import pg module:', importError);
    console.error('[DatabaseQuery] Direct database connections require the "pg" package.');
    console.error('[DatabaseQuery] Please use Docker connection instead (set useDocker: true in database config).');
    return {
      data: null,
      enteredAt: new Date(0),
      etag: '',
      version: '',
      exists: false
    };
  }

  const { Client } = pg;
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

    // Query for specific version if provided, otherwise latest version
    const result = version
      ? await client.query(
          `SELECT i."Key", i."Flow", d."Data", d."EnteredAt", d."ETag", d."Version"
           FROM "${dbSchema}"."Instances" i
           JOIN "${dbSchema}"."InstancesData" d ON i."Id" = d."InstanceId"
           WHERE i."Key" = $1
           AND d."Version" = $2`,
          [key, version]
        )
      : await client.query(
          `SELECT i."Key", i."Flow", d."Data", d."EnteredAt", d."ETag", d."Version"
           FROM "${dbSchema}"."Instances" i
           JOIN "${dbSchema}"."InstancesData" d ON i."Id" = d."InstanceId"
           WHERE i."Key" = $1
           AND d."IsLatest" = true`,
          [key]
        );

    if (result.rows.length === 0) {
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

    const row = result.rows[0];
    return {
      data: row.Data,
      key: row.Key,
      flow: row.Flow,
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
 * Note: domain is part of component identity but not currently stored in database
 */
export async function getComponentDataBatch(
  dbConfig: DatabaseConfig,
  components: Array<{ flow: string; key: string; version?: string; domain?: string }>
): Promise<Map<string, ComponentDatabaseData>> {
  // Import pg dynamically to avoid activation errors when module is missing
  let pg;
  try {
    pg = await import('pg');
  } catch (importError) {
    console.error('[DatabaseQuery] Failed to import pg module:', importError);
    console.error('[DatabaseQuery] Direct database connections require the "pg" package.');
    console.error('[DatabaseQuery] Please use Docker connection instead (set useDocker: true in database config).');
    return new Map<string, ComponentDatabaseData>();
  }

  const results = new Map<string, ComponentDatabaseData>();

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

  const { Client } = pg;
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
        `SELECT i."Key", i."Flow", d."Data", d."EnteredAt", d."ETag", d."Version"
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
          key: row.Key,
          flow: row.Flow,
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
  } finally {
    await client.end();
  }
}
