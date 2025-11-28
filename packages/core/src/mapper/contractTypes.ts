/**
 * Contract Types for Workflow Scripting Mappers
 * Extends the base MapSpec to support C# contract generation
 * Uses key-based identity system like workflow components
 */

import type { MapSpec, SchemaParts, MapSpecNode, Edge } from './types';

/**
 * Contract type - maps to C# interface in BBT.Workflow.Scripting namespace
 */
export type ContractType =
  | 'IMapping'              // Task input/output data binding
  | 'IConditionMapping'     // Boolean conditional logic for auto-transitions
  | 'ITransitionMapping'    // Transition-specific data transformations
  | 'ISubFlowMapping'       // Subflow input/output handlers
  | 'ISubProcessMapping'    // Subprocess input preparation
  | 'ITimerMapping';        // Timer schedule calculation

/**
 * File extension mapping by contract type
 */
export const CONTRACT_FILE_EXTENSIONS: Record<ContractType, string> = {
  IMapping: '.mapping.json',
  IConditionMapping: '.condition.json',
  ITransitionMapping: '.transition.json',
  ISubFlowMapping: '.subflow.json',
  ISubProcessMapping: '.subprocess.json',
  ITimerMapping: '.timer.json'
};

/**
 * Handler definition for multi-method contracts
 * Each handler represents one method in the generated C# class
 */
export interface HandlerMapSpec {
  methodName: string;           // e.g., 'InputHandler', 'OutputHandler', 'Handler'
  schemaParts: SchemaParts;     // Handler-specific source/target schemas
  nodes: MapSpecNode[];         // Handler-specific functoid nodes
  edges: Edge[];                // Handler-specific connections
}

/**
 * Contract-specific metadata
 */
export interface ContractMetadata {
  name: string;                 // Display name (e.g., "HTTP Task Mapping")
  description?: string;         // Optional description
  version?: string;             // Mapper version (semantic versioning)
  author?: string;              // Author name
  tags?: string[];              // Categorization tags
  createdAt?: string;           // ISO 8601 timestamp
  updatedAt?: string;           // ISO 8601 timestamp

  // Key-based identity (like workflow components)
  key: string;                  // Unique key within domain/flow (e.g., "http-task-mapping")
  domain: string;               // Domain/namespace (e.g., "ecommerce", "core")
  flow: string;                 // Flow/category (e.g., "mappers", "sys-mappers")
}

/**
 * Contract MapSpec - extends base MapSpec with contract-specific fields
 * Supports both legacy data mappers (no contractType) and new scripting mappers
 */
export interface ContractMapSpec extends Omit<MapSpec, 'metadata'> {
  metadata: ContractMetadata;

  /**
   * Contract type - if undefined, this is a legacy data mapper
   */
  contractType?: ContractType;

  /**
   * Multi-method contracts: Record<handlerName, HandlerMapSpec>
   * - IMapping: { InputHandler, OutputHandler }
   * - ISubFlowMapping: { InputHandler, OutputHandler }
   * - ISubProcessMapping: { InputHandler }
   *
   * Single-method contracts use base MapSpec fields (nodes, edges, schemaParts)
   */
  handlers?: Record<string, HandlerMapSpec>;

  /**
   * Return type for single-method contracts
   * - IConditionMapping: 'boolean'
   * - ITimerMapping: 'TimerSchedule'
   * - ITransitionMapping: 'dynamic'
   */
  returnType?: string;

  /**
   * Namespace for generated C# class
   * Default: BBT.Workflow.Generated
   */
  namespace?: string;

  /**
   * Generated class name
   * Default: PascalCase(metadata.name)
   */
  className?: string;
}

/**
 * Contract method signature definition
 * Used for validation and code generation
 */
export interface ContractMethodSignature {
  methodName: string;           // C# method name
  parameters: MethodParameter[]; // Method parameters
  returnType: string;           // C# return type
  isAsync: boolean;             // Whether method is async
}

/**
 * Method parameter definition
 */
export interface MethodParameter {
  name: string;                 // Parameter name (e.g., 'context', 'task')
  type: string;                 // C# type (e.g., 'ScriptContext', 'WorkflowTask')
  isOptional?: boolean;         // Whether parameter is optional
}

/**
 * Contract definition - complete signature for a C# interface
 */
export interface ContractDefinition {
  contractType: ContractType;
  namespace: string;            // C# namespace (e.g., 'BBT.Workflow.Scripting')
  interfaceName: string;        // C# interface name (e.g., 'IMapping')
  methods: ContractMethodSignature[];
  description?: string;
  usings?: string[];            // Required using statements
}

/**
 * Contract registry - signatures for all supported contracts
 */
