import React, { useState, useEffect, useCallback, useRef } from 'react';
import './TestRunnerApp.css';
import { SchemaFormGenerator } from './SchemaFormGenerator.js';
import { TransitionHistory, type TransitionHistoryEntry } from './TransitionHistory.js';

interface WorkflowInfo {
  key: string;
  domain: string;
  version: string;
}

interface TestStatus {
  ready: boolean;
  environment?: {
    id: string;
    name?: string;
    baseUrl: string;
    domain: string;
  };
  error?: string;
}

interface Instance {
  instanceId: string;
  currentState: string;
  data: any;
  transitions: string[];
}

interface TransitionOption {
  key: string;
  schema: any;
  type: 'start' | 'state';
  label: string;
}

declare const acquireVsCodeApi: any;
const vscode = acquireVsCodeApi();

export function TestRunnerApp() {
  const [workflow, setWorkflow] = useState<WorkflowInfo | null>(null);
  const [testStatus, setTestStatus] = useState<TestStatus | null>(null);
  const [currentInstance, setCurrentInstance] = useState<Instance | null>(null);
  const [error, setError] = useState<string | null>(null);

  // SubFlow state
  const [subFlowWorkflow, setSubFlowWorkflow] = useState<any | null>(null);
  const [subFlowInfo, setSubFlowInfo] = useState<any | null>(null);

  // Transition management
  const [startTransition, setStartTransition] = useState<{ key: string; schema: any } | null>(null);
  const [modelTransitions, setModelTransitions] = useState<Array<{ key: string; schema: any }>>([]);
  const [availableTransitions, setAvailableTransitions] = useState<TransitionOption[]>([]);
  const [selectedTransitionKey, setSelectedTransitionKey] = useState<string | null>(null);
  const [loadedSchemas, setLoadedSchemas] = useState<Record<string, any>>({});
  const [currentFormData, setCurrentFormData] = useState<any>({});

  // UI state
  const [isConnectedToCanvas, setIsConnectedToCanvas] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Attach to external instance
  const [attachInstanceId, setAttachInstanceId] = useState('');
  const [isAttaching, setIsAttaching] = useState(false);
  const [instanceList, setInstanceList] = useState<Array<{ instanceId: string; state: string; created: string }>>([]);
  const [isLoadingInstances, setIsLoadingInstances] = useState(false);
  const [showInstanceList, setShowInstanceList] = useState(false);

  // History
  const [transitionHistory, setTransitionHistory] = useState<TransitionHistoryEntry[]>([]);

  // Track the current transition to prevent stale form data updates
  const currentTransitionRef = useRef<string | null>(null);

  // Send history updates to canvas when connected
  useEffect(() => {
    if (!isConnectedToCanvas || !currentInstance || !workflow) return;

    console.log('[TestRunnerApp] Sending history update to canvas');
    vscode.postMessage({
      type: 'test:highlightHistory',
      workflowKey: workflow.key,
      history: transitionHistory.filter(h => h.status === 'success').map(h => h.transitionKey),
      currentState: currentInstance.currentState
    });
  }, [transitionHistory, isConnectedToCanvas, currentInstance, workflow]);

  // Handle messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const message = event.data;
        console.log('[TestRunnerApp] Received message:', message.type, message);

        switch (message.type) {
        case 'init':
          setWorkflow(message.workflow);
          vscode.postMessage({ type: 'ready' });
          break;

        case 'test:status':
          setTestStatus(message);
          break;

        case 'test:instanceCreated':
          setCurrentInstance({
            instanceId: message.instanceId,
            currentState: message.initialState,
            data: {},
            transitions: []
          });
          setError(null);
          setIsConnectedToCanvas(false);
          setIsSubmitting(false);

          // Update pending history entry with success response
          setTransitionHistory(prev => {
            if (prev.length > 0 && prev[prev.length - 1].status === 'pending') {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                status: 'success',
                response: {
                  instanceId: message.instanceId,
                  initialState: message.initialState
                }
              };
              return updated;
            }
            return prev;
          });
          break;

        case 'test:instanceUpdate':
          console.log('[TestRunnerApp] Instance update received:', {
            instanceId: message.instanceId,
            currentState: message.currentState,
            hasActiveCorrelations: !!message.data?.activeCorrelations,
            activeCorrelations: message.data?.activeCorrelations,
            transitions: message.transitions
          });
          setCurrentInstance({
            instanceId: message.instanceId,
            currentState: message.currentState,
            data: message.data,
            transitions: message.transitions
          });
          setIsSubmitting(false);

          // Update pending history entry with success response
          setTransitionHistory(prev => {
            if (prev.length > 0 && prev[prev.length - 1].status === 'pending') {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                status: 'success',
                response: {
                  instanceId: message.instanceId,
                  currentState: message.currentState,
                  data: message.data,
                  transitions: message.transitions
                }
              };
              return updated;
            }
            return prev;
          });
          break;

        case 'test:instanceCompleted':
          setCurrentInstance(prev => prev ? {
            ...prev,
            currentState: message.finalState,
            data: message.data,
            transitions: []
          } : null);
          // Auto-disconnect when instance completes
          if (isConnectedToCanvas) {
            vscode.postMessage({
              type: 'test:disconnectInstance'
            });
            setIsConnectedToCanvas(false);
          }
          setIsSubmitting(false);

          // Update pending history entry with completion response
          setTransitionHistory(prev => {
            if (prev.length > 0 && prev[prev.length - 1].status === 'pending') {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                status: 'success',
                response: {
                  finalState: message.finalState,
                  data: message.data,
                  completed: true
                }
              };
              return updated;
            }
            return prev;
          });
          break;

        case 'test:error':
          setError(message.error);
          setIsSubmitting(false);

          // Update history with error if there's a pending entry
          setTransitionHistory(prev => {
            if (prev.length > 0 && prev[prev.length - 1].status === 'pending') {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                status: 'error',
                error: message.error
              };
              return updated;
            }
            return prev;
          });
          break;

        case 'test:modelTransitions':
          console.log('[TestRunnerApp] Received model transitions:', message.transitions);
          setModelTransitions(message.transitions);
          break;

        case 'test:schemaLoaded':
          if (message.error) {
            console.error('[TestRunnerApp] Error loading schema:', message.error);
          } else {
            console.log('[TestRunnerApp] Schema loaded for transition:', message.transitionKey);
            setLoadedSchemas(prev => ({
              ...prev,
              [message.transitionKey]: message.schema
            }));
          }
          break;

        case 'test:startTransitionSchema':
          console.log('[TestRunnerApp] Received start transition schema:', message.startTransition);
          setStartTransition(message.startTransition);
          break;

        case 'test:subFlowModel':
          console.log('[TestRunnerApp] ✅ Received subflow model response:', {
            hasWorkflow: !!message.subFlowWorkflow,
            workflowKey: message.subFlowWorkflow?.key,
            subFlowInfo: message.subFlowInfo,
            error: message.error
          });
          if (message.error) {
            console.error('[TestRunnerApp] ❌ Error loading subflow model:', message.error);
            setSubFlowWorkflow(null);
            setSubFlowInfo(null);
          } else {
            console.log('[TestRunnerApp] ✅ Setting subflow state:', {
              workflow: message.subFlowWorkflow,
              info: message.subFlowInfo
            });
            setSubFlowWorkflow(message.subFlowWorkflow);
            setSubFlowInfo(message.subFlowInfo);
          }
          break;

        case 'test:instancesList':
          console.log('[TestRunnerApp] Received instances list:', message.instances?.length);
          setInstanceList(message.instances || []);
          setIsLoadingInstances(false);
          break;

        case 'test:attachResult':
          console.log('[TestRunnerApp] Attach result:', message);
          setIsAttaching(false);
          if (message.error) {
            setError(message.error);
          } else {
            // Set the attached instance as current
            setCurrentInstance({
              instanceId: message.instanceId,
              currentState: message.currentState,
              data: message.data || {},
              transitions: message.transitions || []
            });
            setError(null);
            // Build history from visited states
            if (message.visitedStates && message.visitedStates.length > 0) {
              const historyEntries: TransitionHistoryEntry[] = message.visitedStates.map((state: string, index: number) => ({
                timestamp: new Date().toISOString(),
                transitionKey: state,
                transitionType: index === 0 ? 'start' as const : 'state' as const,
                request: {},
                status: 'success' as const,
                response: { state }
              }));
              setTransitionHistory(historyEntries);
            }
            // Auto-connect to canvas for highlighting
            setIsConnectedToCanvas(true);
            vscode.postMessage({
              type: 'test:connectInstance',
              instanceId: message.instanceId,
              workflowKey: workflow?.key,
              stateKey: message.currentState
            });
            // Send history highlighting
            if (message.visitedStates && message.visitedStates.length > 0) {
              vscode.postMessage({
                type: 'test:highlightHistory',
                workflowKey: workflow?.key,
                history: message.visitedStates,
                currentState: message.currentState
              });
            }
          }
          break;
        }
      } catch (error) {
        console.error('[TestRunnerApp] Error handling message:', error);
        setError(error instanceof Error ? error.message : String(error));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isConnectedToCanvas, selectedTransitionKey, currentFormData]);

  // Request status on mount
  useEffect(() => {
    vscode.postMessage({ type: 'test:checkStatus' });
  }, []);

  // Request start transition schema when workflow is set
  useEffect(() => {
    if (workflow) {
      console.log('[TestRunnerApp] Requesting start transition schema for workflow:', workflow.key);
      vscode.postMessage({
        type: 'test:getStartTransitionSchema',
        workflowKey: workflow.key
      });
    }
  }, [workflow]);

  // Request model transitions when instance state changes OR when transitions are received
  useEffect(() => {
    if (currentInstance && workflow) {
      // If there's an active subflow, we need to wait for the subflow model to load
      // Then we'll request transitions from the subflow instead of the parent
      if (currentInstance.data?.activeCorrelations?.length > 0) {
        console.log('[TestRunnerApp] Active subflow detected, skipping parent workflow transition request');
        return;
      }

      // Request model transitions if we have a state
      // This handles both state changes and when API returns transitions for current state
      console.log('[TestRunnerApp] Requesting model transitions for state:', currentInstance.currentState);
      vscode.postMessage({
        type: 'test:getModelTransitions',
        workflowKey: workflow.key,
        stateKey: currentInstance.currentState
      });
    }
  }, [currentInstance?.currentState, currentInstance?.data?.activeCorrelations, currentInstance?.transitions?.length, workflow]);

  // Debug: Log subflow state changes
  useEffect(() => {
    console.log('[TestRunnerApp] SubFlow state changed:', {
      hasSubFlowWorkflow: !!subFlowWorkflow,
      subFlowWorkflowKey: subFlowWorkflow?.key,
      hasSubFlowInfo: !!subFlowInfo,
      subFlowInfo
    });
  }, [subFlowWorkflow, subFlowInfo]);

  // Detect activeCorrelations and request subflow model
  useEffect(() => {
    console.log('[TestRunnerApp] Checking for activeCorrelations:', {
      hasCurrentInstance: !!currentInstance,
      hasData: !!currentInstance?.data,
      hasActiveCorrelations: !!currentInstance?.data?.activeCorrelations,
      isArray: Array.isArray(currentInstance?.data?.activeCorrelations),
      length: currentInstance?.data?.activeCorrelations?.length,
      hasWorkflow: !!workflow,
      currentState: currentInstance?.currentState,
      activeCorrelations: currentInstance?.data?.activeCorrelations
    });

    if (currentInstance?.data?.activeCorrelations &&
        Array.isArray(currentInstance.data.activeCorrelations) &&
        currentInstance.data.activeCorrelations.length > 0 &&
        workflow) {

      // Get parent state from activeCorrelations
      const parentState = currentInstance.data.activeCorrelations[0].parentState;

      console.log('[TestRunnerApp] ✅ Active subflow detected, requesting model:', {
        workflowKey: workflow.key,
        parentState,
        subflowCurrentState: currentInstance.currentState,
        correlation: currentInstance.data.activeCorrelations[0]
      });

      // Clear parent workflow transitions when switching to subflow
      console.log('[TestRunnerApp] Clearing parent transitions for subflow switch');
      setModelTransitions([]);
      setSelectedTransitionKey(null);

      // Request subflow model for the parent state
      vscode.postMessage({
        type: 'test:getSubFlowModel',
        workflowKey: workflow.key,
        stateKey: parentState
      });
    } else {
      console.log('[TestRunnerApp] ❌ No active subflow, clearing subflow state and switching back to parent');
      // Clear subflow state when no active correlations
      setSubFlowWorkflow(null);
      setSubFlowInfo(null);
      // Clear subflow transitions to allow parent transitions to load
      if (subFlowWorkflow) {
        console.log('[TestRunnerApp] Clearing subflow transitions for parent switch');
        setModelTransitions([]);
        setSelectedTransitionKey(null);
      }
    }
  }, [currentInstance?.data?.activeCorrelations, currentInstance?.currentState, workflow]);

  // Extract transitions from subflow model when it loads
  useEffect(() => {
    if (subFlowWorkflow && subFlowInfo && currentInstance?.data?.activeCorrelations?.[0]) {
      // When activeCorrelations exists, currentInstance.currentState is the SUBFLOW's state
      const subFlowState = currentInstance.currentState;

      console.log('[TestRunnerApp] ✅ SubFlow model loaded, extracting transitions from subflow:', {
        subFlowKey: subFlowWorkflow.key,
        subFlowState,
        parentState: currentInstance.data.activeCorrelations[0].parentState,
        workflowStates: (subFlowWorkflow as any).attributes?.states?.map((s: any) => s.key)
      });

      // Extract transitions directly from the subflow workflow model
      const states = (subFlowWorkflow as any).attributes?.states || [];
      const state = states.find((s: any) => s.key === subFlowState);

      if (state) {
        const transitions = (state.transitions || []).map((t: any) => ({
          key: t.key,
          schema: t.schema
        }));

        console.log('[TestRunnerApp] ✅ Extracted subflow transitions:', {
          stateKey: subFlowState,
          transitions: transitions.map((t: any) => t.key)
        });

        // Set the transitions directly instead of requesting from ModelBridge
        setModelTransitions(transitions);
      } else {
        console.warn('[TestRunnerApp] ⚠️ State not found in subflow model:', subFlowState);
        setModelTransitions([]);
      }
    }
  }, [subFlowWorkflow, subFlowInfo, currentInstance?.data?.activeCorrelations, currentInstance?.currentState]);

  // Build available transitions list
  useEffect(() => {
    const transitions: TransitionOption[] = [];

    // Add start transition (only if no instance yet)
    if (startTransition && !currentInstance) {
      transitions.push({
        key: startTransition.key,
        schema: startTransition.schema,
        type: 'start',
        label: `${startTransition.key} (Start)`
      });
    }

    // Add state transitions
    if (modelTransitions.length > 0) {
      modelTransitions.forEach(t => {
        transitions.push({
          key: t.key,
          schema: t.schema,
          type: 'state',
          label: t.key
        });
      });
    }

    setAvailableTransitions(transitions);

    // Set default selection (first transition)
    // Also reset selection if current selection is no longer available
    if (transitions.length > 0) {
      const isCurrentSelectionValid = selectedTransitionKey &&
        transitions.some(t => t.key === selectedTransitionKey);

      if (!isCurrentSelectionValid) {
        console.log('[TestRunnerApp] Auto-selecting first transition:', transitions[0].key);
        setSelectedTransitionKey(transitions[0].key);
      }
    }
  }, [startTransition, modelTransitions, currentInstance, selectedTransitionKey]);

  // Request schema loading when selected transition changes
  useEffect(() => {
    if (!selectedTransitionKey) return;

    const selectedTransition = availableTransitions.find(t => t.key === selectedTransitionKey);
    if (selectedTransition && selectedTransition.schema && !loadedSchemas[selectedTransitionKey]) {
      console.log('[TestRunnerApp] Requesting schema for transition:', selectedTransitionKey, selectedTransition.schema);
      vscode.postMessage({
        type: 'test:loadSchema',
        transitionKey: selectedTransitionKey,
        schemaRef: selectedTransition.schema
      });
    }
  }, [selectedTransitionKey, availableTransitions, loadedSchemas]);

  // Reset form data when switching to a no-schema transition
  useEffect(() => {
    if (!selectedTransitionKey) return;

    const selectedTransition = availableTransitions.find(t => t.key === selectedTransitionKey);
    // If transition has no schema, reset form data to empty
    if (selectedTransition && !selectedTransition.schema) {
      console.log('[TestRunnerApp] No schema detected, resetting form data to {}');
      setCurrentFormData({});
    }
  }, [selectedTransitionKey, availableTransitions]);

  const handleToggleCanvasConnection = useCallback(() => {
    if (!currentInstance || !workflow) return;

    if (isConnectedToCanvas) {
      // Disconnect from canvas
      console.log('[TestRunnerApp] Disconnecting from canvas');
      vscode.postMessage({
        type: 'test:disconnectInstance'
      });
      setIsConnectedToCanvas(false);
    } else {
      // Connect to canvas
      console.log('[TestRunnerApp] Connecting to canvas');
      vscode.postMessage({
        type: 'test:connectInstance',
        instanceId: currentInstance.instanceId,
        workflowKey: workflow.key,
        stateKey: currentInstance.currentState
      });
      setIsConnectedToCanvas(true);

      // Send initial history for highlighting
      vscode.postMessage({
        type: 'test:highlightHistory',
        workflowKey: workflow.key,
        history: transitionHistory.filter(h => h.status === 'success').map(h => h.transitionKey),
        currentState: currentInstance.currentState
      });
    }
  }, [currentInstance, workflow, isConnectedToCanvas, transitionHistory]);

  // Handle attach to external instance
  const handleAttachInstance = useCallback((instanceId?: string) => {
    const idToAttach = instanceId || attachInstanceId.trim();
    if (!idToAttach || !workflow) return;

    console.log('[TestRunnerApp] Attaching to instance:', idToAttach);
    setIsAttaching(true);
    setError(null);

    vscode.postMessage({
      type: 'test:attachInstance',
      instanceId: idToAttach,
      workflowKey: workflow.key,
      domain: workflow.domain
    });
  }, [attachInstanceId, workflow]);

  // Handle list instances
  const handleListInstances = useCallback(() => {
    if (!workflow) return;

    console.log('[TestRunnerApp] Listing instances for:', workflow.key);
    setIsLoadingInstances(true);
    setShowInstanceList(true);

    vscode.postMessage({
      type: 'test:listInstances',
      workflowKey: workflow.key,
      domain: workflow.domain
    });
  }, [workflow]);

  // Handle detach (reset to initial state)
  const handleDetach = useCallback(() => {
    console.log('[TestRunnerApp] Detaching from instance');

    // Disconnect canvas highlighting
    if (isConnectedToCanvas) {
      vscode.postMessage({ type: 'test:disconnectInstance' });
      setIsConnectedToCanvas(false);
    }

    setCurrentInstance(null);
    setTransitionHistory([]);
    setModelTransitions([]);
    setSelectedTransitionKey(null);
    setSubFlowWorkflow(null);
    setSubFlowInfo(null);
    setAttachInstanceId('');
    setError(null);
  }, [isConnectedToCanvas]);

  const handleTransitionSelect = useCallback((transitionKey: string) => {
    console.log('[TestRunnerApp] Transition selected:', transitionKey);
    currentTransitionRef.current = transitionKey;
    setSelectedTransitionKey(transitionKey);
    // Don't reset currentFormData here - let SchemaFormGenerator set initial data
    // For no-schema transitions, the textarea uses defaultValue="{}"
  }, []);

  const handleFormDataChange = useCallback((data: any) => {
    console.log('[TestRunnerApp] handleFormDataChange called with:', data);
    console.log('[TestRunnerApp] Data keys:', Object.keys(data));
    setCurrentFormData(data);
  }, []);

  const handleSubmitTransition = useCallback(() => {
    if (!selectedTransitionKey || !workflow) return;

    const selectedTransition = availableTransitions.find(t => t.key === selectedTransitionKey);
    if (!selectedTransition) return;

    console.log('[TestRunnerApp] Submitting transition:', selectedTransitionKey);
    console.log('[TestRunnerApp] Current form data:', currentFormData);
    console.log('[TestRunnerApp] Form data keys:', Object.keys(currentFormData));

    setIsSubmitting(true);
    setError(null);

    // Add pending entry to history
    const historyEntry: TransitionHistoryEntry = {
      timestamp: new Date().toISOString(),
      transitionKey: selectedTransitionKey,
      transitionType: selectedTransition.type,
      request: currentFormData,
      status: 'pending'
    };

    // Clear history when starting new instance, append for state transitions
    if (selectedTransition.type === 'start') {
      setTransitionHistory([historyEntry]); // Clear old history, start fresh
    } else {
      setTransitionHistory(prev => [...prev, historyEntry]); // Append to current instance history
    }

    if (selectedTransition.type === 'start') {
      // Start new instance
      console.log('[TestRunnerApp] Starting new instance with data:', currentFormData);
      vscode.postMessage({
        type: 'test:start',
        workflowKey: workflow.key,
        domain: workflow.domain,
        version: workflow.version,
        inputData: currentFormData
      });
    } else {
      // Execute state transition
      if (!currentInstance) return;

      console.log('[TestRunnerApp] Executing transition:', selectedTransitionKey);
      vscode.postMessage({
        type: 'test:executeTransition',
        instanceId: currentInstance.instanceId,
        transitionKey: selectedTransitionKey,
        workflowKey: workflow.key,
        domain: workflow.domain,
        data: currentFormData
      });
    }
  }, [selectedTransitionKey, workflow, availableTransitions, currentFormData, currentInstance]);

  const selectedTransition = availableTransitions.find(t => t.key === selectedTransitionKey);
  const selectedSchema = selectedTransitionKey ? loadedSchemas[selectedTransitionKey] : null;

  return (
    <div className="test-runner">
      <header className="test-runner__header">
        <h2>Test & Run: {workflow?.key || 'Loading...'}</h2>
        {testStatus && (
          <div className="test-runner__status">
            {testStatus.ready ? (
              <span className="status-ready">✓ Ready ({testStatus.environment?.baseUrl})</span>
            ) : (
              <span className="status-error">{testStatus.error || 'Not configured'}</span>
            )}
          </div>
        )}
      </header>

      <main className="test-runner__content">
        {/* Attach to External Instance Section */}
        {!currentInstance && testStatus?.ready && (
          <section className="test-runner__attach-section">
            <h3>📡 Attach to Instance</h3>
            <p className="attach-description">
              Connect to an existing workflow instance (e.g. started via Postman) to visualize its state on the canvas.
            </p>
            <div className="attach-input-row">
              <input
                type="text"
                className="attach-input"
                placeholder="Enter Instance ID..."
                value={attachInstanceId}
                onChange={(e) => setAttachInstanceId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAttachInstance();
                }}
                disabled={isAttaching}
              />
              <button
                className="btn-attach"
                onClick={() => handleAttachInstance()}
                disabled={!attachInstanceId.trim() || isAttaching}
              >
                {isAttaching ? '⏳ Attaching...' : '🔗 Attach'}
              </button>
            </div>
            <div className="attach-actions">
              <button
                className="btn-list-instances"
                onClick={handleListInstances}
                disabled={isLoadingInstances}
              >
                {isLoadingInstances ? '⏳ Loading...' : '📋 List Running Instances'}
              </button>
            </div>

            {/* Instance List */}
            {showInstanceList && (
              <div className="instance-list">
                {instanceList.length === 0 && !isLoadingInstances ? (
                  <div className="instance-list-empty">No instances found for this workflow.</div>
                ) : (
                  instanceList.map(inst => (
                    <div
                      key={inst.instanceId}
                      className="instance-list-item"
                      onClick={() => handleAttachInstance(inst.instanceId)}
                    >
                      <div className="instance-list-item__id">{inst.instanceId}</div>
                      <div className="instance-list-item__info">
                        <span className="instance-list-item__state">State: {inst.state}</span>
                        <span className="instance-list-item__date">{new Date(inst.created).toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        )}

        {/* Top Bar */}
        {(availableTransitions.length > 0 || currentInstance) && (
          <div className="test-runner__topbar">
            <div className="topbar-left">
              {currentInstance && (
                <>
                  <button
                    onClick={handleToggleCanvasConnection}
                    className="btn-canvas-toggle"
                    style={{
                      background: isConnectedToCanvas ? '#fef2f2' : '#f1f5f9',
                      borderColor: isConnectedToCanvas ? '#fca5a5' : '#cbd5e1',
                      color: isConnectedToCanvas ? '#dc2626' : '#0f172a'
                    }}
                  >
                    {isConnectedToCanvas ? '⏸ Disconnect' : '▶ Connect'}
                  </button>
                  <button
                    onClick={handleDetach}
                    className="btn-canvas-toggle"
                    style={{
                      background: '#fefce8',
                      borderColor: '#fde047',
                      color: '#854d0e'
                    }}
                  >
                    ↩ Detach
                  </button>
                </>
              )}
            </div>
            <div className="topbar-right">
              {availableTransitions.length > 0 && (
                <select
                  className="transition-select"
                  value={selectedTransitionKey || ''}
                  onChange={(e) => handleTransitionSelect(e.target.value)}
                >
                  {availableTransitions.map(t => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="error-message">{error}</div>
        )}

        {/* Form Section */}
        {selectedTransition && (
          <section className="test-runner__form-section">
            <h3>{selectedTransition.label}</h3>

            {selectedSchema ? (
              <SchemaFormGenerator
                key={selectedTransitionKey}
                schema={selectedSchema}
                onDataChange={handleFormDataChange}
              />
            ) : (
              <textarea
                key={selectedTransitionKey}
                className="test-runner__json-editor"
                defaultValue="{}"
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setCurrentFormData(parsed);
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
                placeholder='{"key": "value"}'
                rows={10}
              />
            )}

            <button
              onClick={handleSubmitTransition}
              disabled={!testStatus?.ready || isSubmitting}
              className="btn-submit"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </section>
        )}

        {/* Instance Info Section */}
        {currentInstance && (
          <section className="test-runner__instance-section">
            <h3>Instance: {currentInstance.instanceId}</h3>
            <div className="instance-state">
              <strong>Current State:</strong> {currentInstance.currentState}
            </div>

            {/* SubFlow Badge */}
            {subFlowWorkflow && subFlowInfo && (
              <div className="subflow-badge" style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                fontSize: '13px'
              }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong style={{ color: '#1e40af' }}>🔄 Active SubFlow</strong>
                </div>
                <div style={{ marginLeft: '20px' }}>
                  <div><strong>Workflow:</strong> {subFlowWorkflow.key}</div>
                  <div><strong>Domain:</strong> {subFlowWorkflow.domain}</div>
                  <div><strong>Type:</strong> {subFlowInfo.type === 'S' ? 'SubFlow (Synchronous)' : subFlowInfo.type === 'P' ? 'SubProcess (Asynchronous)' : subFlowInfo.type}</div>
                  {currentInstance.data?.activeCorrelations?.[0] && (
                    <>
                      <div><strong>Instance ID:</strong> {currentInstance.data.activeCorrelations[0].subFlowInstanceId}</div>
                      <div><strong>Correlation ID:</strong> {currentInstance.data.activeCorrelations[0].correlationId}</div>
                    </>
                  )}
                </div>
                <div style={{
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: '1px solid #bfdbfe',
                  color: '#64748b',
                  fontSize: '12px'
                }}>
                  ℹ️ Transitions shown are from the active subflow
                </div>
              </div>
            )}

            <details>
              <summary>Parent Instance Data</summary>
              <pre className="json-viewer">{JSON.stringify(currentInstance.data, null, 2)}</pre>
            </details>

            {/* SubFlow Correlation Data */}
            {currentInstance.data?.activeCorrelations?.[0] && (
              <>
                <details style={{ marginTop: '12px' }}>
                  <summary>SubFlow Correlation Info</summary>
                  <pre className="json-viewer">{JSON.stringify({
                    correlationId: currentInstance.data.activeCorrelations[0].correlationId,
                    parentState: currentInstance.data.activeCorrelations[0].parentState,
                    subFlowInstanceId: currentInstance.data.activeCorrelations[0].subFlowInstanceId,
                    subFlowType: currentInstance.data.activeCorrelations[0].subFlowType,
                    subFlowDomain: currentInstance.data.activeCorrelations[0].subFlowDomain,
                    subFlowName: currentInstance.data.activeCorrelations[0].subFlowName,
                    subFlowVersion: currentInstance.data.activeCorrelations[0].subFlowVersion,
                    isCompleted: currentInstance.data.activeCorrelations[0].isCompleted,
                    status: currentInstance.data.activeCorrelations[0].status,
                    currentState: currentInstance.data.activeCorrelations[0].currentState
                  }, null, 2)}</pre>
                </details>

                {/* SubFlow Instance Data */}
                {currentInstance.data.activeCorrelations[0].subflowData && (
                  <details style={{ marginTop: '12px' }} open>
                    <summary>SubFlow Instance Data</summary>
                    <pre className="json-viewer">{JSON.stringify(currentInstance.data.activeCorrelations[0].subflowData, null, 2)}</pre>
                  </details>
                )}
              </>
            )}
          </section>
        )}

        {/* Transition History Section */}
        {transitionHistory.length > 0 && (
          <section className="test-runner__history-section">
            <h3>Transition History</h3>
            <TransitionHistory history={transitionHistory} />
          </section>
        )}
      </main>
    </div>
  );
}
