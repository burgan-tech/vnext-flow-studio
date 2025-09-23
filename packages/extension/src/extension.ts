import * as vscode from 'vscode';
import * as path from 'path';
import { toReactFlow, lint, autoLayout } from '@nextcredit/core';
import type { Workflow, Diagram, MsgFromWebview, TaskDefinition, SharedTransition, Transition } from '@nextcredit/core';
import { FlowDiagnosticsProvider, createCodeActionProvider } from './diagnostics';
import { registerCommands } from './commands';
import { registerQuickFixCommands } from './quickfix';
import {
  FLOW_AND_DIAGRAM_GLOBS,
  FLOW_FILE_GLOBS,
  getDiagramUri,
  isFlowDefinitionUri
} from './flowFileUtils';
import { loadAllCatalogs, REFERENCE_PATTERNS } from './referenceCatalog';

async function readJson<T>(uri: vscode.Uri): Promise<T> {
  const buffer = await vscode.workspace.fs.readFile(uri);
  return JSON.parse(new TextDecoder().decode(buffer)) as T;
}

async function writeJson(uri: vscode.Uri, data: any): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
}

async function openFlowEditor(flowUri: vscode.Uri, context: vscode.ExtensionContext, diagnosticsProvider: FlowDiagnosticsProvider, activePanels: Map<string, vscode.WebviewPanel>) {
  try {
    console.log('Opening flow editor for:', flowUri.toString());
    console.log('Is flow definition URI:', isFlowDefinitionUri(flowUri));

    if (!isFlowDefinitionUri(flowUri)) {
      const errorMsg = `Amorphie Flow Studio can only open *.flow.json files or JSON files within a workflows directory. File: ${flowUri.path}`;
      console.error(errorMsg);
      vscode.window.showErrorMessage(errorMsg);
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

    // Check if we already have a panel for this file and close it
    const existingPanel = activePanels.get(flowUri.toString());
    if (existingPanel) {
      existingPanel.dispose();
    }

    // Track this panel
    activePanels.set(flowUri.toString(), panel);

    // Clean up when panel is disposed
    panel.onDidDispose(() => {
      activePanels.delete(flowUri.toString());
    });

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
    let currentTasks: TaskDefinition[] = [];

    try {
      currentDiagram = await readJson<Diagram>(diagramUri);
    } catch {
      currentDiagram = await autoLayout(currentWorkflow);
      await writeJson(diagramUri, currentDiagram);
    }

    // Load all catalogs
    const catalogs = await loadAllCatalogs();
    currentTasks = catalogs.task.map(ref => ({
      key: ref.key,
      domain: ref.domain,
      version: ref.version,
      flow: ref.flow,
      title: ref.title,
      tags: ref.tags,
      path: ref.path,
      flowVersion: undefined
    }));

    // Convert to React Flow format
    const derived = toReactFlow(currentWorkflow, currentDiagram, 'en');
    const problemsById = lint(currentWorkflow, { tasks: currentTasks });

    // Update VS Code diagnostics
    await diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);

    // Send initial data to webview
    panel.webview.postMessage({
      type: 'init',
      workflow: currentWorkflow,
      diagram: currentDiagram,
      derived,
      problemsById,
      tasks: currentTasks,
      catalogs
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
              triggerType: 0 // Start trigger type
            };

            currentWorkflow = updatedWorkflow;
            await writeJson(flowUri, currentWorkflow);

            const updatedDerived = toReactFlow(currentWorkflow, currentDiagram, 'en');
            const updatedProblems = lint(currentWorkflow, { tasks: currentTasks });
            await diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);

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
            await diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);

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

            // Update transition target
            transition.target = newTarget;

            // Add to new source
            newSourceState.transitions.push(transition);

            currentWorkflow = updatedWorkflow;
            await writeJson(flowUri, currentWorkflow);

            const updatedDerived = toReactFlow(currentWorkflow, currentDiagram, 'en');
            const updatedProblems = lint(currentWorkflow, { tasks: currentTasks });
            await diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);

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
            await diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);

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

          case 'domain:removeState': {
            const { stateKey } = message;
            const updatedWorkflow = JSON.parse(JSON.stringify(currentWorkflow)) as Workflow;

            // Find the state to remove
            const stateIndex = updatedWorkflow.attributes.states.findIndex(s => s.key === stateKey);
            if (stateIndex === -1) {
              vscode.window.showWarningMessage(`State ${stateKey} not found`);
              break;
            }

            // Remove all transitions that target this state
            for (const state of updatedWorkflow.attributes.states) {
              if (state.transitions) {
                state.transitions = state.transitions.filter(t => t.target !== stateKey);
                if (state.transitions.length === 0) {
                  delete state.transitions;
                }
              }
            }

            // Remove from shared transitions
            if (updatedWorkflow.attributes.sharedTransitions) {
              // Remove shared transitions that target this state
              updatedWorkflow.attributes.sharedTransitions = updatedWorkflow.attributes.sharedTransitions.filter(
                st => st.target !== stateKey
              );

              // Remove this state from availableIn arrays
              for (const sharedTransition of updatedWorkflow.attributes.sharedTransitions) {
                sharedTransition.availableIn = sharedTransition.availableIn.filter(s => s !== stateKey);
              }

              // Remove empty shared transitions
              updatedWorkflow.attributes.sharedTransitions = updatedWorkflow.attributes.sharedTransitions.filter(
                st => st.availableIn.length > 0
              );

              if (updatedWorkflow.attributes.sharedTransitions.length === 0) {
                delete updatedWorkflow.attributes.sharedTransitions;
              }
            }

            // Update start transition if it targets this state (preserve it but mark it as needing attention)
            if (updatedWorkflow.attributes.startTransition?.target === stateKey) {
              // Keep the startTransition but set target to empty string or a placeholder
              // This preserves the mandatory field while indicating it needs to be fixed
              updatedWorkflow.attributes.startTransition.target = '';
            }

            // Remove from timeout if it targets this state
            if (updatedWorkflow.attributes.timeout?.target === stateKey) {
              delete updatedWorkflow.attributes.timeout;
            }

            // Remove the state itself
            updatedWorkflow.attributes.states.splice(stateIndex, 1);

            // Remove from diagram
            if (currentDiagram.nodePos[stateKey]) {
              const updatedDiagram = {
                ...currentDiagram,
                nodePos: { ...currentDiagram.nodePos }
              };
              delete updatedDiagram.nodePos[stateKey];
              currentDiagram = updatedDiagram;
              await writeJson(diagramUri, currentDiagram);
            }

            currentWorkflow = updatedWorkflow;
            await writeJson(flowUri, currentWorkflow);

            const updatedDerived = toReactFlow(currentWorkflow, currentDiagram, 'en');
            const updatedProblems = lint(currentWorkflow, { tasks: currentTasks });
            await diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);

            panel.webview.postMessage({
              type: 'workflow:update',
              workflow: currentWorkflow,
              derived: updatedDerived
            });

            panel.webview.postMessage({
              type: 'diagram:update',
              diagram: currentDiagram
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

            // Check if the key is being changed
            const oldKey = updatedWorkflow.attributes.states[stateIndex].key;
            const newKey = state.key;
            const keyChanged = oldKey !== newKey;

            if (keyChanged) {
              // Check if new key already exists
              if (updatedWorkflow.attributes.states.some(s => s.key === newKey && s.key !== oldKey)) {
                vscode.window.showErrorMessage(`State key "${newKey}" already exists in the workflow.`);
                break;
              }

              // Update all references to the old key
              // 1. Update transitions that reference this state as target
              for (const otherState of updatedWorkflow.attributes.states) {
                if (otherState.transitions) {
                  for (const transition of otherState.transitions) {
                    if (transition.target === oldKey) {
                      transition.target = newKey;
                    }
                  }
                }
              }

              // 2. Transitions don't have a 'from' field - they're already in the correct state

              // 3. Update shared transitions
              if (updatedWorkflow.attributes.sharedTransitions) {
                for (const sharedTransition of updatedWorkflow.attributes.sharedTransitions) {
                  // Update target references
                  if (sharedTransition.target === oldKey) {
                    sharedTransition.target = newKey;
                  }
                  // Update availableIn references
                  const availableInIndex = sharedTransition.availableIn.indexOf(oldKey);
                  if (availableInIndex !== -1) {
                    sharedTransition.availableIn[availableInIndex] = newKey;
                  }
                }
              }

              // 4. Update start transition
              if (updatedWorkflow.attributes.startTransition?.target === oldKey) {
                updatedWorkflow.attributes.startTransition.target = newKey;
              }

              // 5. Update timeout transition
              if (updatedWorkflow.attributes.timeout?.target === oldKey) {
                updatedWorkflow.attributes.timeout.target = newKey;
              }

              // 6. Update diagram node positions
              if (currentDiagram.nodePos[oldKey]) {
                currentDiagram = {
                  ...currentDiagram,
                  nodePos: {
                    ...currentDiagram.nodePos,
                    [newKey]: currentDiagram.nodePos[oldKey]
                  }
                };
                delete currentDiagram.nodePos[oldKey];
                await writeJson(diagramUri, currentDiagram);
              }
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

            if (keyChanged) {
              panel.webview.postMessage({
                type: 'diagram:update',
                diagram: currentDiagram
              });
            }
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

            // Check if key is being renamed
            const oldKey = transitionKey;
            const newKey = transition.key;

            if (oldKey !== newKey) {
              // Check if new key already exists in this state
              const existingTransition = transitions.find((t, i) => i !== transitionIndex && t.key === newKey);
              if (existingTransition) {
                vscode.window.showWarningMessage(`A transition with key "${newKey}" already exists in state "${from}".`);
                break;
              }
            }

            transitions[transitionIndex] = { ...transition };
            state.transitions = transitions;
            currentWorkflow = updatedWorkflow;
            await writeJson(flowUri, currentWorkflow);

            const updatedDerived = toReactFlow(currentWorkflow, currentDiagram, 'en');
            const updatedProblems = lint(currentWorkflow, { tasks: currentTasks });
            await diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);

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

          case 'domain:makeTransitionShared': {
            const { from, transitionKey } = message;
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

            // Get the transition to make shared
            const transition = transitions[transitionIndex];

            // Remove from state transitions
            transitions.splice(transitionIndex, 1);
            state.transitions = transitions.length > 0 ? transitions : undefined;

            // Add to shared transitions
            const sharedTransitions = [...(updatedWorkflow.attributes.sharedTransitions ?? [])];
            const sharedTransition: SharedTransition = {
              ...transition,
              availableIn: [from] // Initially available only in the original state
            };
            sharedTransitions.push(sharedTransition);
            updatedWorkflow.attributes.sharedTransitions = sharedTransitions;

            currentWorkflow = updatedWorkflow;
            await writeJson(flowUri, currentWorkflow);

            const updatedDerived = toReactFlow(currentWorkflow, currentDiagram, 'en');
            const updatedProblems = lint(currentWorkflow, { tasks: currentTasks });
            await diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);

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

          case 'domain:updateSharedTransition': {
            const { transitionKey, sharedTransition } = message;
            const updatedWorkflow = JSON.parse(JSON.stringify(currentWorkflow)) as Workflow;

            const sharedTransitions = [...(updatedWorkflow.attributes.sharedTransitions ?? [])];
            const transitionIndex = sharedTransitions.findIndex((item) => item.key === transitionKey);

            if (transitionIndex === -1) {
              vscode.window.showWarningMessage(`Shared transition ${transitionKey} was not found.`);
              break;
            }

            // Check if key is being renamed
            const oldKey = transitionKey;
            const newKey = sharedTransition.key;

            if (oldKey !== newKey) {
              // Check if new key already exists in shared transitions
              const existingTransition = sharedTransitions.find((t, i) => i !== transitionIndex && t.key === newKey);
              if (existingTransition) {
                vscode.window.showWarningMessage(`A shared transition with key "${newKey}" already exists.`);
                break;
              }
            }

            // Replace the entire shared transition with the updated one
            sharedTransitions[transitionIndex] = sharedTransition;
            updatedWorkflow.attributes.sharedTransitions = sharedTransitions;

            currentWorkflow = updatedWorkflow;
            await writeJson(flowUri, currentWorkflow);

            const updatedDerived = toReactFlow(currentWorkflow, currentDiagram, 'en');
            const updatedProblems = lint(currentWorkflow, { tasks: currentTasks });
            await diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);

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

          case 'domain:removeFromSharedTransition': {
            const { transitionKey, stateKey } = message;
            const updatedWorkflow = JSON.parse(JSON.stringify(currentWorkflow)) as Workflow;

            const sharedTransitions = [...(updatedWorkflow.attributes.sharedTransitions ?? [])];
            const transitionIndex = sharedTransitions.findIndex((item) => item.key === transitionKey);

            if (transitionIndex === -1) {
              vscode.window.showWarningMessage(`Shared transition ${transitionKey} was not found.`);
              break;
            }

            const transition = sharedTransitions[transitionIndex];

            // Check if this is the last state
            if (transition.availableIn.length === 1 && transition.availableIn[0] === stateKey) {
              // Ask for confirmation before deleting the entire shared transition
              const answer = await vscode.window.showWarningMessage(
                `This is the last state for shared transition "${transitionKey}". Delete the entire shared transition?`,
                'Yes, Delete',
                'Cancel'
              );

              if (answer !== 'Yes, Delete') {
                // User cancelled - refresh the UI to restore the edge
                const currentDerived = toReactFlow(currentWorkflow, currentDiagram, 'en');
                panel.webview.postMessage({
                  type: 'workflow:update',
                  workflow: currentWorkflow,
                  derived: currentDerived
                });
                break;
              }

              // Remove the entire shared transition
              sharedTransitions.splice(transitionIndex, 1);
              updatedWorkflow.attributes.sharedTransitions = sharedTransitions.length > 0 ? sharedTransitions : undefined;
            } else {
              // Update the availableIn list by removing this state
              const updatedAvailableIn = transition.availableIn.filter(s => s !== stateKey);
              sharedTransitions[transitionIndex] = {
                ...transition,
                availableIn: updatedAvailableIn
              };
              updatedWorkflow.attributes.sharedTransitions = sharedTransitions;
            }

            currentWorkflow = updatedWorkflow;
            await writeJson(flowUri, currentWorkflow);

            const updatedDerived = toReactFlow(currentWorkflow, currentDiagram, 'en');
            const updatedProblems = lint(currentWorkflow, { tasks: currentTasks });
            await diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);

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

          case 'domain:convertSharedToRegular': {
            const { transitionKey, targetState } = message;
            const updatedWorkflow = JSON.parse(JSON.stringify(currentWorkflow)) as Workflow;

            // Find and remove the shared transition
            const sharedTransitions = [...(updatedWorkflow.attributes.sharedTransitions ?? [])];
            const transitionIndex = sharedTransitions.findIndex((item) => item.key === transitionKey);

            if (transitionIndex === -1) {
              vscode.window.showWarningMessage(`Shared transition ${transitionKey} was not found.`);
              break;
            }

            const sharedTransition = sharedTransitions[transitionIndex];
            sharedTransitions.splice(transitionIndex, 1);
            updatedWorkflow.attributes.sharedTransitions = sharedTransitions.length > 0 ? sharedTransitions : undefined;

            // Add it back as a regular transition to the target state
            const state = updatedWorkflow.attributes.states.find((item) => item.key === targetState);
            if (!state) {
              vscode.window.showWarningMessage(`State ${targetState} was not found.`);
              break;
            }

            // Convert SharedTransition to Transition (remove availableIn)
            const { availableIn, ...transitionWithoutAvailableIn } = sharedTransition;
            const regularTransition: Transition = transitionWithoutAvailableIn;

            const transitions = [...(state.transitions ?? [])];
            transitions.push(regularTransition);
            state.transitions = transitions;

            currentWorkflow = updatedWorkflow;
            await writeJson(flowUri, currentWorkflow);

            const updatedDerived = toReactFlow(currentWorkflow, currentDiagram, 'en');
            const updatedProblems = lint(currentWorkflow, { tasks: currentTasks });
            await diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);

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

          case 'domain:addState':
            {
              const { state, position } = message;

              const existingIndex = currentWorkflow.attributes.states.findIndex((item) => item.key === state.key);
              const nextStates = existingIndex === -1
                ? [...currentWorkflow.attributes.states, state]
                : currentWorkflow.attributes.states.map((item, index) => (index === existingIndex ? state : item));

              currentWorkflow = {
                ...currentWorkflow,
                attributes: {
                  ...currentWorkflow.attributes,
                  states: nextStates
                }
              };

              currentDiagram = {
                ...currentDiagram,
                nodePos: {
                  ...currentDiagram.nodePos,
                  [state.key]: position
                }
              };

              await writeJson(flowUri, currentWorkflow);
              await writeJson(diagramUri, currentDiagram);

              const derived = toReactFlow(currentWorkflow, currentDiagram, 'en');
              const problemsById = lint(currentWorkflow, { tasks: currentTasks });

              // Update VS Code diagnostics
              await diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);

              panel.webview.postMessage({
                type: 'workflow:update',
                workflow: currentWorkflow,
                derived
              });

              panel.webview.postMessage({
                type: 'diagram:update',
                diagram: currentDiagram
              });

              panel.webview.postMessage({
                type: 'lint:update',
                problemsById
              });
            }
            break;

          case 'mapping:createFile': {
            const { stateKey, list, from, transitionKey, sharedTransitionKey, index, location, code } = message;

            if (!location) {
              break; // Silently skip if no location specified
            }

            // Resolve the absolute path
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(flowUri);
            const basePath = workspaceFolder?.uri.fsPath || path.dirname(flowUri.fsPath);
            const absolutePath = path.resolve(basePath, location);
            const fileUri = vscode.Uri.file(absolutePath);

            // Check if file already exists
            try {
              await vscode.workspace.fs.stat(fileUri);
              // File exists, don't overwrite it
              console.log(`Mapping file already exists: ${location}`);
              break;
            } catch (error) {
              // File doesn't exist, create it
            }

            // Create directories if they don't exist
            const dirUri = vscode.Uri.file(path.dirname(absolutePath));
            try {
              await vscode.workspace.fs.createDirectory(dirUri);
            } catch (error) {
              // Directory might already exist, ignore
            }

            // Decode Base64 code if provided, otherwise use default template
            let csharpCode = '';
            if (code) {
              try {
                // Check if code is Base64 encoded
                const isBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(code) && code.length % 4 === 0 && code.length > 10;
                if (isBase64) {
                  csharpCode = Buffer.from(code, 'base64').toString('utf8');
                } else {
                  csharpCode = code;
                }
              } catch (error) {
                csharpCode = code; // Fallback to raw code
              }
            }

            // Use default template if no code provided
            if (!csharpCode) {
              csharpCode = `using System;
using System.Threading.Tasks;
using BBT.Workflow.Scripting;

public class MappingHandler : IMapping
{
    public async Task<ScriptResponse> InputHandler(ScriptContext context)
    {
        // TODO: Implement input mapping logic
        return new ScriptResponse
        {
            Data = context.Body.Data
        };
    }

    public async Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
        // TODO: Implement output mapping logic
        return new ScriptResponse
        {
            Data = context.Body.Data
        };
    }
}`;
            }

            try {
              await vscode.workspace.fs.writeFile(fileUri, Buffer.from(csharpCode, 'utf8'));
              console.log(`Created mapping file: ${location}`);

            } catch (error) {
              console.error(`Failed to create mapping file: ${error}`);
            }
            break;
          }

          case 'mapping:loadFromFile': {
            const { stateKey, list, from, transitionKey, sharedTransitionKey, index, transition: latestTransition } = message;

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

            // Handle state tasks
            if (stateKey && list) {
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
            }
            // Handle regular transition tasks
            else if (from && transitionKey) {
              const fromState = updatedWorkflow.attributes.states.find(st => st.key === from);
              if (!fromState) {
                vscode.window.showWarningMessage(`State ${from} could not be found in the workflow.`);
                break;
              }
              let transition = fromState.transitions?.find(t => t.key === transitionKey);

              // If transition not found in saved workflow and we have latest data, use it
              if (!transition && latestTransition) {
                // Add or update the transition with latest data
                if (!fromState.transitions) {
                  fromState.transitions = [];
                }
                transition = latestTransition as Transition;
                const existingIndex = fromState.transitions.findIndex(t => t.key === transitionKey);
                if (existingIndex >= 0) {
                  fromState.transitions[existingIndex] = transition;
                } else {
                  fromState.transitions.push(transition);
                }
              }

              if (!transition) {
                vscode.window.showWarningMessage(`Transition ${transitionKey} could not be found in state ${from}.`);
                break;
              }
              const arr = transition.onExecutionTasks ?? [];
              if (!arr[index]) {
                vscode.window.showWarningMessage(`Task reference at index ${index} not found in transition.`);
                break;
              }
              const task = { ...arr[index] } as any;
              task.mapping = { location: rel, code: base64 };
              const nextArr = [...arr];
              nextArr[index] = task;
              transition.onExecutionTasks = nextArr;
            }
            // Handle shared transition tasks
            else if (sharedTransitionKey) {
              let sharedTransition = updatedWorkflow.attributes.sharedTransitions?.find(t => t.key === sharedTransitionKey);

              // If shared transition not found in saved workflow and we have latest data, use it
              if (!sharedTransition && latestTransition) {
                // Add or update the shared transition with latest data
                if (!updatedWorkflow.attributes.sharedTransitions) {
                  updatedWorkflow.attributes.sharedTransitions = [];
                }
                sharedTransition = latestTransition as SharedTransition;
                const existingIndex = updatedWorkflow.attributes.sharedTransitions.findIndex(t => t.key === sharedTransitionKey);
                if (existingIndex >= 0) {
                  updatedWorkflow.attributes.sharedTransitions[existingIndex] = sharedTransition;
                } else {
                  updatedWorkflow.attributes.sharedTransitions.push(sharedTransition);
                }
              }

              if (!sharedTransition) {
                vscode.window.showWarningMessage(`Shared transition ${sharedTransitionKey} could not be found in the workflow.`);
                break;
              }
              const arr = sharedTransition.onExecutionTasks ?? [];
              if (!arr[index]) {
                vscode.window.showWarningMessage(`Task reference at index ${index} not found in shared transition.`);
                break;
              }
              const task = { ...arr[index] } as any;
              task.mapping = { location: rel, code: base64 };
              const nextArr = [...arr];
              nextArr[index] = task;
              sharedTransition.onExecutionTasks = nextArr;
            }

            currentWorkflow = updatedWorkflow;
            await writeJson(flowUri, currentWorkflow);

            const updatedDerived = toReactFlow(currentWorkflow, currentDiagram, 'en');
            const updatedProblems = lint(currentWorkflow, { tasks: currentTasks });
            await diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);
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
            await diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);
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
            await diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);
            panel.webview.postMessage({
              type: 'lint:update',
              problemsById: updatedProblems
            });
            break;
          }

          case 'request:autoLayout': {
            const nextDiagram = await autoLayout(currentWorkflow, currentDiagram);
            currentDiagram = nextDiagram;
            currentDiagram = nextDiagram;
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
        const catalogs = await loadAllCatalogs();
        currentTasks = catalogs.task.map(ref => ({
          key: ref.key,
          domain: ref.domain,
          version: ref.version,
          flow: ref.flow,
          title: ref.title,
          tags: ref.tags,
          path: ref.path,
          flowVersion: undefined
        }));
        panel.webview.postMessage({ type: 'catalog:update', tasks: currentTasks, catalogs });

        const updatedProblems = lint(currentWorkflow, { tasks: currentTasks });
        await diagnosticsProvider.updateDiagnostics(flowUri, currentWorkflow, currentTasks);
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
      ? REFERENCE_PATTERNS.task.map((pattern) =>
          vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspaceFolder, pattern))
        )
      : REFERENCE_PATTERNS.task.map((pattern) => vscode.workspace.createFileSystemWatcher(pattern))
    );
    const watchers = [...flowWatchers, ...taskWatchers];

    const flowUriKey = flowUri.toString();

    const handleFileChange = async (changedUri: vscode.Uri) => {
      try {
        const changedKey = changedUri.toString();

        if (changedKey === flowUriKey) {
          const updatedWorkflow = await readJson<Workflow>(flowUri);
          currentWorkflow = updatedWorkflow;
          currentWorkflow = updatedWorkflow;
          const updatedDerived = toReactFlow(updatedWorkflow, currentDiagram, 'en');
          panel.webview.postMessage({
            type: 'workflow:update',
            workflow: updatedWorkflow,
            derived: updatedDerived
          });
          const updatedProblems = lint(updatedWorkflow, { tasks: currentTasks });
          await diagnosticsProvider.updateDiagnostics(flowUri, updatedWorkflow, currentTasks);
          panel.webview.postMessage({
            type: 'lint:update',
            problemsById: updatedProblems
          });
        } else if (changedUri.path === diagramUri.path) {
          const updatedDiagram = await readJson<Diagram>(diagramUri);
          currentDiagram = updatedDiagram;
          currentDiagram = updatedDiagram;
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
  constructor(
    private context: vscode.ExtensionContext,
    private diagnosticsProvider: FlowDiagnosticsProvider,
    private activePanels: Map<string, vscode.WebviewPanel>
  ) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    _webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    await openFlowEditor(document.uri, this.context, this.diagnosticsProvider, this.activePanels);
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('🚀 Amorphie Flow Studio ACTIVATING...');
  vscode.window.showInformationMessage('Amorphie Flow Studio extension activated!');

  // Initialize diagnostics
  const diagnosticsProvider = new FlowDiagnosticsProvider();
  context.subscriptions.push(diagnosticsProvider);

  // Register code action provider
  const codeActionProvider = createCodeActionProvider();
  const documentSelectors: vscode.DocumentSelector = FLOW_FILE_GLOBS.map((pattern) => ({ pattern }));
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      documentSelectors,
      codeActionProvider,
      {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
      }
    )
  );

  // Store active panels for command access - map from file path to panel
  const activePanels = new Map<string, vscode.WebviewPanel>();

  // Register custom editor provider
  const customEditorProvider = new FlowEditorProvider(context, diagnosticsProvider, activePanels);
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

  // Register command to open property panel from problems
  const openPropertyPanelCommand = vscode.commands.registerCommand(
    'flowEditor.openPropertyPanel',
    async (args?: { ownerId: string; fileUri?: string }) => {
      if (!args?.ownerId) {
        return;
      }

      let documentUri: vscode.Uri;

      // First try to use the fileUri from the command arguments
      if (args.fileUri) {
        documentUri = vscode.Uri.parse(args.fileUri);
      } else {
        // Fall back to active editor
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
          vscode.window.showErrorMessage('No file specified and no active editor');
          return;
        }
        documentUri = activeEditor.document.uri;
      }

      // Check if this is a flow file
      if (!isFlowDefinitionUri(documentUri)) {
        vscode.window.showErrorMessage('Not a flow file: ' + documentUri.fsPath);
        return;
      }

      // Find the panel for this specific file
      let panel = activePanels.get(documentUri.toString());

      // If no panel exists for this file, open it
      if (!panel) {
        await openFlowEditor(documentUri, context, diagnosticsProvider, activePanels);
        panel = activePanels.get(documentUri.toString());
      }

      if (!panel) {
        vscode.window.showErrorMessage('Could not open flow editor');
        return;
      }

      // Wait a bit for the panel to initialize if just opened
      const wasJustOpened = panel === activePanels.get(documentUri.toString());
      setTimeout(() => {
        if (panel) {
          panel.webview.postMessage({
            type: 'select:node',
            nodeId: args.ownerId
          });

          // Focus the webview panel
          panel.reveal();
        }
      }, wasJustOpened ? 500 : 0);
    }
  );

  context.subscriptions.push(openPropertyPanelCommand);

  // Register main command
  const openCommand = vscode.commands.registerCommand(
    'flowEditor.open',
    async (uri?: vscode.Uri) => {
      console.log('🎯 flowEditor.open command triggered with URI:', uri?.toString());
      vscode.window.showInformationMessage(`Opening workflow file: ${uri?.path || 'file picker'}`);

      const flowUri = uri ?? (
        await vscode.window.showOpenDialog({
          filters: { 'Amorphie Flow': ['json'] },
          canSelectMany: false
        })
      )?.[0];

      if (!flowUri) {
        console.log('❌ No file URI provided');
        return;
      }

      console.log('🔍 Checking if file is recognized:', flowUri.toString());
      if (!isFlowDefinitionUri(flowUri)) {
        const errorMsg = `File not recognized as workflow: ${flowUri.path}`;
        console.error('❌', errorMsg);
        vscode.window.showErrorMessage(
          'Select a *.flow.json file or a JSON workflow stored under a workflows directory.'
        );
        return;
      }

      console.log('✅ File recognized, opening editor...');
      await openFlowEditor(flowUri, context, diagnosticsProvider, activePanels);
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
