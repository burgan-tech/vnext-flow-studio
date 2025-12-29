import type { Workflow, Diagram, State, Transition, SharedTransition, TaskComponentDefinition } from './types/index.js';

export type MsgToWebview =
  | {
      type: 'init';
      workflow: Workflow;
      diagram: Diagram;
      derived: { nodes: any[]; edges: any[] };
      problemsById: Record<string, any>;
      tasks: TaskComponentDefinition[];
      catalogs?: Record<string, any[]>;
      plugins?: any[];
      pluginVariants?: Record<string, any[]>;
      designHints?: Record<string, any>;
      generatedDiagram?: boolean;
    }
  | { type: 'workflow:update'; workflow: Workflow; derived: { nodes: any[]; edges: any[] } }
  | { type: 'diagram:update'; diagram: Diagram }
  | { type: 'lint:update'; problemsById: Record<string, any> }
  | { type: 'catalog:update'; tasks: TaskComponentDefinition[]; catalogs?: Record<string, any[]> }
  | { type: 'plugins:update'; plugins: any[]; variants: Record<string, any[]> }
  | { type: 'select:node'; nodeId: string }
  | { type: 'confirm:response'; save: boolean }
  | { type: 'deploy:status'; ready: boolean; configured: boolean; environment?: { id: string; name?: string; baseUrl: string }; domain?: string; apiReachable: boolean; error?: string }
  | { type: 'deploy:progress'; step: 'normalizing' | 'validating' | 'deploying' | 'completed' | 'failed'; current: number; total: number; workflow?: { key: string; domain: string; filePath: string }; message: string; percentage: number }
  | { type: 'deploy:result'; success: boolean; message: string; results?: Array<{ success: boolean; key: string; domain: string; error?: string }> }
  | { type: 'mapper:saved'; mapperRef: string; mapperId: string }
  | { type: 'editor:scriptCreated'; success: boolean; location?: string; error?: string }
  | { type: 'editor:scriptOperationResult'; success: boolean; location?: string; error?: string; action: 'created' | 'overridden' | 'failed' }
  | { type: 'editor:fileOpened'; success: boolean; error?: string }
  | { type: 'task:created'; success: boolean; filePath?: string; taskRef?: string; domain?: string; flow?: string; key?: string; version?: string; error?: string }
  | { type: 'dependency:validation'; results: Array<{ index: number; exists: boolean }> }
  | { type: 'workflow:settings'; data: { key: string; domain: string; version: string; labels?: Array<{ label: string; language: string }>; tags: string[]; type: 'C' | 'F' | 'S' | 'P'; subFlowType?: 'S' | 'P'; timeout?: any; functions?: any[]; extensions?: any[] } }
  | { type: 'workflow:settingsSaved'; success: boolean; error?: string }
  | { type: 'test:status'; ready: boolean; environment?: { id: string; name?: string; baseUrl: string; domain: string }; error?: string }
  | { type: 'test:instanceCreated'; instanceId: string; workflowKey: string; initialState: string }
  | { type: 'test:instanceUpdate'; instanceId: string; currentState: string; data: any; transitions: string[] }
  | { type: 'test:instanceCompleted'; instanceId: string; finalState: string; data: any }
  | { type: 'test:error'; instanceId?: string; error: string }
  | { type: 'test:instancesList'; instances: Array<{ instanceId: string; state: string; created: string }> }
  | { type: 'test:testCases'; testCases: Array<{ name: string; input: any; description?: string }> }
  | { type: 'test:modelTransitions'; stateKey: string; transitions: Array<{ key: string; schema: any }> }
  | { type: 'test:schemaLoaded'; transitionKey: string; schema: any; error?: string }
  | { type: 'test:startTransitionSchema'; startTransition: { key: string; schema: any } | null }
  | { type: 'test:subFlowModel'; subFlowWorkflow: Workflow | null; subFlowInfo?: { stateKey: string; instanceId?: string; type?: string }; error?: string }
  | { type: 'instance:highlight'; stateKey: string; instanceId: string }
  | { type: 'instance:clearHighlight' }
  | { type: 'instance:highlightHistory'; workflowKey: string; history: string[]; currentState: string }
  | { type: 'script:updated'; script: any; scriptType: 'mapper' | 'rule' }
  | { type: 'component:updated'; componentType: string; component: any }
  | { type: 'history:stateChanged'; canUndo: boolean; canRedo: boolean };

