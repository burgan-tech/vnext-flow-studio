import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  type Workflow,
  type State,
  type Transition,
  type VersionStrategy,
  type StateType,
  type StateSubType,
  type Label,
  type ExecutionTask,
  type TaskComponentDefinition,
  type SchemaRef,
  type SharedTransition,
  type MsgToWebview,
} from '@amorphie-flow-studio/core';
import { useBridge } from '../hooks/useBridge';
import { decodeBase64, encodeBase64 } from '../utils/base64Utils';
import {
  CollapsibleSection,
  LabelListEditor,
  ExecutionTaskListEditor,
  EnhancedTriggerEditor,
  EnhancedRuleEditor,
  ReferenceSelector,
  SubFlowEditor,
  isSchemaRef,
  isTaskRef,
  type SchemaMode,
  type ComponentReference,
  type ScriptItem
} from './editors';
import { ServiceTaskProperties } from './properties/ServiceTaskProperties';

export type PropertySelection =
  | { kind: 'state'; stateKey: string }
  | { kind: 'transition'; from: string; transitionKey: string }
  | { kind: 'sharedTransition'; transitionKey: string }
  | { kind: 'startTransition'; transitionKey: string }
  | null;

interface PropertyPanelProps {
  workflow: Workflow;
  selection: PropertySelection;
  collapsed: boolean;
  availableTasks: TaskComponentDefinition[];
  catalogs?: Record<string, any[]>;
}

const versionStrategies: VersionStrategy[] = ['Major', 'Minor'];

const stateTypeOptions: { value: StateType; label: string }[] = [
  { value: 1, label: 'Initial' },
  { value: 2, label: 'Intermediate' },
  { value: 3, label: 'Final' },
  { value: 4, label: 'Sub-flow' }
];

const stateSubTypeOptions: { value: StateSubType; label: string }[] = [
  { value: 1, label: 'Success' },
  { value: 2, label: 'Failed' },
  { value: 3, label: 'Cancelled' }
];

function sanitizeLabels(labels?: Label[]): Label[] {
  if (!labels) return [];

  return labels
    .map((label) => ({
      language: label.language?.trim() ?? '',
      label: label.label?.trim() ?? ''
    }))
    .filter((label) => label.language || label.label);
}

function sanitizeExecutionTasks(tasks?: ExecutionTask[]): ExecutionTask[] | undefined {
  if (!tasks) return undefined;

  const sanitized = tasks
    .map((task, index) => {
      const result: ExecutionTask & Record<string, unknown> = {
        ...task,
        order: Number.isFinite(task.order) ? task.order : index + 1
      };

      // Handle task reference
      if (isTaskRef(task.task)) {
        result.task = {
          key: task.task.key?.trim() ?? '',
          domain: task.task.domain?.trim() ?? '',
          version: task.task.version?.trim() ?? '',
          flow: 'sys-tasks'
        };
      } else {
        // It's an inline ref
        result.task = task.task;
      }

      if (task.mapping) {
        const location = task.mapping.location?.trim() ?? '';
        const code = task.mapping.code?.trim() ?? '';
        result.mapping = { location, code };
      } else {
        // Mapping is required, provide empty one
        result.mapping = { location: '', code: '' };
      }

      return result as ExecutionTask;
    })
    .filter((task) => {
      if (isTaskRef(task.task)) {
        return task.task.key || task.task.domain || task.task.version;
      }
      return task.task.ref; // For inline refs
    });

  return sanitized.length > 0 ? sanitized : undefined;
}

function sanitizeState(draft: State): State {
  const result: State & Record<string, unknown> = {
    ...draft,
    labels: sanitizeLabels(draft.labels)
  };

  const onEntries = sanitizeExecutionTasks(draft.onEntries);
  if (onEntries) {
    result.onEntries = onEntries;
  } else {
    delete result.onEntries;
  }

  const onExits = sanitizeExecutionTasks(draft.onExits);
  if (onExits) {
    result.onExits = onExits;
  } else {
    delete result.onExits;
  }

  // onExecutionTasks moved to transition level in new schema

  // views replaced with single view reference in new schema
  if (draft.view) {
    result.view = draft.view;
  } else {
    delete result.view;
  }

  // Handle subFlow configuration
  if (draft.subFlow) {
    console.log('🔍 sanitizeState - checking subFlow:', JSON.stringify(draft.subFlow, null, 2));

    // Validate that process reference has required fields
    const process = draft.subFlow.process;
    const hasValidProcess =
      ('ref' in process && process.ref) ||
      ('key' in process && process.key && process.domain && process.version);

    console.log('🔍 sanitizeState - hasValidProcess:', hasValidProcess, {
      hasRef: 'ref' in process && !!process.ref,
      hasKey: 'key' in process && !!process.key,
      hasDomain: 'key' in process && !!process.domain,
      hasVersion: 'key' in process && !!process.version,
      hasType: !!draft.subFlow.type
    });

    if (hasValidProcess && draft.subFlow.type) {
      result.subFlow = draft.subFlow;
      console.log('✅ sanitizeState - keeping subFlow');
    } else {
      delete result.subFlow;
      console.log('❌ sanitizeState - deleting subFlow due to validation failure');
    }
  } else {
    delete result.subFlow;
    console.log('🔍 sanitizeState - no subFlow in draft');
  }

  if (!Array.isArray(result.labels)) {
    result.labels = [];
  }

  return result as State;
}

function sanitizeTransition(
  draft: Transition
): Transition {
  const labels = sanitizeLabels(draft.labels);
  const result: Transition & Record<string, unknown> = {
    ...draft,
    labels
  };

  if (!labels.length) {
    delete result.labels;
  }

  if (draft.rule) {
    const location = draft.rule.location?.trim() ?? '';
    const code = draft.rule.code?.trim() ?? '';
    if (!location && !code) {
      delete result.rule;
    } else {
      result.rule = { location, code };
    }
  } else {
    delete result.rule;
  }

  // Derive mode from the schema value
  const schemaMode: SchemaMode = draft.schema === null || draft.schema === undefined
    ? 'none'
    : isSchemaRef(draft.schema)
    ? 'full'
    : 'ref';

  if (schemaMode === 'none') {
    result.schema = null;
  } else if (schemaMode === 'full') {
    if (isSchemaRef(draft.schema)) {
      const schema: SchemaRef = {
        key: draft.schema.key?.trim() ?? '',
        domain: draft.schema.domain?.trim() ?? '',
        version: draft.schema.version?.trim() ?? '',
        flow: 'sys-schemas'
      };
      if (schema.key || schema.domain || schema.version) {
        result.schema = schema;
      } else {
        result.schema = null;
      }
    } else {
      result.schema = null;
    }
  } else if (schemaMode === 'ref') {
    if (draft.schema && 'ref' in draft.schema) {
      const ref = (draft.schema as any).ref?.trim() ?? '';
      if (ref) {
        result.schema = { ref };
      } else {
        result.schema = null;
      }
    } else {
      result.schema = null;
    }
  }

  return result as Transition;
}

