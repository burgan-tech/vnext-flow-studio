import React, { useState, useEffect, useCallback, useRef } from 'react';
import './InstanceMonitorApp.css';

interface WorkflowInfo {
  key: string;
  domain: string;
  version: string;
}

interface EnvironmentInfo {
  id: string;
  name: string;
  baseUrl: string;
  hasClickHouse: boolean;
}

interface InstanceSummary {
  instanceId: string;
  state: string;
  status: string;
  created: string;
  durationSeconds?: number;
}

interface TransitionRecord {
  fromState: string;
  toState: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  transitionId: string;
}

interface InstanceDetail {
  instanceId: string;
  currentState: string;
  status: string;
  data: any;
  transitions: string[];
  visitedStates: string[];
  transitionHistory: TransitionRecord[];
  isFinal: boolean;
  activeCorrelations?: any[];
  error?: string;
}

interface WorkflowStats {
  total: number;
  active: number;
  completed: number;
  failed: number;
  avgDuration: number;
}

const SIDEBAR_DEFAULT_WIDTH = 320;
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 600;

declare const acquireVsCodeApi: any;
const vscode = acquireVsCodeApi();

export function InstanceMonitorApp() {
  const [workflow, setWorkflow] = useState<WorkflowInfo | null>(null);
  const [instances, setInstances] = useState<InstanceSummary[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<InstanceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // Environment state
  const [environments, setEnvironments] = useState<EnvironmentInfo[]>([]);
  const [activeEnvironment, setActiveEnvironment] = useState<string | null>(null);
  const [hasClickHouse, setHasClickHouse] = useState(false);

  // Data source info
  const [dataSource, setDataSource] = useState<'clickhouse' | 'api' | null>(null);

  // Workflow stats
  const [workflowStats, setWorkflowStats] = useState<WorkflowStats | null>(null);

  // Connection status
  const [apiConnected, setApiConnected] = useState(false);
  const [clickhouseConnected, setClickhouseConnected] = useState(false);

  // Setup screen state
  const [showSetup, setShowSetup] = useState(true);
  const [setupBaseUrl, setSetupBaseUrl] = useState('http://localhost:4201');
  const [setupName, setSetupName] = useState('');
  const [setupSaving, setSetupSaving] = useState(false);

  // Auto-detect banner
  const [autoDetectedUrl, setAutoDetectedUrl] = useState<string | null>(null);

  // Environment edit state
  const [showEnvEdit, setShowEnvEdit] = useState(false);
  const [editEnvId, setEditEnvId] = useState('');
  const [editBaseUrl, setEditBaseUrl] = useState('');
  const [editName, setEditName] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Status filter
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Monitoring overlay state
  const [isShowingOnFlow, setIsShowingOnFlow] = useState(false);

  // Per-state data inspector
  const [selectedJourneyState, setSelectedJourneyState] = useState<string | null>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; instanceId: string } | null>(null);

  // Pagination
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; totalCount: number; totalPages: number; hasNext?: boolean; hasPrev?: boolean } | null>(null);

  // Resizable sidebar
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [isResizingState, setIsResizingState] = useState(false);
  const isResizing = useRef(false);
  const bodyLeftRef = useRef(0);
  const monitorBodyRef = useRef<HTMLDivElement>(null);

  // Resize handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      e.preventDefault();
      const newWidth = e.clientX - bodyLeftRef.current;
      setSidebarWidth(Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        setIsResizingState(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    bodyLeftRef.current = monitorBodyRef.current?.getBoundingClientRect().left ?? 0;
    isResizing.current = true;
    setIsResizingState(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleResizeKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 50 : 10;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSidebarWidth(prev => Math.min(SIDEBAR_MAX_WIDTH, prev + step));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSidebarWidth(prev => Math.max(SIDEBAR_MIN_WIDTH, prev - step));
    }
  }, []);

  // Handle messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const message = event.data;
        console.log('[InstanceMonitor] Received message:', message.type);

        switch (message.type) {
          case 'init':
            console.log('[InstanceMonitor] init received — workflow:', JSON.stringify(message.workflow), 'hasEnvironment:', message.hasEnvironment, 'activeEnv:', message.activeEnvironment);
            setWorkflow(message.workflow);
            if (message.environments) {
              setEnvironments(message.environments);
            }
            if (message.activeEnvironment) {
              setActiveEnvironment(message.activeEnvironment);
              const env = message.environments?.find((e: EnvironmentInfo) => e.id === message.activeEnvironment);
              if (env) {
                setHasClickHouse(env.hasClickHouse);
              }
            }
            // Show setup screen if no environment configured
            setShowSetup(message.hasEnvironment === false);
            // Auto-detect banner
            if (message.autoDetected && message.autoDetectedUrl) {
              setAutoDetectedUrl(message.autoDetectedUrl);
              setTimeout(() => setAutoDetectedUrl(null), 6000);
            }
            vscode.postMessage({ type: 'ready' });
            break;

          case 'test:status':
            setApiConnected(message.ready === true);
            setClickhouseConnected(message.clickhouseAvailable === true);
            // If API is connected and we were on setup screen, auto-transition to main UI
            if (message.ready === true) {
              setShowSetup(false);
            }
            break;

          case 'monitor:instancesList':
            console.log('[InstanceMonitor] instancesList received — count:', (message.instances || []).length, 'source:', message.source, 'pagination:', JSON.stringify(message.pagination));
            setInstances(message.instances || []);
            if (message.pagination) {
              setPagination(message.pagination);
            }
            setIsLoading(false);
            setLastRefresh(new Date().toLocaleTimeString());
            if (message.source) {
              setDataSource(message.source);
            }
            break;

          case 'monitor:instanceDetail':
            setSelectedInstance(message.detail);
            setError(null);
            break;

          case 'monitor:instanceUpdate':
            // Update selected instance when polling returns new data
            setSelectedInstance(prev => {
              if (prev && message.instanceId === prev.instanceId) {
                return {
                  ...prev,
                  currentState: message.currentState,
                  status: message.status || prev.status,
                  data: message.data || prev.data,
                  transitions: message.transitions || prev.transitions,
                  visitedStates: message.visitedStates || prev.visitedStates,
                  isFinal: message.isFinal ?? prev.isFinal,
                  activeCorrelations: message.activeCorrelations
                };
              }
              return prev;
            });

            // Also update the instance in the list
            setInstances(prev => prev.map(inst =>
              inst.instanceId === message.instanceId
                ? { ...inst, state: message.currentState, status: message.status || inst.status }
                : inst
            ));
            break;

          case 'monitor:environmentChanged':
            setActiveEnvironment(message.environmentId);
            setHasClickHouse(!!message.hasClickHouse);
            break;

          case 'monitor:workflowStats':
            if (message.stats) {
              setWorkflowStats(message.stats);
            }
            break;

          case 'monitor:environmentSaved':
            setShowSetup(false);
            setSetupSaving(false);
            setError(null);
            break;

          case 'monitor:environmentUpdated':
            setShowEnvEdit(false);
            setEditSaving(false);
            setError(null);
            break;

          case 'monitor:environmentDetail':
            if (message.env) {
              setEditEnvId(message.env.id);
              setEditBaseUrl(message.env.baseUrl || '');
              setEditName(message.env.name || '');
              setShowEnvEdit(true);
            }
            break;

          case 'monitor:showOnFlowResult':
            if (message.success) {
              setIsShowingOnFlow(true);
            }
            break;

          case 'monitor:pollingError':
            // Polling stopped due to consecutive errors — update UI
            setSelectedInstance(prev => {
              if (prev && message.instanceId === prev.instanceId) {
                return { ...prev, error: message.error };
              }
              return prev;
            });
            setAutoRefresh(false);
            break;

          case 'monitor:error':
            console.error('[InstanceMonitor] Error from extension:', message.error);
            setError(message.error);
            setIsLoading(false);
            setSetupSaving(false);
            break;
        }
      } catch (err) {
        console.error('[InstanceMonitor] Error handling message:', err);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Request status on mount
  useEffect(() => {
    vscode.postMessage({ type: 'monitor:checkStatus' });
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && workflow) {
      autoRefreshRef.current = setInterval(() => {
        handleRefreshInstances();
      }, 5000);

      return () => {
        if (autoRefreshRef.current) {
          clearInterval(autoRefreshRef.current);
        }
      };
    } else {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    }
  }, [autoRefresh, workflow]);

  // Fetch instances on workflow init
  useEffect(() => {
    if (workflow) {
      handleRefreshInstances();
      // Also fetch stats if ClickHouse is available
      if (hasClickHouse) {
        vscode.postMessage({
          type: 'monitor:getWorkflowStats',
          workflowKey: workflow.key
        });
      }
    }
  }, [workflow, hasClickHouse]);

  const handleRefreshInstances = useCallback((_keepPage?: boolean) => {
    if (!workflow) {
      console.warn('[InstanceMonitor] handleRefreshInstances called but workflow is null');
      return;
    }
    console.log('[InstanceMonitor] handleRefreshInstances — workflow:', workflow.key, 'domain:', workflow.domain);
    setIsLoading(true);
    vscode.postMessage({
      type: 'monitor:listInstances',
      workflowKey: workflow.key,
      domain: workflow.domain,
      page: 1,
      pageSize: 20
    });
    // Refresh stats too
    if (hasClickHouse) {
      vscode.postMessage({
        type: 'monitor:getWorkflowStats',
        workflowKey: workflow.key
      });
    }
  }, [workflow, hasClickHouse]);

  const handleGoToPage = useCallback((targetPage: number) => {
    if (!workflow || !pagination) return;
    if (targetPage < 1 || targetPage > pagination.totalPages) return;
    setIsLoading(true);
    vscode.postMessage({
      type: 'monitor:listInstances',
      workflowKey: workflow.key,
      domain: workflow.domain,
      page: targetPage,
      pageSize: pagination.pageSize
    });
  }, [workflow, pagination]);

  const handleSelectInstance = useCallback((instanceId: string) => {
    if (!workflow) return;
    console.log('[InstanceMonitor] Selecting instance:', instanceId);

    // Find the instance in the list to pass fallback info
    const inst = instances.find(i => i.instanceId === instanceId);

    vscode.postMessage({
      type: 'monitor:getInstanceDetail',
      instanceId,
      workflowKey: workflow.key,
      domain: workflow.domain,
      // Fallback info from list (used if /functions/state fails)
      currentState: inst?.state,
      status: inst?.status
    });
  }, [workflow, instances]);

  const handleHighlightOnCanvas = useCallback(() => {
    if (!selectedInstance || !workflow) return;

    if (isHighlighting) {
      vscode.postMessage({ type: 'monitor:clearHighlight' });
      setIsHighlighting(false);
    } else {
      vscode.postMessage({
        type: 'monitor:highlightInstance',
        instanceId: selectedInstance.instanceId,
        workflowKey: workflow.key,
        currentState: selectedInstance.currentState,
        visitedStates: selectedInstance.visitedStates || []
      });
      setIsHighlighting(true);
    }
  }, [selectedInstance, workflow, isHighlighting]);

  const handleShowOnFlow = useCallback((instanceId?: string) => {
    if (!workflow) return;
    const iid = instanceId || selectedInstance?.instanceId;
    if (!iid) return;

    if (isShowingOnFlow) {
      // Clear overlay
      vscode.postMessage({ type: 'monitor:clearOverlay' });
      setIsShowingOnFlow(false);
    } else {
      // Find fallback info from list or selected instance
      const inst = instances.find(i => i.instanceId === iid);
      vscode.postMessage({
        type: 'monitor:showOnFlow',
        instanceId: iid,
        workflowKey: workflow.key,
        domain: workflow.domain,
        // Fallback info (used if /functions/state fails)
        currentState: selectedInstance?.currentState || inst?.state,
        status: selectedInstance?.status || inst?.status
      });
    }
  }, [selectedInstance, workflow, isShowingOnFlow, instances]);

  const handleContextMenu = useCallback((e: React.MouseEvent, instanceId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, instanceId });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleCopyInstanceId = useCallback((instanceId: string) => {
    navigator.clipboard.writeText(instanceId);
    setContextMenu(null);
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  const handleStartPolling = useCallback(() => {
    if (!selectedInstance || !workflow) return;

    vscode.postMessage({
      type: 'monitor:startPolling',
      instanceId: selectedInstance.instanceId,
      workflowKey: workflow.key,
      domain: workflow.domain
    });
  }, [selectedInstance, workflow]);

  const handleSwitchEnvironment = useCallback((envId: string) => {
    vscode.postMessage({
      type: 'monitor:switchEnvironment',
      environmentId: envId
    });
  }, []);

  const handleSaveEnvironment = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!setupBaseUrl.trim()) return;
    setSetupSaving(true);
    setError(null);
    vscode.postMessage({
      type: 'monitor:saveEnvironment',
      baseUrl: setupBaseUrl.trim(),
      name: setupName.trim() || 'Local Development'
    });
  }, [setupBaseUrl, setupName]);

  const handleOpenEnvEdit = useCallback(() => {
    if (!activeEnvironment || environments.length === 0) return;
    const activeEnv = environments.find(e => e.id === activeEnvironment);
    if (activeEnv) {
      setEditEnvId(activeEnv.id);
      setEditBaseUrl(activeEnv.baseUrl);
      setEditName(activeEnv.name);
      setShowEnvEdit(true);
    }
  }, [activeEnvironment, environments]);

  const handleUpdateEnvironment = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!editBaseUrl.trim()) return;
    setEditSaving(true);
    setError(null);
    vscode.postMessage({
      type: 'monitor:updateEnvironment',
      envId: editEnvId,
      baseUrl: editBaseUrl.trim(),
      name: editName.trim() || 'Local Development'
    });
  }, [editEnvId, editBaseUrl, editName]);

  const handleDeleteEnvironment = useCallback(() => {
    if (!editEnvId) return;
    vscode.postMessage({
      type: 'monitor:deleteEnvironment',
      envId: editEnvId
    });
    setShowEnvEdit(false);
  }, [editEnvId]);

  // Filter instances by search + status
  const filteredInstances = instances.filter(inst => {
    // Status filter
    if (statusFilter === 'done') {
      if (inst.status !== 'C' && inst.status !== 'F') return false;
    } else if (statusFilter !== 'all' && inst.status !== statusFilter) return false;
    // Search filter
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return inst.instanceId.toLowerCase().includes(q) ||
           inst.state.toLowerCase().includes(q);
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'A': return { label: 'Active', className: 'status-active' };
      case 'C': return { label: 'Completed', className: 'status-completed' };
      case 'F': return { label: 'Finished', className: 'status-completed' }; // F=Finished (final state reached)
      case 'S': return { label: 'Suspended', className: 'status-suspended' };
      default: return { label: status || 'Unknown', className: 'status-unknown' };
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const statusCounts = {
    all: instances.length,
    A: instances.filter(i => i.status === 'A').length,
    done: instances.filter(i => i.status === 'C' || i.status === 'F').length, // C=Completed, F=Finished — both are done
    S: instances.filter(i => i.status === 'S').length,
  };

  // ── Setup Screen ──────────────────────────────────────
  if (showSetup) {
    return (
      <div className="instance-monitor">
        <div className="setup-screen">
          <div className="setup-card">
            <div className="setup-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <h2>Runtime Connection Required</h2>
            <p className="setup-desc">
              Instance Monitor connects to the Amorphie workflow runtime API to list and track workflow instances.
            </p>
            <form className="setup-form" onSubmit={handleSaveEnvironment}>
              <div className="setup-field">
                <label htmlFor="setup-url">Runtime API URL</label>
                <input
                  id="setup-url"
                  type="url"
                  value={setupBaseUrl}
                  onChange={(e) => setSetupBaseUrl(e.target.value)}
                  placeholder="http://localhost:4201"
                  required
                  autoFocus
                />
              </div>
              <div className="setup-field">
                <label htmlFor="setup-name">Environment Name <span className="setup-optional">(optional)</span></label>
                <input
                  id="setup-name"
                  type="text"
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  placeholder="Local Development"
                />
              </div>
              {error && <div className="setup-error">{error}</div>}
              <button type="submit" className="setup-btn" disabled={setupSaving || !setupBaseUrl.trim()}>
                {setupSaving ? 'Connecting...' : 'Connect'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Monitor UI ──────────────────────────────────
  return (
    <div className="instance-monitor">
      {/* Header */}
      <header className="monitor-header">
        <div className="monitor-header__left">
          <h2>Instance Monitor</h2>
          <span className="monitor-header__workflow">{workflow?.key || 'Loading...'}</span>
          {/* Connection indicators */}
          <div className="connection-indicators">
            <span className={`conn-dot ${apiConnected ? 'conn-dot--ok' : 'conn-dot--err'}`}
                  title={apiConnected ? 'API Connected' : 'API Disconnected'}>
              API
            </span>
            {hasClickHouse && (
              <span className={`conn-dot ${clickhouseConnected ? 'conn-dot--ok' : 'conn-dot--err'}`}
                    title={clickhouseConnected ? 'ClickHouse Connected' : 'ClickHouse Disconnected'}>
                CH
              </span>
            )}
          </div>
        </div>
        <div className="monitor-header__actions">
          {/* Environment Selector */}
          {environments.length > 0 && (
            <div className="env-selector">
              <select
                className="env-select"
                value={activeEnvironment || ''}
                onChange={(e) => handleSwitchEnvironment(e.target.value)}
              >
                {environments.map(env => (
                  <option key={env.id} value={env.id}>
                    {env.name} {env.hasClickHouse ? '(CH)' : ''}
                  </option>
                ))}
              </select>
              <button
                className="btn-env-edit"
                onClick={handleOpenEnvEdit}
                title="Edit Environment"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            </div>
          )}
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Auto</span>
          </label>
          <button
            className="btn-refresh"
            onClick={handleRefreshInstances}
            disabled={isLoading}
          >
            {isLoading ? '...' : 'Refresh'}
          </button>
        </div>
      </header>

      {/* Auto-detect banner */}
      {autoDetectedUrl && (
        <div className="auto-detect-banner">
          <span className="auto-detect-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </span>
          Auto-connected to runtime at <strong>{autoDetectedUrl}</strong>
        </div>
      )}

      {/* Environment Edit Panel */}
      {showEnvEdit && (
        <div className="env-edit-panel">
          <div className="env-edit-header">
            <h4>Edit Environment</h4>
            <button className="env-edit-close" onClick={() => setShowEnvEdit(false)} title="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <form className="env-edit-form" onSubmit={handleUpdateEnvironment}>
            <div className="setup-field">
              <label htmlFor="edit-url">Runtime API URL</label>
              <input
                id="edit-url"
                type="url"
                value={editBaseUrl}
                onChange={(e) => setEditBaseUrl(e.target.value)}
                placeholder="http://localhost:4201"
                required
              />
            </div>
            <div className="setup-field">
              <label htmlFor="edit-name">Environment Name</label>
              <input
                id="edit-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Local Development"
              />
            </div>
            {error && <div className="setup-error">{error}</div>}
            <div className="env-edit-actions">
              <button type="submit" className="setup-btn" disabled={editSaving || !editBaseUrl.trim()}>
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" className="btn-env-delete" onClick={handleDeleteEnvironment}>
                Delete
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats Bar */}
      {workflowStats && (
        <div className="stats-bar">
          <div className="stats-bar__item">
            <span className="stats-bar__value">{workflowStats.total}</span>
            <span className="stats-bar__label">Total</span>
          </div>
          <div className="stats-bar__item stats-bar__item--active">
            <span className="stats-bar__value">{workflowStats.active}</span>
            <span className="stats-bar__label">Active</span>
          </div>
          <div className="stats-bar__item stats-bar__item--completed">
            <span className="stats-bar__value">{workflowStats.completed}</span>
            <span className="stats-bar__label">Completed</span>
          </div>
          <div className="stats-bar__item stats-bar__item--failed">
            <span className="stats-bar__value">{workflowStats.failed}</span>
            <span className="stats-bar__label">Failed</span>
          </div>
          <div className="stats-bar__item">
            <span className="stats-bar__value">{formatDuration(workflowStats.avgDuration)}</span>
            <span className="stats-bar__label">Avg Duration</span>
          </div>
        </div>
      )}

      <div className={`monitor-body ${isResizingState ? 'monitor-body--resizing' : ''}`} ref={monitorBodyRef}>
        {/* Left: Instance List */}
        <aside className="monitor-sidebar" style={{ width: sidebarWidth }}>
          <div className="sidebar-header">
            <input
              type="text"
              className="search-input"
              placeholder="Search by ID or state..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {/* Status filter tabs */}
            <div className="status-filter-tabs">
              <button
                className={`filter-tab ${statusFilter === 'all' ? 'filter-tab--active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                All ({statusCounts.all})
              </button>
              <button
                className={`filter-tab filter-tab--blue ${statusFilter === 'A' ? 'filter-tab--active' : ''}`}
                onClick={() => setStatusFilter('A')}
              >
                Active ({statusCounts.A})
              </button>
              <button
                className={`filter-tab filter-tab--green ${statusFilter === 'done' ? 'filter-tab--active' : ''}`}
                onClick={() => setStatusFilter('done')}
              >
                Done ({statusCounts.done})
              </button>
              <button
                className={`filter-tab filter-tab--orange ${statusFilter === 'S' ? 'filter-tab--active' : ''}`}
                onClick={() => setStatusFilter('S')}
              >
                Suspended ({statusCounts.S})
              </button>
            </div>
            <div className="sidebar-stats">
              <span className="stat">
                {filteredInstances.length} instances{pagination?.hasNext ? '+' : ''}
              </span>
              <div className="stat-meta">
                {dataSource && (
                  <span className={`data-source-badge ${dataSource === 'clickhouse' ? 'data-source-badge--ch' : 'data-source-badge--api'}`}>
                    {dataSource === 'clickhouse' ? 'ClickHouse' : 'API'}
                  </span>
                )}
                {lastRefresh && <span className="stat-time">{lastRefresh}</span>}
              </div>
            </div>
          </div>
          <div className="instance-list-container">
            {filteredInstances.length === 0 ? (
              <div className="empty-state">
                {isLoading ? (
                  <div className="loading-spinner">Loading instances...</div>
                ) : (
                  <>
                    <div className="empty-icon">
                      {statusFilter !== 'all' ? '🔍' : '📭'}
                    </div>
                    <div className="empty-text">
                      {statusFilter !== 'all' ? 'No matching instances' : 'No instances found'}
                    </div>
                    <div className="empty-hint">
                      {statusFilter !== 'all'
                        ? 'Try a different filter or search term'
                        : 'Start a workflow via API or Test Panel'
                      }
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                {filteredInstances.map(inst => {
                  const badge = getStatusBadge(inst.status);
                  const isSelected = selectedInstance?.instanceId === inst.instanceId;
                  return (
                    <div
                      key={inst.instanceId}
                      className={`instance-card ${isSelected ? 'instance-card--selected' : ''}`}
                      onClick={() => handleSelectInstance(inst.instanceId)}
                      onContextMenu={(e) => handleContextMenu(e, inst.instanceId)}
                    >
                      <div className="instance-card__top">
                        <span className="instance-card__id">{inst.instanceId.substring(0, 12)}...</span>
                        <span className={`instance-card__status ${badge.className}`}>{badge.label}</span>
                      </div>
                      <div className="instance-card__bottom">
                        <span className="instance-card__state">{inst.state}</span>
                        <span className="instance-card__time">
                          {inst.created ? new Date(inst.created).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          }) : ''}
                        </span>
                      </div>
                      {inst.durationSeconds != null && inst.durationSeconds > 0 && (
                        <div className="instance-card__duration">
                          {formatDuration(inst.durationSeconds)}
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Pagination controls */}
                {pagination && (pagination.hasNext || pagination.hasPrev || pagination.totalPages > 1) && (
                  <div className="pagination-controls">
                    <button
                      className="pagination-btn"
                      onClick={() => handleGoToPage(pagination.page - 1)}
                      disabled={pagination.hasPrev === false || pagination.page <= 1 || isLoading}
                      title="Previous page"
                    >
                      ‹
                    </button>
                    <span className="pagination-info">
                      Page {pagination.page}
                    </span>
                    <button
                      className="pagination-btn"
                      onClick={() => handleGoToPage(pagination.page + 1)}
                      disabled={pagination.hasNext === false || isLoading}
                      title="Next page"
                    >
                      ›
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {/* Resizer Handle */}
        <div
          className="resizer-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuemin={SIDEBAR_MIN_WIDTH}
          aria-valuemax={SIDEBAR_MAX_WIDTH}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          onMouseDown={handleResizeStart}
          onKeyDown={handleResizeKeyDown}
        />

        {/* Right: Instance Detail */}
        <main className="monitor-detail">
          {error && (
            <div className="monitor-error">{error}</div>
          )}

          {!selectedInstance ? (
            <div className="detail-empty">
              <div className="detail-empty__icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <div className="detail-empty__title">Select an Instance</div>
              <div className="detail-empty__hint">
                Click on an instance from the list to view its details, transition history, and visualize it on the canvas.
              </div>
            </div>
          ) : (
            <>
              {/* Instance Header */}
              <div className="detail-header">
                <div className="detail-header__info">
                  <h3 className="detail-header__id">{selectedInstance.instanceId}</h3>
                  <div className="detail-header__meta">
                    <span className={`detail-status ${getStatusBadge(selectedInstance.status).className}`}>
                      {getStatusBadge(selectedInstance.status).label}
                    </span>
                    <span className="detail-current-state">
                      Current: <strong>{selectedInstance.currentState}</strong>
                    </span>
                    {selectedInstance.isFinal && (
                      <span className="detail-final-badge">Final</span>
                    )}
                  </div>
                </div>
                <div className="detail-header__actions">
                  <button
                    className={`btn-show-flow ${isShowingOnFlow ? 'btn-show-flow--active' : ''}`}
                    onClick={() => handleShowOnFlow()}
                    title={isShowingOnFlow ? 'Clear monitoring overlay' : 'Visualize instance path on the flow canvas'}
                  >
                    {isShowingOnFlow ? 'Exit Flow View' : 'Show on Flow'}
                  </button>
                  <button
                    className={`btn-highlight ${isHighlighting ? 'btn-highlight--active' : ''}`}
                    onClick={handleHighlightOnCanvas}
                  >
                    {isHighlighting ? 'Highlighting' : 'Show on Canvas'}
                  </button>
                  {!selectedInstance.isFinal && (
                    <button
                      className="btn-poll"
                      onClick={handleStartPolling}
                    >
                      Watch Live
                    </button>
                  )}
                </div>
              </div>

              {/* Warning when detail data is limited */}
              {selectedInstance.error && (
                <div className="detail-warning">
                  <span className="detail-warning__icon">&#9888;</span>
                  <span className="detail-warning__text">
                    Limited data available. Some features may not work for this instance.
                  </span>
                </div>
              )}

              {/* State Journey / Flow Path (clickable) */}
              <section className="detail-section">
                <h4>State Journey</h4>
                <div className="state-journey">
                  {selectedInstance.visitedStates && selectedInstance.visitedStates.length > 0 ? (
                    <div className="journey-path journey-path--vertical">
                      {selectedInstance.visitedStates.map((state, index) => {
                        const isCurrent = state === selectedInstance.currentState;
                        const isSelected = selectedJourneyState === state;
                        return (
                          <div key={`${state}-${index}`} className="journey-step">
                            <div
                              className={`journey-node journey-node--clickable ${isCurrent ? 'journey-node--current' : 'journey-node--visited'} ${isSelected ? 'journey-node--selected' : ''}`}
                              onClick={() => setSelectedJourneyState(isSelected ? null : state)}
                              title={`Click to inspect state: ${state}`}
                            >
                              <span className="journey-node__order">{index + 1}</span>
                              <span className="journey-node__dot" />
                              <span className="journey-node__label">{state}</span>
                              {isCurrent && <span className="journey-node__badge">Current</span>}
                            </div>
                            {index < selectedInstance.visitedStates.length - 1 && (
                              <div className="journey-connector" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="journey-single">
                      <div
                        className={`journey-node journey-node--current journey-node--clickable ${selectedJourneyState === selectedInstance.currentState ? 'journey-node--selected' : ''}`}
                        onClick={() => setSelectedJourneyState(selectedJourneyState === selectedInstance.currentState ? null : selectedInstance.currentState)}
                      >
                        <span className="journey-node__order">1</span>
                        <span className="journey-node__dot" />
                        <span className="journey-node__label">{selectedInstance.currentState}</span>
                        <span className="journey-node__badge">Current</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Per-State Data Inspector */}
                {selectedJourneyState && (
                  <div className="state-inspector">
                    <div className="state-inspector__header">
                      <h5>State: {selectedJourneyState}</h5>
                      <button className="state-inspector__close" onClick={() => setSelectedJourneyState(null)}>✕</button>
                    </div>
                    <div className="state-inspector__tabs">
                      <details open>
                        <summary>Instance Data</summary>
                        <pre className="data-viewer data-viewer--compact">
                          {JSON.stringify(selectedInstance.data, null, 2)}
                        </pre>
                      </details>
                      {selectedInstance.transitionHistory && selectedInstance.transitionHistory.length > 0 && (
                        <details>
                          <summary>Transitions from this state</summary>
                          <div className="state-inspector__transitions">
                            {selectedInstance.transitionHistory
                              .filter(t => t.fromState === selectedJourneyState || t.toState === selectedJourneyState)
                              .map((t, idx) => (
                                <div key={idx} className="state-inspector__transition">
                                  <span className="timeline-from">{t.fromState}</span>
                                  <span className="timeline-arrow-icon">→</span>
                                  <span className="timeline-to">{t.toState}</span>
                                  {t.durationSeconds != null && (
                                    <span className="timeline-duration">{formatDuration(t.durationSeconds)}</span>
                                  )}
                                </div>
                              ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* Transition History Timeline (ClickHouse data) */}
              {selectedInstance.transitionHistory && selectedInstance.transitionHistory.length > 0 && (
                <section className="detail-section">
                  <h4>
                    Transition History
                    <span className="section-badge">ClickHouse</span>
                  </h4>
                  <div className="transition-timeline">
                    {selectedInstance.transitionHistory.map((t, idx) => (
                      <div key={t.transitionId || idx} className="timeline-item">
                        <div className="timeline-connector">
                          <div className="timeline-dot" />
                          {idx < selectedInstance.transitionHistory.length - 1 && (
                            <div className="timeline-line" />
                          )}
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-transition">
                            <span className="timeline-from">{t.fromState}</span>
                            <span className="timeline-arrow-icon">→</span>
                            <span className="timeline-to">{t.toState}</span>
                          </div>
                          <div className="timeline-meta">
                            {t.durationSeconds != null && (
                              <span className="timeline-duration">{formatDuration(t.durationSeconds)}</span>
                            )}
                            {t.startedAt && (
                              <span className="timeline-time">
                                {new Date(t.startedAt).toLocaleString(undefined, {
                                  hour: '2-digit', minute: '2-digit', second: '2-digit'
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Available Transitions */}
              {selectedInstance.transitions && selectedInstance.transitions.length > 0 && (
                <section className="detail-section">
                  <h4>Available Transitions</h4>
                  <div className="transition-chips">
                    {selectedInstance.transitions.map(t => (
                      <span key={t} className="transition-chip">{t}</span>
                    ))}
                  </div>
                </section>
              )}

              {/* Active SubFlow */}
              {selectedInstance.activeCorrelations && selectedInstance.activeCorrelations.length > 0 && (
                <section className="detail-section">
                  <h4>Active SubFlow</h4>
                  <div className="subflow-info">
                    {selectedInstance.activeCorrelations.map((corr: any, idx: number) => (
                      <div key={idx} className="subflow-card">
                        <div className="subflow-card__row">
                          <span className="subflow-card__label">Workflow:</span>
                          <span className="subflow-card__value">{corr.subFlowName || 'N/A'}</span>
                        </div>
                        <div className="subflow-card__row">
                          <span className="subflow-card__label">Instance:</span>
                          <span className="subflow-card__value mono">{corr.subFlowInstanceId || 'N/A'}</span>
                        </div>
                        <div className="subflow-card__row">
                          <span className="subflow-card__label">Parent State:</span>
                          <span className="subflow-card__value">{corr.parentState || 'N/A'}</span>
                        </div>
                        <div className="subflow-card__row">
                          <span className="subflow-card__label">Status:</span>
                          <span className={`subflow-card__value ${corr.isCompleted ? 'text-green' : 'text-blue'}`}>
                            {corr.isCompleted ? 'Completed' : 'Active'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Instance Data */}
              <section className="detail-section">
                <h4>Instance Data</h4>
                <details>
                  <summary>View JSON</summary>
                  <pre className="data-viewer">{JSON.stringify(selectedInstance.data, null, 2)}</pre>
                </details>
              </section>
            </>
          )}
        </main>
      </div>

      {/* Context menu for instance right-click */}
      {contextMenu && (
        <div
          className="instance-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={handleCloseContextMenu}
        >
          <button
            className="instance-context-menu__item"
            onClick={() => {
              handleSelectInstance(contextMenu.instanceId);
              handleShowOnFlow(contextMenu.instanceId);
              setContextMenu(null);
            }}
          >
            Show on Flow
          </button>
          <button
            className="instance-context-menu__item"
            onClick={() => {
              handleSelectInstance(contextMenu.instanceId);
              setContextMenu(null);
            }}
          >
            View Details
          </button>
          <button
            className="instance-context-menu__item"
            onClick={() => handleCopyInstanceId(contextMenu.instanceId)}
          >
            Copy Instance ID
          </button>
        </div>
      )}
    </div>
  );
}
