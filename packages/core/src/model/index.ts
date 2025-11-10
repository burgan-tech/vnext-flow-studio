// Model abstraction layer exports

export { WorkflowModel } from './WorkflowModel.js';
export { ComponentResolver, type ComponentResolverOptions } from './ComponentResolver.js';
export { ComponentWatcher, type ComponentWatcherOptions, type FileChangeEvent, type WatcherStats } from './ComponentWatcher.js';
export { ScriptManager } from './ScriptManager.js';
export { ModelLoader, type DiscoveryOptions, type DiscoveredWorkflow } from './ModelLoader.js';
export { ModelSaver } from './ModelSaver.js';
export { ModelValidator, type ValidationOptions, type ValidationRule } from './ModelValidator.js';
export { VSCodeModelIntegration, type VSCodeModelEvents, type DocumentChange } from './VSCodeIntegration.js';
export {
  generateWorkflowTemplate,
  generateSubflowTemplate,
  generateSubprocessTemplate,
  getWorkflowTemplate,
  type WorkflowTemplateOptions
} from './WorkflowTemplate.js';

// Logger exports
export {
  type ILogger,
  type LogLevel,
  ConsoleLogger,
  SilentLogger,
  MultiLogger,
  BufferedLogger,
  createLogger
} from './Logger.js';

// Export all types
export type {
  // Script types
  ResolvedScript,
  ResolvedMapping,
  ResolvedRule,

  // Component types
  ResolvedExecutionTask,
  ResolvedTransition,
  ResolvedSharedTransition,
  ResolvedState,
  ComponentRef,

  // Usage and tracking types
  ScriptUsage,
  ModelChangeEvent,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  SaveResult,

  // Model state types
  WorkflowModelState,
  ModelLoadOptions,
  ModelSaveOptions,

  // Interface types
  IComponentResolver,
  IScriptManager,
  IModelEventEmitter
} from './types.js';