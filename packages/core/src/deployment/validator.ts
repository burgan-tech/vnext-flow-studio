// Validator for normalized workflows

import type {
  Workflow,
  TaskRef as _TaskRef,
  FunctionRef as _FunctionRef,
  ExtensionRef as _ExtensionRef,
  ViewRef as _ViewRef,
  SchemaRef as _SchemaRef,
  ProcessRef as _ProcessRef,
  ExecutionTask,
  Transition,
  State,
  SharedTransition
} from '../types/workflow.js';
import type {
  NormalizationContext,
  NormalizationError as _NormalizationError,
  NormalizationWarning as _NormalizationWarning
} from './types.js';

/**
 * Validates normalized workflows before deployment
 */
export class DeploymentValidator {
  /**
   * Validate a normalized workflow
   */
  validate(workflow: Workflow, context: NormalizationContext): void {
    // Validate workflow structure
    this.validateWorkflowStructure(workflow, context);

    // Validate all references are explicit (no 'ref' fields)
    this.validateReferences(workflow, context);

    // Validate scripts are inlined
    this.validateScripts(workflow, context);

    // Validate states
    for (const state of workflow.attributes.states) {
      this.validateState(state, context);
    }

    // Validate shared transitions
    if (workflow.attributes.sharedTransitions) {
      for (const transition of workflow.attributes.sharedTransitions) {
        this.validateSharedTransition(transition, context);
      }
    }

    // Validate start transition
    this.validateTransition(workflow.attributes.startTransition, 'startTransition', context);
  }

  /**
   * Validate basic workflow structure
   */
  private validateWorkflowStructure(workflow: Workflow, context: NormalizationContext): void {
    // Required fields
    if (!workflow.key) {
      this.addError('Workflow missing required field: key', context);
    }
    if (!workflow.domain) {
      this.addError('Workflow missing required field: domain', context);
    }
    if (!workflow.flow) {
      this.addError('Workflow missing required field: flow', context);
    }
    if (!workflow.version) {
      this.addError('Workflow missing required field: version', context);
    }
    if (!workflow.attributes) {
      this.addError('Workflow missing required field: attributes', context);
    }
    if (!workflow.attributes.states || workflow.attributes.states.length === 0) {
      this.addError('Workflow must have at least one state', context);
    }
    if (!workflow.attributes.startTransition) {
      this.addError('Workflow missing required field: attributes.startTransition', context);
    }
  }

  /**
   * Validate all references are explicit (normalized)
   */
  private validateReferences(workflow: Workflow, context: NormalizationContext): void {
    // Check functions
    if (workflow.attributes.functions) {
      for (let i = 0; i < workflow.attributes.functions.length; i++) {
        const ref = workflow.attributes.functions[i];
        if ('ref' in ref) {
          this.addError(`Function reference not normalized: functions[${i}]`, context);
        } else {
          this.validateExplicitReference(ref, `functions[${i}]`, context);
        }
      }
    }

    // Check extensions
    if (workflow.attributes.extensions) {
      for (let i = 0; i < workflow.attributes.extensions.length; i++) {
        const ref = workflow.attributes.extensions[i];
        if ('ref' in ref) {
          this.addError(`Extension reference not normalized: extensions[${i}]`, context);
        } else {
          this.validateExplicitReference(ref, `extensions[${i}]`, context);
        }
      }
    }

    // Check features (alternative name for extensions)
    if (workflow.attributes.features) {
      for (let i = 0; i < workflow.attributes.features.length; i++) {
        const ref = workflow.attributes.features[i];
        if ('ref' in ref) {
          this.addError(`Feature reference not normalized: features[${i}]`, context);
        } else {
          this.validateExplicitReference(ref, `features[${i}]`, context);
        }
      }
    }

    // Check states
    for (const state of workflow.attributes.states) {
      this.validateStateReferences(state, context);
    }

    // Check shared transitions
    if (workflow.attributes.sharedTransitions) {
      for (let i = 0; i < workflow.attributes.sharedTransitions.length; i++) {
        this.validateTransitionReferences(
          workflow.attributes.sharedTransitions[i],
          `sharedTransition[${i}]`,
          context
        );
      }
    }

    // Check start transition
    this.validateTransitionReferences(workflow.attributes.startTransition, 'startTransition', context);
  }

