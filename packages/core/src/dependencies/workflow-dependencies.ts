// Browser-compatible workflow dependency extraction
import type { Workflow } from '../types/index.js';

export interface WorkflowDependency {
  type: 'Task' | 'Schema' | 'View' | 'Script' | 'Function' | 'Extension' | 'Workflow';
  key: string;
  domain?: string;
  flow?: string;
  version?: string;
  location?: string;
  context?: string;
}

export type DependencyTree = Record<string, WorkflowDependency[]>;

/**
 * Extract all dependencies from a workflow
 * Returns a tree structure organized by state
 */
export function extractWorkflowDependencies(workflow: Workflow): DependencyTree {
  const stateTree: DependencyTree = {};

  // Helper to extract task info from TaskRef
  const extractTask = (taskRef: any): WorkflowDependency | null => {
    if (!taskRef) return null;
    if (taskRef.ref) {
      // {ref: "path/to/task.json"} format
      return { type: 'Task', key: taskRef.ref, location: taskRef.ref };
    } else if (taskRef.key) {
      // {key, domain, flow, version} format
      return {
        type: 'Task',
        key: taskRef.key,
        domain: taskRef.domain || 'core',
        flow: taskRef.flow || 'sys-tasks',
        version: taskRef.version
      };
    }
    return null;
  };

  // Helper to extract reference (Schema, View, etc.)
  const extractRef = (ref: any, type: WorkflowDependency['type'], defaultFlow: string): WorkflowDependency | null => {
    if (!ref) return null;
    if (ref.ref) {
      return { type, key: ref.ref, location: ref.ref };
    } else if (ref.key) {
      return {
        type,
        key: ref.key,
        domain: ref.domain || 'core',
        flow: ref.flow || defaultFlow,
        version: ref.version
      };
    }
    return null;
  };

  // Start transition
  if (workflow.attributes?.startTransition) {
    const startDeps: WorkflowDependency[] = [];
    const st = workflow.attributes.startTransition;

    if (st.mapping?.location) {
      startDeps.push({
        type: 'Script',
        key: st.mapping.location.split('/').pop()?.replace('.csx', '') || st.mapping.location,
        location: st.mapping.location
      });
    }

    if (startDeps.length > 0) {
      stateTree['[Start Transition]'] = startDeps;
    }
  }

  // Extract from states
  if (workflow.attributes?.states) {
    workflow.attributes.states.forEach((state) => {
      const stateDeps: WorkflowDependency[] = [];

      // State view
      const stateView = extractRef(state.view, 'View', 'sys-views');
      if (stateView) stateDeps.push(stateView);

      // SubFlow process reference
      if (state.subFlow?.process) {
        const subFlowRef = extractRef(state.subFlow.process, 'Workflow', 'sys-flows');
        if (subFlowRef) stateDeps.push({ ...subFlowRef, context: 'subFlow' });

        // SubFlow mapping script
        if (state.subFlow.mapping?.location) {
          stateDeps.push({
            type: 'Script',
            key: state.subFlow.mapping.location.split('/').pop()?.replace('.csx', '') || state.subFlow.mapping.location,
            location: state.subFlow.mapping.location,
            context: 'subFlow:mapping'
          });
        }

        // SubFlow view overrides (if present - not in TypeScript type but may exist in runtime data)
        const subFlowAny = state.subFlow as any;
        if (subFlowAny.viewOverrides && typeof subFlowAny.viewOverrides === 'object') {
          Object.entries(subFlowAny.viewOverrides as Record<string, any>).forEach(([_viewKey, viewRef]) => {
            const viewOverride = extractRef(viewRef, 'View', 'sys-views');
            if (viewOverride) stateDeps.push({ ...viewOverride, context: 'subFlow:viewOverride' });
          });
        }
      }

      // OnEntry tasks and scripts
      if (state.onEntries) {
        state.onEntries.forEach((entry) => {
          const task = extractTask(entry.task);
          if (task) stateDeps.push({ ...task, context: 'onEntry' });

          if (entry.mapping?.location) {
            stateDeps.push({
              type: 'Script',
              key: entry.mapping.location.split('/').pop()?.replace('.csx', '') || entry.mapping.location,
              location: entry.mapping.location,
              context: 'onEntry'
            });
          }
        });
      }

      // OnExit tasks and scripts
      if (state.onExits) {
        state.onExits.forEach((exit) => {
          const task = extractTask(exit.task);
          if (task) stateDeps.push({ ...task, context: 'onExit' });

          if (exit.mapping?.location) {
            stateDeps.push({
              type: 'Script',
              key: exit.mapping.location.split('/').pop()?.replace('.csx', '') || exit.mapping.location,
              location: exit.mapping.location,
              context: 'onExit'
            });
          }
        });
      }

      // Transitions
      if (state.transitions) {
        state.transitions.forEach((transition) => {
          // Transition rule script
          if (transition.rule?.location) {
            stateDeps.push({
              type: 'Script',
              key: transition.rule.location.split('/').pop()?.replace('.csx', '') || transition.rule.location,
              location: transition.rule.location,
              context: `transition:${transition.key}:rule`
            });
          }

          // Transition mapping script
          if (transition.mapping?.location) {
            stateDeps.push({
              type: 'Script',
              key: transition.mapping.location.split('/').pop()?.replace('.csx', '') || transition.mapping.location,
              location: transition.mapping.location,
              context: `transition:${transition.key}:mapping`
            });
          }

          // Transition schema
          const transSchema = extractRef(transition.schema, 'Schema', 'sys-schemas');
          if (transSchema) stateDeps.push({ ...transSchema, context: `transition:${transition.key}` });

          // Transition view
          const transView = extractRef(transition.view, 'View', 'sys-views');
          if (transView) stateDeps.push({ ...transView, context: `transition:${transition.key}` });

          // Transition onExecutionTasks
          if (transition.onExecutionTasks) {
            transition.onExecutionTasks.forEach((execTask) => {
              const task = extractTask(execTask.task);
              if (task) stateDeps.push({ ...task, context: `transition:${transition.key}:onExecution` });

              if (execTask.mapping?.location) {
                stateDeps.push({
                  type: 'Script',
                  key: execTask.mapping.location.split('/').pop()?.replace('.csx', '') || execTask.mapping.location,
                  location: execTask.mapping.location,
                  context: `transition:${transition.key}:onExecution`
                });
              }
            });
          }
        });
      }

      if (stateDeps.length > 0) {
        stateTree[state.key] = stateDeps;
      }
    });
  }

  // Extract workflow-level functions and extensions
  if (workflow.attributes?.functions) {
    const workflowLevelDeps: WorkflowDependency[] = [];
    workflow.attributes.functions.forEach((funcRef: any) => {
      const func = extractRef(funcRef, 'Function', 'sys-functions');
      if (func) workflowLevelDeps.push(func);
    });
    if (workflowLevelDeps.length > 0) {
      stateTree['[Workflow Level]'] = workflowLevelDeps;
    }
  }

  if (workflow.attributes?.extensions) {
    const extDeps = stateTree['[Workflow Level]'] || [];
    workflow.attributes.extensions.forEach((extRef: any) => {
      const ext = extractRef(extRef, 'Extension', 'sys-extensions');
      if (ext) extDeps.push(ext);
    });
    if (extDeps.length > 0) {
      stateTree['[Workflow Level]'] = extDeps;
    }
  }

  return stateTree;
}
