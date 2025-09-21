import React, { useEffect, useMemo, useState } from 'react';
import {
  type Workflow,
  type State,
  type Transition,
  type VersionStrategy,
  type TriggerType,
  type StateType,
  type StateSubType,
  type Label,
  type ExecutionTask,
  type TaskDefinition,
  type ViewItem,
  type SchemaRef,
  type ViewRef
} from '@nextcredit/core';
import { useBridge } from '../hooks/useBridge';

export type PropertySelection =
  | { kind: 'state'; stateKey: string }
  | { kind: 'transition'; from: string; transitionKey: string }
  | null;

interface PropertyPanelProps {
  workflow: Workflow;
  selection: PropertySelection;
  collapsed: boolean;
  availableTasks: TaskDefinition[];
}

const versionStrategies: VersionStrategy[] = ['Major', 'Minor', 'Patch'];
const triggerOptions: { value: TriggerType; label: string }[] = [
  { value: 0, label: 'Manual' },
  { value: 1, label: 'Automatic' },
  { value: 2, label: 'Timeout' },
  { value: 3, label: 'Event' }
];

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

const viewTypeOptions: { value: ViewItem['viewType']; label: string }[] = [
  { value: 1, label: 'Type 1' },
  { value: 2, label: 'Type 2' },
  { value: 3, label: 'Type 3' }
];

const viewTargetOptions: { value: ViewItem['viewTarget']; label: string }[] = [
  { value: 1, label: 'Target 1' },
  { value: 2, label: 'Target 2' },
  { value: 3, label: 'Target 3' }
];

type SchemaMode = 'none' | 'reference' | 'inline';

function isSchemaRef(value: Transition['schema']): value is SchemaRef {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      'flow' in value &&
      (value as SchemaRef).flow === 'sys-schemas'
  );
}

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
        order: Number.isFinite(task.order) ? task.order : index + 1,
        task: {
          ...task.task,
          key: task.task.key?.trim() ?? '',
          domain: task.task.domain?.trim() ?? '',
          version: task.task.version?.trim() ?? '',
          flow: 'sys-tasks'
        }
      };

      if (task.mapping) {
        const location = task.mapping.location?.trim() ?? '';
        const code = task.mapping.code?.trim() ?? '';
        if (!location && !code) {
          delete result.mapping;
        } else {
          result.mapping = { location, code };
        }
      }

      return result as ExecutionTask;
    })
    .filter((task) => task.task.key || task.task.domain || task.task.version);

  return sanitized.length > 0 ? sanitized : undefined;
}

function makeTaskIdentifier(task: {
  domain?: string;
  flow?: string;
  key?: string;
  version?: string;
}): string {
  const domain = task.domain?.trim() ?? '';
  const flow = task.flow?.trim() ?? '';
  const key = task.key?.trim() ?? '';
  const version = task.version?.trim() ?? '';
  return `${domain}::${flow}::${key}::${version}`;
}

function formatTaskOptionLabel(task: TaskDefinition): string {
  const base = `${task.domain}/${task.key} @ ${task.version}`;
  const withFlow = task.flow && task.flow !== 'sys-tasks' ? `${base} (${task.flow})` : base;
  return task.title ? `${withFlow} – ${task.title}` : withFlow;
}

