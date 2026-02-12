/**
 * Runtime adapter for Amorphie workflow runtime
 * Fetches component definitions from runtime API
 */

import type {
  RuntimeAdapter,
  FetchGraphOptions,
  FetchOptions,
  WorkflowInstanceResponse
} from './RuntimeAdapter.js';
import type { Graph, ComponentType, GraphNode } from '../types/index.js';
import type { EnvironmentConfig } from '../types/config.js';
import { createGraph, addNode, addEdge } from '../graph/Graph.js';
import { extractComponentReferences, computeHash, extractApiSignature, extractConfig, extractLabel } from '../graph/utils.js';
import { COMPONENT_WORKFLOWS } from '../types/index.js';

/**
 * Amorphie runtime adapter implementation
 */
export class AmorphieRuntimeAdapter implements RuntimeAdapter {
  /**
   * Fetch all components from runtime and build a graph
   */
  async fetchGraph(
    envConfig: EnvironmentConfig,
    domain: string,
    options?: FetchGraphOptions
  ): Promise<Graph> {
    const graph = createGraph();
    const computeHashes = options?.computeHashes ?? false;
    const includeTypes = options?.includeTypes || ['workflow', 'task', 'schema', 'view', 'function', 'extension'];

    // Fetch each component type
    for (const type of includeTypes) {
      const components = await this.fetchComponentsByType(type, envConfig, domain, {
        pageSize: options?.limit || 100
      });

      // Add components to graph
      for (const component of components) {
        const node = await this.convertToNode(component, type, computeHashes, envConfig, domain);
        if (node) {
          addNode(graph, node);
        }
      }
    }

    // Extract dependencies and add edges
    for (const node of graph.nodes.values()) {
      if (node.definition) {
        const refs = extractComponentReferences(node.definition);
        for (const { ref, type } of refs) {
          const targetId = `${ref.domain}/${ref.flow}/${ref.key}@${ref.version}`;
          // Only add edge if target node exists in the graph
          if (graph.nodes.has(targetId)) {
            addEdge(graph, {
              id: `${node.id}->${targetId}`,
              from: node.id,
              to: targetId,
              type,
              versionRange: ref.version
            });
          }
        }
      }
    }

    return graph;
  }

