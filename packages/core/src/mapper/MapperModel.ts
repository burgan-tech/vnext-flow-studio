/**
 * MapperModel - Main model class for data mapper
 * Follows the same pattern as WorkflowModel
 */

import { EventEmitter } from 'events';
import type {
  MapSpec,
  MapSpecNode,
  Edge,
  TestCase,
  JSONSchema
} from './types';

/**
 * Mapper model state
 */
export interface MapperModelState {
  /** The MapSpec (semantic model) */
  mapSpec: MapSpec;

  /** Source JSON Schema */
  sourceSchema?: JSONSchema;

  /** Target JSON Schema */
  targetSchema?: JSONSchema;

  /** Metadata */
  metadata: {
    /** Path to mapper file */
    mapperPath: string;

    /** Base path for resolving schemas */
    basePath: string;

    /** Last loaded timestamp */
    lastLoaded: Date;

    /** Has unsaved changes */
    isDirty: boolean;
  };
}

/**
 * Model change event
 */
export interface MapperChangeEvent {
  type: 'node-added' | 'node-removed' | 'node-updated' | 'edge-added' | 'edge-removed' | 'schema-updated' | 'metadata-updated';
  nodeId?: string;
  edgeId?: string;
  data?: any;
}

/**
 * Main mapper model that provides unified access to MapSpec
 */
export class MapperModel extends EventEmitter {
  private state: MapperModelState;

  constructor(mapperPath: string, basePath?: string) {
    super();

    const actualBasePath = basePath || '';

    this.state = {
      mapSpec: this.createEmptyMapSpec(),
      sourceSchema: undefined,
      targetSchema: undefined,
      metadata: {
        mapperPath,
        basePath: actualBasePath,
        lastLoaded: new Date(),
        isDirty: false
      }
    };
  }

  /**
   * Create an empty MapSpec
   */
  private createEmptyMapSpec(): MapSpec {
    return {
      version: '1.0',
      metadata: {
        name: 'New Mapper',
        description: '',
        version: '1.0.0',
        source: 'Source Schema',
        target: 'Target Schema',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      schemas: {
        source: '',
        target: ''
      },
      nodes: [],
      edges: [],
      tests: []
    };
  }

  /**
   * Load mapper from file content
   */
  async load(content: string, options: { loadSchemas?: boolean } = {}): Promise<void> {
    try {
      const mapSpec = JSON.parse(content) as MapSpec;

      // Validate basic structure
      if (!mapSpec.version || !mapSpec.metadata || !mapSpec.schemas) {
        throw new Error('Invalid MapSpec format');
      }

      this.state.mapSpec = mapSpec;
      this.state.metadata.lastLoaded = new Date();
      this.state.metadata.isDirty = false;

      // Optionally load schemas
      if (options.loadSchemas) {
        // TODO: Load source and target schemas from file system
        // This would be similar to ComponentResolver in WorkflowModel
      }

      this.emit('loaded', { mapSpec });
    } catch (error) {
      this.emit('error', { error, message: 'Failed to load mapper' });
      throw error;
    }
  }

  /**
   * Get the current MapSpec
   */
  getMapSpec(): MapSpec {
    return this.state.mapSpec;
  }

  /**
   * Get the entire model state
   */
  getModelState(): MapperModelState {
    return this.state;
  }

  /**
   * Get source schema
   */
  getSourceSchema(): JSONSchema | undefined {
    return this.state.sourceSchema;
  }

  /**
   * Get target schema
   */
  getTargetSchema(): JSONSchema | undefined {
    return this.state.targetSchema;
  }

  /**
   * Set source schema
   */
  setSourceSchema(schema: JSONSchema): void {
    this.state.sourceSchema = schema;
    this.state.metadata.isDirty = true;
    this.emit('change', { type: 'schema-updated', data: { side: 'source', schema } });
  }

  /**
   * Set target schema
   */
  setTargetSchema(schema: JSONSchema): void {
    this.state.targetSchema = schema;
    this.state.metadata.isDirty = true;
    this.emit('change', { type: 'schema-updated', data: { side: 'target', schema } });
  }

  /**
   * Add a functoid node
   */
  addNode(node: MapSpecNode): void {
    this.state.mapSpec.nodes.push(node);
    this.state.metadata.isDirty = true;
    this.emit('change', { type: 'node-added', nodeId: node.id, data: node });
  }

  /**
   * Remove a node
   */
  removeNode(nodeId: string): void {
    const index = this.state.mapSpec.nodes.findIndex(n => n.id === nodeId);
    if (index !== -1) {
      this.state.mapSpec.nodes.splice(index, 1);

      // Remove edges connected to this node
      this.state.mapSpec.edges = this.state.mapSpec.edges.filter(
        edge => edge.source !== nodeId && edge.target !== nodeId
      );

      this.state.metadata.isDirty = true;
      this.emit('change', { type: 'node-removed', nodeId });
    }
  }

  /**
   * Update a node
   */
  updateNode(nodeId: string, updates: Partial<MapSpecNode>): void {
    const node = this.state.mapSpec.nodes.find(n => n.id === nodeId);
    if (node) {
      Object.assign(node, updates);
      this.state.metadata.isDirty = true;
      this.emit('change', { type: 'node-updated', nodeId, data: updates });
    }
  }

  /**
   * Add an edge
   */
  addEdge(edge: Edge): void {
    this.state.mapSpec.edges.push(edge);
    this.state.metadata.isDirty = true;
    this.emit('change', { type: 'edge-added', edgeId: edge.id, data: edge });
  }

  /**
   * Remove an edge
   */
  removeEdge(edgeId: string): void {
    const index = this.state.mapSpec.edges.findIndex(e => e.id === edgeId);
    if (index !== -1) {
      this.state.mapSpec.edges.splice(index, 1);
      this.state.metadata.isDirty = true;
      this.emit('change', { type: 'edge-removed', edgeId });
    }
  }

  /**
   * Add a test case
   */
  addTest(test: TestCase): void {
    if (!this.state.mapSpec.tests) {
      this.state.mapSpec.tests = [];
    }
    this.state.mapSpec.tests.push(test);
    this.state.metadata.isDirty = true;
    this.emit('change', { type: 'metadata-updated', data: { tests: this.state.mapSpec.tests } });
  }

  /**
   * Serialize to JSON string for saving
   */
  serialize(): string {
    // Update timestamp
    this.state.mapSpec.metadata.updatedAt = new Date().toISOString();

    return JSON.stringify(this.state.mapSpec, null, 2);
  }

  /**
   * Check if model has unsaved changes
   */
  isDirty(): boolean {
    return this.state.metadata.isDirty;
  }

  /**
   * Mark as clean (after save)
   */
  markClean(): void {
    this.state.metadata.isDirty = false;
  }

  /**
   * Get mapper file path
   */
  getMapperPath(): string {
    return this.state.metadata.mapperPath;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.removeAllListeners();
  }
}
