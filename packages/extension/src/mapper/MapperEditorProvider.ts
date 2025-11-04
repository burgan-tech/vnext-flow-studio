import * as vscode from 'vscode';
import * as path from 'path';
import { autoLayoutMapper } from '../../../core/src/mapper/mapperLayout';

/**
 * MapperEditorProvider - Custom editor for *.mapper.json files
 * Provides visual data mapping interface with React Flow canvas
 */

/**
 * Open a mapper file in the visual editor
 */
async function openMapperEditor(
  mapperUri: vscode.Uri,
  context: vscode.ExtensionContext,
  activePanels: Map<string, vscode.WebviewPanel>,
  providedPanel?: vscode.WebviewPanel
) {
  try {
    // Validate file extension
    if (!mapperUri.path.endsWith('.mapper.json')) {
      const errorMsg = `Mapper Editor can only open *.mapper.json files. File: ${mapperUri.path}`;
      console.error(errorMsg);
      vscode.window.showErrorMessage(errorMsg);
      return;
    }

    // Use provided panel or create a new one
    let panel: vscode.WebviewPanel;

    if (providedPanel) {
      // Use the panel provided by CustomTextEditor
      panel = providedPanel;
    } else {
      // Create a new panel (for command invocation)
      // Check if we already have a panel for this file and close it
      const existingPanel = activePanels.get(mapperUri.toString());
      if (existingPanel) {
        existingPanel.dispose();
      }

      panel = vscode.window.createWebviewPanel(
        'amorphieMapper',
        `Mapper: ${vscode.workspace.asRelativePath(mapperUri)}`,
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
    activePanels.set(mapperUri.toString(), panel);

    // Clean up when panel is disposed
    panel.onDidDispose(() => {
      activePanels.delete(mapperUri.toString());
    });

    // Load webview content
    const webviewDistPath = vscode.Uri.joinPath(context.extensionUri, 'dist-web');

    try {
      const indexHtmlUri = vscode.Uri.joinPath(webviewDistPath, 'mapper.html');
      let html: string;

      try {
        const indexHtmlContent = await vscode.workspace.fs.readFile(indexHtmlUri);
        html = new TextDecoder().decode(indexHtmlContent);

        // Fix asset paths for webview
        // Map relative paths to webview URIs
        const webviewUri = panel.webview.asWebviewUri(webviewDistPath);

        // IMPORTANT: Add CSP FIRST, before path replacement
        // CSP must be in place before browser parses asset tags
        // 'unsafe-eval' is added to allow Vite's preload helper to work without throwing errors
        const cspContent = `default-src 'none'; style-src ${panel.webview.cspSource} 'unsafe-inline'; script-src ${panel.webview.cspSource} 'unsafe-inline' 'unsafe-eval'; font-src ${panel.webview.cspSource}; img-src ${panel.webview.cspSource} data: https:; connect-src ${panel.webview.cspSource} https:; worker-src blob:;`;
        const cspTag = `\n    <meta http-equiv="Content-Security-Policy" content="${cspContent}">`;

        // Insert CSP as the very first thing in <head>
        html = html.replace(/<head>/i, `<head>${cspTag}`);

        // Replace relative paths with webview URIs
        html = html.replace(/(src|href)="\.\//g, (_, attr) => `${attr}="${webviewUri}/`);
      } catch {
        // Fallback to main index.html if mapper.html doesn't exist yet
        const fallbackIndexUri = vscode.Uri.joinPath(webviewDistPath, 'index.html');
        const fallbackContent = await vscode.workspace.fs.readFile(fallbackIndexUri);
        html = new TextDecoder().decode(fallbackContent);

        // Map relative paths to webview URIs
        const webviewUri = panel.webview.asWebviewUri(webviewDistPath);

        // IMPORTANT: Add CSP FIRST, before path replacement
        // 'unsafe-eval' is added to allow Vite's preload helper to work without throwing errors
        const cspContent = `default-src 'none'; style-src ${panel.webview.cspSource} 'unsafe-inline'; script-src ${panel.webview.cspSource} 'unsafe-inline' 'unsafe-eval'; font-src ${panel.webview.cspSource}; img-src ${panel.webview.cspSource} data: https:; connect-src ${panel.webview.cspSource} https:; worker-src blob:;`;
        const cspTag = `\n    <meta http-equiv="Content-Security-Policy" content="${cspContent}">`;

        // Insert CSP as the very first thing in <head>
        html = html.replace(/<head>/i, `<head>${cspTag}`);

        // Replace relative paths with webview URIs
        html = html.replace(/(src|href)="\.\//g, (_, attr) => `${attr}="${webviewUri}/`);
      }

      panel.webview.html = html;
    } catch (error) {
      console.error('Failed to load mapper webview content:', error);
      // Fallback HTML if webview dist is not built
      panel.webview.html = `
        <!DOCTYPE html>
        <html>
          <head><title>Amorphie Mapper</title></head>
          <body>
            <div style="padding: 20px; font-family: Arial, sans-serif;">
              <h2>Mapper Webview Not Built</h2>
              <p>The mapper webview assets haven't been built yet.</p>
              <p>Run <code>npm run build</code> in the workspace root to build the webview.</p>
            </div>
          </body>
        </html>
      `;
    }

    // Load the mapper file
    const mapperContent = await vscode.workspace.fs.readFile(mapperUri);
    const mapperText = new TextDecoder().decode(mapperContent);
    const mapSpec = JSON.parse(mapperText);

    // Load GraphLayout file if it exists (*.mapper.diagram.json)
    const layoutUri = vscode.Uri.file(mapperUri.fsPath.replace(/\.mapper\.json$/, '.mapper.diagram.json'));
    let graphLayout = null;
    try {
      const layoutContent = await vscode.workspace.fs.readFile(layoutUri);
      const layoutText = new TextDecoder().decode(layoutContent);
      graphLayout = JSON.parse(layoutText);
      console.log('GraphLayout loaded from:', layoutUri.path);
    } catch {
      console.log('No GraphLayout file found (optional):', layoutUri.path);
    }

    // Helper function to load schema from file reference
    const loadSchemaFromPath = async (schemaPath: string) => {
      try {
        let schemaUri: vscode.Uri;

        // Handle relative paths relative to the workspace root or mapper file
        if (!path.isAbsolute(schemaPath)) {
          // Remove leading ./ if present
          const cleanPath = schemaPath.replace(/^\.\//, '');

          // First try to resolve relative to workspace root
          const workspaceFolder = vscode.workspace.getWorkspaceFolder(mapperUri);
          if (workspaceFolder) {
            const workspaceRelativePath = path.join(workspaceFolder.uri.fsPath, cleanPath);
            try {
              // Check if file exists in workspace
              await vscode.workspace.fs.stat(vscode.Uri.file(workspaceRelativePath));
              schemaUri = vscode.Uri.file(workspaceRelativePath);
              console.log(`Resolved schema path relative to workspace: ${schemaUri.fsPath}`);
            } catch {
              // File not found in workspace root, try relative to mapper file
              const mapperDir = path.dirname(mapperUri.fsPath);
              const resolvedPath = path.resolve(mapperDir, cleanPath);
              schemaUri = vscode.Uri.file(resolvedPath);
              console.log(`Resolved schema path relative to mapper: ${schemaUri.fsPath}`);
            }
          } else {
            // No workspace, resolve relative to mapper file
            const mapperDir = path.dirname(mapperUri.fsPath);
            const resolvedPath = path.resolve(mapperDir, cleanPath);
            schemaUri = vscode.Uri.file(resolvedPath);
            console.log(`Resolved schema path relative to mapper (no workspace): ${schemaUri.fsPath}`);
          }
        } else {
          schemaUri = vscode.Uri.file(schemaPath);
          console.log(`Using absolute schema path: ${schemaUri.fsPath}`);
        }

        console.log(`Loading schema from resolved path: ${schemaUri.fsPath}`);
        const schemaContent = await vscode.workspace.fs.readFile(schemaUri);
        const schemaText = new TextDecoder().decode(schemaContent);
        return JSON.parse(schemaText);
      } catch (error) {
        console.error(`Failed to load schema from ${schemaPath}:`, error);
        return null;
      }
    };

    // Load referenced schemas if they're file paths (not 'custom' or 'none')
    // Don't modify mapSpec - send schemas separately to avoid save loop
    const sourceRef = mapSpec.schemas?.source;
    const targetRef = mapSpec.schemas?.target;
    let loadedSourceSchema = null;
    let loadedTargetSchema = null;

    console.log('Loading mapper - source ref:', sourceRef, 'target ref:', targetRef);

    if (sourceRef && sourceRef !== 'custom' && sourceRef !== 'none') {
      console.log('Loading source schema from file:', sourceRef);
      loadedSourceSchema = await loadSchemaFromPath(sourceRef);
      if (loadedSourceSchema) {
        console.log('Source schema loaded successfully');
      } else {
        console.warn('Failed to load source schema from:', sourceRef);
      }
    } else if (sourceRef === 'custom' && mapSpec.schemas?.sourceSchema) {
      // Use embedded schema for custom
      loadedSourceSchema = mapSpec.schemas.sourceSchema;
    }

    if (targetRef && targetRef !== 'custom' && targetRef !== 'none') {
      console.log('Loading target schema from file:', targetRef);
      loadedTargetSchema = await loadSchemaFromPath(targetRef);
      if (loadedTargetSchema) {
        console.log('Target schema loaded successfully');
      } else {
        console.warn('Failed to load target schema from:', targetRef);
      }
    } else if (targetRef === 'custom' && mapSpec.schemas?.targetSchema) {
      // Use embedded schema for custom
      loadedTargetSchema = mapSpec.schemas.targetSchema;
    }

    console.log('Prepared mapSpec with schemas:', {
      hasSource: !!loadedSourceSchema,
      hasTarget: !!loadedTargetSchema
    });

    // Don't send init immediately - wait for webview to be ready
    // The webview will send a 'ready' message when loaded

    // Track last saved content to prevent reload loops
    let lastSavedContent = mapperText;
    let isSaving = false;

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async (message) => {
      try {
        switch (message.type) {
          case 'ready':
            // Webview is ready, now send the init data
            console.log('Webview ready, sending init message with schemas:', {
              hasSource: !!loadedSourceSchema,
              hasTarget: !!loadedTargetSchema,
              hasLayout: !!graphLayout
            });

            panel.webview.postMessage({
              type: 'init',
              mapSpec,
              fileUri: mapperUri.toString(),
              sourceSchema: loadedSourceSchema,
              targetSchema: loadedTargetSchema,
              graphLayout
            });
            break;

          case 'save':
            // Set saving flag to prevent file watcher from triggering reload
            isSaving = true;

            try {
              // Save the mapper file
              const content = JSON.stringify(message.mapSpec, null, 2);
              await vscode.workspace.fs.writeFile(
                mapperUri,
                new TextEncoder().encode(content)
              );

              // Update last saved content
              lastSavedContent = content;

              // Log save (no toast message to avoid spam with auto-save)
              console.log('Mapper saved:', mapperUri.path);
            } finally {
              // Reset saving flag after a longer delay to ensure file watcher doesn't fire
              setTimeout(() => {
                isSaving = false;
                console.log('Saving flag cleared');
              }, 500);
            }
            break;

          case 'saveLayout':
            // Save GraphLayout file (*.mapper.diagram.json)
            try {
              const layoutContent = JSON.stringify(message.graphLayout, null, 2);
              await vscode.workspace.fs.writeFile(
                layoutUri,
                new TextEncoder().encode(layoutContent)
              );

              // Update in-memory layout
              graphLayout = message.graphLayout;

              console.log('GraphLayout saved:', layoutUri.path);
            } catch (error) {
              console.error('Failed to save GraphLayout:', error);
              vscode.window.showErrorMessage(`Failed to save layout: ${error}`);
            }
            break;

          case 'error':
            vscode.window.showErrorMessage(`Mapper error: ${message.message}`);
            break;

          case 'info':
            vscode.window.showInformationMessage(message.message);
            break;

          case 'pickSchemaFile':
            try {
              // Show file picker dialog
              const selected = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: {
                  'JSON Schema': ['json', 'schema.json'],
                  'All Files': ['*']
                },
                title: `Select ${message.side === 'source' ? 'Source' : 'Target'} Schema File`
              });

              if (selected && selected[0]) {
                const selectedUri = selected[0];
                const mapperDir = vscode.Uri.joinPath(mapperUri, '..');

                // Calculate relative path from mapper file to schema file
                let relativePath: string;
                try {
                  relativePath = './' + vscode.workspace.asRelativePath(selectedUri, false);

                  // If both are in the same workspace, try to make it relative to mapper dir
                  const mapperDirPath = mapperDir.fsPath;
                  const selectedPath = selectedUri.fsPath;

                  if (selectedPath.startsWith(mapperDirPath)) {
                    relativePath = './' + selectedPath.substring(mapperDirPath.length + 1);
                  }
                } catch {
                  // Fallback to absolute path if relative path calculation fails
                  relativePath = selectedUri.fsPath;
                }

                // Send picked file path back to webview
                panel.webview.postMessage({
                  type: 'schemaFilePicked',
                  path: relativePath,
                  side: message.side
                });
              }
            } catch (error) {
              console.error('Failed to pick schema file:', error);
              vscode.window.showErrorMessage(`Failed to pick schema file: ${error}`);
            }
            break;

          case 'loadSchema':
            try {
              const schemaPath = message.path;
              let schemaUri: vscode.Uri;

              // Handle relative paths relative to workspace root or mapper file
              if (!path.isAbsolute(schemaPath)) {
                // Remove leading ./ if present
                const cleanPath = schemaPath.replace(/^\.\//, '');

                // First try to resolve relative to workspace root
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(mapperUri);
                if (workspaceFolder) {
                  const workspaceRelativePath = path.join(workspaceFolder.uri.fsPath, cleanPath);
                  try {
                    // Check if file exists in workspace
                    await vscode.workspace.fs.stat(vscode.Uri.file(workspaceRelativePath));
                    schemaUri = vscode.Uri.file(workspaceRelativePath);
                    console.log(`Resolved schema path relative to workspace: ${schemaUri.fsPath}`);
                  } catch {
                    // File not found in workspace root, try relative to mapper file
                    const mapperDir = path.dirname(mapperUri.fsPath);
                    const resolvedPath = path.resolve(mapperDir, cleanPath);
                    schemaUri = vscode.Uri.file(resolvedPath);
                    console.log(`Resolved schema path relative to mapper: ${schemaUri.fsPath}`);
                  }
                } else {
                  // No workspace, resolve relative to mapper file
                  const mapperDir = path.dirname(mapperUri.fsPath);
                  const resolvedPath = path.resolve(mapperDir, cleanPath);
                  schemaUri = vscode.Uri.file(resolvedPath);
                  console.log(`Resolved schema path relative to mapper (no workspace): ${schemaUri.fsPath}`);
                }
              } else {
                schemaUri = vscode.Uri.file(schemaPath);
                console.log(`Using absolute schema path: ${schemaUri.fsPath}`);
              }

              console.log(`Loading schema from resolved path: ${schemaUri.fsPath}`);

              // Load the schema file
              const schemaContent = await vscode.workspace.fs.readFile(schemaUri);
              const schemaText = new TextDecoder().decode(schemaContent);
              const schema = JSON.parse(schemaText);

              // Send loaded schema back to webview
              panel.webview.postMessage({
                type: 'schemaLoaded',
                schema,
                side: message.side,
                path: schemaPath
              });

              console.log(`Schema loaded from ${schemaPath} for ${message.side}`);
            } catch (error) {
              console.error('Failed to load schema:', error);
              vscode.window.showErrorMessage(`Failed to load schema: ${error}`);
            }
            break;

          case 'autoLayout':
            try {
              // Compute auto-layout (keeps schema nodes fixed, positions functoids)
              const nodeSizes = message.nodeSizes || {};
              const currentPositions = message.currentPositions || {};
              const handlePositions = message.handlePositions || {};
              const computedLayout = await autoLayoutMapper(mapSpec, {
                nodeSizes,
                currentPositions,
                handlePositions
              });

              // Send computed layout back to webview
              panel.webview.postMessage({
                type: 'layoutComputed',
                graphLayout: computedLayout
              });

              console.log('Auto-layout computed and sent to webview');
            } catch (error) {
              console.error('Failed to compute auto-layout:', error);
              vscode.window.showErrorMessage(`Failed to compute auto-layout: ${error}`);
            }
            break;

          default:
            console.warn('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error(`Error handling message ${message.type}:`, error);
        vscode.window.showErrorMessage(`Error: ${error}`);
      }
    });

    // Set up file watchers for auto-refresh
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(mapperUri);

    // Watch for mapper file changes
    const mapperPattern = '**/*.mapper.json';
    const mapperWatcher = workspaceFolder
      ? vscode.workspace.createFileSystemWatcher(
          new vscode.RelativePattern(workspaceFolder, mapperPattern)
        )
      : vscode.workspace.createFileSystemWatcher(mapperPattern);

    // Watch for GraphLayout file changes
    const layoutPattern = '**/*.mapper.diagram.json';
    const layoutWatcher = workspaceFolder
      ? vscode.workspace.createFileSystemWatcher(
          new vscode.RelativePattern(workspaceFolder, layoutPattern)
        )
      : vscode.workspace.createFileSystemWatcher(layoutPattern);

    const mapperUriKey = mapperUri.toString();
    const layoutUriKey = layoutUri.toString();

    // Handle file changes
    const handleFileChange = async (changedUri: vscode.Uri) => {
      try {
        const changedKey = changedUri.toString();

        // Handle mapper file changes
        if (changedKey === mapperUriKey) {
          // Skip if we're currently saving (to prevent feedback loop)
          if (isSaving) {
            console.log('Skipping reload - save in progress');
            return;
          }

          // Read the updated file
          const fileContent = await vscode.workspace.fs.readFile(changedUri);
          const fileText = new TextDecoder().decode(fileContent);

          // Only reload if content actually changed (ignore formatting differences)
          if (fileText === lastSavedContent) {
            console.log('Skipping reload - content unchanged');
            return;
          }

          console.log('File content changed!');
          console.log('Last saved length:', lastSavedContent.length);
          console.log('New file length:', fileText.length);

          const updatedMapSpec = JSON.parse(fileText);

          // Load referenced schemas if they're file paths (don't modify mapSpec)
          const sourceRef = updatedMapSpec.schemas?.source;
          const targetRef = updatedMapSpec.schemas?.target;
          let reloadSourceSchema = null;
          let reloadTargetSchema = null;

          if (sourceRef && sourceRef !== 'custom' && sourceRef !== 'none') {
            reloadSourceSchema = await loadSchemaFromPath(sourceRef);
          } else if (sourceRef === 'custom' && updatedMapSpec.schemas?.sourceSchema) {
            reloadSourceSchema = updatedMapSpec.schemas.sourceSchema;
          }

          if (targetRef && targetRef !== 'custom' && targetRef !== 'none') {
            reloadTargetSchema = await loadSchemaFromPath(targetRef);
          } else if (targetRef === 'custom' && updatedMapSpec.schemas?.targetSchema) {
            reloadTargetSchema = updatedMapSpec.schemas.targetSchema;
          }

          // Reload GraphLayout if it exists
          let reloadGraphLayout = null;
          try {
            const layoutContent = await vscode.workspace.fs.readFile(layoutUri);
            const layoutText = new TextDecoder().decode(layoutContent);
            reloadGraphLayout = JSON.parse(layoutText);
          } catch {
            // Layout file doesn't exist or couldn't be read - that's ok
          }

          // Update last saved content
          lastSavedContent = fileText;

          // Send update to webview
          panel.webview.postMessage({
            type: 'reload',
            mapSpec: updatedMapSpec,
            sourceSchema: reloadSourceSchema,
            targetSchema: reloadTargetSchema,
            graphLayout: reloadGraphLayout
          });

          console.log('External mapper file change detected, reloading:', changedUri.path);
        }

        // Handle GraphLayout file changes
        if (changedKey === layoutUriKey) {
          console.log('GraphLayout file changed externally:', changedUri.path);

          // Reload the entire mapper to pick up the layout
          const fileContent = await vscode.workspace.fs.readFile(mapperUri);
          const fileText = new TextDecoder().decode(fileContent);
          const updatedMapSpec = JSON.parse(fileText);

          // Load schemas
          const sourceRef = updatedMapSpec.schemas?.source;
          const targetRef = updatedMapSpec.schemas?.target;
          let reloadSourceSchema = null;
          let reloadTargetSchema = null;

          if (sourceRef && sourceRef !== 'custom' && sourceRef !== 'none') {
            reloadSourceSchema = await loadSchemaFromPath(sourceRef);
          } else if (sourceRef === 'custom' && updatedMapSpec.schemas?.sourceSchema) {
            reloadSourceSchema = updatedMapSpec.schemas.sourceSchema;
          }

          if (targetRef && targetRef !== 'custom' && targetRef !== 'none') {
            reloadTargetSchema = await loadSchemaFromPath(targetRef);
          } else if (targetRef === 'custom' && updatedMapSpec.schemas?.targetSchema) {
            reloadTargetSchema = updatedMapSpec.schemas.targetSchema;
          }

          // Load updated GraphLayout
          let reloadGraphLayout = null;
          try {
            const layoutContent = await vscode.workspace.fs.readFile(layoutUri);
            const layoutText = new TextDecoder().decode(layoutContent);
            reloadGraphLayout = JSON.parse(layoutText);
            graphLayout = reloadGraphLayout; // Update in-memory copy
          } catch {
            // Layout file deleted or couldn't be read
            graphLayout = null;
          }

          // Send update to webview
          panel.webview.postMessage({
            type: 'reload',
            mapSpec: updatedMapSpec,
            sourceSchema: reloadSourceSchema,
            targetSchema: reloadTargetSchema,
            graphLayout: reloadGraphLayout
          });
        }
      } catch (error) {
        console.warn('File change handling error:', error);
      }
    };

    mapperWatcher.onDidChange(handleFileChange);
    layoutWatcher.onDidChange(handleFileChange);

    // Cleanup on panel disposal
    panel.onDidDispose(() => {
      mapperWatcher.dispose();
      layoutWatcher.dispose();
    });

    context.subscriptions.push(mapperWatcher, layoutWatcher);

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open mapper editor: ${error}`);
  }
}

/**
 * Custom editor provider for *.mapper.json files
 */
export class MapperEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(
    private context: vscode.ExtensionContext,
    private activePanels: Map<string, vscode.WebviewPanel>
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

    await openMapperEditor(
      document.uri,
      this.context,
      this.activePanels,
      webviewPanel
    );
  }
}

/**
 * Register the mapper editor provider
 */
export function registerMapperEditor(context: vscode.ExtensionContext): void {
  const activePanels = new Map<string, vscode.WebviewPanel>();

  // Register custom editor provider
  const editorProvider = new MapperEditorProvider(context, activePanels);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'mapperEditor.canvas',
      editorProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, 'dist-web')
          ]
        }
      }
    )
  );

  // Register command to open mapper files
  const openCommand = vscode.commands.registerCommand(
    'mapperEditor.open',
    async (uri?: vscode.Uri) => {
      const mapperUri = uri ?? (
        await vscode.window.showOpenDialog({
          filters: { 'Amorphie Mapper': ['mapper.json'] },
          canSelectMany: false
        })
      )?.[0];

      if (!mapperUri) {
        return;
      }

      if (!mapperUri.path.endsWith('.mapper.json')) {
        vscode.window.showErrorMessage('Please select a *.mapper.json file');
        return;
      }

      await openMapperEditor(mapperUri, context, activePanels);
    }
  );

  context.subscriptions.push(openCommand);

  console.log('Mapper Editor registered successfully');
}