  /**
   * Fetch components of a specific type
   */
  async fetchComponentsByType(
    type: ComponentType,
    envConfig: EnvironmentConfig,
    domain: string,
    options?: FetchOptions
  ): Promise<any[]> {
    const workflowName = COMPONENT_WORKFLOWS[type];
    if (!workflowName) {
      throw new Error(`Unknown component type: ${type}`);
    }

    const components: any[] = [];
    let page = options?.page || 1;
    const pageSize = options?.pageSize || 100;

    // Fetch all pages
    while (true) {
      const url = this.buildUrl(envConfig, domain, workflowName, page, pageSize, options?.filter);
      const response = await this.fetchWithAuth(url, envConfig);

      if (!response.ok) {
        throw new Error(`Failed to fetch ${type}: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        break;
      }

      components.push(...data.data);

      // Check if there are more pages
      if (data.pagination && data.pagination.next) {
        page++;
      } else {
        break;
      }
    }

    return components;
  }

  /**
   * Test connection to runtime environment
   */
  async testConnection(envConfig: EnvironmentConfig, domain: string = 'core'): Promise<boolean> {
    try {
      // Try fetching a small page of sys-flows
      const url = this.buildUrl(envConfig, domain, 'sys-flows', 1, 1);
      const response = await this.fetchWithAuth(url, envConfig);

      // Accept any response from the server (even 404/500) as "connected"
      // We just want to verify the API is reachable, not that it has data
      return response.status >= 200 && response.status < 600;
    } catch {
      // Network error - API is not reachable
      return false;
    }
  }

  /**
   * Activate a workflow instance
   * @param type Component type
   * @param instanceId Instance ID from create/update
   * @param version Version to activate
   * @param domain Domain of the component
   * @param flow Flow of the component (e.g., sys-flows, sys-tasks, etc.)
   * @param envConfig Environment configuration
   */
  async activateComponent(
    type: ComponentType,
    instanceId: string,
    version: string,
    domain: string,
    flow: string,
    envConfig: EnvironmentConfig
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Use the flow from the component definition
      const url = `${envConfig.baseUrl}/api/v1.0/${domain}/workflows/${flow}/instances/${instanceId}/transitions/activate?version=${version}&sync=true`;

      const response = await this.fetchWithAuth(url, envConfig, {
        method: 'PATCH'
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Failed to activate ${type}: ${response.status} ${response.statusText} - ${errorText}`
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Exception activating ${type}: ${error}`
      };
    }
  }

  /**
   * Reinitialize the runtime system
   * @param envConfig Environment configuration
   */
  async reinitializeSystem(envConfig: EnvironmentConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const url = `${envConfig.baseUrl}/api/v1.0/admin/re-initialize`;

      const controller = new AbortController();
      const timeout = 10000; // 10 second timeout for reinit
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const headers: Record<string, string> = {
          'Accept': 'application/json',
          ...envConfig.headers
        };

        if (envConfig.auth) {
          switch (envConfig.auth.type) {
            case 'bearer':
              if (envConfig.auth.token) {
                headers['Authorization'] = `Bearer ${envConfig.auth.token}`;
              }
              break;
            case 'basic':
              if (envConfig.auth.username && envConfig.auth.password) {
                const credentials = Buffer.from(`${envConfig.auth.username}:${envConfig.auth.password}`).toString('base64');
                headers['Authorization'] = `Basic ${credentials}`;
              }
              break;
          }
        }

        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          return {
            success: false,
            error: `Failed to reinitialize: ${response.status} ${response.statusText}`
          };
        }

        return { success: true };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Reinitialize request timed out'
        };
      }
      return {
        success: false,
        error: `Exception reinitializing: ${error}`
      };
    }
  }

  /**
   * Create a new component in runtime
   */
  async createComponent(
    type: ComponentType,
    definition: any,
    envConfig: EnvironmentConfig
  ): Promise<{ success: boolean; instanceId?: string; error?: string }> {
    try {
      // The key should always be at the root level of the definition
      if (!definition.key) {
        return {
          success: false,
          error: `No key found in definition. Definition structure: ${JSON.stringify(Object.keys(definition))}`
        };
      }

      // Extract domain, flow, and flowVersion from the definition
      const domain = definition.domain || 'core';
      const flow = definition.flow || 'sys-flows';
      // Use flowVersion (the version of the flow/class to create instance in)
      // definition.version is the INSTANCE version, not the flow version
      const flowVersion = definition.flowVersion || '1.0.0';

      // Use the flow from the definition (e.g., sys-flows, sys-tasks, sys-schemas, etc.)
      const url = `${envConfig.baseUrl}/api/v1.0/${domain}/workflows/${flow}/instances/start?version=${flowVersion}&sync=true`;

      // Send the full document directly (no wrapper)
      console.log('[AmorphieRuntimeAdapter] Creating component:', {
        type,
        key: definition.key,
        url,
        payload: JSON.stringify(definition, null, 2)
      });

      const response = await this.fetchWithAuth(url, envConfig, {
        method: 'POST',
        body: JSON.stringify(definition)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Failed to create ${type}: ${response.status} ${response.statusText} - ${errorText}`
        };
      }

      const result = await response.json();
      return {
        success: true,
        instanceId: result.instanceId || result.id || result.data?.id
      };
    } catch (error) {
      return {
        success: false,
        error: `Exception creating ${type}: ${error}`
      };
    }
  }

  /**
   * Update an existing component in runtime
   */
  async updateComponent(
    type: ComponentType,
    runtimeId: string,
    definition: any,
    envConfig: EnvironmentConfig,
    _etag?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Extract domain, flow, and flowVersion from the definition
      const domain = definition.domain || 'core';
      const flow = definition.flow || 'sys-flows';
      // Use flowVersion (the version of the flow/class to create instance in)
      // definition.version is the INSTANCE version, not the flow version
      const flowVersion = definition.flowVersion || '1.0.0';

      // Use the flow from the definition (e.g., sys-flows, sys-tasks, sys-schemas, etc.)
      const url = `${envConfig.baseUrl}/api/v1.0/${domain}/workflows/${flow}/instances/start?version=${flowVersion}&sync=true`;

      // The key should always be at the root level of the definition
      if (!definition.key) {
        return {
          success: false,
          error: `No key found in definition. Definition structure: ${JSON.stringify(Object.keys(definition))}`
        };
      }

      // Send the full document directly (no wrapper)
      console.log('[AmorphieRuntimeAdapter] Updating component:', {
        type,
        key: definition.key,
        runtimeId,
        url,
        payload: JSON.stringify(definition, null, 2)
      });

      const response = await this.fetchWithAuth(url, envConfig, {
        method: 'POST',
        body: JSON.stringify(definition)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Failed to update ${type}: ${response.status} ${response.statusText} - ${errorText}`
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Exception updating ${type}: ${error}`
      };
    }
  }

