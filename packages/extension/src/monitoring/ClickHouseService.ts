import type { MonitoringConfig } from '@amorphie-flow-studio/graph-core';

/**
 * ClickHouse query service for workflow analytics.
 * Uses ClickHouse HTTP interface (port 8123) — no native driver needed.
 *
 * Tables used (from workflow_analytics DB):
 *  - instances: Id, Key, Flow, CurrentState, Status, CreatedAt, DurationSeconds
 *  - instance_transitions: InstanceId, FromState, ToState, StartedAt, FinishedAt, DurationSeconds
 *  - instance_tasks: TransitionId, TaskId, Status, DurationSeconds
 */
export class ClickHouseService {
  private baseUrl: string;
  private database: string;
  private user: string;
  private password: string;

  constructor(config: MonitoringConfig) {
    this.baseUrl = (config.clickhouseUrl || 'http://localhost:8123').replace(/\/$/, '');
    this.database = config.clickhouseDatabase || 'workflow_analytics';
    this.user = config.clickhouseUser || 'default';
    this.password = config.clickhousePassword || '';
  }

  /**
   * Execute a ClickHouse SQL query and return parsed JSON rows
   */
  private async query<T = any>(sql: string): Promise<T[]> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('database', this.database);
    url.searchParams.set('query', sql + ' FORMAT JSON');

    if (this.user) {
      url.searchParams.set('user', this.user);
    }
    if (this.password) {
      url.searchParams.set('password', this.password);
    }

    console.log('[ClickHouseService] Executing query:', sql.substring(0, 200));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ClickHouse query failed (${response.status}): ${errorText.substring(0, 200)}`);
    }

    const result = await response.json();
    return result.data || [];
  }

  /**
   * Test connection to ClickHouse
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('[ClickHouseService] Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get all instances for a workflow (recent first, limited)
   */
  async getInstances(workflowKey: string, limit: number = 50): Promise<Array<{
    instanceId: string;
    state: string;
    status: string;
    created: string;
    durationSeconds: number;
  }>> {
    const sql = `
      SELECT
        Id as instanceId,
        CurrentState as state,
        Status as status,
        toString(CreatedAt) as created,
        DurationSeconds as durationSeconds
      FROM instances
      WHERE Flow = '${this.escapeStr(workflowKey)}'
      ORDER BY CreatedAt DESC
      LIMIT ${limit}
    `;

    return this.query(sql);
  }

  /**
   * Get transition history for an instance — the KEY feature!
   * Returns ordered list of state transitions: FromState → ToState
   */
  async getTransitionHistory(instanceId: string): Promise<Array<{
    fromState: string;
    toState: string;
    startedAt: string;
    finishedAt: string;
    durationSeconds: number;
    transitionId: string;
  }>> {
    const sql = `
      SELECT
        FromState as fromState,
        ToState as toState,
        toString(StartedAt) as startedAt,
        toString(FinishedAt) as finishedAt,
        DurationSeconds as durationSeconds,
        TransitionId as transitionId
      FROM instance_transitions
      WHERE InstanceId = '${this.escapeStr(instanceId)}'
      ORDER BY StartedAt ASC
    `;

    return this.query(sql);
  }

  /**
   * Get visited states for an instance (unique, ordered by first visit)
   * This is what we use for canvas highlighting
   */
  async getVisitedStates(instanceId: string): Promise<string[]> {
    const transitions = await this.getTransitionHistory(instanceId);

    if (transitions.length === 0) {
      return [];
    }

    // Build ordered unique list of states
    const seen = new Set<string>();
    const ordered: string[] = [];

    for (const t of transitions) {
      if (t.fromState && !seen.has(t.fromState)) {
        seen.add(t.fromState);
        ordered.push(t.fromState);
      }
      if (t.toState && !seen.has(t.toState)) {
        seen.add(t.toState);
        ordered.push(t.toState);
      }
    }

    return ordered;
  }

  /**
   * Get task execution details for a transition
   */
  async getTransitionTasks(transitionId: string): Promise<Array<{
    taskId: string;
    status: string;
    startedAt: string;
    finishedAt: string;
    durationSeconds: number;
  }>> {
    const sql = `
      SELECT
        TaskId as taskId,
        Status as status,
        toString(StartedAt) as startedAt,
        toString(FinishedAt) as finishedAt,
        DurationSeconds as durationSeconds
      FROM instance_tasks
      WHERE TransitionId = '${this.escapeStr(transitionId)}'
      ORDER BY StartedAt ASC
    `;

    return this.query(sql);
  }

  /**
   * Get instance summary stats for a workflow
   */
  async getWorkflowStats(workflowKey: string): Promise<{
    total: number;
    active: number;
    completed: number;
    failed: number;
    avgDuration: number;
  }> {
    const sql = `
      SELECT
        count() as total,
        countIf(Status = 'A') as active,
        countIf(Status = 'C') as completed,
        countIf(Status = 'F') as failed,
        avg(DurationSeconds) as avgDuration
      FROM instances
      WHERE Flow = '${this.escapeStr(workflowKey)}'
    `;

    const rows = await this.query<any>(sql);
    if (rows.length === 0) {
      return { total: 0, active: 0, completed: 0, failed: 0, avgDuration: 0 };
    }

    return {
      total: Number(rows[0].total) || 0,
      active: Number(rows[0].active) || 0,
      completed: Number(rows[0].completed) || 0,
      failed: Number(rows[0].failed) || 0,
      avgDuration: Number(rows[0].avgDuration) || 0
    };
  }

  /**
   * Escape string for ClickHouse SQL (prevent SQL injection)
   */
  private escapeStr(str: string): string {
    // Order matters: escape backslashes first, then single quotes
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
}
