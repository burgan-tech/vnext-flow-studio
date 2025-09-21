import * as vscode from 'vscode';
import * as path from 'path';
import { toReactFlow, lint, autoLayout } from '@nextcredit/core';
import type { Workflow, Diagram, MsgFromWebview, TaskDefinition } from '@nextcredit/core';
import { FlowDiagnosticsProvider, createCodeActionProvider } from './diagnostics';
import { registerCommands } from './commands';
import { registerQuickFixCommands } from './quickfix';
import {
  FLOW_AND_DIAGRAM_GLOBS,
  FLOW_FILE_GLOBS,
  getDiagramUri,
  isFlowDefinitionUri
} from './flowFileUtils';
import { loadTaskCatalog, TASK_FILE_GLOBS } from './taskCatalog';

async function readJson<T>(uri: vscode.Uri): Promise<T> {
  const buffer = await vscode.workspace.fs.readFile(uri);
  return JSON.parse(new TextDecoder().decode(buffer)) as T;
}

async function writeJson(uri: vscode.Uri, data: any): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
}

async function openFlowEditor(flowUri: vscode.Uri, context: vscode.ExtensionContext, diagnosticsProvider: FlowDiagnosticsProvider) {
  try {
    if (!isFlowDefinitionUri(flowUri)) {
      vscode.window.showErrorMessage(
        'Amorphie Flow Studio can only open *.flow.json files or JSON files within a workflows directory.'
      );
      return;
    }

    // Create webview panel
    const panel = vscode.window.createWebviewPanel(
      'amorphieFlow',
      'Amorphie Flow Studio',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'dist-web')
        ]
      }
    );

    // Load webview content
    const webviewDistPath = vscode.Uri.joinPath(context.extensionUri, 'dist-web');

    try {
      const indexHtmlUri = vscode.Uri.joinPath(webviewDistPath, 'index.html');
      console.log('Loading webview from:', indexHtmlUri.toString());
      const indexHtmlContent = await vscode.workspace.fs.readFile(indexHtmlUri);
      let html = new TextDecoder().decode(indexHtmlContent);

      // Fix asset paths for webview
      const webviewUri = panel.webview.asWebviewUri(webviewDistPath);
      console.log('Webview URI:', webviewUri.toString());
      html = html.replace(/(src|href)="\//g, (_, attr) => `${attr}="${webviewUri}/`);

      console.log('Setting webview HTML:', html.substring(0, 200) + '...');
      panel.webview.html = html;
    } catch (error) {
      console.error('Failed to load webview content:', error);
      // Fallback HTML if webview dist is not built
      panel.webview.html = `
        <!DOCTYPE html>
        <html>
          <head><title>Amorphie Flow Studio</title></head>
          <body>
            <div style="padding: 20px; font-family: Arial, sans-serif;">
              <h2>Webview Not Built</h2>
              <p>The webview assets haven't been built yet.</p>
              <p>Run <code>npm run build</code> in the workspace root to build the webview.</p>
            </div>
          </body>
        </html>
      `;
    }

    // Load workflow and diagram
    let currentWorkflow = await readJson<Workflow>(flowUri);
    const diagramUri = getDiagramUri(flowUri);
    let currentDiagram: Diagram;
    let workflow = await readJson<Workflow>(flowUri);
    let diagram: Diagram;
    let currentTasks: TaskDefinition[] = [];

    try {
      currentDiagram = await readJson<Diagram>(diagramUri);
    } catch {
      currentDiagram = await autoLayout(currentWorkflow);
      await writeJson(diagramUri, currentDiagram);
    }
    diagram = currentDiagram;

    currentTasks = await loadTaskCatalog();

    // Convert to React Flow format
    const derived = toReactFlow(currentWorkflow, currentDiagram, 'en');
    const problemsById = lint(currentWorkflow, { tasks: currentTasks });

    // Update VS Code diagnostics
    diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);

    // Send initial data to webview
    panel.webview.postMessage({
      type: 'init',
      workflow: currentWorkflow,
      diagram: currentDiagram,
      derived,
      problemsById,
      tasks: currentTasks
    });

    // Utility function to generate unique transition keys
    const generateTransitionKey = (stateKey: string, targetKey: string): string => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      return `t_${stateKey}_${targetKey}_${timestamp}_${random}`;
    };

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async (message: MsgFromWebview) => {
      try {
        switch (message.type) {
          case 'persist:diagram':
            currentDiagram = message.diagram;
            await writeJson(diagramUri, currentDiagram);
            break;

          case 'domain:setStart': {
            const updatedWorkflow = JSON.parse(JSON.stringify(currentWorkflow)) as Workflow;

            // Create or update start transition
            updatedWorkflow.attributes.startTransition = {
              key: 'start',
              target: message.target,
              versionStrategy: 'Major',
              triggerType: 1 // Automatic
            };

            currentWorkflow = updatedWorkflow;
            await writeJson(flowUri, currentWorkflow);

            const updatedDerived = toReactFlow(currentWorkflow, currentDiagram, 'en');
            const updatedProblems = lint(currentWorkflow, { tasks: currentTasks });
            diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);

            panel.webview.postMessage({
              type: 'workflow:update',
              workflow: currentWorkflow,
              derived: updatedDerived
            });
            panel.webview.postMessage({
              type: 'lint:update',
              problemsById: updatedProblems
            });
            break;
          }

          case 'domain:addTransition': {
            const { from, target, triggerType = 1 } = message;
            const updatedWorkflow = JSON.parse(JSON.stringify(currentWorkflow)) as Workflow;

            // Find the source state
            const sourceState = updatedWorkflow.attributes.states.find(s => s.key === from);
            if (!sourceState) {
              vscode.window.showWarningMessage(`Source state ${from} not found`);
              break;
            }

            // Initialize transitions array if needed
            if (!sourceState.transitions) {
              sourceState.transitions = [];
            }

            // Check for duplicate transition
            const existingTransition = sourceState.transitions.find(t => t.target === target);
            if (existingTransition) {
              vscode.window.showInformationMessage(`A transition from ${from} to ${target} already exists`);
              break;
            }

            // Create new transition
            const newTransition = {
              key: generateTransitionKey(from, target),
              from,
              target,
              versionStrategy: 'Major' as const,
              triggerType
            };

            // Add the transition
            sourceState.transitions.push(newTransition);

            currentWorkflow = updatedWorkflow;
            await writeJson(flowUri, currentWorkflow);

            const updatedDerived = toReactFlow(currentWorkflow, currentDiagram, 'en');
            const updatedProblems = lint(currentWorkflow, { tasks: currentTasks });
            diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);

            panel.webview.postMessage({
              type: 'workflow:update',
              workflow: currentWorkflow,
              derived: updatedDerived
            });
            panel.webview.postMessage({
              type: 'lint:update',
              problemsById: updatedProblems
            });
            break;
          }

          case 'domain:moveTransition': {
            const { oldFrom, tKey, newFrom, newTarget } = message;
            const updatedWorkflow = JSON.parse(JSON.stringify(currentWorkflow)) as Workflow;

            // Find the old source state
            const oldSourceState = updatedWorkflow.attributes.states.find(s => s.key === oldFrom);
            if (!oldSourceState) {
              vscode.window.showWarningMessage(`Old source state ${oldFrom} not found`);
              break;
            }

            // Find the transition to move
            const transitionIndex = oldSourceState.transitions?.findIndex(t => t.key === tKey) ?? -1;
            if (transitionIndex === -1) {
              vscode.window.showWarningMessage(`Transition ${tKey} not found in state ${oldFrom}`);
              break;
            }

            // Get the transition
            const transition = oldSourceState.transitions![transitionIndex];

            // Remove from old source
            oldSourceState.transitions!.splice(transitionIndex, 1);

            // If old state has no more transitions, delete the array
            if (oldSourceState.transitions!.length === 0) {
              delete oldSourceState.transitions;
            }

            // Find or create new source state
            const newSourceState = updatedWorkflow.attributes.states.find(s => s.key === newFrom);
            if (!newSourceState) {
              vscode.window.showWarningMessage(`New source state ${newFrom} not found`);
              break;
            }

            // Initialize transitions if needed
            if (!newSourceState.transitions) {
              newSourceState.transitions = [];
            }

            // Update transition properties
            transition.from = newFrom;
            transition.target = newTarget;

            // Add to new source
            newSourceState.transitions.push(transition);

            currentWorkflow = updatedWorkflow;
            await writeJson(flowUri, currentWorkflow);

            const updatedDerived = toReactFlow(currentWorkflow, currentDiagram, 'en');
            const updatedProblems = lint(currentWorkflow, { tasks: currentTasks });
            diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);

            panel.webview.postMessage({
              type: 'workflow:update',
              workflow: currentWorkflow,
              derived: updatedDerived
            });
            panel.webview.postMessage({
              type: 'lint:update',
              problemsById: updatedProblems
            });
            break;
          }

          case 'domain:removeTransition': {
            const { from, tKey } = message;
            const updatedWorkflow = JSON.parse(JSON.stringify(currentWorkflow)) as Workflow;

            // Find the source state
            const sourceState = updatedWorkflow.attributes.states.find(s => s.key === from);
            if (!sourceState) {
              vscode.window.showWarningMessage(`Source state ${from} not found`);
              break;
            }

            // Find and remove the transition
            if (sourceState.transitions) {
              const transitionIndex = sourceState.transitions.findIndex(t => t.key === tKey);

              if (transitionIndex === -1) {
                vscode.window.showWarningMessage(`Transition ${tKey} not found in state ${from}`);
                break;
              }

              // Remove the transition
              sourceState.transitions.splice(transitionIndex, 1);

              // If no more transitions, delete the array
              if (sourceState.transitions.length === 0) {
                delete sourceState.transitions;
              }
            }

            currentWorkflow = updatedWorkflow;
            await writeJson(flowUri, currentWorkflow);

            const updatedDerived = toReactFlow(currentWorkflow, currentDiagram, 'en');
            const updatedProblems = lint(currentWorkflow, { tasks: currentTasks });
            diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);

            panel.webview.postMessage({
              type: 'workflow:update',
              workflow: currentWorkflow,
              derived: updatedDerived
            });
            panel.webview.postMessage({
              type: 'lint:update',
              problemsById: updatedProblems
            });
            break;
          }

          case 'domain:updateState': {
            const { stateKey, state } = message;
            const updatedWorkflow = JSON.parse(JSON.stringify(currentWorkflow)) as Workflow;
            const stateIndex = updatedWorkflow.attributes.states.findIndex((item) => item.key === stateKey);

            if (stateIndex === -1) {
              vscode.window.showWarningMessage(`State ${stateKey} could not be found in the workflow.`);
              break;
            }

            updatedWorkflow.attributes.states[stateIndex] = state;
            currentWorkflow = updatedWorkflow;
            await writeJson(flowUri, currentWorkflow);

            const updatedDerived = toReactFlow(currentWorkflow, currentDiagram, 'en');
            panel.webview.postMessage({
              type: 'workflow:update',
              workflow: currentWorkflow,
              derived: updatedDerived
            });
            break;
          }

          case 'domain:updateTransition': {
            const { from, transitionKey, transition } = message;
            const updatedWorkflow = JSON.parse(JSON.stringify(currentWorkflow)) as Workflow;
            const state = updatedWorkflow.attributes.states.find((item) => item.key === from);

            if (!state) {
              vscode.window.showWarningMessage(`State ${from} could not be found in the workflow.`);
              break;
            }

            const transitions = [...(state.transitions ?? [])];
            const transitionIndex = transitions.findIndex((item) => item.key === transitionKey);

            if (transitionIndex === -1) {
              vscode.window.showWarningMessage(`Transition ${transitionKey} was not found for state ${from}.`);
              break;
            }

            transitions[transitionIndex] = { ...transition, from };
            state.transitions = transitions;
            currentWorkflow = updatedWorkflow;
            await writeJson(flowUri, currentWorkflow);

            const updatedDerived = toReactFlow(currentWorkflow, currentDiagram, 'en');
            panel.webview.postMessage({
              type: 'workflow:update',
              workflow: currentWorkflow,
              derived: updatedDerived
            });
            break;
          }

          case 'domain:addState':
            {
              const { state, position } = message;

              const existingIndex = workflow.attributes.states.findIndex((item) => item.key === state.key);
              const nextStates = existingIndex === -1
                ? [...workflow.attributes.states, state]
                : workflow.attributes.states.map((item, index) => (index === existingIndex ? state : item));

              workflow = {
                ...workflow,
                attributes: {
                  ...workflow.attributes,
                  states: nextStates
                }
              };

              diagram = {
                ...diagram,
                nodePos: {
                  ...diagram.nodePos,
                  [state.key]: position
                }
              };

              await writeJson(flowUri, workflow);
              await writeJson(diagramUri, diagram);

              const derived = toReactFlow(workflow, diagram, 'en');
              const problemsById = lint(workflow, { tasks: currentTasks });

              // Update VS Code diagnostics
              diagnosticsProvider.updateDiagnostics(flowUri, workflow, currentTasks);

              panel.webview.postMessage({
                type: 'workflow:update',
                workflow,
                derived
              });

              panel.webview.postMessage({
                type: 'diagram:update',
                diagram
              });

              panel.webview.postMessage({
                type: 'lint:update',
                problemsById
              });
            }
            break;

          case 'mapping:loadFromFile': {
            const { stateKey, list, index } = message;

            const picks = await vscode.window.showOpenDialog({
              canSelectFiles: true,
              canSelectFolders: false,
              canSelectMany: false,
              filters: { CSX: ['csx'] },
              defaultUri: vscode.Uri.file(path.dirname(flowUri.fsPath))
            });

            if (!picks || picks.length === 0) {
              break;
            }

            const fileUri = picks[0];
            const bytes = await vscode.workspace.fs.readFile(fileUri);
            const base64 = Buffer.from(bytes).toString('base64');
            let rel = path.relative(path.dirname(flowUri.fsPath), fileUri.fsPath);
            if (!rel.startsWith('.')) {
              rel = `./${rel}`;
            }

            const updatedWorkflow = JSON.parse(JSON.stringify(currentWorkflow)) as Workflow;
            const s = updatedWorkflow.attributes.states.find((st) => st.key === stateKey);
            if (!s) {
              vscode.window.showWarningMessage(`State ${stateKey} could not be found in the workflow.`);
              break;
            }

            const arrName = list as 'onEntries' | 'onExit' | 'onExecutionTasks';
            const arr = ((s as any)[arrName] as any[]) ?? [];
            if (!arr[index]) {
              vscode.window.showWarningMessage(`Task reference at index ${index} not found in '${arrName}'.`);
              break;
            }

            const task = { ...arr[index] } as any;
            task.mapping = { location: rel, code: base64 };
            const nextArr = [...arr];
            nextArr[index] = task;
            (s as any)[arrName] = nextArr;

            currentWorkflow = updatedWorkflow;
            await writeJson(flowUri, currentWorkflow);

            const updatedDerived = toReactFlow(currentWorkflow, currentDiagram, 'en');
            const updatedProblems = lint(currentWorkflow, { tasks: currentTasks });
            diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);
            panel.webview.postMessage({
              type: 'workflow:update',
              workflow: currentWorkflow,
              derived: updatedDerived
            });
            panel.webview.postMessage({
              type: 'lint:update',
              problemsById: updatedProblems
            });
            break;
          }

          case 'rule:loadFromFile': {
            const { from, transitionKey } = message;

            const picks = await vscode.window.showOpenDialog({
              canSelectFiles: true,
              canSelectFolders: false,
              canSelectMany: false,
              filters: { CSX: ['csx'] },
              defaultUri: vscode.Uri.file(path.dirname(flowUri.fsPath))
            });

            if (!picks || picks.length === 0) {
              break;
            }

            const fileUri = picks[0];
            const bytes = await vscode.workspace.fs.readFile(fileUri);
            const base64 = Buffer.from(bytes).toString('base64');
            let rel = path.relative(path.dirname(flowUri.fsPath), fileUri.fsPath);
            if (!rel.startsWith('.')) {
              rel = `./${rel}`;
            }

            const updatedWorkflow = JSON.parse(JSON.stringify(currentWorkflow)) as Workflow;
            const s = updatedWorkflow.attributes.states.find((st) => st.key === from);
            if (!s) {
              vscode.window.showWarningMessage(`State ${from} could not be found in the workflow.`);
              break;
            }

            const trIndex = (s.transitions || []).findIndex((t) => t.key === transitionKey);
            if (trIndex === -1) {
              vscode.window.showWarningMessage(`Transition ${transitionKey} could not be found in state '${from}'.`);
              break;
            }

            const tr = { ...(s.transitions as any[])[trIndex] } as any;
            tr.rule = { location: rel, code: base64 };
            const nextTransitions = [...(s.transitions as any[])];
            nextTransitions[trIndex] = tr;
            s.transitions = nextTransitions as any;

            currentWorkflow = updatedWorkflow;
            await writeJson(flowUri, currentWorkflow);

            const updatedDerived = toReactFlow(currentWorkflow, currentDiagram, 'en');
            const updatedProblems = lint(currentWorkflow, { tasks: currentTasks });
            diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);
            panel.webview.postMessage({
              type: 'workflow:update',
              workflow: currentWorkflow,
              derived: updatedDerived
            });
            panel.webview.postMessage({
              type: 'lint:update',
              problemsById: updatedProblems
            });
            break;
          }

          case 'request:lint': {
            const updatedProblems = lint(currentWorkflow, { tasks: currentTasks });
            diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);
            panel.webview.postMessage({
              type: 'lint:update',
              problemsById: updatedProblems
            });
            break;
          }

          case 'request:autoLayout': {
            const nextDiagram = await autoLayout(currentWorkflow, currentDiagram);
            currentDiagram = nextDiagram;
            diagram = nextDiagram;
            await writeJson(diagramUri, currentDiagram);

            const updatedDerived = toReactFlow(currentWorkflow, currentDiagram, 'en');
            panel.webview.postMessage({
              type: 'workflow:update',
              workflow: currentWorkflow,
              derived: updatedDerived
            });
            panel.webview.postMessage({
              type: 'diagram:update',
              diagram: currentDiagram
            });
            break;
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Webview message error: ${error}`);
      }
    });

    const refreshTasks = async () => {
      try {
        const nextTasks = await loadTaskCatalog();
        currentTasks = nextTasks;
        panel.webview.postMessage({ type: 'catalog:update', tasks: currentTasks });

        const updatedProblems = lint(currentWorkflow, { tasks: currentTasks });
        diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);
        panel.webview.postMessage({ type: 'lint:update', problemsById: updatedProblems });
      } catch (error) {
        console.warn('Failed to refresh task catalog:', error);
      }
    };

    // Watch for file changes
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(flowUri);
    const flowWatchers = (workspaceFolder
      ? FLOW_AND_DIAGRAM_GLOBS.map((pattern) =>
          vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspaceFolder, pattern))
        )
      : FLOW_AND_DIAGRAM_GLOBS.map((pattern) => vscode.workspace.createFileSystemWatcher(pattern))
    );
    const taskWatchers = (workspaceFolder
      ? TASK_FILE_GLOBS.map((pattern) =>
          vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspaceFolder, pattern))
        )
      : TASK_FILE_GLOBS.map((pattern) => vscode.workspace.createFileSystemWatcher(pattern))
    );
    const watchers = [...flowWatchers, ...taskWatchers];

    const flowUriKey = flowUri.toString();

    const handleFileChange = async (changedUri: vscode.Uri) => {
      try {
        const changedKey = changedUri.toString();

        if (changedKey === flowUriKey) {
          const updatedWorkflow = await readJson<Workflow>(flowUri);
          currentWorkflow = updatedWorkflow;
          workflow = updatedWorkflow;
          const updatedDerived = toReactFlow(updatedWorkflow, currentDiagram, 'en');
          panel.webview.postMessage({
            type: 'workflow:update',
            workflow: updatedWorkflow,
            derived: updatedDerived
          });
          const updatedProblems = lint(updatedWorkflow, { tasks: currentTasks });
          diagnosticsProvider.updateDiagnostics(flowUri, updatedWorkflow, currentTasks);
          panel.webview.postMessage({
            type: 'lint:update',
            problemsById: updatedProblems
          });
        } else if (changedUri.path === diagramUri.path) {
          const updatedDiagram = await readJson<Diagram>(diagramUri);
          currentDiagram = updatedDiagram;
          diagram = updatedDiagram;
          const updatedDerived = toReactFlow(currentWorkflow, currentDiagram, 'en');
          panel.webview.postMessage({
            type: 'workflow:update',
            workflow: currentWorkflow,
            derived: updatedDerived
          });
          panel.webview.postMessage({
            type: 'diagram:update',
            diagram: currentDiagram
          });
        }
      } catch (error) {
        console.warn('File change handling error:', error);
      }
    };

    for (const watcher of flowWatchers) {
      watcher.onDidChange(handleFileChange);
    }

    const handleTaskFileEvent = () => {
      void refreshTasks();
    };

    for (const watcher of taskWatchers) {
      watcher.onDidChange(handleTaskFileEvent);
      watcher.onDidCreate(handleTaskFileEvent);
      watcher.onDidDelete(handleTaskFileEvent);
    }

    // Cleanup on panel disposal
    panel.onDidDispose(() => {
      for (const watcher of watchers) {
        watcher.dispose();
      }
    });

    context.subscriptions.push(...watchers);

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open flow editor: ${error}`);
  }
}

class FlowEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(private context: vscode.ExtensionContext, private diagnosticsProvider: FlowDiagnosticsProvider) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    _webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    await openFlowEditor(document.uri, this.context, this.diagnosticsProvider);
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Amorphie Flow Studio activated');

  // Initialize diagnostics
  const diagnosticsProvider = new FlowDiagnosticsProvider();
  context.subscriptions.push(diagnosticsProvider);

  // Register code action provider
  const codeActionProvider = createCodeActionProvider();
  const documentSelectors: vscode.DocumentSelector = FLOW_FILE_GLOBS.map((pattern) => ({ pattern }));
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      documentSelectors,
      codeActionProvider
    )
  );

  // Register custom editor provider
  const customEditorProvider = new FlowEditorProvider(context, diagnosticsProvider);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'flowEditor.canvas',
      customEditorProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );

  // Register main command
  const openCommand = vscode.commands.registerCommand(
    'flowEditor.open',
    async (uri?: vscode.Uri) => {
      const flowUri = uri ?? (
        await vscode.window.showOpenDialog({
          filters: { 'Amorphie Flow': ['json'] },
          canSelectMany: false
        })
      )?.[0];

      if (!flowUri) return;

      if (!isFlowDefinitionUri(flowUri)) {
        vscode.window.showErrorMessage(
          'Select a *.flow.json file or a JSON workflow stored under a workflows directory.'
        );
        return;
      }

      await openFlowEditor(flowUri, context, diagnosticsProvider);
    }
  );

  context.subscriptions.push(openCommand);

  // Register other commands
  registerCommands(context);
  registerQuickFixCommands(context);
}

export function deactivate() {
  console.log('Amorphie Flow Studio deactivated');
}
