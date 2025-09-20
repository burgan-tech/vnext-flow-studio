import * as vscode from 'vscode';
import { toReactFlow, lint } from '@nextcredit/core';
import type { Workflow, Diagram } from '@nextcredit/core';
import { FlowDiagnosticsProvider, createCodeActionProvider } from './diagnostics';
import { registerCommands } from './commands';
import { registerQuickFixCommands } from './quickfix';

async function readJson<T>(uri: vscode.Uri): Promise<T> {
  const buffer = await vscode.workspace.fs.readFile(uri);
  return JSON.parse(new TextDecoder().decode(buffer)) as T;
}

async function writeJson(uri: vscode.Uri, data: any): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
}

function getDiagramUri(flowUri: vscode.Uri): vscode.Uri {
  return flowUri.with({
    path: flowUri.path.replace(/\.flow\.json$/, '.diagram.json')
  });
}

async function openFlowEditor(flowUri: vscode.Uri, context: vscode.ExtensionContext) {
  try {
    // Create webview panel
    const panel = vscode.window.createWebviewPanel(
      'bbtFlow',
      'BBT Flow Editor',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, '../webview/dist-web')
        ]
      }
    );

    // Load webview content
    const webviewDistPath = vscode.Uri.joinPath(context.extensionUri, '../webview/dist-web');

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
          <head><title>BBT Flow Editor</title></head>
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
    let workflow = await readJson<Workflow>(flowUri);
    let diagram: Diagram;

    try {
      diagram = await readJson<Diagram>(getDiagramUri(flowUri));
    } catch {
      diagram = { nodePos: {} };
    }

    // Convert to React Flow format
    const derived = toReactFlow(workflow, diagram, 'en');
    const problemsById = lint(workflow);

    // Send initial data to webview
    panel.webview.postMessage({
      type: 'init',
      workflow,
      diagram,
      derived,
      problemsById
    });

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async (message: any) => {
      try {
        switch (message.type) {
          case 'persist:diagram':
            await writeJson(getDiagramUri(flowUri), message.diagram);
            break;

          case 'domain:setStart':
            // TODO: Implement domain mutations
            console.log('TODO: Set start transition target to', message.target);
            break;

          case 'domain:addTransition':
            // TODO: Implement domain mutations
            console.log('TODO: Add transition from', message.from, 'to', message.target);
            break;

          case 'domain:moveTransition':
            // TODO: Implement domain mutations
            console.log('TODO: Move transition', message);
            break;

          case 'domain:removeTransition':
            // TODO: Implement domain mutations
            console.log('TODO: Remove transition', message);
            break;

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
              await writeJson(getDiagramUri(flowUri), diagram);

              const derived = toReactFlow(workflow, diagram, 'en');
              const problemsById = lint(workflow);

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

          case 'request:lint':
            const updatedProblems = lint(workflow);
            panel.webview.postMessage({
              type: 'lint:update',
              problemsById: updatedProblems
            });
            break;
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Webview message error: ${error}`);
      }
    });

    // Watch for file changes
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        vscode.workspace.getWorkspaceFolder(flowUri)!,
        '**/*.{flow,diagram}.json'
      )
    );

    watcher.onDidChange(async (changedUri) => {
      try {
        if (changedUri.path === flowUri.path) {
          workflow = await readJson<Workflow>(flowUri);
          const updatedDerived = toReactFlow(workflow, diagram, 'en');
          panel.webview.postMessage({
            type: 'workflow:update',
            workflow,
            derived: updatedDerived
          });
          const updatedProblems = lint(workflow);
          panel.webview.postMessage({
            type: 'lint:update',
            problemsById: updatedProblems
          });
        } else if (changedUri.path === getDiagramUri(flowUri).path) {
          diagram = await readJson<Diagram>(getDiagramUri(flowUri));
          panel.webview.postMessage({
            type: 'diagram:update',
            diagram
          });
        }
      } catch (error) {
        console.warn('File change handling error:', error);
      }
    });

    // Cleanup on panel disposal
    panel.onDidDispose(() => {
      watcher.dispose();
    });

    context.subscriptions.push(watcher);

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open flow editor: ${error}`);
  }
}

class FlowEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(private context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    await openFlowEditor(document.uri, this.context);
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('NextCredit BBT Flow Editor activated');

  // Initialize diagnostics
  const diagnosticsProvider = new FlowDiagnosticsProvider();
  context.subscriptions.push(diagnosticsProvider);

  // Register code action provider
  const codeActionProvider = createCodeActionProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { pattern: '**/*.flow.json' },
      codeActionProvider
    )
  );

  // Register custom editor provider
  const customEditorProvider = new FlowEditorProvider(context);
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
          filters: { 'BBT Flow': ['flow.json'] },
          canSelectMany: false
        })
      )?.[0];

      if (!flowUri) return;

      await openFlowEditor(flowUri, context);
    }
  );

  context.subscriptions.push(openCommand);

  // Register other commands
  registerCommands(context);
  registerQuickFixCommands(context);
}

export function deactivate() {
  console.log('NextCredit BBT Flow Editor deactivated');
}
