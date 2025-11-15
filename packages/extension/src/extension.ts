import * as vscode from 'vscode';
import { ModelBridge } from './ModelBridge';
import { FlowDiagnosticsProvider, createCodeActionProvider } from './diagnostics';
import { registerCommands } from './commands';
import { registerQuickFixCommands } from './quickfix';
import { registerMapperEditor } from './mapper/MapperEditorProvider';
import { registerGraphCommands } from './graph/graphCommands';
import { TaskQuickEditorProvider } from './taskEditor/TaskQuickEditorProvider';
import { SettingsEditorProvider } from './settings/SettingsEditorProvider';
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
  modelBridge: ModelBridge,
  providedPanel?: vscode.WebviewPanel,
  document?: vscode.TextDocument
) {
  try {
    if (!isFlowDefinitionUri(flowUri)) {
      const errorMsg = `Amorphie Flow Studio can only open *.flow.json, *-subflow.json, *-workflow.json files or JSON files within workflows/Workflows directories. File: ${flowUri.path}`;
      console.error(errorMsg);
      vscode.window.showErrorMessage(errorMsg);
      return;
    }

    let panel: vscode.WebviewPanel;

    if (providedPanel) {
      // Use the panel provided by CustomTextEditor
      panel = providedPanel;
    } else {
      // Check if we already have a panel for this file and close it
      const existingPanel = activePanels.get(flowUri.toString());
      if (existingPanel) {
        console.log('[Extension] Disposing existing panel for:', flowUri.toString());
        existingPanel.dispose();
        // Wait for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Create webview panel
      panel = vscode.window.createWebviewPanel(
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
    }

    // Track this panel
    activePanels.set(flowUri.toString(), panel);

    // Clean up when panel is disposed
    panel.onDidDispose(() => {
      console.log('[Extension] Panel disposed, cleaning up for:', flowUri.toString());
      activePanels.delete(flowUri.toString());
    });

    // Load webview content
    const webviewDistPath = vscode.Uri.joinPath(context.extensionUri, 'dist-web');

    try {
      const indexHtmlUri = vscode.Uri.joinPath(webviewDistPath, 'index.html');
      const indexHtmlContent = await vscode.workspace.fs.readFile(indexHtmlUri);
      let html = new TextDecoder().decode(indexHtmlContent);

      // Fix asset paths for webview (handle both absolute /path and relative ./path)
      const webviewUri = panel.webview.asWebviewUri(webviewDistPath);
      html = html.replace(/(src|href)="(\.?\/[^"]+)"/g, (_match, attr, path) => {
        // Remove leading ./ or / from path
        const cleanPath = path.replace(/^\.?\//, '');
        return `${attr}="${webviewUri}/${cleanPath}"`;
      });

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
    // Pass the TextDocument for proper git virtual URI support
    const model = await modelBridge.openWorkflow(flowUri, panel, document);

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

    // Watch for component file changes (for catalog refresh)
    const componentPatterns = [
      // Tasks
      '**/Tasks/**/*.json',
      '**/tasks/**/*.json',
      '**/sys-tasks/**/*.json',
      // Schemas
      '**/Schemas/**/*.json',
      '**/schemas/**/*.json',
      '**/sys-schemas/**/*.json',
      // Views
      '**/Views/**/*.json',
      '**/views/**/*.json',
      '**/sys-views/**/*.json',
      // Functions
      '**/Functions/**/*.json',
      '**/functions/**/*.json',
      '**/sys-functions/**/*.json',
      // Extensions
      '**/Extensions/**/*.json',
      '**/extensions/**/*.json',
      '**/sys-extensions/**/*.json',
      // Workflows (for subflow catalog)
      '**/Workflows/**/*.json',
      '**/workflows/**/*.json',
      '**/flows/**/*.json',
      '**/sys-flows/**/*.json'
    ];

    const componentWatchers = (workspaceFolder
      ? componentPatterns.map((pattern) =>
          vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspaceFolder, pattern))
        )
      : componentPatterns.map((pattern) => vscode.workspace.createFileSystemWatcher(pattern))
    );

    const watchers = [...flowWatchers, ...componentWatchers];

    const flowUriKey = flowUri.toString();
    const diagramUri = getDiagramUri(flowUri);

    // Handle file changes
    const handleFileChange = async (changedUri: vscode.Uri) => {
      try {
        const changedKey = changedUri.toString();

        // Handle external changes to the workflow or diagram
        if (changedKey === flowUriKey || changedUri.path === diagramUri.path) {
          // Check if this is an external change
          const fileContent = await vscode.workspace.fs.readFile(changedUri);
          const fileText = new TextDecoder().decode(fileContent);

          // Get model key for checking saved content
          const workflow = model.getWorkflow();
          const modelKey = `${workflow.domain}/${workflow.flow}/${workflow.key}`;

          let isInternalChange = false;
          if (changedKey === flowUriKey) {
            // Check if this matches our last saved content
            isInternalChange = modelBridge.isLastSavedContent(modelKey, 'workflow', fileText);

            // If not tracked, fallback to comparing with current model
            if (!isInternalChange) {
              const modelContent = JSON.stringify(workflow, null, 2);
              isInternalChange = fileText.trim() === modelContent.trim();
            }
          } else {
            // Check diagram
            isInternalChange = modelBridge.isLastSavedContent(modelKey, 'diagram', fileText);

            // If not tracked, fallback to comparing with current model
            if (!isInternalChange) {
              const diagram = model.getDiagram();
              const modelContent = diagram ? JSON.stringify(diagram, null, 2) : '';
              isInternalChange = fileText.trim() === modelContent.trim();
            }
          }

          // Only reload if this is an external change
          if (!isInternalChange) {
            console.log('[FlowEditor] External file change detected, reloading:', changedUri.path);

            // Reload the model
            await model.load({
              resolveReferences: true,
              loadScripts: true,
              validate: true
            });

            // Properly update the webview with the new model data
            await modelBridge.updateWebviewForModel(model, panel);
            console.log('[FlowEditor] External changes reloaded and applied');
          }
        }
      } catch (error) {
        console.error('[FlowEditor] File change handling error:', error);
      }
    };

    for (const watcher of flowWatchers) {
      watcher.onDidChange(handleFileChange);
    }

    // Handle component catalog changes (tasks, schemas, views, functions, extensions, workflows)
    const handleComponentFileEvent = async (changedUri: vscode.Uri) => {
      try {
        const changedPath = changedUri.fsPath;

        // Skip files in .meta directories (diagram files)
        if (changedPath.includes('/.meta/') || changedPath.includes('\\.meta\\')) {
          console.log('[FileWatcher] Skipping component reload for .meta directory file:', changedPath);
          return;
        }

        // Skip .diagram.json files
        if (changedPath.endsWith('.diagram.json')) {
          console.log('[FileWatcher] Skipping component reload for diagram file:', changedPath);
          return;
        }

        // Skip if this is the currently edited workflow file that was just saved
        if (modelBridge.isRecentlySaved(changedPath)) {
          console.log('[FileWatcher] Skipping component reload for recently saved workflow:', changedPath);
          return;
        }

        // Skip if this is the current workflow being edited
        const currentWorkflowPath = model.getModelState().metadata.workflowPath;
        if (changedPath === currentWorkflowPath) {
          console.log('[FileWatcher] Skipping component reload for current workflow:', changedPath);
          return;
        }

        // Wait a bit for file system to settle
        await new Promise(resolve => setTimeout(resolve, 100));

        // Reload components in the model
        const resolver = (model as any).componentResolver;
        if (resolver) {
          console.log('[FileWatcher] Component file changed, clearing cache and reloading...');
          resolver.clearCache();
          const components = await resolver.preloadAllComponents();
          console.log('[FileWatcher] Preloaded components:', {
            tasks: components.tasks.length,
            schemas: components.schemas.length,
            views: components.views.length,
            functions: components.functions.length,
            extensions: components.extensions.length,
            workflows: components.workflows.length
          });

          // Update the model's state with the preloaded components
          const modelState = model.getModelState();
          modelState.components.workflows.clear();
          modelState.components.tasks.clear();
          modelState.components.schemas.clear();
          modelState.components.views.clear();

          components.workflows.forEach((w: any) => modelState.components.workflows.set(w.key, w));
          components.tasks.forEach((t: any) => modelState.components.tasks.set(t.key, t));
          components.schemas.forEach((s: any) => modelState.components.schemas.set(s.key, s));
          components.views.forEach((v: any) => modelState.components.views.set(v.key, v));
        }

        // Update the webview with refreshed catalogs
        await modelBridge.handleWebviewMessage(
          { type: 'request:lint' },
          model,
          panel
        );
      } catch (error) {
        console.warn('Failed to refresh component catalog:', error);
      }
    };

    for (const watcher of componentWatchers) {
      watcher.onDidChange(handleComponentFileEvent);
      watcher.onDidCreate(handleComponentFileEvent);
      watcher.onDidDelete(handleComponentFileEvent);
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
 * Register JSON schemas for validation
 */
function registerJsonSchemas(context: vscode.ExtensionContext) {
  // Get current JSON schemas configuration
  const config = vscode.workspace.getConfiguration('json');
  const schemas = config.get<any[]>('schemas') || [];

  // Define all schema types with their file patterns
  const schemaDefinitions = [
    {
      name: 'workflow-definition.schema.json',
      fileMatch: [
        '**/*.flow.json',
        '**/*-subflow.json',
        '**/*-workflow.json',
        '**/workflows/**/*.json',
        '**/Workflows/**/*.json'
      ]
    },
    {
      name: 'task-definition.schema.json',
      fileMatch: [
        '**/Tasks/*.json',
        '**/Tasks/**/*.json',
        '**/sys-tasks/**/*.json'
      ]
    },
    {
      name: 'schema-definition.schema.json',
      fileMatch: [
        '**/Schemas/*.json',
        '**/Schemas/**/*.json',
        '**/schemas/**/*.json',
        '**/sys-schemas/**/*.json'
      ]
    },
    {
      name: 'view-definition.schema.json',
      fileMatch: [
        '**/Views/*.json',
        '**/Views/**/*.json',
        '**/views/**/*.json',
        '**/sys-views/**/*.json'
      ]
    },
    {
      name: 'function-definition.schema.json',
      fileMatch: [
        '**/Functions/*.json',
        '**/Functions/**/*.json',
        '**/functions/**/*.json',
        '**/sys-functions/**/*.json'
      ]
    },
    {
      name: 'extension-definition.schema.json',
      fileMatch: [
        '**/Extensions/*.json',
        '**/Extensions/**/*.json',
        '**/extensions/**/*.json',
        '**/sys-extensions/**/*.json'
      ]
    }
  ];

  let updated = false;

  // Register each schema type
  for (const schemaDef of schemaDefinitions) {
    const schemaPath = vscode.Uri.joinPath(context.extensionUri, 'schemas', schemaDef.name).toString();
    const hasSchema = schemas.some(s => s.url === schemaPath);

    if (!hasSchema) {
      schemas.push({
        fileMatch: schemaDef.fileMatch,
        url: schemaPath
      });
      updated = true;
    }
  }

  // Update configuration if needed
  if (updated) {
    config.update('schemas', schemas, vscode.ConfigurationTarget.Global).then(
      () => console.log('JSON schemas registered successfully for all component types'),
      (error) => console.error('Failed to register JSON schemas:', error)
    );
  }
}

/**
 * Configure cSpell settings for workflow files in user projects
 */
function configureCSpell(_context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('cSpell');

  // Get existing words list
  const existingWords = config.get<string[]>('words') || [];

  // Turkish workflow labels to add
  const turkishWorkflowWords = [
    'Başlat', 'Başla', 'Bitir', 'Devam', 'Durdur', 'İptal',
    'Onayla', 'Reddet', 'Gönder', 'Kaydet', 'Sil', 'Güncelle',
    'Yeni', 'Düzenle', 'İşlem', 'Durum', 'Sonuç', 'Hata',
    'Uyarı', 'Bilgi', 'Yayınla', 'Yayın', 'Akış', 'Geçiş',
    'Onay', 'Ret', 'Bekle', 'Tamamla', 'Kontrol', 'Doğrula'
  ];

  // Workflow-specific technical terms
  const technicalTerms = [
    'amorphie', 'burgan', 'vnext', 'triggerType', 'stateType',
    'versionStrategy', 'onEntries', 'onExits', 'executionTasks',
    'mappings', 'subFlow', 'taskRef', 'schemaRef'
  ];

  // Combine and deduplicate
  const wordsToAdd = [...turkishWorkflowWords, ...technicalTerms];
  const newWords = [...new Set([...existingWords, ...wordsToAdd])];

  // Only update if there are new words
  if (newWords.length > existingWords.length) {
    config.update('words', newWords, vscode.ConfigurationTarget.Workspace);
  }

  // Configure language-specific settings
  const languageSettings = config.get<any[]>('languageSettings') || [];

  // Check if JSON settings already exist
  const jsonSettingIndex = languageSettings.findIndex(s => s.languageId === 'json');

  const jsonSetting = {
    languageId: 'json',
    ignoreRegExpList: [
      // Ignore label content in any language
      '"label"\\s*:\\s*"[^"]*"',
      // Ignore language codes
      '"language"\\s*:\\s*"[^"]*"',
      // Ignore Base64 encoded content
      '"code"\\s*:\\s*"[A-Za-z0-9+/=]{50,}"'
    ]
  };

  if (jsonSettingIndex === -1) {
    // Add new JSON settings
    languageSettings.push(jsonSetting);
    config.update('languageSettings', languageSettings, vscode.ConfigurationTarget.Workspace);
  } else {
    // Update existing JSON settings if needed
    const existing = languageSettings[jsonSettingIndex];
    if (!existing.ignoreRegExpList ||
        !existing.ignoreRegExpList.includes('"label"\\s*:\\s*"[^"]*"')) {
      languageSettings[jsonSettingIndex] = jsonSetting;
      config.update('languageSettings', languageSettings, vscode.ConfigurationTarget.Workspace);
    }
  }

  // Configure file-specific overrides
  const overrides = config.get<any[]>('overrides') || [];

  const workflowOverride = {
    filename: '**/*.json',
    ignoreRegExpList: [
      '"label"\\s*:\\s*"[^"]*"',
      '"language"\\s*:\\s*"[^"]*"'
    ]
  };

  // Check if override already exists
  const overrideExists = overrides.some(o => o.filename === '**/*.json');

  if (!overrideExists) {
    overrides.push(workflowOverride);
    config.update('overrides', overrides, vscode.ConfigurationTarget.Workspace);
  }

  console.log('cSpell configuration updated for workflow files');
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
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    // Configure the provided webview panel
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist-web')
      ]
    };

    await openFlowEditor(
      document.uri,
      this.context,
      this.diagnosticsProvider,
      this.activePanels,
      this.modelBridge,
      webviewPanel,
      document
    );
  }
}

export function activate(context: vscode.ExtensionContext) {
  vscode.window.showInformationMessage('Amorphie Flow Studio extension activated!');

  // Register JSON schemas for validation
  registerJsonSchemas(context);

  // Configure cSpell for workflow files
  configureCSpell(context);

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

  // Create output channel for deployment logs
  const deploymentOutputChannel = vscode.window.createOutputChannel('Workflow Deployment');
  context.subscriptions.push(deploymentOutputChannel);

  // Create the model bridge
  const modelBridge = new ModelBridge({
    context,
    diagnosticsProvider,
    activePanels,
    deploymentOutputChannel
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
  registerGraphCommands(context);

  // Register mapper editor
  registerMapperEditor(context, modelBridge);

  // Register task quick editor
  context.subscriptions.push(TaskQuickEditorProvider.register(context));

  // Register settings editor
  context.subscriptions.push(SettingsEditorProvider.register(context));

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