export function PropertyPanel({ workflow, selection, collapsed, availableTasks, catalogs = {} }: PropertyPanelProps) {
  const { postMessage, onMessage } = useBridge();

  const panelClassName = useMemo(() => {
    return ['property-panel', collapsed ? 'property-panel--collapsed' : '']
      .filter(Boolean)
      .join(' ');
  }, [collapsed]);

  // Convert catalog scripts to ScriptItem format
  const availableMappers = useMemo((): ScriptItem[] => {
    return (catalogs.mapper || []).map((script: any) => ({
      location: script.location || '',
      absolutePath: script.absolutePath || '',
      content: script.content || '',
      base64: script.base64 || '',
      exists: script.exists !== false,
      lastModified: script.lastModified ? new Date(script.lastModified) : undefined,
      size: script.size
    }));
  }, [catalogs.mapper]);

  const availableRules = useMemo((): ScriptItem[] => {
    return (catalogs.rule || []).map((script: any) => ({
      location: script.location || '',
      absolutePath: script.absolutePath || '',
      content: script.content || '',
      base64: script.base64 || '',
      exists: script.exists !== false,
      lastModified: script.lastModified ? new Date(script.lastModified) : undefined,
      size: script.size
    }));
  }, [catalogs.rule]);

  const selectedState = useMemo(() => {
    if (selection?.kind !== 'state') return null;
    return workflow.attributes.states.find((state) => state.key === selection.stateKey) ?? null;
  }, [selection, workflow]);

  const selectedTransition = useMemo(() => {
    if (selection?.kind !== 'transition') return null;
    const fromState = workflow.attributes.states.find((state) => state.key === selection.from);
    if (!fromState || !fromState.transitions) return null;
    const transition = fromState.transitions.find((item) => item.key === selection.transitionKey) ?? null;
    if (!transition) return null;
    return { fromState, transition } as const;
  }, [selection, workflow]);

  const selectedSharedTransition = useMemo(() => {
    if (selection?.kind !== 'sharedTransition') return null;
    const sharedTransition = workflow.attributes.sharedTransitions?.find(
      (item) => item.key === selection.transitionKey
    );
    return sharedTransition ?? null;
  }, [selection, workflow]);

  const selectedStartTransition = useMemo(() => {
    if (selection?.kind !== 'startTransition') return null;
    return workflow.attributes.startTransition ?? null;
  }, [selection, workflow]);

  const [stateDraft, setStateDraft] = useState<State | null>(null);
  const [transitionDraft, setTransitionDraft] = useState<Transition | null>(null);
  const [sharedTransitionDraft, setSharedTransitionDraft] = useState<SharedTransition | null>(null);
  const [startTransitionDraft, setStartTransitionDraft] = useState<Transition | null>(null);
  // Schema mode is derived from the schema value itself, no need to track in state
  // Shared schema mode is derived from the schema value itself
  // Schema ref states removed - no longer needed since we don't support inline schemas
  const [ruleText, setRuleText] = useState('');
  const [sharedRuleText, setSharedRuleText] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const previousSelectionRef = useRef<PropertySelection>(selection);

  // Check if there are unsaved changes
  const checkForUnsavedChanges = useCallback(() => {
    if (stateDraft && selectedState) {
      return JSON.stringify(stateDraft) !== JSON.stringify(selectedState);
    }
    if (transitionDraft && selectedTransition) {
      return JSON.stringify(transitionDraft) !== JSON.stringify(selectedTransition.transition);
    }
    if (sharedTransitionDraft && selectedSharedTransition) {
      return JSON.stringify(sharedTransitionDraft) !== JSON.stringify(selectedSharedTransition);
    }
    if (startTransitionDraft && selectedStartTransition) {
      return JSON.stringify(startTransitionDraft) !== JSON.stringify(selectedStartTransition);
    }
    return false;
  }, [stateDraft, selectedState, transitionDraft, selectedTransition, sharedTransitionDraft, selectedSharedTransition, startTransitionDraft, selectedStartTransition]);

  // Store pending selection when confirmation is needed
  const [pendingSelection, setPendingSelection] = useState<PropertySelection | null>(null);
  // Store the data to save when confirmation is needed
  const [pendingSaveData, setPendingSaveData] = useState<{
    selection: PropertySelection;
    stateDraft?: State;
    transitionDraft?: Transition;
    sharedTransitionDraft?: SharedTransition;
  } | null>(null);

  // Handle confirmation response from extension
  useEffect(() => {
    return onMessage((message: MsgToWebview) => {
      if (message.type === 'confirm:response') {
        console.log('🔍 Confirmation response received:', {
          save: message.save,
          pendingSaveData,
          pendingSelection
        });

        if (message.save && pendingSaveData && pendingSaveData.selection) {
          const selection = pendingSaveData.selection;

          // Save the pending changes based on selection type
          if (selection.kind === 'state' && pendingSaveData.stateDraft) {
            // Check if it's a Service Task state that needs special handling
            if (pendingSaveData.stateDraft.xProfile === 'ServiceTask') {
              // For Service Task, manually save like ServiceTaskProperties does
              const cleanState = { ...pendingSaveData.stateDraft };

              // Ensure only one onEntry task for Service Task
              if (cleanState.onEntries && cleanState.onEntries.length > 1) {
                cleanState.onEntries = [cleanState.onEntries[0]];
              }

              // Send update
              postMessage({
                type: 'domain:updateState',
                stateKey: selection.stateKey,
                state: cleanState
              });
            } else {
              // For regular states, send the sanitized state
              const sanitized = sanitizeState(pendingSaveData.stateDraft);
              postMessage({
                type: 'domain:updateState',
                stateKey: selection.stateKey,
                state: sanitized
              });
            }
          } else if (selection.kind === 'transition' && pendingSaveData.transitionDraft) {
            // Save transition
            const sanitized = sanitizeTransition(pendingSaveData.transitionDraft);
            postMessage({
              type: 'domain:updateTransition',
              from: selection.from,
              transitionKey: selection.transitionKey,
              transition: sanitized
            });
          } else if (selection.kind === 'sharedTransition' && pendingSaveData.sharedTransitionDraft) {
            // Save shared transition
            const { availableIn, ...transitionFields } = pendingSaveData.sharedTransitionDraft;
            const sanitized = sanitizeTransition(transitionFields as Transition);
            const updatedSharedTransition: SharedTransition = {
              ...sanitized,
              availableIn
            };
            postMessage({
              type: 'domain:updateSharedTransition',
              transitionKey: selection.transitionKey,
              sharedTransition: updatedSharedTransition
            });
          }
        }

        // Now proceed with the selection change
        if (pendingSelection) {
          previousSelectionRef.current = pendingSelection;
          setHasUnsavedChanges(false);
          setPendingSelection(null);
          setPendingSaveData(null);
        }
      }
    });
  }, [onMessage, pendingSelection, pendingSaveData, postMessage]);

  // Handle selection change with unsaved changes check
  useEffect(() => {
    console.log('🔍 Selection change effect:', {
      selection,
      previousSelection: previousSelectionRef.current,
      hasUnsavedChanges,
      stateDraft: stateDraft?.key,
      transitionDraft: transitionDraft?.key
    });

    // Check if selection is actually changing
    if (JSON.stringify(selection) === JSON.stringify(previousSelectionRef.current)) {
      return;
    }

    // If this is the first selection (previousSelectionRef is null), just set it
    if (!previousSelectionRef.current) {
      console.log('🔍 Setting initial selection:', selection);
      previousSelectionRef.current = selection;
      return;
    }

    // Check for unsaved changes before switching
    if (hasUnsavedChanges) {
      console.log('🔍 Unsaved changes detected, showing confirmation');
      console.log('🔍 Previous selection before confirmation:', previousSelectionRef.current);

      // Store the pending selection and current drafts
      setPendingSelection(selection);
      setPendingSaveData({
        selection: previousSelectionRef.current,
        stateDraft: stateDraft || undefined,
        transitionDraft: transitionDraft || undefined,
        sharedTransitionDraft: sharedTransitionDraft || undefined
      });

      // Request confirmation from the extension
      postMessage({
        type: 'confirm:unsavedChanges',
        message: 'You have unsaved changes. Do you want to save them before switching?'
      });

      // Don't update selection yet - wait for response
      return;
    }

    // Update the previous selection
    console.log('🔍 Updating previousSelectionRef to:', selection);
    previousSelectionRef.current = selection;
    setHasUnsavedChanges(false);
  }, [selection, hasUnsavedChanges, postMessage, stateDraft, transitionDraft, sharedTransitionDraft]);

  useEffect(() => {
    // Don't update draft if we're waiting for confirmation
    if (pendingSelection) {
      return;
    }

    if (selectedState) {
      const clone = JSON.parse(JSON.stringify(selectedState)) as State;
      if (!Array.isArray(clone.labels)) {
        clone.labels = [];
      }
      setStateDraft(clone);
      setHasUnsavedChanges(false);
    } else {
      setStateDraft(null);
    }
  }, [selectedState, pendingSelection]);

  // Track changes in drafts
  useEffect(() => {
    setHasUnsavedChanges(checkForUnsavedChanges());
  }, [stateDraft, transitionDraft, sharedTransitionDraft, checkForUnsavedChanges]);

  useEffect(() => {
    // Don't update draft if we're waiting for confirmation
    if (pendingSelection) {
      return;
    }

    if (selectedTransition) {
      const clone = JSON.parse(JSON.stringify(selectedTransition.transition)) as Transition;
      setTransitionDraft(clone);
      setHasUnsavedChanges(false);

      // Schema mode will be derived from the schema value in the editor

      // Initialize rule text - decode Base64 if needed
      if (clone.rule) {
        const code = clone.rule.code || '';
        setRuleText(decodeBase64(code));
      } else {
        setRuleText('');
      }
    } else {
      setTransitionDraft(null);
      setRuleText('');
    }
  }, [selectedTransition, pendingSelection]);

  useEffect(() => {
    // Don't update draft if we're waiting for confirmation
    if (pendingSelection) {
      return;
    }

    if (selectedSharedTransition) {
      const clone = JSON.parse(JSON.stringify(selectedSharedTransition)) as SharedTransition;
      setHasUnsavedChanges(false);
      // Clean up availableIn to ensure target is not included
      clone.availableIn = clone.availableIn.filter(s => s !== clone.target);
      setSharedTransitionDraft(clone);

      // Schema mode will be derived from the schema value in the editor

      // Initialize rule text - decode Base64 if needed
      if (clone.rule) {
        const code = clone.rule.code || '';
        setSharedRuleText(decodeBase64(code));
      } else {
        setSharedRuleText('');
      }
    } else {
      setSharedTransitionDraft(null);
      setSharedRuleText('');
    }
  }, [selectedSharedTransition, pendingSelection]);

  useEffect(() => {
    // Don't update draft if we're waiting for confirmation
    if (pendingSelection) {
      return;
    }

    if (selectedStartTransition) {
      const clone = JSON.parse(JSON.stringify(selectedStartTransition)) as Transition;
      setStartTransitionDraft(clone);
      setHasUnsavedChanges(false);

      // Initialize rule text - decode Base64 if needed
      if (clone.rule) {
        const code = clone.rule.code || '';
        setRuleText(decodeBase64(code));
      } else {
        setRuleText('');
      }
    } else {
      setStartTransitionDraft(null);
      setRuleText('');
    }
  }, [selectedStartTransition, pendingSelection]);

  const handleStateSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    console.log('🔍 handleStateSubmit called!');
    event.preventDefault();
    if (!selection || selection.kind !== 'state' || !stateDraft) {
      console.log('❌ Early return:', { selection, hasStateDraft: !!stateDraft });
      return;
    }
    console.log('✅ Proceeding with state save...');

    const sanitized = sanitizeState(stateDraft);

    // Encode execution task mapping codes to Base64 before saving
    const encodeExecutionTaskMappings = (tasks?: any[]) => {
      if (!tasks) return tasks;
      return tasks.map(task => {
        if (task.mapping && task.mapping.code) {
          try {
            const code = task.mapping.code;
            console.log('🔍 Encoding execution task mapping code:', code?.substring(0, 100) + '...');

            // Encode any non-empty code to Base64 (more permissive)
            if (code && code.trim().length > 0) {
              const encodedCode = btoa(code);
              console.log('✅ Encoded execution task mapping to Base64');
              return {
                ...task,
                mapping: {
                  ...task.mapping,
                  code: encodedCode
                }
              };
            }
          } catch (error) {
            console.error('Failed to encode execution task mapping to Base64:', error);
          }
        }
        return task;
      });
    };

    // Encode mappings in onEntries and onExits
    if (sanitized.onEntries) {
      sanitized.onEntries = encodeExecutionTaskMappings(sanitized.onEntries);
    }
    if (sanitized.onExits) {
      sanitized.onExits = encodeExecutionTaskMappings(sanitized.onExits);
    }

    // NOTE: Removed automatic file creation for mapping files
    // Files should only be created with explicit user consent
    // This prevents unwanted files in repositories and ensures user awareness

    postMessage({
      type: 'domain:updateState',
      stateKey: selection.stateKey,
      state: sanitized
    });

    // Mark changes as saved
    setHasUnsavedChanges(false);
  };

  const handleTransitionSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    console.log('🔍 handleTransitionSubmit called!');
    event.preventDefault();
    if (!selection || selection.kind !== 'transition' || !transitionDraft) {
      console.log('❌ Early return:', { selection, hasTransitionDraft: !!transitionDraft });
      return;
    }
    console.log('✅ Proceeding with transition save...');

    console.log('🔍 Sanitizing transition...');
    const sanitized = sanitizeTransition(transitionDraft) as any;
    console.log('✅ Transition sanitized');

    // Preserve duration for timeout triggers
    if (transitionDraft.triggerType === 2 && (transitionDraft as any).duration) {
      sanitized.duration = (transitionDraft as any).duration;
      console.log('🔍 Preserving timeout duration:', sanitized.duration);
    }

    // Encode rule text to Base64 before saving
    if (sanitized.rule && ruleText) {
      sanitized.rule.code = encodeBase64(ruleText);
    }

    // Encode execution task mapping codes to Base64 before saving
    console.log('🔍 Setting up execution task encoding...');
    const encodeExecutionTaskMappings = (tasks?: any[]) => {
      if (!tasks) return tasks;
      console.log('🔍 Processing', tasks.length, 'execution tasks for encoding');
      return tasks.map(task => {
        if (task.mapping && task.mapping.code) {
          try {
            const code = task.mapping.code;
            console.log('🔍 Encoding transition execution task mapping code:', code?.substring(0, 100) + '...');

            // Encode any non-empty code to Base64 (more permissive)
            if (code && code.trim().length > 0) {
              const encodedCode = btoa(code);
              console.log('✅ Encoded transition execution task mapping to Base64');
              return {
                ...task,
                mapping: {
                  ...task.mapping,
                  code: encodedCode
                }
              };
            }
          } catch (error) {
            console.error('Failed to encode transition execution task mapping to Base64:', error);
          }
        }
        return task;
      });
    };

    // Encode mappings in onExecutionTasks
    console.log('🔍 Checking onExecutionTasks...', { hasOnExecutionTasks: !!sanitized.onExecutionTasks });
    if (sanitized.onExecutionTasks) {
      console.log('🔍 Encoding onExecutionTasks...');
      sanitized.onExecutionTasks = encodeExecutionTaskMappings(sanitized.onExecutionTasks);
      console.log('✅ onExecutionTasks encoded');
    }

    // Auto-create .csx files for transition execution tasks if they don't exist
    if (transitionDraft.onExecutionTasks) {
      transitionDraft.onExecutionTasks.forEach((task, index) => {
        if (task.mapping && task.mapping.location && task.mapping.code) {
          postMessage({
            type: 'mapping:createFile',
            from: selection.from,
            transitionKey: selection.transitionKey,
            index,
            location: task.mapping.location,
            code: task.mapping.code
          });
        }
      });
    }

    console.log('🔍 Sending postMessage to update transition...');
    postMessage({
      type: 'domain:updateTransition',
      from: selection.from,
      transitionKey: selection.transitionKey,
      transition: sanitized
    });
    console.log('✅ postMessage sent successfully');

    // Mark changes as saved
    setHasUnsavedChanges(false);
  };

  const handleSharedTransitionSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selection || selection.kind !== 'sharedTransition' || !sharedTransitionDraft) return;

    // The sanitizeTransition function works for both regular and shared transitions
    const { availableIn, ...transitionFields } = sharedTransitionDraft;
    const sanitized = sanitizeTransition(transitionFields as Transition) as any;

    // Preserve duration for timeout triggers
    if (sharedTransitionDraft.triggerType === 2 && (sharedTransitionDraft as any).duration) {
      sanitized.duration = (sharedTransitionDraft as any).duration;
      console.log('🔍 Preserving shared transition timeout duration:', sanitized.duration);
    }

    // Encode shared rule text to Base64 before saving
    if (sanitized.rule && sharedRuleText) {
      try {
        sanitized.rule.code = btoa(sharedRuleText);
      } catch (error) {
        console.error('Failed to encode shared rule to Base64:', error);
        sanitized.rule.code = sharedRuleText; // fallback to plain text
      }
    }

    // Combine sanitized fields with availableIn
    const updatedSharedTransition: SharedTransition = {
      ...sanitized,
      availableIn
    };

    postMessage({
      type: 'domain:updateSharedTransition',
      transitionKey: selection.transitionKey, // Use original key from selection
      sharedTransition: updatedSharedTransition
    });

    // Mark changes as saved
    setHasUnsavedChanges(false);
  };

  const handleStartTransitionSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selection || selection.kind !== 'startTransition' || !startTransitionDraft) return;

    const sanitized = sanitizeTransition(startTransitionDraft) as any;

    // Preserve duration for timeout triggers
    if (startTransitionDraft.triggerType === 2 && (startTransitionDraft as any).duration) {
      sanitized.duration = (startTransitionDraft as any).duration;
    }

    // Encode rule text to Base64 before saving
    if (sanitized.rule && ruleText) {
      sanitized.rule.code = encodeBase64(ruleText);
    }

    // Encode execution task mapping codes to Base64 before saving
    const encodeExecutionTaskMappings = (tasks?: any[]) => {
      if (!tasks) return tasks;
      return tasks.map(task => {
        if (task.mapping && task.mapping.code) {
          try {
            const code = task.mapping.code;
            if (code && code.trim().length > 0) {
              const encodedCode = btoa(code);
              return {
                ...task,
                mapping: {
                  ...task.mapping,
                  code: encodedCode
                }
              };
            }
          } catch (error) {
            console.error('Failed to encode start transition execution task mapping to Base64:', error);
          }
        }
        return task;
      });
    };

    if (sanitized.onExecutionTasks) {
      sanitized.onExecutionTasks = encodeExecutionTaskMappings(sanitized.onExecutionTasks);
    }

    postMessage({
      type: 'domain:updateStartTransition',
      startTransition: sanitized
    });

    // Mark changes as saved
    setHasUnsavedChanges(false);
  };

  const stateLabels = stateDraft?.labels ?? [];
  const transitionLabels = transitionDraft?.labels ?? [];
  const transitionHasErrors = false; // No more inline schema errors

  return (
    <aside className={panelClassName} aria-hidden={collapsed}>
      <div className="property-panel__header">
        <h2 className="property-panel__title">Properties</h2>
        {selection?.kind === 'state' && stateDraft ? (
          <span className="property-panel__tag">State</span>
        ) : null}
        {selection?.kind === 'transition' && transitionDraft ? (
          <span className="property-panel__tag">Transition</span>
        ) : null}
        {selection?.kind === 'sharedTransition' && sharedTransitionDraft ? (
          <span className="property-panel__tag">Shared Transition</span>
        ) : null}
        {selection?.kind === 'startTransition' && startTransitionDraft ? (
          <span className="property-panel__tag">Start Transition</span>
        ) : null}
      </div>
      <div className="property-panel__content">
        {!selection ? (
          <div className="property-panel__empty">
            <p>Select a state or transition to edit its properties.</p>
            <div style={{ marginTop: '16px' }}>
              <button
                type="button"
                className="property-panel__pill-button"
                onClick={() => {
                  // Note: Workflow properties editing would need to be implemented
                  // with proper message passing to the extension
                  alert('Workflow properties editing is not yet implemented.\n\nMissing features:\n- Workflow type (C/F/S/P)\n- SubFlow type\n- Workflow timeout\n- Functions/Extensions\n- Shared transitions');
                }}
              >
                Edit Workflow Properties
              </button>
            </div>
          </div>
        ) : null}

        {selection?.kind === 'state' && stateDraft ? (
          // Use specialized component for Service Task states
          stateDraft.xProfile === 'ServiceTask' ? (
            <ServiceTaskProperties
              state={stateDraft}
              stateKey={selection.stateKey}
              taskCatalog={availableTasks}
              hasUnsavedChanges={hasUnsavedChanges}
              onSave={() => setHasUnsavedChanges(false)}
              onChange={(updatedState) => setStateDraft(updatedState)}
            />
          ) : (
          <form className="property-panel__section" onSubmit={handleStateSubmit}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <h3 className="property-panel__section-title">{stateDraft.key}</h3>
              {stateDraft.stateType === 4 && stateDraft.subFlow?.process && (
                <button
                  type="button"
                  className="property-panel__pill-button"
                  onClick={() => {
                    postMessage({
                      type: 'navigate:subflow',
                      stateKey: stateDraft.key
                    });
                  }}
                  title={
                    'key' in stateDraft.subFlow.process
                      ? `Open subflow: ${stateDraft.subFlow.process.key}`
                      : `Open subflow: ${stateDraft.subFlow.process.ref}`
                  }
                  style={{ fontSize: '12px', padding: '4px 12px' }}
                >
                  → Open Subflow
                </button>
              )}
            </div>

            <CollapsibleSection title="Basic Properties" defaultExpanded={true}>
              <label className="property-panel__field">
                <span>Key</span>
                <input
                  type="text"
                  value={stateDraft.key}
                  onChange={(event) =>
                    setStateDraft((prev) =>
                      prev ? { ...prev, key: event.target.value } : prev
                    )
                  }
                />
              </label>

              <label className="property-panel__field">
                <span>Version strategy</span>
                <select
                  value={stateDraft.versionStrategy}
                  onChange={(event) =>
                    setStateDraft((prev) =>
                      prev
                        ? { ...prev, versionStrategy: event.target.value as VersionStrategy }
                        : prev
                    )
                  }
                >
                  {versionStrategies.map((strategy) => (
                    <option key={strategy} value={strategy}>
                      {strategy}
                    </option>
                  ))}
                </select>
              </label>

              <label className="property-panel__field">
                <span>State type</span>
                <select
                  value={stateDraft.stateType}
                  onChange={(event) =>
                    setStateDraft((prev) =>
                      prev ? { ...prev, stateType: Number(event.target.value) as StateType } : prev
                    )
                  }
                >
                  {stateTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="property-panel__field">
                <span>State subtype</span>
                <select
                  value={stateDraft.stateSubType ?? ''}
                  onChange={(event) =>
                    setStateDraft((prev) => {
                      if (!prev) return prev;
                      const value = event.target.value;
                      if (value === '') {
                        const updated = { ...prev } as State & Record<string, unknown>;
                        delete updated.stateSubType;
                        return updated as State;
                      }
                      return { ...prev, stateSubType: Number(value) as StateSubType };
                    })
                  }
                >
                  <option value="">None</option>
                  {stateSubTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </CollapsibleSection>

            <CollapsibleSection
              title="Labels"
              defaultExpanded={false}
              headerActions={
                <button
                  type="button"
                  onClick={() => {
                    const newLabels = [...stateLabels, { label: '', language: 'en' }];
                    setStateDraft((prev) => (prev ? { ...prev, labels: newLabels } : prev));
                  }}
                  className="property-panel__add-button"
                >
                  +
                </button>
              }
            >
              <LabelListEditor
                title=""
                labels={stateLabels}
                onChange={(labels) =>
                  setStateDraft((prev) => (prev ? { ...prev, labels } : prev))
                }
              />
            </CollapsibleSection>

            <CollapsibleSection title="View Reference" defaultExpanded={false}>
              <ReferenceSelector
                label="View"
                value={stateDraft.view && 'key' in stateDraft.view ? stateDraft.view as ComponentReference : null}
                availableComponents={catalogs.view || []}
                componentType="View"
                defaultFlow="sys-views"
                onChange={(reference) => {
                  setStateDraft(prev => {
                    if (!prev) return prev;
                    const next = { ...prev } as State & Record<string, unknown>;
                    if (reference) {
                      next.view = reference;
                    } else {
                      delete next.view;
                    }
                    return next as State;
                  });
                }}
                helpText="Select a view definition to display UI for this state"
              />
            </CollapsibleSection>

            {stateDraft.stateType === 4 && (
              <CollapsibleSection title="Subflow Configuration" defaultExpanded={false}>
                <SubFlowEditor
                  value={stateDraft.subFlow || null}
                  availableWorkflows={catalogs.workflow || []}
                  availableMappers={availableMappers}
                  onChange={(subFlow) => {
                    setStateDraft(prev => {
                      if (!prev) return prev;
                      const next = { ...prev } as State & Record<string, unknown>;
                      if (subFlow) {
                        next.subFlow = subFlow;
                      } else {
                        delete next.subFlow;
                      }
                      return next as State;
                    });
                  }}
                  onLoadMappingFromFile={() => {
                    // TODO: Implement subflow mapping file loading
                    console.log('Load subflow mapping from file');
                  }}
                />
              </CollapsibleSection>
            )}

            <CollapsibleSection
              title="On Entry Tasks"
              defaultExpanded={false}
              headerActions={
                <button
                  type="button"
                  onClick={() => {
                    const newTask = {
                      order: (stateDraft.onEntries?.length || 0) + 1,
                      task: { ref: '' },
                      mapping: { location: './src/mappings/new.csx', code: '' }
                    };
                    const newTasks = [...(stateDraft.onEntries || []), newTask];
                    setStateDraft((prev) => {
                      if (!prev) return prev;
                      const next = { ...prev } as State & Record<string, unknown>;
                      next.onEntries = newTasks;
                      return next as State;
                    });
                  }}
                  className="property-panel__add-button"
                >
                  +
                </button>
              }
            >
            <ExecutionTaskListEditor
              title=""
              tasks={stateDraft.onEntries}
              availableTasks={availableTasks}
              availableMappers={availableMappers}
              onLoadFromFile={(taskIndex) => {
                postMessage({
                  type: 'mapping:loadFromFile',
                  stateKey: stateDraft.key,
                  list: 'onEntries',
                  index: taskIndex
                });
              }}
              onChange={(tasks) =>
                setStateDraft((prev) => {
                  if (!prev) return prev;
                  const next = { ...prev } as State & Record<string, unknown>;
                  if (!tasks) {
                    delete next.onEntries;
                  } else {
                    next.onEntries = tasks;
                  }
                  return next as State;
                })
              }
            />
            </CollapsibleSection>

            <CollapsibleSection
              title="On Exit Tasks"
              defaultExpanded={false}
              headerActions={
                <button
                  type="button"
                  onClick={() => {
                    const newTask = {
                      order: (stateDraft.onExits?.length || 0) + 1,
                      task: { ref: '' },
                      mapping: { location: './src/mappings/new.csx', code: '' }
                    };
                    const newTasks = [...(stateDraft.onExits || []), newTask];
                    setStateDraft((prev) => {
                      if (!prev) return prev;
                      const next = { ...prev } as State & Record<string, unknown>;
                      next.onExits = newTasks;
                      return next as State;
                    });
                  }}
                  className="property-panel__add-button"
                >
                  +
                </button>
              }
            >
            <ExecutionTaskListEditor
              title=""
              tasks={stateDraft.onExits}
              availableTasks={availableTasks}
              availableMappers={availableMappers}
              onLoadFromFile={(taskIndex) => {
                postMessage({
                  type: 'mapping:loadFromFile',
                  stateKey: stateDraft.key,
                  list: 'onExits',
                  index: taskIndex
                });
              }}
              onChange={(tasks) =>
                setStateDraft((prev) => {
                  if (!prev) return prev;
                  const next = { ...prev } as State & Record<string, unknown>;
                  if (!tasks) {
                    delete next.onExits;
                  } else {
                    next.onExits = tasks;
                  }
                  return next as State;
                })
              }
            />
            </CollapsibleSection>

            {/* onExecutionTasks moved to transition level in new schema */}

            {/* views replaced with single view reference in new schema */}

            <button
              type="submit"
              className="property-panel__save"
              onClick={() => console.log('🔍 Save state button clicked!')}
            >
              {hasUnsavedChanges ? '● Save state' : 'Save state'}
            </button>
          </form>
          )
        ) : null}

        {selection?.kind === 'transition' && transitionDraft ? (
          <form className="property-panel__section" onSubmit={handleTransitionSubmit}>
            <h3 className="property-panel__section-title">{transitionDraft.key}</h3>

            <CollapsibleSection title="Basic Properties" defaultExpanded={true}>
              <label className="property-panel__field">
                <span>Key</span>
                <input
                  type="text"
                  value={transitionDraft.key}
                  onChange={(event) =>
                    setTransitionDraft((prev) =>
                      prev ? { ...prev, key: event.target.value } : prev
                    )
                  }
                />
              </label>

              <label className="property-panel__field">
                <span>Target State</span>
                <input
                  type="text"
                  value={transitionDraft.target}
                  readOnly={true}
                  disabled={true}
                  onChange={() => {}}
                  title="Target state is defined in the flow editor"
                  style={{
                    opacity: 0.6,
                    cursor: 'not-allowed',
                    backgroundColor: '#f5f5f5',
                    pointerEvents: 'none'
                  }}
                />
                <small className="property-panel__help">
                  Target state is defined by the connection in the flow editor
                </small>
              </label>

              <label className="property-panel__field">
                <span>Version strategy</span>
                <select
                  value={transitionDraft.versionStrategy}
                  onChange={(event) =>
                    setTransitionDraft((prev) =>
                      prev
                        ? { ...prev, versionStrategy: event.target.value as VersionStrategy }
                        : prev
                    )
                  }
                >
                  {versionStrategies.map((strategy) => (
                    <option key={strategy} value={strategy}>
                      {strategy}
                    </option>
                  ))}
                </select>
              </label>
            </CollapsibleSection>

            {/* Enhanced Trigger Editor for Trigger Type */}
            <CollapsibleSection title="Transition Trigger" defaultExpanded={true}>
              <EnhancedTriggerEditor
                title=""
                triggerType={transitionDraft.triggerType}
                onTriggerTypeChange={(triggerType) =>
                  setTransitionDraft((prev) =>
                    prev ? { ...prev, triggerType } : prev
                  )
                }
                duration={
                  transitionDraft.triggerType === 2 && (transitionDraft as any).duration
                    ? (transitionDraft as any).duration
                    : 'PT1H'
                }
                onDurationChange={(duration) => {
                  if (transitionDraft.triggerType === 2) {
                    setTransitionDraft((prev) =>
                      prev ? { ...prev, duration } as any : prev
                    );
                  }
                }}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="Labels"
              defaultExpanded={false}
              headerActions={
                <button
                  type="button"
                  onClick={() => {
                    const newLabels = [...transitionLabels, { label: '', language: 'en' }];
                    setTransitionDraft((prev) => (prev ? { ...prev, labels: newLabels } : prev));
                  }}
                  className="property-panel__add-button"
                >
                  +
                </button>
              }
            >
              <LabelListEditor
                title=""
                labels={transitionLabels}
                onChange={(labels) =>
                  setTransitionDraft((prev) => (prev ? { ...prev, labels } : prev))
                }
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="Rule"
              defaultExpanded={false}
              headerActions={
                !transitionDraft.rule && (
                  <button
                    type="button"
                    onClick={() => {
                      setTransitionDraft((prev) => {
                        if (!prev) return prev;
                        const next = { ...prev } as Transition & Record<string, unknown>;
                        next.rule = { location: './src/rules/new.csx', code: '' };
                        return next as Transition;
                      });
                    }}
                    className="property-panel__add-button"
                  >
                    +
                  </button>
                )
              }
            >
              <EnhancedRuleEditor
                title=""
                rule={transitionDraft.rule}
                inlineText={ruleText}
                availableRules={availableRules}
                onLoadFromFile={() => {
                  if (selection?.kind === 'transition') {
                    postMessage({
                      type: 'rule:loadFromFile',
                      from: selection.from,
                      transitionKey: selection.transitionKey
                    });
                  }
                }}
                onChange={(rule) => {
                  setTransitionDraft((prev) => {
                    if (!prev) return prev;
                    const next = { ...prev } as Transition & Record<string, unknown>;
                    if (rule) {
                      next.rule = rule;
                    } else {
                      delete next.rule;
                    }
                    return next as Transition;
                  });
                }}
                onInlineChange={setRuleText}
                currentState={selectedTransition?.fromState}
                workflow={workflow}
                availableTasks={availableTasks}
                hideHeader={true}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Schema" defaultExpanded={false}>
              <ReferenceSelector
                label="Schema"
                value={transitionDraft.schema && isSchemaRef(transitionDraft.schema) ? transitionDraft.schema as ComponentReference : null}
                availableComponents={catalogs.schema || []}
                componentType="Schema"
                defaultFlow="sys-schemas"
                onChange={(reference) => {
                  setTransitionDraft(prev => {
                    if (!prev) return prev;
                    return { ...prev, schema: reference };
                  });
                }}
                helpText="Select a schema to validate data sent with this transition"
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="On Execution Tasks"
              defaultExpanded={false}
              headerActions={
                <button
                  type="button"
                  onClick={() => {
                    const newTask = {
                      order: (transitionDraft.onExecutionTasks?.length || 0) + 1,
                      task: { ref: '' },
                      mapping: { location: './src/mappings/new.csx', code: '' }
                    };
                    const newTasks = [...(transitionDraft.onExecutionTasks || []), newTask];
                    setTransitionDraft((prev) => {
                      if (!prev) return prev;
                      const next = { ...prev } as Transition & Record<string, unknown>;
                      next.onExecutionTasks = newTasks;
                      return next as Transition;
                    });
                  }}
                  className="property-panel__add-button"
                >
                  +
                </button>
              }
            >
            <ExecutionTaskListEditor
              title=""
              tasks={transitionDraft.onExecutionTasks}
              availableTasks={availableTasks}
              availableMappers={availableMappers}
              onLoadFromFile={(taskIndex) => {
                if (selection?.kind === 'transition') {
                  postMessage({
                    type: 'mapping:loadFromFile',
                    from: selection.from,
                    transitionKey: selection.transitionKey,
                    transition: transitionDraft,
                    index: taskIndex
                  });
                }
              }}
              onChange={(tasks) =>
                setTransitionDraft((prev) => {
                  if (!prev) return prev;
                  const next = { ...prev } as Transition & Record<string, unknown>;
                  if (!tasks) {
                    delete next.onExecutionTasks;
                  } else {
                    next.onExecutionTasks = tasks;
                  }
                  return next as Transition;
                })
              }
            />
            </CollapsibleSection>

            <button
              type="submit"
              className="property-panel__save"
              disabled={transitionHasErrors}
              onClick={() => console.log('🔍 Save transition button clicked!')}
            >
              {hasUnsavedChanges ? '● Save transition' : 'Save transition'}
            </button>
          </form>
        ) : null}

        {selection?.kind === 'sharedTransition' && sharedTransitionDraft ? (
          <form className="property-panel__section" onSubmit={handleSharedTransitionSubmit}>
            <h3 className="property-panel__section-title">{sharedTransitionDraft.key} (Shared)</h3>

            <CollapsibleSection title="Basic Properties" defaultExpanded={true}>
              <label className="property-panel__field">
                <span>Key</span>
                <input
                  type="text"
                  value={sharedTransitionDraft.key}
                  onChange={(event) =>
                    setSharedTransitionDraft((prev) =>
                      prev ? { ...prev, key: event.target.value } : prev
                    )
                  }
                />
              </label>

              <label className="property-panel__field">
                <span>Target State</span>
                <input
                  type="text"
                  value={sharedTransitionDraft.target}
                  onChange={(event) => {
                    const newTarget = event.target.value;
                    setSharedTransitionDraft((prev) => {
                      if (!prev) return prev;
                      // Only filter out target from availableIn if it's not "$self"
                      const filteredAvailableIn = newTarget === '$self'
                        ? prev.availableIn
                        : prev.availableIn.filter(s => s !== newTarget);
                      return {
                        ...prev,
                        target: newTarget,
                        availableIn: filteredAvailableIn
                      };
                    });
                  }}
                />
                <small className="property-panel__help">
                  The state that all shared instances will transition to. Use &quot;$self&quot; to make each state transition to itself.
                </small>
              </label>

              <label className="property-panel__field">
                <span>Version strategy</span>
                <select
                  value={sharedTransitionDraft.versionStrategy}
                  onChange={(event) =>
                    setSharedTransitionDraft((prev) =>
                      prev
                        ? { ...prev, versionStrategy: event.target.value as VersionStrategy }
                        : prev
                    )
                  }
                >
                  {versionStrategies.map((strategy) => (
                    <option key={strategy} value={strategy}>
                      {strategy}
                    </option>
                  ))}
                </select>
              </label>
            </CollapsibleSection>

            {/* Enhanced Trigger Editor for Shared Transition Trigger Type */}
            <CollapsibleSection title="Shared Transition Trigger" defaultExpanded={true}>
              <EnhancedTriggerEditor
                title=""
                triggerType={sharedTransitionDraft.triggerType}
                onTriggerTypeChange={(triggerType) =>
                  setSharedTransitionDraft((prev) =>
                    prev ? { ...prev, triggerType } : prev
                  )
                }
                duration={
                  sharedTransitionDraft.triggerType === 2 && (sharedTransitionDraft as any).duration
                    ? (sharedTransitionDraft as any).duration
                    : 'PT1H'
                }
                onDurationChange={(duration) => {
                  if (sharedTransitionDraft.triggerType === 2) {
                    setSharedTransitionDraft((prev) =>
                      prev ? { ...prev, duration } as any : prev
                    );
                  }
                }}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="Labels"
              defaultExpanded={false}
              headerActions={
                <button
                  type="button"
                  onClick={() => {
                    const newLabels = [...(sharedTransitionDraft.labels || []), { label: '', language: 'en' }];
                    setSharedTransitionDraft((prev) => (prev ? { ...prev, labels: newLabels } : prev));
                  }}
                  className="property-panel__add-button"
                >
                  +
                </button>
              }
            >
              <LabelListEditor
                title=""
                labels={sharedTransitionDraft.labels || []}
                onChange={(labels) =>
                  setSharedTransitionDraft((prev) => (prev ? { ...prev, labels } : prev))
                }
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="Rule"
              defaultExpanded={false}
              headerActions={
                !sharedTransitionDraft.rule && (
                  <button
                    type="button"
                    onClick={() => {
                      setSharedTransitionDraft((prev) => {
                        if (!prev) return prev;
                        const next = { ...prev } as SharedTransition & Record<string, unknown>;
                        next.rule = { location: './src/rules/new.csx', code: '' };
                        return next as SharedTransition;
                      });
                    }}
                    className="property-panel__add-button"
                  >
                    +
                  </button>
                )
              }
            >
              <EnhancedRuleEditor
                title=""
                rule={sharedTransitionDraft.rule}
                inlineText={sharedRuleText}
                availableRules={availableRules}
                onLoadFromFile={() => {
                  // TODO: Implement shared transition rule file loading
                  console.log('Load rule from file for shared transition');
                }}
                onChange={(rule) => {
                  setSharedTransitionDraft((prev) => {
                    if (!prev) return prev;
                    const next = { ...prev } as SharedTransition & Record<string, unknown>;
                    if (rule) {
                      next.rule = rule;
                    } else {
                      delete next.rule;
                    }
                    return next as SharedTransition;
                  });
                }}
                onInlineChange={setSharedRuleText}
                workflow={workflow}
                availableTasks={availableTasks}
                hideHeader={true}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Schema" defaultExpanded={false}>
              <ReferenceSelector
                label="Schema"
                value={sharedTransitionDraft.schema && isSchemaRef(sharedTransitionDraft.schema) ? sharedTransitionDraft.schema as ComponentReference : null}
                availableComponents={catalogs.schema || []}
                componentType="Schema"
                defaultFlow="sys-schemas"
                onChange={(reference) => {
                  setSharedTransitionDraft(prev => {
                    if (!prev) return prev;
                    return { ...prev, schema: reference };
                  });
                }}
                helpText="Select a schema to validate data sent with this shared transition"
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="On Execution Tasks"
              defaultExpanded={false}
              headerActions={
                <button
                  type="button"
                  onClick={() => {
                    const newTask = {
                      order: (sharedTransitionDraft.onExecutionTasks?.length || 0) + 1,
                      task: { ref: '' },
                      mapping: { location: './src/mappings/new.csx', code: '' }
                    };
                    const newTasks = [...(sharedTransitionDraft.onExecutionTasks || []), newTask];
                    setSharedTransitionDraft((prev) => {
                      if (!prev) return prev;
                      const next = { ...prev } as SharedTransition & Record<string, unknown>;
                      next.onExecutionTasks = newTasks;
                      return next as SharedTransition;
                    });
                  }}
                  className="property-panel__add-button"
                >
                  +
                </button>
              }
            >
              <ExecutionTaskListEditor
                title=""
                tasks={sharedTransitionDraft.onExecutionTasks}
              availableTasks={availableTasks}
              availableMappers={availableMappers}
              onLoadFromFile={(taskIndex) => {
                if (selection?.kind === 'sharedTransition') {
                  postMessage({
                    type: 'mapping:loadFromFile',
                    sharedTransitionKey: selection.transitionKey,
                    transition: sharedTransitionDraft,
                    index: taskIndex
                  });
                }
              }}
              onChange={(tasks) =>
                setSharedTransitionDraft((prev) => {
                  if (!prev) return prev;
                  const next = { ...prev } as SharedTransition & Record<string, unknown>;
                  if (!tasks) {
                    delete next.onExecutionTasks;
                  } else {
                    next.onExecutionTasks = tasks;
                  }
                  return next as SharedTransition;
                })
              }
              />
            </CollapsibleSection>

            <CollapsibleSection title="Available In States" defaultExpanded={true}>
              <div className="property-panel__group">
                <div className="property-panel__checkbox-list">
                  {workflow.attributes.states.length === 0 ? (
                    <p className="property-panel__muted">No states available in the workflow.</p>
                  ) : (
                    workflow.attributes.states
                      .filter((state) =>
                        state.stateType !== 3 && // Exclude final states (they can't have outgoing transitions)
                        (sharedTransitionDraft.target === '$self' || state.key !== sharedTransitionDraft.target) // Allow all states when target is "$self"
                      )
                      .map((state) => (
                      <label key={state.key} className="property-panel__checkbox">
                        <input
                          type="checkbox"
                          checked={sharedTransitionDraft.availableIn.includes(state.key)}
                          onChange={(event) => {
                            if (event.target.checked) {
                              // Add state if not already in the list
                              if (!sharedTransitionDraft.availableIn.includes(state.key)) {
                                setSharedTransitionDraft(prev =>
                                  prev ? { ...prev, availableIn: [...prev.availableIn, state.key] } : prev
                                );
                              }
                            } else {
                              // Remove state from the list
                              setSharedTransitionDraft(prev =>
                                prev ? { ...prev, availableIn: prev.availableIn.filter(s => s !== state.key) } : prev
                              );
                            }
                          }}
                        />
                        <span>{state.key}</span>
                        {state.labels?.[0]?.label && (
                          <span className="property-panel__muted"> - {state.labels[0].label}</span>
                        )}
                      </label>
                    ))
                  )}
                </div>
                {sharedTransitionDraft.availableIn.length === 0 && (
                  <p className="property-panel__warning">
                    ⚠️ Select at least one state where this transition should be available.
                  </p>
                )}
              </div>
            </CollapsibleSection>

            <p className="property-panel__muted">
              Shared transitions can be triggered from multiple states.
            </p>

            <button type="submit" className="property-panel__submit">
              {hasUnsavedChanges ? '● Save shared transition' : 'Save shared transition'}
            </button>
          </form>
        ) : null}

        {selection?.kind === 'startTransition' && startTransitionDraft ? (
          <form className="property-panel__section" onSubmit={handleStartTransitionSubmit}>
            <h3 className="property-panel__section-title">Start Transition</h3>

            <CollapsibleSection title="Basic Properties" defaultExpanded={true}>
              <label className="property-panel__field">
                <span>Key</span>
                <input
                  type="text"
                  value={startTransitionDraft.key}
                  onChange={(event) =>
                    setStartTransitionDraft((prev) =>
                      prev ? { ...prev, key: event.target.value } : prev
                    )
                  }
                />
              </label>

              <label className="property-panel__field">
                <span>Target State</span>
                <select
                  value={startTransitionDraft.target}
                  onChange={(event) =>
                    setStartTransitionDraft((prev) =>
                      prev ? { ...prev, target: event.target.value } : prev
                    )
                  }
                >
                  <option value="">Select a state...</option>
                  {workflow.attributes.states.map((state) => (
                    <option key={state.key} value={state.key}>
                      {state.labels?.find((l) => l.language === 'en')?.label || state.key}
                    </option>
                  ))}
                </select>
              </label>

              <label className="property-panel__field">
                <span>Version strategy</span>
                <select
                  value={startTransitionDraft.versionStrategy}
                  onChange={(event) =>
                    setStartTransitionDraft((prev) =>
                      prev
                        ? { ...prev, versionStrategy: event.target.value as VersionStrategy }
                        : prev
                    )
                  }
                >
                  {versionStrategies.map((strategy) => (
                    <option key={strategy} value={strategy}>
                      {strategy}
                    </option>
                  ))}
                </select>
              </label>
            </CollapsibleSection>

            {/* Enhanced Trigger Editor for Trigger Type */}
            <CollapsibleSection title="Transition Trigger" defaultExpanded={true}>
              <EnhancedTriggerEditor
                title=""
                triggerType={startTransitionDraft.triggerType}
                onTriggerTypeChange={(triggerType) =>
                  setStartTransitionDraft((prev) =>
                    prev ? { ...prev, triggerType } : prev
                  )
                }
                duration={
                  startTransitionDraft.triggerType === 2 && (startTransitionDraft as any).duration
                    ? (startTransitionDraft as any).duration
                    : 'PT1H'
                }
                onDurationChange={(duration) => {
                  if (startTransitionDraft.triggerType === 2) {
                    setStartTransitionDraft((prev) =>
                      prev ? { ...prev, duration } as any : prev
                    );
                  }
                }}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="Labels"
              defaultExpanded={false}
            >
              <LabelListEditor
                title=""
                labels={startTransitionDraft.labels || []}
                onChange={(labels) =>
                  setStartTransitionDraft((prev) => (prev ? { ...prev, labels } : prev))
                }
              />
            </CollapsibleSection>

            <CollapsibleSection title="Execution Rule" defaultExpanded={false}>
              <EnhancedRuleEditor
                rule={startTransitionDraft.rule || null}
                availableRules={availableRules}
                initialText={ruleText}
                onRuleChange={(rule, text) => {
                  setRuleText(text);
                  setStartTransitionDraft(prev => {
                    if (!prev) return prev;
                    const next = { ...prev };
                    if (rule) {
                      next.rule = rule;
                    } else {
                      delete next.rule;
                    }
                    return next;
                  });
                }}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Schema" defaultExpanded={false}>
              <ReferenceSelector
                label="Schema"
                value={startTransitionDraft.schema && isSchemaRef(startTransitionDraft.schema) ? startTransitionDraft.schema as ComponentReference : null}
                availableComponents={catalogs.schema || []}
                componentType="Schema"
                defaultFlow="sys-schemas"
                onChange={(reference) => {
                  setStartTransitionDraft(prev => {
                    if (!prev) return prev;
                    return { ...prev, schema: reference };
                  });
                }}
                helpText="Select a schema to validate data sent with this transition"
              />
            </CollapsibleSection>

            <CollapsibleSection title="View" defaultExpanded={false}>
              <ReferenceSelector
                label="View"
                value={startTransitionDraft.view ? startTransitionDraft.view as ComponentReference : null}
                availableComponents={catalogs.view || []}
                componentType="View"
                defaultFlow="sys-views"
                onChange={(reference) => {
                  setStartTransitionDraft(prev => {
                    if (!prev) return prev;
                    const next = { ...prev } as Transition & Record<string, unknown>;
                    if (reference) {
                      next.view = reference;
                    } else {
                      delete next.view;
                    }
                    return next as Transition;
                  });
                }}
                helpText="Select a UI view for this transition"
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="Execution Tasks"
              defaultExpanded={false}
              headerActions={
                <button
                  type="button"
                  onClick={() => {
                    const newTasks = [...(startTransitionDraft.onExecutionTasks || [])];
                    newTasks.push({ task: { key: '', domain: '', flow: 'sys-tasks', version: '' }, order: newTasks.length + 1 });
                    setStartTransitionDraft((prev) => {
                      if (!prev) return prev;
                      const next = { ...prev } as Transition & Record<string, unknown>;
                      next.onExecutionTasks = newTasks;
                      return next as Transition;
                    });
                  }}
                  className="property-panel__add-button"
                >
                  +
                </button>
              }
            >
              <ExecutionTaskListEditor
                title=""
                tasks={startTransitionDraft.onExecutionTasks}
                availableTasks={availableTasks}
                availableMappers={availableMappers}
                onLoadFromFile={(taskIndex) => {
                  if (selection?.kind === 'startTransition') {
                    postMessage({
                      type: 'mapping:loadFromFile',
                      startTransitionKey: selection.transitionKey,
                      transition: startTransitionDraft,
                      index: taskIndex
                    });
                  }
                }}
                onChange={(tasks) =>
                  setStartTransitionDraft((prev) => {
                    if (!prev) return prev;
                    const next = { ...prev } as Transition & Record<string, unknown>;
                    if (!tasks) {
                      delete next.onExecutionTasks;
                    } else {
                      next.onExecutionTasks = tasks;
                    }
                    return next as Transition;
                  })
                }
              />
            </CollapsibleSection>

            <button type="submit" className="property-panel__submit">
              {hasUnsavedChanges ? '● Save start transition' : 'Save start transition'}
            </button>
          </form>
        ) : null}

        {selection && !stateDraft && !transitionDraft && !sharedTransitionDraft && !startTransitionDraft ? (
          <div className="property-panel__empty">
            <p>No editable properties for the current selection.</p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