  /**
   * Build URL for fetching instances
   */
  private buildUrl(
    envConfig: EnvironmentConfig,
    domain: string,
    workflowName: string,
    page: number,
    pageSize: number,
    filter?: string
  ): string {
    const { baseUrl } = envConfig;
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString()
    });

    if (filter) {
      params.append('filter', filter);
    }

    return `${baseUrl}/api/v1.0/${domain}/workflows/${workflowName}/instances?${params}`;
  }

  /**
   * Fetch with authentication
   */
  private async fetchWithAuth(
    url: string,
    envConfig: EnvironmentConfig,
    options?: {
      method?: string;
      body?: string;
      headers?: Record<string, string>;
    }
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...envConfig.headers,
      ...options?.headers
    };

    // Add Content-Type for POST/PUT requests
    if (options?.method && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
      headers['Content-Type'] = 'application/json';
    }

    if (envConfig.auth) {
      switch (envConfig.auth.type) {
        case 'bearer':
          if (envConfig.auth.token) {
            headers['Authorization'] = `Bearer ${envConfig.auth.token}`;
          }
          break;
        case 'basic':
          if (envConfig.auth.username && envConfig.auth.password) {
            const credentials = Buffer.from(`${envConfig.auth.username}:${envConfig.auth.password}`).toString('base64');
            headers['Authorization'] = `Basic ${credentials}`;
          }
          break;
      }
    }

    const controller = new AbortController();
    const timeout = envConfig.timeout || 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: options?.method || 'GET',
        headers,
        body: options?.body,
        signal: controller.signal
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Convert runtime instance to graph node
   */
  private async convertToNode(
    instance: WorkflowInstanceResponse,
    type: ComponentType,
    computeHashes: boolean,
    envConfig: EnvironmentConfig,
    domain: string
  ): Promise<GraphNode | null> {
    // Check if attributes is empty or missing
    const hasEmptyAttributes = !instance.attributes || Object.keys(instance.attributes).length === 0;

    let definition = instance.attributes;
    let fullInstance = instance;

    // If attributes is empty, we need to check if extensions.data.href exists
    // But list endpoint might not include extensions, so fetch full instance first
    if (hasEmptyAttributes) {
      // Fetch full instance to get extensions
      if (!instance.extensions || Object.keys(instance.extensions).length === 0) {
        try {
          const instanceUrl = this.buildUrl(envConfig, domain, COMPONENT_WORKFLOWS[type], 1, 1);
          const baseUrl = instanceUrl.substring(0, instanceUrl.indexOf('/instances?'));
          const fullInstanceUrl = `${baseUrl}/instances/${instance.id}`;
          const response = await this.fetchWithAuth(fullInstanceUrl, envConfig);
          if (response.ok) {
            fullInstance = await response.json();
          }
        } catch (error) {
          console.warn(`Failed to fetch full instance for ${instance.key}:`, error);
        }
      }

      // Now try to fetch from data extension endpoint if available
      if (fullInstance.extensions?.data?.href) {
        try {
          const dataUrl = `${envConfig.baseUrl}/api/v1.0/${fullInstance.extensions.data.href}`;
          const response = await this.fetchWithAuth(dataUrl, envConfig);
          if (response.ok) {
            const data = await response.json();
            // The response structure is {data: {...}, etag, extensions}
            definition = data.data && Object.keys(data.data).length > 0 ? data.data : data.attributes || data;
          }
        } catch (error) {
          console.warn(`Failed to fetch data from extension for ${instance.key}:`, error);
        }
      }
    }

    // Still no definition? Skip this component
    if (!definition || Object.keys(definition).length === 0) {
      return null;
    }

    // Extract domain from attributes or fall back to instance domain
    const componentDomain = (definition.domain || instance.domain).toLowerCase();
    const flow = (definition.flow || instance.flow).toLowerCase();
    const key = (definition.key || instance.key).toLowerCase();

    // Get version from attributes or instance
    const version = definition.version || instance.flowVersion || '1.0.0';

    const node: GraphNode = {
      id: `${componentDomain}/${flow}/${key}@${version}`,
      type,
      ref: {
        domain: componentDomain,
        flow,
        key,
        version
      },
      label: extractLabel(definition),
      definition,
      source: 'runtime',
      tags: instance.tags || [],
      metadata: {
        runtimeId: instance.id,
        etag: instance.etag,
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt,
        currentState: instance.extensions?.currentState,
        status: instance.extensions?.status,
        dataFetchedFromExtension: hasEmptyAttributes
      }
    };

    // Compute hashes if requested
    if (computeHashes) {
      const apiSignature = extractApiSignature(definition, type);
      if (apiSignature) {
        node.apiHash = computeHash(apiSignature);
      }

      const config = extractConfig(definition, type);
      if (config) {
        node.configHash = computeHash(config);
      }
    }

    return node;
  }
}
