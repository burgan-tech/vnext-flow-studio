/**
 * Database cleanup utility for removing existing workflow instances
 * Mimics the vnext-workflow-cli database cleanup functionality
 */

import type { DatabaseConfig } from '@amorphie-flow-studio/graph-core';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Instance status result
 */
export interface InstanceInfo {
  id: string;
  status: 'Draft' | 'Active' | 'Inactive' | 'Unknown';
  version?: string;  // The actual version stored in database
}

/**
 * Get the instance ID and status for a workflow from the database
 * @param version Optional version to query for specific version. If not provided, gets latest by CreatedAt
 */
export async function getInstanceInfo(
  dbConfig: DatabaseConfig,
  flow: string,
  key: string,
  version?: string
): Promise<InstanceInfo | null> {
  const dbSchema = flow.replace(/-/g, '_');

  if (dbConfig.useDocker) {
    // Use Docker exec
    // Join with InstancesData to get version info
    const cmd = version
      ? `docker exec ${dbConfig.dockerContainer} psql -U ${dbConfig.user} -d ${dbConfig.database} -t -c "SELECT i.\\"Id\\", i.\\"Status\\", d.\\"Version\\" FROM \\"${dbSchema}\\".\\"Instances\\" i JOIN \\"${dbSchema}\\".\\"InstancesData\\" d ON i.\\"Id\\" = d.\\"InstanceId\\" WHERE i.\\"Key\\" = '${key}' AND d.\\"Version\\" = '${version}' ORDER BY i.\\"CreatedAt\\" DESC LIMIT 1"`
      : `docker exec ${dbConfig.dockerContainer} psql -U ${dbConfig.user} -d ${dbConfig.database} -t -c "SELECT i.\\"Id\\", i.\\"Status\\", d.\\"Version\\" FROM \\"${dbSchema}\\".\\"Instances\\" i JOIN \\"${dbSchema}\\".\\"InstancesData\\" d ON i.\\"Id\\" = d.\\"InstanceId\\" WHERE i.\\"Key\\" = '${key}' ORDER BY i.\\"CreatedAt\\" DESC LIMIT 1"`;

    try {
      console.log('[DatabaseCleanup] Executing Docker exec...');
      console.log('[DatabaseCleanup]   Container:', dbConfig.dockerContainer);
      console.log('[DatabaseCleanup]   User:', dbConfig.user);
      console.log('[DatabaseCleanup]   Database:', dbConfig.database);
      console.log('[DatabaseCleanup]   Schema:', dbSchema);
      console.log('[DatabaseCleanup]   Key:', key);
      if (version) {
        console.log('[DatabaseCleanup]   Querying for version:', version);
      }

      const { stdout } = await execAsync(cmd);
      const line = stdout.trim();
      if (!line) return null;

      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 2) {
        return {
          id: parts[0],
          status: (parts[1] as any) || 'Unknown',
          version: parts[2] || undefined
        };
      }
      return null;
    } catch (error) {
      console.error('[DatabaseCleanup] Error getting instance info:', error);
      console.error('[DatabaseCleanup] ❌ Docker container not found: "' + dbConfig.dockerContainer + '"');
      console.error('[DatabaseCleanup] ⚠️  This should be the actual Docker container name (e.g. "vnext-postgres")');
      console.error('[DatabaseCleanup] ⚠️  It is NOT the database name (e.g. "vNext_WorkflowDb")');
      console.error('[DatabaseCleanup] ℹ️  Check your database configuration in Amorphie Settings');
      return null;
    }
  } else {
    // Direct connection - requires pg module
    try {
      let pg;
      try {
        pg = await import('pg');
      } catch (importError) {
        console.error('[DatabaseCleanup] Failed to import pg module:', importError);
        console.error('[DatabaseCleanup] Direct database connections require the "pg" package.');
        console.error('[DatabaseCleanup] Please use Docker connection instead (set useDocker: true in database config).');
        console.error('[DatabaseCleanup] Or install pg globally: npm install -g pg');
        return null;
      }

      const { Client } = pg;
      const client = new Client({
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password
      });

      await client.connect();
      console.log('[DatabaseCleanup] Querying schema:', dbSchema, 'for key:', key);
      if (version) {
        console.log('[DatabaseCleanup]   Version:', version);
      }

      // First, check if there are ANY instances in this schema
      const countQuery = `SELECT COUNT(*) as count FROM "${dbSchema}"."Instances"`;
      const countResult = await client.query(countQuery);
      console.log(`[DatabaseCleanup] Total instances in schema "${dbSchema}":`, countResult.rows[0].count);

      // Then query for our specific key (and version if provided)
      // Join with InstancesData to get version info
      const query = version
        ? `SELECT i."Id", i."Status", d."Version" FROM "${dbSchema}"."Instances" i
           JOIN "${dbSchema}"."InstancesData" d ON i."Id" = d."InstanceId"
           WHERE i."Key" = $1 AND d."Version" = $2
           ORDER BY i."CreatedAt" DESC LIMIT 1`
        : `SELECT i."Id", i."Status", d."Version" FROM "${dbSchema}"."Instances" i
           JOIN "${dbSchema}"."InstancesData" d ON i."Id" = d."InstanceId"
           WHERE i."Key" = $1
           ORDER BY i."CreatedAt" DESC LIMIT 1`;

      const result = version
        ? await client.query(query, [key, version])
        : await client.query(query, [key]);

      console.log('[DatabaseCleanup] Query result rows:', result.rows.length);
      if (result.rows.length > 0) {
        console.log('[DatabaseCleanup] Found instance:', result.rows[0]);
      } else {
        // Debug: show what keys actually exist
        const keysQuery = `SELECT DISTINCT "Key" FROM "${dbSchema}"."Instances" LIMIT 10`;
        const keysResult = await client.query(keysQuery);
        console.log('[DatabaseCleanup] Sample keys in schema:', keysResult.rows.map(r => r.Key));
      }

      await client.end();

      if (result.rows.length > 0) {
        return {
          id: result.rows[0].Id,
          status: result.rows[0].Status || 'Unknown',
          version: result.rows[0].Version || undefined
        };
      }
      return null;
    } catch (error) {
      console.error('[DatabaseCleanup] Error getting instance info:', error);
      console.error('[DatabaseCleanup] Failed query - Schema:', dbSchema, 'Key:', key);
      return null;
    }
  }
}