export const CONTRACT_DEFINITIONS: Record<ContractType, ContractDefinition> = {
  IMapping: {
    contractType: 'IMapping',
    namespace: 'BBT.Workflow.Scripting',
    interfaceName: 'IMapping',
    description: 'Task input and output data binding operations',
    usings: [
      'System.Threading.Tasks',
      'BBT.Workflow.Scripting',
      'BBT.Workflow.Definitions'
    ],
    methods: [
      {
        methodName: 'InputHandler',
        parameters: [
          { name: 'task', type: 'WorkflowTask' },
          { name: 'context', type: 'ScriptContext' }
        ],
        returnType: 'Task<ScriptResponse>',
        isAsync: true
      },
      {
        methodName: 'OutputHandler',
        parameters: [
          { name: 'context', type: 'ScriptContext' }
        ],
        returnType: 'Task<ScriptResponse>',
        isAsync: true
      }
    ]
  },

  IConditionMapping: {
    contractType: 'IConditionMapping',
    namespace: 'BBT.Workflow.Scripting',
    interfaceName: 'IConditionMapping',
    description: 'Conditional logic for automatic workflow transitions',
    usings: [
      'System.Threading.Tasks',
      'BBT.Workflow.Scripting'
    ],
    methods: [
      {
        methodName: 'Handler',
        parameters: [
          { name: 'context', type: 'ScriptContext' }
        ],
        returnType: 'Task<bool>',
        isAsync: true
      }
    ]
  },

  ITransitionMapping: {
    contractType: 'ITransitionMapping',
    namespace: 'BBT.Workflow.Scripting',
    interfaceName: 'ITransitionMapping',
    description: 'Transition-specific data transformations',
    usings: [
      'System.Threading.Tasks',
      'BBT.Workflow.Scripting'
    ],
    methods: [
      {
        methodName: 'Handler',
        parameters: [
          { name: 'context', type: 'ScriptContext' }
        ],
        returnType: 'Task<dynamic>',
        isAsync: true
      }
    ]
  },

  ISubFlowMapping: {
    contractType: 'ISubFlowMapping',
    namespace: 'BBT.Workflow.Scripting',
    interfaceName: 'ISubFlowMapping',
    description: 'Data binding for subflow execution',
    usings: [
      'System.Threading.Tasks',
      'BBT.Workflow.Scripting'
    ],
    methods: [
      {
        methodName: 'InputHandler',
        parameters: [
          { name: 'context', type: 'ScriptContext' }
        ],
        returnType: 'Task<ScriptResponse>',
        isAsync: true
      },
      {
        methodName: 'OutputHandler',
        parameters: [
          { name: 'context', type: 'ScriptContext' }
        ],
        returnType: 'Task<ScriptResponse>',
        isAsync: true
      }
    ]
  },

  ISubProcessMapping: {
    contractType: 'ISubProcessMapping',
    namespace: 'BBT.Workflow.Scripting',
    interfaceName: 'ISubProcessMapping',
    description: 'Data binding for subprocess initialization',
    usings: [
      'System.Threading.Tasks',
      'BBT.Workflow.Scripting'
    ],
    methods: [
      {
        methodName: 'InputHandler',
        parameters: [
          { name: 'context', type: 'ScriptContext' }
        ],
        returnType: 'Task<ScriptResponse>',
        isAsync: true
      }
    ]
  },

  ITimerMapping: {
    contractType: 'ITimerMapping',
    namespace: 'BBT.Workflow.Scripting',
    interfaceName: 'ITimerMapping',
    description: 'Timer schedule calculation based on workflow context',
    usings: [
      'System.Threading.Tasks',
      'BBT.Workflow.Scripting',
      'BBT.Workflow.Definitions.Timer'
    ],
    methods: [
      {
        methodName: 'Handler',
        parameters: [
          { name: 'context', type: 'ScriptContext' }
        ],
        returnType: 'Task<TimerSchedule>',
        isAsync: true
      }
    ]
  }
};

/**
 * Helper: Get contract definition by type
 */
export function getContractDefinition(contractType: ContractType): ContractDefinition {
  return CONTRACT_DEFINITIONS[contractType];
}

/**
 * Helper: Check if contract has multiple methods
 */
export function isMultiMethodContract(contractType: ContractType): boolean {
  const definition = CONTRACT_DEFINITIONS[contractType];
  return definition.methods.length > 1;
}

/**
 * Helper: Get file extension for contract type
 */
export function getContractFileExtension(contractType: ContractType): string {
  return CONTRACT_FILE_EXTENSIONS[contractType];
}

/**
 * Helper: Get contract type from file extension
 */
export function getContractTypeFromExtension(extension: string): ContractType | undefined {
  for (const [contractType, ext] of Object.entries(CONTRACT_FILE_EXTENSIONS)) {
    if (ext === extension) {
      return contractType as ContractType;
    }
  }
  return undefined;
}

/**
 * Helper: Generate full reference key for mapper
 * Format: domain/flow/key@version
 * Example: ecommerce/mappers/order-to-invoice@1.0.0
 */
export function getMapperReferenceKey(metadata: ContractMetadata): string {
  const { domain, flow, key, version } = metadata;
  return version ? `${domain}/${flow}/${key}@${version}` : `${domain}/${flow}/${key}`;
}

/**
 * Helper: Parse mapper reference key
 * Returns: { domain, flow, key, version? }
 */
export function parseMapperReferenceKey(refKey: string): {
  domain: string;
  flow: string;
  key: string;
  version?: string;
} {
  const versionMatch = refKey.match(/^(.+)@(.+)$/);
  const withoutVersion = versionMatch ? versionMatch[1] : refKey;
  const version = versionMatch ? versionMatch[2] : undefined;

  const parts = withoutVersion.split('/');
  if (parts.length !== 3) {
    throw new Error(`Invalid mapper reference key: ${refKey}. Expected format: domain/flow/key[@version]`);
  }

  return {
    domain: parts[0],
    flow: parts[1],
    key: parts[2],
    version
  };
}

/**
 * Type guard: Check if MapSpec is a ContractMapSpec
 */
export function isContractMapSpec(mapSpec: MapSpec | ContractMapSpec): mapSpec is ContractMapSpec {
  return 'contractType' in mapSpec && mapSpec.contractType !== undefined;
}

/**
 * Type guard: Check if metadata includes key-based identity
 */
export function hasKeyBasedIdentity(metadata: any): metadata is ContractMetadata {
  return (
    typeof metadata === 'object' &&
    typeof metadata.key === 'string' &&
    typeof metadata.domain === 'string' &&
    typeof metadata.flow === 'string'
  );
}
