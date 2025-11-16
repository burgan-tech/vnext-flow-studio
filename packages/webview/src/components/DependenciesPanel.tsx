import React, { useState, useEffect, useMemo } from 'react';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { CheckSquare, FileCode, Database, Eye, Zap, Package, XCircle, Workflow as WorkflowIcon } from 'lucide-react';
import type { Workflow } from '@amorphie-flow-studio/core';
import '../styles/dependencies-panel.css';

console.log('[DependenciesPanel] Module loaded!');

interface DependenciesPanelProps {
  workflow: Workflow | null;
  onOpenDependency?: (dep: WorkflowDependency) => void;
  postMessage: (message: any) => void;
}

interface WorkflowDependency {
  type: 'Task' | 'Schema' | 'View' | 'Script' | 'Function' | 'Extension' | 'Workflow';
  key: string;
  domain?: string;
  flow?: string;
  version?: string;
  location?: string;
  ref?: string;
  context?: string;
  validated?: boolean;
  exists?: boolean;
}

type DependencyTree = Record<string, WorkflowDependency[]>;

export function DependenciesPanel({ workflow, onOpenDependency, postMessage }: DependenciesPanelProps) {
  console.log('[DependenciesPanel] Component rendering, workflow:', workflow?.attributes?.key);
  const [validationMap, setValidationMap] = useState<Map<string, boolean>>(new Map());

  const getTypeIcon = (type: string, exists?: boolean) => {
    const iconProps = { size: 16, strokeWidth: 2 };
    if (exists === false) {
      return <XCircle {...iconProps} />;
    }
    switch (type) {
      case 'Task': return <CheckSquare {...iconProps} />;
      case 'Script': return <FileCode {...iconProps} />;
      case 'Schema': return <Database {...iconProps} />;
      case 'View': return <Eye {...iconProps} />;
      case 'Function': return <Zap {...iconProps} />;
      case 'Extension': return <Package {...iconProps} />;
      case 'Workflow': return <WorkflowIcon {...iconProps} />;
      default: return <CheckSquare {...iconProps} />;
    }
  };
  // Extract dependencies using the same logic
  const extractDependencies = (): DependencyTree => {
    if (!workflow) return {};

    const stateTree: DependencyTree = {};

    // Helper to extract task info from TaskRef
    const extractTask = (taskRef: any): WorkflowDependency | null => {
      if (!taskRef) return null;
      if (taskRef.ref) {
        // File-based reference - extract filename for display, keep ref for resolution
        const fileName = taskRef.ref.split('/').pop()?.replace('.json', '') || taskRef.ref;
        return { type: 'Task', key: fileName, ref: taskRef.ref };
      } else if (taskRef.key) {
        return {
          type: 'Task',
          key: taskRef.key,
          domain: taskRef.domain,
          flow: taskRef.flow,
          version: taskRef.version
        };
      }
      return null;
    };

    // Helper to extract reference (Schema, View, etc.)
    const extractRef = (ref: any, type: WorkflowDependency['type']): WorkflowDependency | null => {
      if (!ref) return null;
      if (ref.ref) {
        // File-based reference - extract filename for display, keep ref for resolution
        const fileName = ref.ref.split('/').pop()?.replace('.json', '') || ref.ref;
        return { type, key: fileName, ref: ref.ref };
      } else if (ref.key) {
        return {
          type,
          key: ref.key,
          domain: ref.domain,
          flow: ref.flow,
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
        const stateView = extractRef(state.view, 'View');
        if (stateView) stateDeps.push(stateView);

        // SubFlow process reference
        if (state.subFlow?.process) {
          const subFlowRef = extractRef(state.subFlow.process, 'Workflow');
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

          // SubFlow view overrides (if present)
          const subFlowAny = state.subFlow as any;
          if (subFlowAny.viewOverrides && typeof subFlowAny.viewOverrides === 'object') {
            Object.entries(subFlowAny.viewOverrides as Record<string, any>).forEach(([_viewKey, viewRef]) => {
              const viewOverride = extractRef(viewRef, 'View');
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
            const transSchema = extractRef(transition.schema, 'Schema');
            if (transSchema) stateDeps.push({ ...transSchema, context: `transition:${transition.key}` });

            // Transition view
            const transView = extractRef(transition.view, 'View');
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
        const func = extractRef(funcRef, 'Function');
        if (func) workflowLevelDeps.push(func);
      });
      if (workflowLevelDeps.length > 0) {
        stateTree['[Workflow Level]'] = workflowLevelDeps;
      }
    }

    if (workflow.attributes?.extensions) {
      const extDeps = stateTree['[Workflow Level]'] || [];
      workflow.attributes.extensions.forEach((extRef: any) => {
        const ext = extractRef(extRef, 'Extension');
        if (ext) extDeps.push(ext);
      });
      if (extDeps.length > 0) {
        stateTree['[Workflow Level]'] = extDeps;
      }
    }

    return stateTree;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stateTree = useMemo(() => extractDependencies(), [workflow]);
  const totalDeps = Object.values(stateTree).reduce((sum, deps) => sum + deps.length, 0);

  // Flatten dependencies for validation
  const allDeps = useMemo(() => Object.values(stateTree).flat(), [stateTree]);

  // Request validation when dependencies change
  useEffect(() => {
    console.log('[DependenciesPanel] useEffect triggered, allDeps.length:', allDeps.length);
    if (allDeps.length === 0) {
      console.log('[DependenciesPanel] Skipping validation - no dependencies');
      return;
    }

    console.log('[DependenciesPanel] Requesting validation for', allDeps.length, 'dependencies');

    // Send validation request
    postMessage({
      type: 'dependency:validate',
      dependencies: allDeps.map(dep => ({
        type: dep.type,
        key: dep.key,
        domain: dep.domain,
        flow: dep.flow,
        version: dep.version,
        location: dep.location,
        ref: dep.ref
      }))
    });

    // Listen for validation results
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'dependency:validation') {
        console.log('[DependenciesPanel] Received validation results:', message.results);
        const newMap = new Map<string, boolean>();
        message.results.forEach((result: { index: number; exists: boolean }) => {
          const dep = allDeps[result.index];
          const key = `${dep.type}:${dep.ref || dep.location || `${dep.domain}/${dep.flow}/${dep.key}`}`;
          console.log('[DependenciesPanel] Dep', result.index, 'key:', key, 'exists:', result.exists);
          newMap.set(key, result.exists);
        });
        console.log('[DependenciesPanel] Validation map:', newMap);
        setValidationMap(newMap);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [allDeps, postMessage]);

  if (totalDeps === 0) {
    return (
      <div className="dependencies-panel__empty">
        <p>No dependencies found</p>
        <p className="dependencies-panel__empty-subtitle">
          This workflow doesn&apos;t reference any tasks, schemas, views, or scripts
        </p>
      </div>
    );
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Task': return '#10b981';
      case 'Script': return '#f59e0b';
      case 'Schema': return '#3b82f6';
      case 'View': return '#8b5cf6';
      case 'Function': return '#ec4899';
      case 'Extension': return '#06b6d4';
      default: return '#6b7280';
    }
  };

  return (
    <div className="dependencies-panel">
      <div className="dependencies-panel__header">
        Found {totalDeps} dependencies across {Object.keys(stateTree).length} states
      </div>
      <SimpleTreeView>
        {Object.entries(stateTree).map(([stateName, deps]) => (
          <TreeItem
            key={stateName}
            itemId={stateName}
            label={
              <div className="dependencies-panel__state-label">
                {stateName}
              </div>
            }
          >
            {deps.map((dep, index) => {
              // For scripts, extract filename from path
              const displayText = dep.type === 'Script'
                ? dep.location?.split('/').pop()?.replace('.csx', '') || dep.key
                : dep.version
                  ? `${dep.key} @ ${dep.version}`
                  : dep.key;

              const tooltip = dep.location || dep.ref || (dep.domain && dep.flow ? `${dep.domain}/${dep.flow}/${dep.key}` : undefined);

              // Check validation status
              const depKey = `${dep.type}:${dep.ref || dep.location || `${dep.domain}/${dep.flow}/${dep.key}`}`;
              const exists = validationMap.get(depKey);
              const isBroken = exists === false;

              if (index === 0 && stateName === Object.keys(stateTree)[0]) {
                console.log('[DependenciesPanel] First dep key:', depKey, 'exists:', exists, 'isBroken:', isBroken, 'validationMap size:', validationMap.size);
              }

              return (
                <TreeItem
                  key={`${stateName}-${index}`}
                  itemId={`${stateName}-${index}`}
                  label={
                    <div
                      className="dependencies-panel__dep-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDependency?.(dep);
                      }}
                      title={tooltip}
                    >
                      <span
                        className="dependencies-panel__dep-icon"
                        style={{ color: isBroken ? '#ef4444' : getTypeColor(dep.type) }}
                      >
                        {getTypeIcon(dep.type, exists)}
                      </span>
                      <span
                        className="dependencies-panel__dep-text"
                        style={{ color: isBroken ? '#ef4444' : undefined }}
                      >
                        {displayText}
                      </span>
                      {dep.context && (
                        <span className="dependencies-panel__dep-context">
                          {dep.context}
                        </span>
                      )}
                    </div>
                  }
                />
              );
            })}
          </TreeItem>
        ))}
      </SimpleTreeView>
    </div>
  );
}