  /**
   * Validate state references
   */
  private validateStateReferences(state: State, context: NormalizationContext): void {
    const location = `state:${state.key}`;

    // Check view reference
    // Handle both direct ViewRef and nested view configuration object
    if (state.view) {
      const viewObj = state.view as any;
      // Check if this is a nested view configuration with { view, loadData, extensions }
      if (typeof viewObj === 'object' && 'view' in viewObj && viewObj.view) {
        // Nested structure - validate the inner view property
        if ('ref' in viewObj.view) {
          this.addError(`View reference not normalized: ${location}.view`, context);
        } else {
          this.validateExplicitReference(viewObj.view, `${location}.view`, context);
        }
      } else {
        // Direct ViewRef
        if ('ref' in viewObj) {
          this.addError(`View reference not normalized: ${location}.view`, context);
        } else {
          this.validateExplicitReference(viewObj, `${location}.view`, context);
        }
      }
    }

    // Check onEntry tasks
    if (state.onEntries) {
      for (let i = 0; i < state.onEntries.length; i++) {
        this.validateExecutionTaskReferences(
          state.onEntries[i],
          `${location}.onEntries[${i}]`,
          context
        );
      }
    }

    // Check onExit tasks
    if (state.onExits) {
      for (let i = 0; i < state.onExits.length; i++) {
        this.validateExecutionTaskReferences(
          state.onExits[i],
          `${location}.onExits[${i}]`,
          context
        );
      }
    }

    // Check transitions
    if (state.transitions) {
      for (let i = 0; i < state.transitions.length; i++) {
        this.validateTransitionReferences(
          state.transitions[i],
          `${location}.transitions[${i}]`,
          context
        );
      }
    }

    // Check subflow process reference
    if (state.subFlow?.process) {
      if ('ref' in state.subFlow.process) {
        this.addError(`Subflow process reference not normalized: ${location}.subFlow.process`, context);
      } else {
        this.validateExplicitReference(state.subFlow.process, `${location}.subFlow.process`, context);
      }
    }
  }

  /**
   * Validate transition references
   */
  private validateTransitionReferences(
    transition: Transition,
    location: string,
    context: NormalizationContext
  ): void {
    // Check schema reference
    if (transition.schema) {
      if ('ref' in transition.schema) {
        this.addError(`Schema reference not normalized: ${location}.schema`, context);
      } else {
        this.validateExplicitReference(transition.schema, `${location}.schema`, context);
      }
    }

    // Check view reference
    // Handle both direct ViewRef and nested view configuration object
    if (transition.view) {
      const viewObj = transition.view as any;
      // Check if this is a nested view configuration with { view, loadData, extensions }
      if (typeof viewObj === 'object' && 'view' in viewObj && viewObj.view) {
        // Nested structure - validate the inner view property
        if ('ref' in viewObj.view) {
          this.addError(`View reference not normalized: ${location}.view`, context);
        } else {
          this.validateExplicitReference(viewObj.view, `${location}.view`, context);
        }
      } else {
        // Direct ViewRef
        if ('ref' in viewObj) {
          this.addError(`View reference not normalized: ${location}.view`, context);
        } else {
          this.validateExplicitReference(viewObj, `${location}.view`, context);
        }
      }
    }

    // Check execution tasks
    if (transition.onExecutionTasks) {
      for (let i = 0; i < transition.onExecutionTasks.length; i++) {
        this.validateExecutionTaskReferences(
          transition.onExecutionTasks[i],
          `${location}.onExecutionTasks[${i}]`,
          context
        );
      }
    }
  }

  /**
   * Validate execution task references
   */
  private validateExecutionTaskReferences(
    task: ExecutionTask,
    location: string,
    context: NormalizationContext
  ): void {
    // Check task reference
    if ('ref' in task.task) {
      this.addError(`Task reference not normalized: ${location}.task`, context);
    } else {
      this.validateExplicitReference(task.task, `${location}.task`, context);
    }
  }

  /**
   * Validate an explicit reference has all required fields
   */
  private validateExplicitReference(
    ref: { key: string; domain: string; flow: string; version: string },
    location: string,
    context: NormalizationContext
  ): void {
    if (!ref.key || ref.key === 'UNRESOLVED') {
      this.addError(`Reference missing or unresolved key: ${location}`, context);
    }
    if (!ref.domain || ref.domain === 'UNRESOLVED') {
      this.addError(`Reference missing or unresolved domain: ${location}`, context);
    }
    if (!ref.flow || ref.flow === 'UNRESOLVED') {
      this.addError(`Reference missing or unresolved flow: ${location}`, context);
    }
    if (!ref.version || ref.version === 'UNRESOLVED') {
      this.addError(`Reference missing or unresolved version: ${location}`, context);
    }
  }

