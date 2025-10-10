import * as vscode from 'vscode';
import { ModelBridge } from './ModelBridge';
import { FlowDiagnosticsProvider, createCodeActionProvider } from './diagnostics';
import { registerCommands } from './commands';
import { registerQuickFixCommands } from './quickfix';
import {
  FLOW_AND_DIAGRAM_GLOBS,
  FLOW_FILE_GLOBS,
  getDiagramUri,
  isFlowDefinitionUri
} from './flowFileUtils';

/**
 * Open a workflow in the flow editor using the model abstraction
 */
async function openFlowEditor(
  flowUri: vscode.Uri,
  context: vscode.ExtensionContext,
  _diagnosticsProvider: FlowDiagnosticsProvider,
  activePanels: Map<string, vscode.WebviewPanel>,
  modelBridge: ModelBridge
) {
  try {
    if (!isFlowDefinitionUri(flowUri)) {
      const errorMsg = `Amorphie Flow Studio can only open *.flow.json, *-subflow.json, *-workflow.json files or JSON files within workflows/Workflows directories. File: ${flowUri.path}`;
      console.error(errorMsg);
      vscode.window.showErrorMessage(errorMsg);
      return;
    }

    // Create webview panel
    const panel = vscode.window.createWebviewPanel(
      'amorphieFlow',
      'Loading...', // Will be updated after model loads
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
      const indexHtmlContent = await vscode.workspace.fs.readFile(indexHtmlUri);
      let html = new TextDecoder().decode(indexHtmlContent);

      // Fix asset paths for webview
      const webviewUri = panel.webview.asWebviewUri(webviewDistPath);
      html = html.replace(/(src|href)="\//g, (_, attr) => `${attr}="${webviewUri}/`);

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

    // Load the workflow using the model bridge
    const model = await modelBridge.openWorkflow(flowUri, panel);

    // Handle messages from webview using the model bridge
    panel.webview.onDidReceiveMessage(async (message) => {
      try {
        await modelBridge.handleWebviewMessage(message, model, panel);
      } catch (error) {
        console.error(`Error handling message ${message.type}:`, error);
        vscode.window.showErrorMessage(`Error: ${error}`);
      }
    });

    // Set up file watchers for auto-refresh
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(flowUri);

    // Watch for workflow and diagram changes
    const flowWatchers = (workspaceFolder
      ? FLOW_AND_DIAGRAM_GLOBS.map((pattern) =>
          vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspaceFolder, pattern))
        )
      : FLOW_AND_DIAGRAM_GLOBS.map((pattern) => vscode.workspace.createFileSystemWatcher(pattern))
    );

    // Watch for task file changes (for catalog refresh)
    const taskPatterns = [
      '**/Tasks/**/*.json',
      '**/tasks/**/*.json',
      '**/sys-tasks/**/*.json'
    ];

    const taskWatchers = (workspaceFolder
      ? taskPatterns.map((pattern) =>
          vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspaceFolder, pattern))
        )
      : taskPatterns.map((pattern) => vscode.workspace.createFileSystemWatcher(pattern))
    );

    const watchers = [...flowWatchers, ...taskWatchers];

    const flowUriKey = flowUri.toString();
    const diagramUri = getDiagramUri(flowUri);

    // Handle file changes
    const handleFileChange = async (changedUri: vscode.Uri) => {
      try {
        const changedKey = changedUri.toString();

        // Handle external changes to the workflow or diagram
        if (changedKey === flowUriKey || changedUri.path === diagramUri.path) {
          // The model will detect and handle external changes
          await model.load({
            resolveReferences: true,
            loadScripts: true,
            validate: true
          });

          // Update the webview
          await modelBridge.handleWebviewMessage(
            { type: 'request:lint' },
            model,
            panel
          );
        }
      } catch (error) {
        console.warn('File change handling error:', error);
      }
    };

    for (const watcher of flowWatchers) {
      watcher.onDidChange(handleFileChange);
    }

    // Handle task catalog changes
    const handleTaskFileEvent = async () => {
      try {
        // Reload components in the model
        const resolver = (model as any).componentResolver;
        if (resolver) {
          await resolver.clearCache();
          await resolver.preloadAllComponents();
        }

        // Update the webview
        await modelBridge.handleWebviewMessage(
          { type: 'request:lint' },
          model,
          panel
        );
      } catch (error) {
        console.warn('Failed to refresh task catalog:', error);
      }
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

/**
 * Custom editor provider using the model abstraction
 */
class FlowEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(
    private context: vscode.ExtensionContext,
    private diagnosticsProvider: FlowDiagnosticsProvider,
    private activePanels: Map<string, vscode.WebviewPanel>,
    private modelBridge: ModelBridge
  ) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    _webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    await openFlowEditor(
      document.uri,
      this.context,
      this.diagnosticsProvider,
      this.activePanels,
      this.modelBridge
    );
  }
}

export function activate(context: vscode.ExtensionContext) {
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

  // Store active panels for command access
  const activePanels = new Map<string, vscode.WebviewPanel>();

  // Create the model bridge
  const modelBridge = new ModelBridge({
    context,
    diagnosticsProvider,
    activePanels
  });

  // Register custom editor provider
  const customEditorProvider = new FlowEditorProvider(
    context,
    diagnosticsProvider,
    activePanels,
    modelBridge
  );

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
        await openFlowEditor(documentUri, context, diagnosticsProvider, activePanels, modelBridge);
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
      vscode.window.showInformationMessage(`Opening workflow file: ${uri?.path || 'file picker'}`);

      const flowUri = uri ?? (
        await vscode.window.showOpenDialog({
          filters: { 'Amorphie Flow': ['json'] },
          canSelectMany: false
        })
      )?.[0];

      if (!flowUri) {
        return;
      }

      if (!isFlowDefinitionUri(flowUri)) {
        const errorMsg = `File not recognized as workflow: ${flowUri.path}`;
        console.error('❌', errorMsg);
        vscode.window.showErrorMessage(
          'Select a *.flow.json, *-subflow.json, *-workflow.json file or a JSON workflow stored under a workflows/Workflows directory.'
        );
        return;
      }

      await openFlowEditor(flowUri, context, diagnosticsProvider, activePanels, modelBridge);
    }
  );

  context.subscriptions.push(openCommand);

  // Register other commands
  registerCommands(context);
  registerQuickFixCommands(context);

  // Clean up on deactivation
  context.subscriptions.push({
    dispose: () => {
      modelBridge.dispose();
    }
  });
}

export function deactivate() {
  // Cleanup is handled by disposal of subscriptions
}