// Model validator for comprehensive workflow validation

import { WorkflowModel } from './WorkflowModel.js';
import type { ValidationResult, ValidationError, ValidationWarning } from './types.js';
import { lint } from '../linter.js';
import { validateWorkflow } from '../schema.js';

/**
 * Validation rule types
 */
export type ValidationRule =
  | 'schema'           // JSON schema validation
  | 'referential'      // Reference integrity
  | 'scripts'          // Script file validation
  | 'states'          // State machine validation
  | 'transitions'     // Transition validation
  | 'tasks'           // Task reference validation
  | 'deadlock'        // Deadlock detection
  | 'unreachable'     // Unreachable state detection
  | 'bestPractices';  // Best practice checks

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Which rules to apply */
  rules?: ValidationRule[];
  /** Whether to check script files exist */
  checkScriptFiles?: boolean;
  /** Whether to validate against task catalog */
  validateTaskCatalog?: boolean;
  /** Custom task catalog for validation */
  taskCatalog?: any[];
  /** Whether to perform expensive checks like deadlock detection */
  deepChecks?: boolean;
}

/**
 * Validates workflow models
 */
export class ModelValidator {
  /**
   * Validate a workflow model
   */
  static async validate(
    model: WorkflowModel,
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    const {
      rules = ['schema', 'referential', 'scripts', 'states', 'transitions'],
      checkScriptFiles = true,
      validateTaskCatalog = false,
      taskCatalog = [],
      deepChecks = false
    } = options;

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Run requested validation rules
    for (const rule of rules) {
      const result = await this.runValidationRule(
        model,
        rule,
        { checkScriptFiles, validateTaskCatalog, taskCatalog, deepChecks }
      );
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Run a specific validation rule
   */
  private static async runValidationRule(
    model: WorkflowModel,
    rule: ValidationRule,
    options: any
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    switch (rule) {
      case 'schema':
        return this.validateSchema(model);
      case 'referential':
        return this.validateReferential(model);
      case 'scripts':
        return this.validateScripts(model, options.checkScriptFiles);
      case 'states':
        return this.validateStates(model);
      case 'transitions':
        return this.validateTransitions(model);
      case 'tasks':
        return this.validateTasks(model, options.validateTaskCatalog, options.taskCatalog);
      case 'deadlock':
        return this.validateDeadlock(model);
      case 'unreachable':
        return this.validateUnreachable(model);
      case 'bestPractices':
        return this.validateBestPractices(model);
      default:
        return { errors: [], warnings: [] };
    }
  }

  /**
   * Validate against JSON schema
   */
  private static validateSchema(model: WorkflowModel): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const workflow = model.getWorkflow();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!validateWorkflow(workflow)) {
      const seenErrors = new Set<string>();

      for (const error of (validateWorkflow.errors || [])) {
        const errorKey = `${error.instancePath}::${error.message}`;
        if (seenErrors.has(errorKey)) continue;
        seenErrors.add(errorKey);

        errors.push({
          type: 'schema',
          message: `${error.instancePath} ${error.message}`,
          path: error.instancePath
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate referential integrity
   */
  private static validateReferential(model: WorkflowModel): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const states = model.getStates();
    const stateKeys = new Set(states.keys());
    const workflow = model.getWorkflow();

    // Check start transition target
    if (workflow.attributes.startTransition) {
      if (!stateKeys.has(workflow.attributes.startTransition.target)) {
        errors.push({
          type: 'referential',
          message: `Start transition targets non-existent state: ${workflow.attributes.startTransition.target}`,
          location: 'startTransition'
        });
      }
    }

    // Check timeout target
    if (workflow.attributes.timeout) {
      if (!stateKeys.has(workflow.attributes.timeout.target)) {
        errors.push({
          type: 'referential',
          message: `Timeout targets non-existent state: ${workflow.attributes.timeout.target}`,
          location: 'timeout'
        });
      }
    }

    // Check transition targets
    for (const [stateKey, state] of states) {
      for (const transition of (state.transitions || [])) {
        if (!stateKeys.has(transition.target)) {
          errors.push({
            type: 'referential',
            message: `Transition '${transition.key}' in state '${stateKey}' targets non-existent state: ${transition.target}`,
            location: `states.${stateKey}.transitions.${transition.key}`
          });
        }
      }
    }

    // Check shared transition targets and availability
    for (const sharedTransition of (workflow.attributes.sharedTransitions || [])) {
      if (!stateKeys.has(sharedTransition.target)) {
        errors.push({
          type: 'referential',
          message: `Shared transition '${sharedTransition.key}' targets non-existent state: ${sharedTransition.target}`,
          location: `sharedTransitions.${sharedTransition.key}`
        });
      }

      for (const availableState of sharedTransition.availableIn) {
        if (!stateKeys.has(availableState)) {
          errors.push({
            type: 'referential',
            message: `Shared transition '${sharedTransition.key}' references non-existent state in availableIn: ${availableState}`,
            location: `sharedTransitions.${sharedTransition.key}.availableIn`
          });
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate script files
   */
  private static async validateScripts(
    model: WorkflowModel,
    checkFiles: boolean
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const state = model.getModelState();

    if (!checkFiles) {
      return { errors, warnings };
    }

    // Check all referenced scripts exist and are valid
    for (const [, script] of state.scripts) {
      if (!script.exists) {
        // Find where this script is used
        const usages = model.findScriptUsages(script.location);
        const locations = usages.map(u => {
          if (u.stateKey) return `state:${u.stateKey}`;
          if (u.sharedTransitionKey) return `sharedTransition:${u.sharedTransitionKey}`;
          return 'unknown';
        }).join(', ');

        errors.push({
          type: 'scripts',
          message: `Script file not found: ${script.location}`,
          location: locations
        });
      } else if (script.content.trim() === '') {
        warnings.push({
          type: 'scripts',
          message: `Script file is empty: ${script.location}`,
          location: script.location
        });
      } else {
        // Basic C# syntax check
        if (!script.content.includes('using') || !script.content.includes('class')) {
          warnings.push({
            type: 'scripts',
            message: `Script may be missing required C# structure: ${script.location}`,
            location: script.location
          });
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate states
   */
  private static validateStates(model: WorkflowModel): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const states = model.getStates();
    const workflow = model.getWorkflow();

    let initialCount = 0;
    let finalCount = 0;

    for (const [key, state] of states) {
      // Count state types
      if (state.stateType === 1) initialCount++;
      if (state.stateType === 3) finalCount++;

      // Check final states don't have outgoing transitions
      if (state.stateType === 3 && state.transitions && state.transitions.length > 0) {
        warnings.push({
          type: 'states',
          message: `Final state '${key}' has outgoing transitions`,
          location: `states.${key}`
        });
      }

      // Check state has at least one way in (except initial)
      if (state.stateType !== 1) {
        const hasIncoming = this.stateHasIncomingTransitions(key, workflow, states);
        if (!hasIncoming) {
          warnings.push({
            type: 'states',
            message: `State '${key}' has no incoming transitions`,
            location: `states.${key}`
          });
        }
      }
    }

    // Check workflow has at least one initial and one final state
    if (initialCount === 0) {
      errors.push({
        type: 'states',
        message: 'Workflow has no initial state',
        location: 'states'
      });
    }

    if (finalCount === 0) {
      warnings.push({
        type: 'states',
        message: 'Workflow has no final state',
        location: 'states'
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate transitions
   */
  private static validateTransitions(model: WorkflowModel): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const workflow = model.getWorkflow();

    // Use the linter for transition validation
    const lintResult = lint(workflow);

    for (const [location, problems] of Object.entries(lintResult)) {
      for (const problem of problems) {
        if (problem.id === 'E_MISSING_RULE') {
          errors.push({
            type: 'transitions',
            message: problem.message,
            location
          });
        }
      }
    }

    // Check for duplicate transition keys
    const transitionKeys = new Set<string>();
    const duplicates = new Set<string>();

    for (const state of workflow.attributes.states) {
      for (const transition of (state.transitions || [])) {
        if (transitionKeys.has(transition.key)) {
          duplicates.add(transition.key);
        }
        transitionKeys.add(transition.key);
      }
    }

    for (const sharedTransition of (workflow.attributes.sharedTransitions || [])) {
      if (transitionKeys.has(sharedTransition.key)) {
        duplicates.add(sharedTransition.key);
      }
      transitionKeys.add(sharedTransition.key);
    }

    for (const duplicate of duplicates) {
      errors.push({
        type: 'transitions',
        message: `Duplicate transition key: ${duplicate}`,
        location: 'transitions'
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate task references
   */
  private static validateTasks(
    model: WorkflowModel,
    validateCatalog: boolean,
    taskCatalog: any[]
  ): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    if (!validateCatalog) {
      return { errors: [], warnings: [] };
    }

    const workflow = model.getWorkflow();
    const lintResult = lint(workflow, { tasks: taskCatalog });
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const [location, problems] of Object.entries(lintResult)) {
      for (const problem of problems) {
        if (problem.id === 'E_TASK_MISSING') {
          errors.push({
            type: 'tasks',
            message: problem.message,
            location
          });
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Check for potential deadlocks
   */
  private static validateDeadlock(model: WorkflowModel): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const states = model.getStates();
    const workflow = model.getWorkflow();

    // Build adjacency list
    const graph = new Map<string, Set<string>>();
    for (const [key, state] of states) {
      const targets = new Set<string>();

      // Add local transitions
      for (const transition of (state.transitions || [])) {
        targets.add(transition.target);
      }

      // Add shared transitions available from this state
      for (const shared of (workflow.attributes.sharedTransitions || [])) {
        if (shared.availableIn.includes(key)) {
          targets.add(shared.target);
        }
      }

      graph.set(key, targets);
    }

    // Find strongly connected components (potential deadlock cycles)
    const sccs = this.findStronglyConnectedComponents(graph);

    for (const scc of sccs) {
      if (scc.size > 1) {
        // Check if there's a way out of this SCC
        let hasExit = false;
        for (const state of scc) {
          const targets = graph.get(state) || new Set();
          for (const target of targets) {
            if (!scc.has(target)) {
              hasExit = true;
              break;
            }
          }
          if (hasExit) break;
        }

        if (!hasExit) {
          warnings.push({
            type: 'deadlock',
            message: `Potential deadlock detected in states: ${Array.from(scc).join(', ')}`,
            location: 'states'
          });
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Check for unreachable states
   */
  private static validateUnreachable(model: WorkflowModel): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const workflow = model.getWorkflow();
    const states = model.getStates();

    // Find all reachable states from start
    const reachable = new Set<string>();
    const queue: string[] = [];

    // Start from the start transition target
    if (workflow.attributes.startTransition) {
      queue.push(workflow.attributes.startTransition.target);
      reachable.add(workflow.attributes.startTransition.target);
    }

    // BFS to find all reachable states
    while (queue.length > 0) {
      const current = queue.shift()!;
      const state = states.get(current);

      if (state) {
        // Add local transition targets
        for (const transition of (state.transitions || [])) {
          if (!reachable.has(transition.target)) {
            reachable.add(transition.target);
            queue.push(transition.target);
          }
        }

        // Add shared transition targets available from this state
        for (const shared of (workflow.attributes.sharedTransitions || [])) {
          if (shared.availableIn.includes(current) && !reachable.has(shared.target)) {
            reachable.add(shared.target);
            queue.push(shared.target);
          }
        }
      }
    }

    // Check for unreachable states
    for (const key of states.keys()) {
      if (!reachable.has(key)) {
        warnings.push({
          type: 'unreachable',
          message: `State '${key}' is unreachable from the start state`,
          location: `states.${key}`
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate best practices
   */
  private static validateBestPractices(model: WorkflowModel): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const workflow = model.getWorkflow();
    const states = model.getStates();

    // Check for meaningful state and transition names
    for (const [key, state] of states) {
      if (key.length < 3) {
        warnings.push({
          type: 'bestPractices',
          message: `State key '${key}' is too short - use descriptive names`,
          location: `states.${key}`
        });
      }

      // Check for missing labels
      if (!state.labels || state.labels.length === 0) {
        warnings.push({
          type: 'bestPractices',
          message: `State '${key}' is missing labels`,
          location: `states.${key}`
        });
      }

      // Check transitions
      for (const transition of (state.transitions || [])) {
        if (transition.key.length < 3) {
          warnings.push({
            type: 'bestPractices',
            message: `Transition key '${transition.key}' is too short - use descriptive names`,
            location: `states.${key}.transitions.${transition.key}`
          });
        }
      }
    }

    // Check workflow metadata
    if (!workflow.tags || workflow.tags.length === 0) {
      warnings.push({
        type: 'bestPractices',
        message: 'Workflow has no tags - consider adding tags for categorization',
        location: 'tags'
      });
    }

    // Check for version
    if (workflow.version === '1.0.0') {
      warnings.push({
        type: 'bestPractices',
        message: 'Workflow is using default version 1.0.0 - consider proper versioning',
        location: 'version'
      });
    }

    return { errors, warnings };
  }

  /**
   * Check if a state has incoming transitions
   */
  private static stateHasIncomingTransitions(
    stateKey: string,
    workflow: any,
    states: Map<string, any>
  ): boolean {
    // Check start transition
    if (workflow.attributes.startTransition?.target === stateKey) {
      return true;
    }

    // Check timeout
    if (workflow.attributes.timeout?.target === stateKey) {
      return true;
    }

    // Check all state transitions
    for (const [_, state] of states) {
      for (const transition of (state.transitions || [])) {
        if (transition.target === stateKey) {
          return true;
        }
      }
    }

    // Check shared transitions
    for (const shared of (workflow.attributes.sharedTransitions || [])) {
      if (shared.target === stateKey) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find strongly connected components using Tarjan's algorithm
   */
  private static findStronglyConnectedComponents(
    graph: Map<string, Set<string>>
  ): Set<Set<string>> {
    const sccs = new Set<Set<string>>();
    const visited = new Set<string>();
    const stack: string[] = [];
    const lowLink = new Map<string, number>();
    const index = new Map<string, number>();
    let currentIndex = 0;

    const strongConnect = (v: string) => {
      index.set(v, currentIndex);
      lowLink.set(v, currentIndex);
      currentIndex++;
      stack.push(v);
      visited.add(v);

      const neighbors = graph.get(v) || new Set();
      for (const w of neighbors) {
        if (!index.has(w)) {
          strongConnect(w);
          lowLink.set(v, Math.min(lowLink.get(v)!, lowLink.get(w)!));
        } else if (stack.includes(w)) {
          lowLink.set(v, Math.min(lowLink.get(v)!, index.get(w)!));
        }
      }

      if (lowLink.get(v) === index.get(v)) {
        const scc = new Set<string>();
        let w: string | undefined;
        do {
          w = stack.pop();
          if (w) scc.add(w);
        } while (w && w !== v);
        sccs.add(scc);
      }
    };

    for (const v of graph.keys()) {
      if (!index.has(v)) {
        strongConnect(v);
      }
    }

    return sccs;
  }
}