  /**
   * Validate scripts are properly inlined
   */
  private validateScripts(workflow: Workflow, context: NormalizationContext): void {
    // Check start transition
    if (workflow.attributes.startTransition.onExecutionTasks) {
      for (const task of workflow.attributes.startTransition.onExecutionTasks) {
        this.validateExecutionTaskScripts(task, 'startTransition', context);
      }
    }

    // Check shared transitions
    if (workflow.attributes.sharedTransitions) {
      for (let i = 0; i < workflow.attributes.sharedTransitions.length; i++) {
        this.validateTransitionScripts(
          workflow.attributes.sharedTransitions[i],
          `sharedTransition[${i}]`,
          context
        );
      }
    }

    // Check states
    for (const state of workflow.attributes.states) {
      this.validateStateScripts(state, context);
    }
  }

  /**
   * Validate state scripts
   */
  private validateStateScripts(state: State, context: NormalizationContext): void {
    const location = `state:${state.key}`;

    // Check onEntry tasks
    if (state.onEntries) {
      for (let i = 0; i < state.onEntries.length; i++) {
        this.validateExecutionTaskScripts(
          state.onEntries[i],
          `${location}.onEntries[${i}]`,
          context
        );
      }
    }

    // Check onExit tasks
    if (state.onExits) {
      for (let i = 0; i < state.onExits.length; i++) {
        this.validateExecutionTaskScripts(
          state.onExits[i],
          `${location}.onExits[${i}]`,
          context
        );
      }
    }

    // Check transitions
    if (state.transitions) {
      for (let i = 0; i < state.transitions.length; i++) {
        this.validateTransitionScripts(
          state.transitions[i],
          `${location}.transitions[${i}]`,
          context
        );
      }
    }

    // Check subflow mapping
    if (state.subFlow?.mapping) {
      this.validateScriptInlined(state.subFlow.mapping, `${location}.subFlow.mapping`, context);
    }
  }

  /**
   * Validate transition scripts
   */
  private validateTransitionScripts(
    transition: Transition,
    location: string,
    context: NormalizationContext
  ): void {
    // Check rule
    if (transition.rule) {
      this.validateScriptInlined(transition.rule, `${location}.rule`, context);
    }

    // Check execution tasks
    if (transition.onExecutionTasks) {
      for (let i = 0; i < transition.onExecutionTasks.length; i++) {
        this.validateExecutionTaskScripts(
          transition.onExecutionTasks[i],
          `${location}.onExecutionTasks[${i}]`,
          context
        );
      }
    }
  }

  /**
   * Validate execution task scripts
   */
  private validateExecutionTaskScripts(
    task: ExecutionTask,
    location: string,
    context: NormalizationContext
  ): void {
    if (task.mapping) {
      this.validateScriptInlined(task.mapping, `${location}.mapping`, context);
    }
  }

  /**
   * Validate a script is inlined (has code or location is 'inline')
   */
  private validateScriptInlined(
    script: { location: string; code: string },
    location: string,
    context: NormalizationContext
  ): void {
    // Script should either be inline or have base64-encoded code
    if (script.location !== 'inline' && script.location.endsWith('.csx')) {
      this.addWarning(
        `Script not inlined, may fail deployment: ${location} (${script.location})`,
        context
      );
    }

    if (script.location !== 'inline' && script.location.includes('mapper.json')) {
      this.addWarning(
        `Mapper not compiled, may fail deployment: ${location} (${script.location})`,
        context
      );
    }

    // Check if code field is present
    if (!script.code || script.code.trim() === '') {
      this.addWarning(`Script has no code content: ${location}`, context);
    }
  }

  /**
   * Validate a state structure
   */
  private validateState(state: State, context: NormalizationContext): void {
    if (!state.key) {
      this.addError('State missing required field: key', context);
    }
    if (state.stateType === undefined || state.stateType === null) {
      this.addError(`State missing required field: stateType (state: ${state.key})`, context);
    }
  }

  /**
   * Validate a shared transition structure
   */
  private validateSharedTransition(transition: SharedTransition, context: NormalizationContext): void {
    if (!transition.key) {
      this.addError('Shared transition missing required field: key', context);
    }
    if (!transition.availableIn || transition.availableIn.length === 0) {
      this.addError(
        `Shared transition missing availableIn: ${transition.key}`,
        context
      );
    }
    this.validateTransition(transition, `sharedTransition:${transition.key}`, context);
  }

  /**
   * Validate a transition structure
   */
  private validateTransition(
    transition: Transition,
    location: string,
    context: NormalizationContext
  ): void {
    if (!transition.key) {
      this.addError(`Transition missing required field: key (${location})`, context);
    }
    if (!transition.target) {
      this.addError(`Transition missing required field: target (${location})`, context);
    }
  }

  /**
   * Add an error to the context
   */
  private addError(message: string, context: NormalizationContext): void {
    context.errors.push({
      type: 'validation',
      message
    });
  }

  /**
   * Add a warning to the context
   */
  private addWarning(message: string, context: NormalizationContext): void {
    context.warnings.push({
      type: 'best-practice',
      message
    });
  }
}