export type MsgFromWebview =
  | { type: 'ready' }
  | { type: 'persist:diagram'; diagram: Diagram }
  | { type: 'domain:setStart'; target: string }
  | { type: 'domain:setCancel'; target: string }
  | { type: 'domain:addTransition'; from: string; target: string; triggerType?: 1 | 3 }
  | { type: 'domain:moveTransition'; oldFrom: string; tKey: string; newFrom: string; newTarget: string }
  | { type: 'domain:removeTransition'; from: string; tKey: string }
  | { type: 'domain:removeState'; stateKey: string }
  | { type: 'domain:updateState'; stateKey: string; state: State }
  | { type: 'domain:updateTransition'; from: string; transitionKey: string; transition: Transition }
  | { type: 'domain:updateComment'; elementType: 'state' | 'transition' | 'workflow'; stateKey?: string; from?: string; transitionKey?: string; comment: string }
  | { type: 'domain:makeTransitionShared'; from: string; transitionKey: string }
  | { type: 'domain:updateSharedTransition'; transitionKey: string; sharedTransition: SharedTransition }
  | { type: 'domain:updateStartTransition'; startTransition: Transition }
  | { type: 'domain:convertSharedToRegular'; transitionKey: string; targetState: string }
  | { type: 'domain:removeFromSharedTransition'; transitionKey: string; stateKey: string }
  | { type: 'domain:addToSharedTransition'; transitionKey: string; stateKey: string }
  | { type: 'domain:addState'; state: State; position: { x: number; y: number }; pluginId?: string; hints?: any }
  | { type: 'request:lint' }
  | {
      type: 'request:autoLayout';
      nodeSizes?: Record<string, { width: number; height: number }>;
      edgeLabelSizes?: Record<string, { width: number; height: number }>;
      direction?: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';
    }
  | { type: 'request:exportDocumentation'; content: string; filename: string; svgContent?: string; svgFilename?: string }
  | {
      type: 'mapping:loadFromFile';
      stateKey?: string;
      list?: 'onEntries' | 'onExits';
      from?: string;
      transitionKey?: string;
      sharedTransitionKey?: string;
      transition?: Transition;
      index: number;
    }
  | {
      type: 'mapping:createFile';
      stateKey?: string;
      list?: 'onEntries' | 'onExits';
      from?: string;
      transitionKey?: string;
      sharedTransitionKey?: string;
      index: number;
      location: string;
      code?: string;
    }
  | {
      type: 'mapping:openMapper';
      stateKey: string;
      lane: 'onEntries' | 'onExits';
      taskIndex: number;
      mappingType: 'input' | 'output';
      existingMapperRef?: string;
    }
  | {
      type: 'rule:loadFromFile';
      from: string;
      transitionKey: string;
    }
  | {
      type: 'navigate:subflow';
      stateKey: string;
    }
  | {
      type: 'confirm:unsavedChanges';
      message?: string;
    }
  | { type: 'deploy:current'; force?: boolean }
  | { type: 'deploy:changed'; force?: boolean }
  | { type: 'deploy:checkStatus' }
  | { type: 'deploy:selectEnvironment' }
  | { type: 'deploy:openSettings' }
  | { type: 'task:openPopupEditor'; stateKey: string; lane?: 'onEntries' | 'onExits' }
  | { type: 'task:createNew' }
  | { type: 'task:create'; taskName: string; taskType: string; version: string; domain?: string; folderPath?: string; openInQuickEditor?: boolean }
  | { type: 'task:open'; taskRef: string; domain?: string; flow?: string; key?: string; version?: string }
  | { type: 'transition:editKey'; transitionId: string }
  | { type: 'editor:openInVSCode'; location: string }
  | { type: 'editor:createScript'; content: string; location: string; scriptType: 'mapping' | 'rule' }
  | { type: 'editor:createOrBindScript'; content: string; location: string; scriptType: 'mapping' | 'rule'; mode: 'create' | 'override' }
  | { type: 'dependency:open'; dependency: { type: string; key: string; domain?: string; flow?: string; version?: string; location?: string; ref?: string } }
  | { type: 'dependency:validate'; dependencies: Array<{ type: string; key: string; domain?: string; flow?: string; version?: string; location?: string; ref?: string }> }
  | { type: 'workflow:getSettings' }
  | { type: 'workflow:updateSettings'; data: { key?: string; domain?: string; version?: string; labels?: Array<{ label: string; language: string }>; tags?: string[]; type?: 'C' | 'F' | 'S' | 'P'; subFlowType?: 'S' | 'P'; functions?: any[]; extensions?: any[] } }
  | { type: 'test:openPanel'; workflow: { key: string; domain: string; version: string } }
  | { type: 'test:start'; workflowKey: string; domain: string; version: string; inputData: any }
  | { type: 'test:checkStatus' }
  | { type: 'test:pollInstance'; instanceId: string; workflowKey: string; domain: string }
  | { type: 'test:executeTransition'; instanceId: string; transitionKey: string; workflowKey: string; domain: string; data: any }
  | { type: 'test:listInstances'; workflowKey: string; domain: string }
  | { type: 'test:getTransitions'; instanceId: string; workflowKey: string; domain: string }
  | { type: 'test:connectInstance'; instanceId: string; workflowKey: string }
  | { type: 'test:disconnectInstance' }
  | { type: 'test:highlightHistory'; workflowKey: string; history: string[]; currentState: string }
  | { type: 'test:saveTestCase'; workflowKey: string; testCase: { name: string; input: any; description?: string } }
  | { type: 'test:loadTestCases'; workflowKey: string }
  | { type: 'test:deleteTestCase'; workflowKey: string; testCaseName: string }
  | { type: 'test:getModelTransitions'; workflowKey: string; stateKey: string }
  | { type: 'test:loadSchema'; transitionKey: string; schemaRef: { key: string; domain?: string; flow?: string; version?: string } }
  | { type: 'test:getStartTransitionSchema'; workflowKey: string }
  | { type: 'test:getSubFlowModel'; workflowKey: string; stateKey: string }
  | { type: 'history:undo' }
  | { type: 'history:redo' };