/**
 * Get the instance ID for a workflow from the database (legacy)
 * @param version Optional version to query for specific version. If not provided, gets latest by CreatedAt
 */
export async function getInstanceId(
  dbConfig: DatabaseConfig,
  flow: string,
  key: string,
  version?: string
): Promise<string | null> {
  const info = await getInstanceInfo(dbConfig, flow, key, version);
  return info?.id || null;
}

/**
 * Delete a workflow instance from the database
 */
export async function deleteWorkflowInstance(
  dbConfig: DatabaseConfig,
  flow: string,
  instanceId: string
): Promise<boolean> {
  const dbSchema = flow.replace(/-/g, '_');

  if (dbConfig.useDocker) {
    // Use Docker exec
    const cmd = `docker exec ${dbConfig.dockerContainer} psql -U ${dbConfig.user} -d ${dbConfig.database} -c "DELETE FROM \\"${dbSchema}\\".\\"Instances\\" WHERE \\"Id\\" = '${instanceId}'"`;

    try {
      await execAsync(cmd);
      return true;
    } catch (error) {
      console.error('[DatabaseCleanup] Error deleting instance:', error);
      return false;
    }
  } else {
    // Direct connection
    try {
      let pg;
      try {
        pg = await import('pg');
      } catch (importError) {
        console.error('[DatabaseCleanup] Failed to import pg module:', importError);
        console.error('[DatabaseCleanup] Direct database connections require the "pg" package.');
        console.error('[DatabaseCleanup] Please use Docker connection instead (set useDocker: true in database config).');
        return false;
      }

      const { Client } = pg;
      const client = new Client({
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password
      });

      await client.connect();
      const query = `DELETE FROM "${dbSchema}"."Instances" WHERE "Id" = $1`;
      await client.query(query, [instanceId]);
      await client.end();

      return true;
    } catch (error) {
      console.error('[DatabaseCleanup] Error deleting instance:', error);
      return false;
    }
  }
}

/**
 * Test database connection
 */
export async function testDatabaseConnection(dbConfig: DatabaseConfig): Promise<boolean> {
  if (dbConfig.useDocker) {
    // Use Docker exec
    try {
      const cmd = `docker exec ${dbConfig.dockerContainer} psql -U ${dbConfig.user} -d ${dbConfig.database} -c "SELECT 1;"`;
      await execAsync(cmd);
      return true;
    } catch {
      return false;
    }
  } else {
    // Direct connection
    try {
      let pg;
      try {
        pg = await import('pg');
      } catch (importError) {
        console.error('[DatabaseCleanup] Failed to import pg module:', importError);
        console.error('[DatabaseCleanup] Direct database connections require the "pg" package.');
        console.error('[DatabaseCleanup] Please use Docker connection instead (set useDocker: true in database config).');
        return false;
      }

      const { Client } = pg;
      const client = new Client({
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password
      });

      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return true;
    } catch {
      return false;
    }
  }
}
