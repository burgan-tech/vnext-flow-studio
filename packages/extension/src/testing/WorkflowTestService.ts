import { EnvironmentManager } from '../deployment/EnvironmentManager.js';
import type { EnvironmentConfig } from '@amorphie-flow-studio/graph-core';

/**
 * Service for testing workflows against runtime API
 */
export class WorkflowTestService {
  /**
   * Check if test environment is configured and API is reachable
   */
  async checkStatus(): Promise<{
    ready: boolean;
    environment?: EnvironmentConfig;
    error?: string;
  }> {
    try {
      const env = EnvironmentManager.getActiveEnvironment();
      if (!env) {
        return { ready: false, error: 'No environment configured' };
      }

      // Test API connectivity
      const reachable = await this.testConnection(env);
      if (!reachable) {
        return {
          ready: false,
          environment: env,
          error: 'API not reachable'
        };
      }

      return { ready: true, environment: env };
    } catch (error: any) {
      return {
        ready: false,
        error: error.message || 'Failed to check status'
      };
    }
  }

  /**
   * Test API connectivity
   */
  private async testConnection(env: EnvironmentConfig): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), env.timeout || 5000);

      const response = await fetch(`${env.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: this.getAuthHeaders(env)
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('API connection test failed:', error);
      return false;
    }
  }

  /**
   * Start workflow instance
   */
  async startInstance(
    workflow: { key: string; domain: string; version: string },
    inputData: any
  ): Promise<{ instanceId: string; initialState: string }> {
    const env = EnvironmentManager.getActiveEnvironment();
    if (!env) {
      throw new Error('No environment configured');
    }

    // Note: sync=true not supported on start endpoint (causes 500 error)
    const url = `${env.baseUrl}/api/v1/${workflow.domain}/workflows/${workflow.key}/instances/start?version=${workflow.version}`;

    // Generate unique idempotency key
    const idempotencyKey = `${workflow.key}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    // Platform expects input data wrapped in attributes field
    const bodyData = {
      key: idempotencyKey,
      attributes: inputData
    };

    console.log('[WorkflowTestService] startInstance - URL:', url);
    console.log('[WorkflowTestService] startInstance - inputData:', inputData);
    console.log('[WorkflowTestService] startInstance - bodyData:', bodyData);
    console.log('[WorkflowTestService] startInstance - bodyData keys:', Object.keys(bodyData));

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
          ...this.getAuthHeaders(env)
        },
        body: JSON.stringify(bodyData)
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[WorkflowTestService] API Error Response:', error);
        console.error('[WorkflowTestService] Request was:', JSON.stringify(bodyData, null, 2));
        throw new Error(`Failed to start instance: ${response.status} ${error}`);
      }

      const result = await response.json();
      console.log('[WorkflowTestService] startInstance response:', JSON.stringify(result, null, 2));

      return {
        instanceId: result.instanceId || result.id,
        initialState: result.extensions?.currentState || result.state || result.currentState || 'unknown'
      };
    } catch (error: any) {
      console.error('Start instance error:', error);
      throw new Error(`Failed to start workflow: ${error.message}`);
    }
  }

  /**
   * Get instance status and data
   * Uses the functions/state endpoint to get state, transitions, and data href in one call
   */
  async getInstanceStatus(
    instanceId: string,
    workflow: { key: string; domain: string }
  ): Promise<{
    state: string;
    data: any;
    isFinal: boolean;
    error?: string;
    availableTransitions?: string[];
  }> {
    try {
      // Get state information including transitions and data href
      const stateInfo = await this.getStateFunctions(instanceId, workflow);
      console.log('[WorkflowTestService] State info:', JSON.stringify(stateInfo, null, 2));

      // Fetch instance data using the href from state info
      let instanceData: any = {};
      if (stateInfo.dataHref) {
        console.log('[WorkflowTestService] Fetching data from href:', stateInfo.dataHref);
        instanceData = await this.fetchInstanceDataFromHref(stateInfo.dataHref);
        console.log('[WorkflowTestService] Fetched instance data:', JSON.stringify(instanceData, null, 2));
      } else {
        console.warn('[WorkflowTestService] No data href found in state info');
      }

      // Merge activeCorrelations from state info into instance data
      if (stateInfo.activeCorrelations) {
        instanceData.activeCorrelations = stateInfo.activeCorrelations;
        console.log('[WorkflowTestService] Added activeCorrelations to instance data:', stateInfo.activeCorrelations.length);

        // Fetch subflow instance data if subflow is active
        if (stateInfo.activeCorrelations.length > 0 && stateInfo.activeCorrelations[0].href) {
          console.log('[WorkflowTestService] Fetching subflow instance data from:', stateInfo.activeCorrelations[0].href);
          try {
            const subflowData = await this.fetchInstanceDataFromHref(stateInfo.activeCorrelations[0].href);
            // Add subflow data to the correlation object
            stateInfo.activeCorrelations[0].subflowData = subflowData;
            instanceData.activeCorrelations = stateInfo.activeCorrelations;
            console.log('[WorkflowTestService] Added subflow data to correlation');
          } catch (error) {
            console.warn('[WorkflowTestService] Failed to fetch subflow data:', error);
          }
        }
      }

      return {
        state: stateInfo.state,
        data: instanceData,
        isFinal: stateInfo.isFinal,
        availableTransitions: stateInfo.transitions
      };
    } catch (error: any) {
      console.error('Get instance status error:', error);
      throw new Error(`Failed to get instance status: ${error.message}`);
    }
  }

  /**
   * Execute manual transition
   */
  async executeTransition(
    instanceId: string,
    transitionKey: string,
    workflow: { key: string; domain: string },
    data: any
  ): Promise<{ state: string; data: any; transitions: string[]; isFinal: boolean }> {
    const env = EnvironmentManager.getActiveEnvironment();
    if (!env) {
      throw new Error('No environment configured');
    }

    // Execute the transition (sync=true for immediate response)
    const url = `${env.baseUrl}/api/v1/${workflow.domain}/workflows/${workflow.key}/instances/${instanceId}/transitions/${transitionKey}?sync=true`;

    // Platform expects input data wrapped in attributes field (same as startInstance)
    const bodyData = {
      attributes: data
    };

    console.log('[WorkflowTestService] executeTransition - URL:', url);
    console.log('[WorkflowTestService] executeTransition - data:', data);
    console.log('[WorkflowTestService] executeTransition - bodyData:', bodyData);

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(env)
        },
        body: JSON.stringify(bodyData)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to execute transition: ${response.status} ${error}`);
      }

      const result = await response.json();
      console.log('[WorkflowTestService] executeTransition sync response:', JSON.stringify(result, null, 2));

      // Extract data from sync response
      let instanceData = result.data || result;
      let currentState = result.currentState || result.state;
      let transitions = result.transitions || [];

      // Determine if final based on status (C=completed, F=failed)
      const status = instanceData.status || 'A';
      const isFinal = status === 'C' || status === 'F';

      // If no currentState in sync response, or no transitions but still active, get from /functions/state
      if (!currentState || (transitions.length === 0 && !isFinal)) {
        console.log('[WorkflowTestService] Need to call /functions/state:', {
          missingState: !currentState,
          noTransitions: transitions.length === 0
        });

        // Brief delay to allow automatic transitions to complete if no transitions
        if (transitions.length === 0 && !isFinal) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Get state information
        const stateInfo = await this.getStateFunctions(instanceId, workflow);

        // Use state from API if we don't have it yet
        if (!currentState) {
          currentState = stateInfo.state;
        }

        // Use transitions from state info if sync response had none
        if (transitions.length === 0) {
          transitions = stateInfo.transitions;
        }

        // Fetch full instance data from dataHref if available
        if (stateInfo.dataHref) {
          console.log('[WorkflowTestService] Fetching full instance data from:', stateInfo.dataHref);
          const fullData = await this.fetchInstanceDataFromHref(stateInfo.dataHref);
          // Merge full data with existing minimal data
          instanceData = { ...fullData, ...instanceData };
        }

        // Merge activeCorrelations from state info (overrides any from data)
        if (stateInfo.activeCorrelations) {
          instanceData.activeCorrelations = stateInfo.activeCorrelations;

          // Fetch subflow instance data if subflow is active
          if (stateInfo.activeCorrelations.length > 0 && stateInfo.activeCorrelations[0].href) {
            console.log('[WorkflowTestService] Fetching subflow instance data from:', stateInfo.activeCorrelations[0].href);
            try {
              const subflowData = await this.fetchInstanceDataFromHref(stateInfo.activeCorrelations[0].href);
              // Add subflow data to the correlation object
              stateInfo.activeCorrelations[0].subflowData = subflowData;
              instanceData.activeCorrelations = stateInfo.activeCorrelations;
            } catch (error) {
              console.warn('[WorkflowTestService] Failed to fetch subflow data:', error);
            }
          }
        }

        console.log('[WorkflowTestService] After /functions/state call:', {
          state: currentState,
          transitions,
          hasActiveCorrelations: !!instanceData.activeCorrelations,
          hasSubflowData: !!instanceData.activeCorrelations?.[0]?.subflowData,
          dataKeys: Object.keys(instanceData)
        });
      }

      console.log('[WorkflowTestService] executeTransition final result:', {
        state: currentState,
        dataKeys: Object.keys(instanceData),
        hasActiveCorrelations: !!instanceData.activeCorrelations,
        activeCorrelationsCount: instanceData.activeCorrelations?.length || 0,
        transitions,
        isFinal
      });

      return {
        state: currentState,
        data: instanceData,
        transitions,
        isFinal
      };
    } catch (error: any) {
      console.error('Execute transition error:', error);
      throw new Error(`Failed to execute transition: ${error.message}`);
    }
  }

  /**
   * List all instances for a workflow
   */
  async listInstances(workflow: { key: string; domain: string }): Promise<
    Array<{
      instanceId: string;
      state: string;
      created: string;
    }>
  > {
    const env = EnvironmentManager.getActiveEnvironment();
    if (!env) {
      throw new Error('No environment configured');
    }

    const url = `${env.baseUrl}/api/v1/${workflow.domain}/workflows/${workflow.key}/instances`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(env)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to list instances: ${response.status} ${error}`);
      }

      const result = await response.json();
      const instances = Array.isArray(result) ? result : result.instances || [];

      return instances.map((inst: any) => ({
        instanceId: inst.instanceId || inst.id,
        state: inst.state || inst.currentState,
        created: inst.created || inst.createdAt || new Date().toISOString()
      }));
    } catch (error: any) {
      console.error('List instances error:', error);
      throw new Error(`Failed to list instances: ${error.message}`);
    }
  }

  /**
   * Get state information including available transitions and data href
   * Uses the functions/state endpoint which returns comprehensive state info
   */
  async getStateFunctions(
    instanceId: string,
    workflow: { key: string; domain: string }
  ): Promise<{
    state: string;
    status: string;
    transitions: string[];
    dataHref?: string;
    viewHref?: string;
    isFinal: boolean;
    activeCorrelations?: any[];
  }> {
    const env = EnvironmentManager.getActiveEnvironment();
    if (!env) {
      throw new Error('No environment configured');
    }

    // Use the functions/state endpoint - note the /api/v1/ prefix
    const url = `${env.baseUrl}/api/v1/${workflow.domain}/workflows/${workflow.key}/instances/${instanceId}/functions/state`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(env)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get state functions: ${response.status} ${error}`);
      }

      const result = await response.json();
      console.log('[WorkflowTestService] State functions API response:', JSON.stringify(result, null, 2));

      // Parse transitions - they have 'name' field
      const transitions = Array.isArray(result.transitions)
        ? result.transitions.map((t: any) => t.name || t.key || String(t))
        : [];

      return {
        state: result.state || 'unknown',
        status: result.status || 'A',
        transitions,
        dataHref: result.data?.href,
        viewHref: result.view?.href,
        isFinal: result.status === 'C' || result.status === 'F', // C=completed, F=failed
        activeCorrelations: result.activeCorrelations // Include activeCorrelations from API
      };
    } catch (error: any) {
      console.error('Get state functions error:', error);
      throw error;
    }
  }

  /**
   * Get available transitions for an instance (backward compatibility)
   * Delegates to getStateFunctions
   */
  async getAvailableTransitions(
    instanceId: string,
    workflow: { key: string; domain: string }
  ): Promise<string[]> {
    try {
      const state = await this.getStateFunctions(instanceId, workflow);
      return state.transitions;
    } catch (error) {
      console.warn('[WorkflowTestService] Failed to get transitions:', error);
      return [];
    }
  }

  /**
   * Fetch instance data from href
   */
  private async fetchInstanceDataFromHref(href: string): Promise<any> {
    const env = EnvironmentManager.getActiveEnvironment();
    if (!env) {
      throw new Error('No environment configured');
    }

    // The href is relative (starts with /), prepend the base URL and /api/v1/
    // Remove leading slash from href to avoid double slash
    const cleanHref = href.startsWith('/') ? href.substring(1) : href;
    const url = `${env.baseUrl}/api/v1/${cleanHref}`;

    console.log('[WorkflowTestService] Fetching instance data from href:', url);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(env)
      });

      if (!response.ok) {
        // If data endpoint doesn't exist, return empty object
        if (response.status === 404) {
          console.warn('[WorkflowTestService] Instance data endpoint not found:', url);
          return {};
        }
        const error = await response.text();
        throw new Error(`Failed to get instance data: ${response.status} ${error}`);
      }

      const result = await response.json();
      console.log('[WorkflowTestService] Instance data response:', JSON.stringify(result, null, 2));
      console.log('[WorkflowTestService] Instance data keys:', Object.keys(result));

      // Extract the actual data field from the response
      return result.data || result;
    } catch (error: any) {
      console.error('Fetch instance data error:', error);
      return {}; // Return empty object on error
    }
  }

  /**
   * Get auth headers based on environment config
   */
  private getAuthHeaders(env: EnvironmentConfig): Record<string, string> {
    const headers: Record<string, string> = {};

    if (env.auth) {
      switch (env.auth.type) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${env.auth.token}`;
          break;
        case 'basic':
          if (env.auth.username && env.auth.password) {
            const credentials = Buffer.from(
              `${env.auth.username}:${env.auth.password}`
            ).toString('base64');
            headers['Authorization'] = `Basic ${credentials}`;
          }
          break;
      }
    }

    // Add custom headers if configured
    if (env.headers) {
      Object.assign(headers, env.headers);
    }

    return headers;
  }
}