function sanitizeViews(views?: ViewItem[]): ViewItem[] | undefined {
  if (!views) return undefined;

  const sanitized = views.map((view) => {
    const result: ViewItem & Record<string, unknown> = {
      ...view,
      viewType: view.viewType,
      viewTarget: view.viewTarget
    };

    if (view.content?.trim()) {
      result.content = view.content;
    } else {
      delete result.content;
    }

    if (view.reference) {
      const reference: ViewRef = {
        key: view.reference.key?.trim() ?? '',
        domain: view.reference.domain?.trim() ?? '',
        version: view.reference.version?.trim() ?? '',
        flow: 'sys-views'
      };

      if (reference.key || reference.domain || reference.version) {
        result.reference = reference;
      } else {
        delete result.reference;
      }
    } else {
      delete result.reference;
    }

    return result as ViewItem;
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

  const onExit = sanitizeExecutionTasks(draft.onExit);
  if (onExit) {
    result.onExit = onExit;
  } else {
    delete result.onExit;
  }

  const onExecutionTasks = sanitizeExecutionTasks(draft.onExecutionTasks);
  if (onExecutionTasks) {
    result.onExecutionTasks = onExecutionTasks;
  } else {
    delete result.onExecutionTasks;
  }

  const views = sanitizeViews(draft.views);
  if (views) {
    result.views = views;
  } else {
    delete result.views;
  }

  if (!Array.isArray(result.labels)) {
    result.labels = [];
  }

  return result as State;
}

function sanitizeTransition(
  draft: Transition,
  mode: SchemaMode,
  inlineSchemaError: string | null
): Transition {
  const result: Transition & Record<string, unknown> = {
    ...draft,
    labels: sanitizeLabels(draft.labels)
  };

  if (!result.labels.length) {
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

  if (mode === 'none') {
    result.schema = null;
  } else if (mode === 'reference') {
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
  } else if (mode === 'inline') {
    if (!inlineSchemaError && draft.schema && !isSchemaRef(draft.schema)) {
      result.schema = draft.schema;
    } else if (inlineSchemaError) {
      result.schema = draft.schema;
    } else {
      result.schema = {};
    }
  }

  return result as Transition;
}

interface LabelListEditorProps {
  title: string;
  labels: Label[];
  onChange: (labels: Label[]) => void;
}

function LabelListEditor({ title, labels, onChange }: LabelListEditorProps) {
  const handleAdd = () => {
    onChange([...labels, { language: '', label: '' }]);
  };

  const handleRemove = (index: number) => {
    onChange(labels.filter((_, i) => i !== index));
  };

  const handleLabelChange = (index: number, field: keyof Label, value: string) => {
    onChange(
      labels.map((label, i) =>
        i === index
          ? {
              ...label,
              [field]: value
            }
          : label
      )
    );
  };

  return (
    <div className="property-panel__group">
      <div className="property-panel__group-header">
        <span>{title}</span>
        <button type="button" className="property-panel__pill-button" onClick={handleAdd}>
          Add label
        </button>
      </div>
      {labels.length === 0 ? (
        <p className="property-panel__muted">No labels configured.</p>
      ) : (
        <div className="property-panel__list">
          {labels.map((label, index) => (
            <div key={index} className="property-panel__list-item">
              <div className="property-panel__inline-fields">
                <label className="property-panel__field">
                  <span>Language</span>
                  <input
                    type="text"
                    value={label.language}
                    onChange={(event) => handleLabelChange(index, 'language', event.target.value)}
                  />
                </label>
                <label className="property-panel__field">
                  <span>Label</span>
                  <input
                    type="text"
                    value={label.label}
                    onChange={(event) => handleLabelChange(index, 'label', event.target.value)}
                  />
                </label>
              </div>
              <button
                type="button"
                className="property-panel__list-remove"
                onClick={() => handleRemove(index)}
              >
                Remove label
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ExecutionTaskListEditorProps {
  title: string;
  tasks?: ExecutionTask[];
  onChange: (tasks?: ExecutionTask[]) => void;
  availableTasks: TaskDefinition[];
  onLoadFromFile?: (index: number) => void;
}

function ExecutionTaskListEditor({ title, tasks, onChange, availableTasks, onLoadFromFile }: ExecutionTaskListEditorProps) {
  const list = tasks ?? [];

  const setTasks = (next: ExecutionTask[]) => {
    onChange(next.length > 0 ? next : undefined);
  };

  const taskLookup = useMemo(() => {
    const map = new Map<string, TaskDefinition>();
    for (const task of availableTasks) {
      map.set(makeTaskIdentifier(task), task);
    }
    return map;
  }, [availableTasks]);

  const taskOptions = useMemo(
    () =>
      availableTasks.map((task) => ({
        id: makeTaskIdentifier(task),
        label: formatTaskOptionLabel(task),
        detail: task.title ?? task.path ?? `${task.domain}/${task.key}`
      })),
    [availableTasks]
  );

  const canAdd = availableTasks.length > 0;

  const handleAdd = () => {
    if (!canAdd) return;
    const first = availableTasks[0];
    setTasks([
      ...list,
      {
        order: list.length + 1,
        task: {
          key: first.key,
          domain: first.domain,
          flow: 'sys-tasks',
          version: first.version
        }
      }
    ]);
  };

  const handleTaskChange = (
    index: number,
    updater: (task: ExecutionTask) => ExecutionTask
  ) => {
    setTasks(list.map((task, i) => (i === index ? updater(task) : task)));
  };

  const handleRemove = (index: number) => {
    setTasks(list.filter((_, i) => i !== index));
  };

  const handleAddMapping = (index: number) => {
    handleTaskChange(index, (task) => ({
      ...task,
      mapping: { location: '', code: '' }
    }));
  };

  const handleRemoveMapping = (index: number) => {
    handleTaskChange(index, (task) => {
      const next = { ...task } as ExecutionTask & Record<string, unknown>;
      delete next.mapping;
      return next as ExecutionTask;
    });
  };

  const handleMappingChange = (
    index: number,
    field: 'location' | 'code',
    value: string
  ) => {
    handleTaskChange(index, (task) => ({
      ...task,
      mapping: {
        ...(task.mapping ?? { location: '', code: '' }),
        [field]: value
      }
    }));
  };

  const handleCatalogSelect = (index: number, identifier: string) => {
    if (!identifier) {
      return;
    }

    const definition = taskLookup.get(identifier);
    if (!definition) {
      return;
    }

    handleTaskChange(index, (current) => ({
      ...current,
      task: {
        ...current.task,
        key: definition.key,
        domain: definition.domain,
        version: definition.version,
        flow: 'sys-tasks'
      }
    }));
  };

  return (
    <div className="property-panel__group">
      <div className="property-panel__group-header">
        <span>{title}</span>
        <button
          type="button"
          className="property-panel__pill-button"
          onClick={handleAdd}
          disabled={!canAdd}
          title={canAdd ? 'Add a reference to an existing task' : 'No catalog tasks available'}
        >
          Add task reference
        </button>
      </div>
      {list.length === 0 ? (
        <p className="property-panel__muted">No task references configured.</p>
      ) : (
        <div className="property-panel__list">
          {list.map((task, index) => (
            <div key={index} className="property-panel__list-item">
              <label className="property-panel__field">
                <span>Order</span>
                <input
                  type="number"
                  value={task.order}
                  onChange={(event) =>
                    handleTaskChange(index, (current) => ({
                      ...current,
                      order: Number(event.target.value)
                    }))
                  }
                />
              </label>
              <div className="property-panel__inline-fields">
                <label className="property-panel__field">
                  <span>Select task</span>
                  <select
                    value={(() => {
                      const identifier = makeTaskIdentifier(task.task);
                      return taskLookup.has(identifier) ? identifier : '';
                    })()}
                    onChange={(event) => handleCatalogSelect(index, event.target.value)}
                    disabled={taskOptions.length === 0}
                  >
                    <option value="">
                      {taskOptions.length === 0 ? 'No tasks available' : 'Select existing task…'}
                    </option>
                    {taskOptions.map((option) => (
                      <option key={option.id} value={option.id} title={option.detail}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {task.mapping ? (
                <div className="property-panel__nested">
                  <div className="property-panel__group-header">
                    <span>Mapping reference</span>
                    <div className="property-panel__group-actions">
                      <button
                        type="button"
                        className="property-panel__pill-button property-panel__pill-button--ghost"
                        onClick={() => onLoadFromFile?.(index)}
                        title="Select a .csx file and embed its base64 content"
                      >
                        Load from file…
                      </button>
                      <button
                        type="button"
                        className="property-panel__pill-button property-panel__pill-button--ghost"
                        onClick={() => handleRemoveMapping(index)}
                      >
                        Remove mapping reference
                      </button>
                    </div>
                  </div>
                  <div className="property-panel__inline-fields">
                    <label className="property-panel__field">
                      <span>Location (relative .csx)</span>
                      <input
                        type="text"
                        value={task.mapping.location}
                        onChange={(event) =>
                          handleMappingChange(index, 'location', event.target.value)
                        }
                        placeholder="./src/MyMapping.csx"
                      />
                    </label>
                    <label className="property-panel__field">
                      <span>Code (base64)</span>
                      <input
                        type="text"
                        value={task.mapping.code ? `(${task.mapping.code.length} bytes)` : ''}
                        readOnly
                        placeholder="Populated from the .csx file"
                        title="Base64-encoded content of the referenced .csx file"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="property-panel__pill-button property-panel__pill-button--ghost"
                  onClick={() => handleAddMapping(index)}
                >
                  Add mapping reference
                </button>
              )}
              <button
                type="button"
                className="property-panel__list-remove"
                onClick={() => handleRemove(index)}
              >
                Remove reference
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ViewListEditorProps {
  views?: ViewItem[];
  onChange: (views?: ViewItem[]) => void;
}

function ViewListEditor({ views, onChange }: ViewListEditorProps) {
  const list = views ?? [];

  const setViews = (next: ViewItem[]) => {
    onChange(next.length > 0 ? next : undefined);
  };

  const handleAdd = () => {
    setViews([
      ...list,
      {
        viewType: 1,
        viewTarget: 1
      }
    ]);
  };

  const handleViewChange = (
    index: number,
    updater: (view: ViewItem) => ViewItem
  ) => {
    setViews(list.map((view, i) => (i === index ? updater(view) : view)));
  };

  const handleRemove = (index: number) => {
    setViews(list.filter((_, i) => i !== index));
  };

  const handleAddReference = (index: number) => {
    handleViewChange(index, (view) => ({
      ...view,
      reference: {
        key: '',
        domain: '',
        version: '',
        flow: 'sys-views'
      }
    }));
  };

  const handleRemoveReference = (index: number) => {
    handleViewChange(index, (view) => {
      const next = { ...view } as ViewItem & Record<string, unknown>;
      delete next.reference;
      return next as ViewItem;
    });
  };

  const handleReferenceChange = (
    index: number,
    field: 'key' | 'domain' | 'version',
    value: string
  ) => {
    handleViewChange(index, (view) => {
      const current: ViewRef =
        view.reference ?? { key: '', domain: '', version: '', flow: 'sys-views' };
      return {
        ...view,
        reference: {
          ...current,
          [field]: value
        }
      };
    });
  };

  return (
    <div className="property-panel__group">
      <div className="property-panel__group-header">
        <span>Views</span>
        <button type="button" className="property-panel__pill-button" onClick={handleAdd}>
          Add view
        </button>
      </div>
      {list.length === 0 ? (
        <p className="property-panel__muted">No views configured.</p>
      ) : (
        <div className="property-panel__list">
          {list.map((view, index) => (
            <div key={index} className="property-panel__list-item">
              <div className="property-panel__inline-fields">
                <label className="property-panel__field">
                  <span>View type</span>
                  <select
                    value={view.viewType}
                    onChange={(event) =>
                      handleViewChange(index, (current) => ({
                        ...current,
                        viewType: Number(event.target.value) as ViewItem['viewType']
                      }))
                    }
                  >
                    {viewTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="property-panel__field">
                  <span>View target</span>
                  <select
                    value={view.viewTarget}
                    onChange={(event) =>
                      handleViewChange(index, (current) => ({
                        ...current,
                        viewTarget: Number(event.target.value) as ViewItem['viewTarget']
                      }))
                    }
                  >
                    {viewTargetOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="property-panel__field">
                <span>Content</span>
                <textarea
                  value={view.content ?? ''}
                  placeholder="Optional"
                  onChange={(event) =>
                    handleViewChange(index, (current) => ({
                      ...current,
                      content: event.target.value
                    }))
                  }
                />
              </label>
              {view.reference ? (
                <div className="property-panel__nested">
                  <div className="property-panel__group-header">
                    <span>Reference</span>
                    <button
                      type="button"
                      className="property-panel__pill-button property-panel__pill-button--ghost"
                      onClick={() => handleRemoveReference(index)}
                    >
                      Remove reference
                    </button>
                  </div>
                  <div className="property-panel__inline-fields">
                    <label className="property-panel__field">
                      <span>Key</span>
                      <input
                        type="text"
                        value={view.reference.key}
                        onChange={(event) =>
                          handleReferenceChange(index, 'key', event.target.value)
                        }
                      />
                    </label>
                    <label className="property-panel__field">
                      <span>Domain</span>
                      <input
                        type="text"
                        value={view.reference.domain}
                        onChange={(event) =>
                          handleReferenceChange(index, 'domain', event.target.value)
                        }
                      />
                    </label>
                    <label className="property-panel__field">
                      <span>Version</span>
                      <input
                        type="text"
                        value={view.reference.version}
                        onChange={(event) =>
                          handleReferenceChange(index, 'version', event.target.value)
                        }
                      />
                    </label>
                    <label className="property-panel__field">
                      <span>Flow</span>
                      <input type="text" value="sys-views" readOnly />
                    </label>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="property-panel__pill-button property-panel__pill-button--ghost"
                  onClick={() => handleAddReference(index)}
                >
                  Add reference
                </button>
              )}
              <button
                type="button"
                className="property-panel__list-remove"
                onClick={() => handleRemove(index)}
              >
                Remove view
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SchemaEditorProps {
  mode: SchemaMode;
  schema: Transition['schema'];
  inlineText: string;
  inlineError: string | null;
  onModeChange: (mode: SchemaMode) => void;
  onReferenceChange: (field: 'key' | 'domain' | 'version', value: string) => void;
  onInlineChange: (value: string) => void;
}

function SchemaEditor({
  mode,
  schema,
  inlineText,
  inlineError,
  onModeChange,
  onReferenceChange,
  onInlineChange
}: SchemaEditorProps) {
  const schemaRef: SchemaRef = isSchemaRef(schema)
    ? schema
    : {
        key: '',
        domain: '',
        version: '',
        flow: 'sys-schemas'
      };

  return (
    <div className="property-panel__group">
      <div className="property-panel__group-header">
        <span>Schema</span>
      </div>
      <div className="property-panel__radio-group">
        <label className="property-panel__radio">
          <input
            type="radio"
            name="schema-mode"
            value="none"
            checked={mode === 'none'}
            onChange={() => onModeChange('none')}
          />
          None
        </label>
        <label className="property-panel__radio">
          <input
            type="radio"
            name="schema-mode"
            value="reference"
            checked={mode === 'reference'}
            onChange={() => onModeChange('reference')}
          />
          Reference
        </label>
        <label className="property-panel__radio">
          <input
            type="radio"
            name="schema-mode"
            value="inline"
            checked={mode === 'inline'}
            onChange={() => onModeChange('inline')}
          />
          Inline JSON
        </label>
      </div>
      {mode === 'reference' ? (
        <div className="property-panel__inline-fields">
          <label className="property-panel__field">
            <span>Key</span>
            <input
              type="text"
              value={schemaRef.key}
              onChange={(event) => onReferenceChange('key', event.target.value)}
            />
          </label>
          <label className="property-panel__field">
            <span>Domain</span>
            <input
              type="text"
              value={schemaRef.domain}
              onChange={(event) => onReferenceChange('domain', event.target.value)}
            />
          </label>
          <label className="property-panel__field">
            <span>Version</span>
            <input
              type="text"
              value={schemaRef.version}
              onChange={(event) => onReferenceChange('version', event.target.value)}
            />
          </label>
          <label className="property-panel__field">
            <span>Flow</span>
            <input type="text" value="sys-schemas" readOnly />
          </label>
        </div>
      ) : null}
      {mode === 'inline' ? (
        <label className="property-panel__field">
          <span>Inline schema (JSON)</span>
          <textarea value={inlineText} onChange={(event) => onInlineChange(event.target.value)} />
          {inlineError ? <span className="property-panel__error">{inlineError}</span> : null}
        </label>
      ) : null}
    </div>
  );
}

export function PropertyPanel({ workflow, selection, collapsed, availableTasks }: PropertyPanelProps) {
  const { postMessage } = useBridge();

  const panelClassName = useMemo(() => {
    return ['property-panel', collapsed ? 'property-panel--collapsed' : '']
      .filter(Boolean)
      .join(' ');
  }, [collapsed]);

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

  const [stateDraft, setStateDraft] = useState<State | null>(null);
  const [transitionDraft, setTransitionDraft] = useState<Transition | null>(null);
  const [schemaMode, setSchemaMode] = useState<SchemaMode>('none');
  const [inlineSchemaText, setInlineSchemaText] = useState('');
  const [inlineSchemaError, setInlineSchemaError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedState) {
      const clone = JSON.parse(JSON.stringify(selectedState)) as State;
      if (!Array.isArray(clone.labels)) {
        clone.labels = [];
      }
      setStateDraft(clone);
    } else {
      setStateDraft(null);
    }
  }, [selectedState]);

  useEffect(() => {
    if (selectedTransition) {
      const clone = JSON.parse(JSON.stringify(selectedTransition.transition)) as Transition;
      if (!clone.from) {
        clone.from = selectedTransition.fromState.key;
      }
      setTransitionDraft(clone);

      if (clone.schema === null || clone.schema === undefined) {
        setSchemaMode('none');
        setInlineSchemaText('');
        setInlineSchemaError(null);
      } else if (isSchemaRef(clone.schema)) {
        setSchemaMode('reference');
        setInlineSchemaText('');
        setInlineSchemaError(null);
      } else {
        setSchemaMode('inline');
        setInlineSchemaText(JSON.stringify(clone.schema, null, 2));
        setInlineSchemaError(null);
      }
    } else {
      setTransitionDraft(null);
      setSchemaMode('none');
      setInlineSchemaText('');
      setInlineSchemaError(null);
    }
  }, [selectedTransition]);

  const handleSchemaModeChange = (mode: SchemaMode) => {
    setTransitionDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev } as Transition & Record<string, unknown>;
      if (mode === 'none') {
        next.schema = null;
        setInlineSchemaText('');
        setInlineSchemaError(null);
      } else if (mode === 'reference') {
        next.schema = isSchemaRef(prev.schema)
          ? { ...prev.schema }
          : { key: '', domain: '', version: '', flow: 'sys-schemas' };
        setInlineSchemaText('');
        setInlineSchemaError(null);
      } else {
        const base = !prev.schema || isSchemaRef(prev.schema) ? {} : prev.schema;
        next.schema = base;
        setInlineSchemaText(JSON.stringify(base, null, 2));
        setInlineSchemaError(null);
      }
      return next as Transition;
    });
    setSchemaMode(mode);
  };

  const handleInlineSchemaChange = (value: string) => {
    setInlineSchemaText(value);
    const trimmed = value.trim();

    if (!trimmed) {
      setInlineSchemaError('Schema cannot be empty.');
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setInlineSchemaError('Schema must be a JSON object.');
        return;
      }
      setTransitionDraft((prev) => {
        if (!prev) return prev;
        return { ...prev, schema: parsed };
      });
      setInlineSchemaError(null);
    } catch {
      setInlineSchemaError('Invalid JSON');
    }
  };

  const handleSchemaReferenceChange = (
    field: 'key' | 'domain' | 'version',
    value: string
  ) => {
    setTransitionDraft((prev) => {
      if (!prev) return prev;
      const current = isSchemaRef(prev.schema)
        ? prev.schema
        : { key: '', domain: '', version: '', flow: 'sys-schemas' };
      return {
        ...prev,
        schema: {
          ...current,
          [field]: value,
          flow: 'sys-schemas'
        }
      };
    });
  };

  const handleStateSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selection || selection.kind !== 'state' || !stateDraft) return;

    const sanitized = sanitizeState(stateDraft);

    postMessage({
      type: 'domain:updateState',
      stateKey: selection.stateKey,
      state: sanitized
    });
  };

  const handleTransitionSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selection || selection.kind !== 'transition' || !transitionDraft) return;
    if (schemaMode === 'inline' && inlineSchemaError) return;

    const sanitized = sanitizeTransition(
      { ...transitionDraft, from: selection.from },
      schemaMode,
      inlineSchemaError
    );

    postMessage({
      type: 'domain:updateTransition',
      from: selection.from,
      transitionKey: selection.transitionKey,
      transition: sanitized
    });
  };

  const stateLabels = stateDraft?.labels ?? [];
  const transitionLabels = transitionDraft?.labels ?? [];
  const transitionHasErrors = schemaMode === 'inline' && inlineSchemaError !== null;

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
      </div>
      <div className="property-panel__content">
        {!selection ? (
          <div className="property-panel__empty">
            <p>Select a state or transition to edit its properties.</p>
          </div>
        ) : null}

        {selection?.kind === 'state' && stateDraft ? (
          <form className="property-panel__section" onSubmit={handleStateSubmit}>
            <h3 className="property-panel__section-title">{stateDraft.key}</h3>
            <label className="property-panel__field">
              <span>Key</span>
              <input type="text" value={stateDraft.key} readOnly />
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

            <LabelListEditor
              title="Labels"
              labels={stateLabels}
              onChange={(labels) =>
                setStateDraft((prev) => (prev ? { ...prev, labels } : prev))
              }
            />

            <ExecutionTaskListEditor
              title="On entry task references"
              tasks={stateDraft.onEntries}
              availableTasks={availableTasks}
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

            <ExecutionTaskListEditor
              title="On exit task references"
              tasks={stateDraft.onExit}
              availableTasks={availableTasks}
              onLoadFromFile={(taskIndex) => {
                postMessage({
                  type: 'mapping:loadFromFile',
                  stateKey: stateDraft.key,
                  list: 'onExit',
                  index: taskIndex
                });
              }}
              onChange={(tasks) =>
                setStateDraft((prev) => {
                  if (!prev) return prev;
                  const next = { ...prev } as State & Record<string, unknown>;
                  if (!tasks) {
                    delete next.onExit;
                  } else {
                    next.onExit = tasks;
                  }
                  return next as State;
                })
              }
            />

            <ExecutionTaskListEditor
              title="Execution task references"
              tasks={stateDraft.onExecutionTasks}
              availableTasks={availableTasks}
              onLoadFromFile={(taskIndex) => {
                postMessage({
                  type: 'mapping:loadFromFile',
                  stateKey: stateDraft.key,
                  list: 'onExecutionTasks',
                  index: taskIndex
                });
              }}
              onChange={(tasks) =>
                setStateDraft((prev) => {
                  if (!prev) return prev;
                  const next = { ...prev } as State & Record<string, unknown>;
                  if (!tasks) {
                    delete next.onExecutionTasks;
                  } else {
                    next.onExecutionTasks = tasks;
                  }
                  return next as State;
                })
              }
            />

            <ViewListEditor
              views={stateDraft.views}
              onChange={(views) =>
                setStateDraft((prev) => {
                  if (!prev) return prev;
                  const next = { ...prev } as State & Record<string, unknown>;
                  if (!views) {
                    delete next.views;
                  } else {
                    next.views = views;
                  }
                  return next as State;
                })
              }
            />

            <button type="submit" className="property-panel__save">
              Save state
            </button>
          </form>
        ) : null}

        {selection?.kind === 'transition' && transitionDraft ? (
          <form className="property-panel__section" onSubmit={handleTransitionSubmit}>
            <h3 className="property-panel__section-title">{transitionDraft.key}</h3>

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
              <span>Target</span>
              <input
                type="text"
                value={transitionDraft.target}
                onChange={(event) =>
                  setTransitionDraft((prev) =>
                    prev ? { ...prev, target: event.target.value } : prev
                  )
                }
              />
            </label>

            <label className="property-panel__field">
              <span>Trigger type</span>
              <select
                value={transitionDraft.triggerType}
                onChange={(event) =>
                  setTransitionDraft((prev) =>
                    prev
                      ? { ...prev, triggerType: Number(event.target.value) as TriggerType }
                      : prev
                  )
                }
              >
                {triggerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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

            <LabelListEditor
              title="Labels"
              labels={transitionLabels}
              onChange={(labels) =>
                setTransitionDraft((prev) => (prev ? { ...prev, labels } : prev))
              }
            />

            <div className="property-panel__group">
              <div className="property-panel__group-header">
                <span>Rule reference</span>
                <div className="property-panel__group-actions">
                  <button
                    type="button"
                    className="property-panel__pill-button property-panel__pill-button--ghost"
                    onClick={() =>
                      selection?.kind === 'transition' &&
                      postMessage({
                        type: 'rule:loadFromFile',
                        from: selection.from,
                        transitionKey: selection.transitionKey
                      })
                    }
                    title="Select a .csx file and embed its base64 content"
                  >
                    Load from file…
                  </button>
                  <button
                    type="button"
                    className="property-panel__pill-button property-panel__pill-button--ghost"
                    onClick={() =>
                      setTransitionDraft((prev) => {
                        if (!prev) return prev;
                        const next = { ...prev } as Transition & Record<string, unknown>;
                        delete next.rule;
                        return next as Transition;
                      })
                    }
                  >
                    Remove rule reference
                  </button>
                </div>
              </div>
              <div className="property-panel__inline-fields">
                <label className="property-panel__field">
                  <span>Location (relative .csx)</span>
                  <input
                    type="text"
                    value={transitionDraft.rule?.location ?? ''}
                    placeholder="./src/MyCondition.csx"
                    onChange={(event) =>
                      setTransitionDraft((prev) => {
                        if (!prev) return prev;
                        const location = event.target.value;
                        const code = prev.rule?.code ?? '';
                        if (!location && !code) {
                          const next = { ...prev } as Transition & Record<string, unknown>;
                          delete next.rule;
                          return next as Transition;
                        }
                        return { ...prev, rule: { location, code } };
                      })
                    }
                  />
                </label>
                <label className="property-panel__field">
                  <span>Code (base64)</span>
                  <input
                    type="text"
                    value={(() => {
                      const code = transitionDraft.rule?.code ?? '';
                      return code ? `(${code.length} bytes)` : '';
                    })()}
                    readOnly
                    placeholder="Populated from the .csx file"
                    title="Base64-encoded content of the referenced .csx file"
                  />
                </label>
              </div>
            </div>

            <SchemaEditor
              mode={schemaMode}
              schema={transitionDraft.schema}
              inlineText={inlineSchemaText}
              inlineError={inlineSchemaError}
              onModeChange={handleSchemaModeChange}
              onReferenceChange={handleSchemaReferenceChange}
              onInlineChange={handleInlineSchemaChange}
            />

            <button
              type="submit"
              className="property-panel__save"
              disabled={transitionHasErrors}
            >
              Save transition
            </button>
          </form>
        ) : null}

        {selection && !stateDraft && !transitionDraft ? (
          <div className="property-panel__empty">
            <p>No editable properties for the current selection.</p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
