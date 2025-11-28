import * as vscode from 'vscode';
import * as path from 'path';
import { autoLayoutMapper } from '../../../core/src/mapper/mapperLayout';
import { ComponentResolverManager } from '../../../core/src/model/ComponentResolverManager';
import { calculateSchemaHash } from '../../../core/src/mapper/schemaHashUtils';

/**
 * MapperEditorProvider - Custom editor for *.mapper.json files
 * Provides visual data mapping interface with React Flow canvas
 */

/**
 * Valid mapper file extensions (including contract-specific types)
 */
const MAPPER_FILE_PATTERNS = [
  '.mapper.json',
  '.mapping.json',
  '.condition.json',
  '.transition.json',
  '.subflow.json',
  '.subprocess.json',
  '.timer.json'
];

/**
 * Check if a file is a valid mapper file
 */
function isMapperFile(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase();
  return MAPPER_FILE_PATTERNS.some(pattern => lowerPath.endsWith(pattern));
}

/**
 * Get the diagram file URI for a mapper file
 * Places diagram files in a .meta subdirectory
 */
function getMapperDiagramUri(mapperUri: vscode.Uri): vscode.Uri {
  const mapperPath = mapperUri.fsPath;
  const dir = path.dirname(mapperPath);
  const filename = path.basename(mapperPath);

  let diagramFilename: string;
  if (filename.toLowerCase().endsWith('.mapper.json')) {
    diagramFilename = filename.replace(/\.mapper\.json$/i, '.mapper.diagram.json');
  } else if (filename.toLowerCase().endsWith('.json')) {
    diagramFilename = filename.replace(/\.json$/i, '.mapper.diagram.json');
  } else {
    diagramFilename = `${filename}.mapper.diagram.json`;
  }

  // Put diagram in .meta subdirectory
  const diagramPath = path.join(dir, '.meta', diagramFilename);
  return vscode.Uri.file(diagramPath);
}

/**
 * Open a mapper file in the visual editor
 */
async function openMapperEditor(
  mapperUri: vscode.Uri,
  context: vscode.ExtensionContext,
  activePanels: Map<string, vscode.WebviewPanel>,
  providedPanel?: vscode.WebviewPanel,
  modelBridge?: any
) {
  console.log('[openMapperEditor] Called with:', mapperUri.toString(), 'providedPanel:', !!providedPanel);
  try {
    // Validate file extension
    if (!isMapperFile(mapperUri.path)) {
      const errorMsg = `Mapper Editor can only open mapper files (*.mapper.json, *.mapping.json, *.condition.json, etc.). File: ${mapperUri.path}`;
      console.error(errorMsg);
      vscode.window.showErrorMessage(errorMsg);
      return;
    }

    // Use provided panel or create a new one
    let panel: vscode.WebviewPanel;

    if (providedPanel) {
      // Use the panel provided by CustomTextEditor - this allows multiple tabs
      panel = providedPanel;
      console.log('[openMapperEditor] Using provided panel from CustomTextEditorProvider for:', mapperUri.toString());

      // Clean up any existing mappings for this panel (VS Code might reuse it for a different file)
      for (const [uri, existingPanel] of activePanels.entries()) {
        if (existingPanel === panel) {
          console.log('[openMapperEditor] Removing old mapping:', uri, '-> new mapping:', mapperUri.toString());
          activePanels.delete(uri);
        }
      }
    } else {
      // Create a new panel (for command invocation only)
      // Don't check for existing panels - always create a new one to allow multiple tabs
      console.log('[openMapperEditor] Creating new panel via command for:', mapperUri.toString());

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

      // Ensure panel is revealed and focused
      panel.reveal(vscode.ViewColumn.Active, false);
      console.log('[openMapperEditor] Created new panel');
    }

    // Track this panel with the new URI (allows multiple panels for different files)
    activePanels.set(mapperUri.toString(), panel);
    console.log('[openMapperEditor] Panel mapped to:', mapperUri.toString(), 'Total panels:', activePanels.size);

    // Clean up when panel is disposed
    panel.onDidDispose(() => {
      console.log('[openMapperEditor] Panel disposed for:', mapperUri.toString());
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
    const layoutUri = getMapperDiagramUri(mapperUri);
    let graphLayout: any = null;
    try {
      const layoutContent = await vscode.workspace.fs.readFile(layoutUri);
      const layoutText = new TextDecoder().decode(layoutContent);
      graphLayout = JSON.parse(layoutText);
      console.log('GraphLayout loaded from:', layoutUri.path);
    } catch {
      console.log('No GraphLayout file found (optional):', layoutUri.path);
    }

    // Helper function to load schema from file reference or platform schema
    const loadSchemaFromPath = async (schemaPath: string) => {
      try {
        // Check if this is a platform schema reference
        if (schemaPath.startsWith('platform://')) {
          console.log(`Loading platform schema: ${schemaPath}`);
          const { resolvePlatformSchema } = require('../../../core/src/mapper/platformSchemas');
          const platformSchema = resolvePlatformSchema(schemaPath);
          if (platformSchema) {
            console.log(`Platform schema loaded: ${schemaPath}`);
            return platformSchema;
          } else {
            console.warn(`Platform schema not found: ${schemaPath}`);
            return null;
          }
        }

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

    // Check for outdated schemas in multipart structure
    const checkOutdatedSchemas = async () => {
      const outdated: Array<{ side: 'source' | 'target'; partName: string; currentHash: string; storedHash: string }> = [];

      // Check source parts
      if (mapSpec.schemaParts?.source) {
        for (const [partName, partDef] of Object.entries(mapSpec.schemaParts.source)) {
          if (partDef.schemaSourcePath && partDef.schemaHash) {
            try {
              // Load current schema from file
              let loadedSchema = await loadSchemaFromPath(partDef.schemaSourcePath);
              if (loadedSchema) {
                // If this is a platform schema (SchemaDefinition), extract the actual schema
                // Platform schemas have structure: { key, domain, attributes: { schema: {...} } }
                if (loadedSchema.attributes && loadedSchema.attributes.schema) {
                  loadedSchema = loadedSchema.attributes.schema;
                }

                // Calculate current hash
                const currentHash = await calculateSchemaHash(loadedSchema);
                // Compare with stored hash
                if (currentHash !== partDef.schemaHash) {
                  outdated.push({
                    side: 'source',
                    partName,
                    currentHash,
                    storedHash: partDef.schemaHash
                  });
                }
              }
            } catch (error) {
              console.error(`Failed to check schema for source part ${partName}:`, error);
            }
          }
        }
      }

      // Check target parts
      if (mapSpec.schemaParts?.target) {
        for (const [partName, partDef] of Object.entries(mapSpec.schemaParts.target)) {
          if (partDef.schemaSourcePath && partDef.schemaHash) {
            try {
              // Load current schema from file
              let loadedSchema = await loadSchemaFromPath(partDef.schemaSourcePath);
              if (loadedSchema) {
                // If this is a platform schema (SchemaDefinition), extract the actual schema
                // Platform schemas have structure: { key, domain, attributes: { schema: {...} } }
                if (loadedSchema.attributes && loadedSchema.attributes.schema) {
                  loadedSchema = loadedSchema.attributes.schema;
                }

                // Calculate current hash
                const currentHash = await calculateSchemaHash(loadedSchema);
                // Compare with stored hash
                if (currentHash !== partDef.schemaHash) {
                  outdated.push({
                    side: 'target',
                    partName,
                    currentHash,
                    storedHash: partDef.schemaHash
                  });
                }
              }
            } catch (error) {
              console.error(`Failed to check schema for target part ${partName}:`, error);
            }
          }
        }
      }

      return outdated;
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

    // Load platform schemas for contract mappers (from schemaParts)
    let activeHandler: string | undefined;
    if (mapSpec.schemaParts || mapSpec.handlers) {
      console.log('Detected contract mapper with schemaParts or handlers');
      const { loadPlatformSchemas } = require('../../../core/src/mapper/mapperAdapter');

      // If this is a contract mapper with handlers, load schemas for each handler
      if (mapSpec.handlers) {
        console.log('Loading schemas for contract handlers:', Object.keys(mapSpec.handlers));
        const handlerNames = Object.keys(mapSpec.handlers);
        activeHandler = handlerNames[0]; // Default to first handler

        for (const [handlerName, handlerSpec] of Object.entries(mapSpec.handlers as any)) {
          if (handlerSpec.schemaParts) {
            console.log(`Loading platform schemas for handler: ${handlerName}`);
            handlerSpec.schemaParts = loadPlatformSchemas(handlerSpec.schemaParts);
          }
        }

        // Flatten the active handler's data to top level for MapperCanvas compatibility
        const activeHandlerSpec = mapSpec.handlers[activeHandler];
        if (activeHandlerSpec) {
          console.log(`Flattening active handler '${activeHandler}' to top level`);
          mapSpec.schemaParts = activeHandlerSpec.schemaParts;
          mapSpec.nodes = activeHandlerSpec.nodes || [];
          mapSpec.edges = activeHandlerSpec.edges || [];
        }
      } else if (mapSpec.schemaParts) {
        // Single schemaParts structure (not handler-based)
        console.log('Loading platform schemas for schemaParts');
        mapSpec.schemaParts = loadPlatformSchemas(mapSpec.schemaParts);
      }
    }

    console.log('Prepared mapSpec with schemas:', {
      hasSource: !!loadedSourceSchema,
      hasTarget: !!loadedTargetSchema,
      hasHandlers: !!mapSpec.handlers,
      hasSchemaParts: !!mapSpec.schemaParts
    });

    // Don't send init immediately - wait for webview to be ready
    // The webview will send a 'ready' message when loaded

    // Track last saved content to prevent reload loops
    let lastSavedContent = mapperText;
    let isSaving = false;
    let isSavingLayout = false;

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async (message) => {
      try {
        switch (message.type) {
          case 'ready': {
            // Webview is ready, now send the init data
            console.log('Webview ready, sending init message with schemas:', {
              hasSource: !!loadedSourceSchema,
              hasTarget: !!loadedTargetSchema,
              hasLayout: !!graphLayout
            });

            // Check for outdated schemas
            const outdatedSchemas = await checkOutdatedSchemas();
            if (outdatedSchemas.length > 0) {
              console.log('Detected outdated schemas:', outdatedSchemas);
            }

            panel.webview.postMessage({
              type: 'init',
              mapSpec,
              fileUri: mapperUri.toString(),
              sourceSchema: loadedSourceSchema,
              targetSchema: loadedTargetSchema,
              graphLayout,
              outdatedSchemas
            });
            break;
          }

          case 'save':
            // Set saving flag to prevent file watcher from triggering reload
            isSaving = true;

            try {
              // Convert absolute schema paths to relative paths for portability
              const mapSpecToSave = JSON.parse(JSON.stringify(message.mapSpec)); // Deep clone

              // Get mapper directory and workspace folder for relative path calculation
              const mapperDir = path.dirname(mapperUri.fsPath);
              const workspaceFolder = vscode.workspace.getWorkspaceFolder(mapperUri);
              const workspaceRoot = workspaceFolder?.uri.fsPath;

              // Helper to convert absolute path to relative path
              const makeRelativePath = (absolutePath: string): string => {
                if (!path.isAbsolute(absolutePath)) {
                  return absolutePath; // Already relative
                }

                // Try workspace-relative first (more portable)
                if (workspaceRoot && absolutePath.startsWith(workspaceRoot)) {
                  return path.relative(workspaceRoot, absolutePath);
                }

                // Fall back to mapper-file-relative
                return path.relative(mapperDir, absolutePath);
              };

              // Convert schema source paths in all parts
              if (mapSpecToSave.schemaParts) {
                for (const side of ['source', 'target'] as const) {
                  const parts = mapSpecToSave.schemaParts[side];
                  if (parts) {
                    for (const partName of Object.keys(parts)) {
                      const part = parts[partName];
                      if (part.schemaSourcePath) {
                        part.schemaSourcePath = makeRelativePath(part.schemaSourcePath);
                      }
                    }
                  }
                }
              }

              // Save the mapper file
              const content = JSON.stringify(mapSpecToSave, null, 2);
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
              // Set flag to prevent file watcher from triggering
              isSavingLayout = true;

              // Ensure .meta directory exists
              const layoutDir = vscode.Uri.file(path.dirname(layoutUri.fsPath));
              await vscode.workspace.fs.createDirectory(layoutDir);

              const layoutContent = JSON.stringify(message.graphLayout, null, 2);
              await vscode.workspace.fs.writeFile(
                layoutUri,
                new TextEncoder().encode(layoutContent)
              );

              // Update in-memory layout
              graphLayout = message.graphLayout;

              console.log('GraphLayout saved:', layoutUri.path);

              // Clear flag after a short delay (to handle filesystem delays)
              setTimeout(() => {
                isSavingLayout = false;
                console.log('Layout saving flag cleared');
              }, 500);
            } catch (error) {
              console.error('Failed to save GraphLayout:', error);
              vscode.window.showErrorMessage(`Failed to save layout: ${error}`);
              isSavingLayout = false;
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
                  side: message.side,
                  partName: message.partName // Include partName for multi-part model
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
                path: schemaPath,
                partName: message.partName, // Include partName for multi-part model
                applyImmediately: message.applyImmediately // Pass through flag for immediate vs staged application
              });

              console.log(`Schema loaded from ${schemaPath} for ${message.side}${message.partName ? ` part: ${message.partName}` : ''}`);
            } catch (error) {
              console.error('Failed to load schema:', error);
              vscode.window.showErrorMessage(`Failed to load schema: ${error}`);
            }
            break;

          case 'requestPlatformSchemas':
            try {
              console.log('Requesting platform schemas...');

              let schemas: any[] = [];

              // Try to get schemas from ModelBridge if available
              if (modelBridge) {
                console.log('Getting schemas from ModelBridge...');
                // Get the active model from the integration
                const integration = (modelBridge as any).integration;
                const activeModel = integration?.getActiveModel?.();

                if (activeModel) {
                  const modelState = activeModel.getModelState();
                  schemas = Array.from(modelState.components.schemas.values());
                  console.log(`Found ${schemas.length} platform schemas from ModelBridge`);
                } else {
                  console.warn('No active model in ModelBridge, falling back to ComponentResolver');
                }
              }

              // Fallback: Create ComponentResolver if ModelBridge not available or no active model
              if (schemas.length === 0) {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(mapperUri);
                if (!workspaceFolder) {
                  console.warn('No workspace folder found, cannot load platform schemas');
                  panel.webview.postMessage({
                    type: 'platformSchemas',
                    schemas: []
                  });
                  break;
                }

                console.log('Using ComponentResolver fallback...');
                const manager = ComponentResolverManager.getInstance();
                const workspacePath = workspaceFolder.uri.fsPath;

                // Try to use the global resolver if it exists, otherwise create isolated resolver
                let resolver = manager.getGlobalResolver(workspacePath);
                if (!resolver) {
                  console.log('Creating isolated resolver for schema loading...');
                  resolver = await manager.createIsolatedResolver({
                    basePath: workspacePath,
                    useCache: true
                  });
                  await resolver.preloadAllComponents();
                } else {
                  console.log('Using existing global resolver');
                }

                const schemaCache = (resolver as any).schemaCache as Map<string, any>;
                schemas = Array.from(schemaCache.values());
                console.log(`Found ${schemas.length} platform schemas from ComponentResolver`);
              }

              // Send schemas to webview
              panel.webview.postMessage({
                type: 'platformSchemas',
                schemas
              });
            } catch (error) {
              console.error('Failed to load platform schemas:', error);
              // Send empty array on error
              panel.webview.postMessage({
                type: 'platformSchemas',
                schemas: []
              });
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

    // Watch for GraphLayout file changes in .meta directories
    const layoutPattern = '**/.meta/*.mapper.diagram.json';
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
          // Skip if we're currently saving the layout (to prevent feedback loop)
          if (isSavingLayout) {
            console.log('Skipping layout reload - save in progress');
            return;
          }

          console.log('GraphLayout file changed externally:', changedUri.path);

          // Only reload the layout, not the entire mapper
          // This preserves in-memory changes to the mapSpec (like added properties)
          let reloadGraphLayout = null;
          try {
            const layoutContent = await vscode.workspace.fs.readFile(layoutUri);
            const layoutText = new TextDecoder().decode(layoutContent);
            reloadGraphLayout = JSON.parse(layoutText);
            graphLayout = reloadGraphLayout; // Update in-memory copy

            console.log('GraphLayout reloaded successfully');
          } catch {
            // Layout file deleted or couldn't be read
            graphLayout = null;
            console.log('GraphLayout file could not be read');
          }

          // Send layoutComputed message to webview to apply the updated layout
          // This applies layout changes without resetting the model
          if (reloadGraphLayout) {
            panel.webview.postMessage({
              type: 'layoutComputed',
              graphLayout: reloadGraphLayout
            });
          }
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
    private activePanels: Map<string, vscode.WebviewPanel>,
    private modelBridge?: any
  ) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    console.log('[MapperEditorProvider.resolveCustomTextEditor] Called for:', document.uri.toString());
    console.log('[MapperEditorProvider.resolveCustomTextEditor] Panel ID:', (webviewPanel as any)._id || 'unknown');
    console.log('[MapperEditorProvider.resolveCustomTextEditor] Current active panels:', this.activePanels.size);

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
      webviewPanel,
      this.modelBridge
    );
  }
}

/**
 * Register the mapper editor provider
 */
export function registerMapperEditor(context: vscode.ExtensionContext, modelBridge?: any): void {
  const activePanels = new Map<string, vscode.WebviewPanel>();

  // Register custom editor provider
  const editorProvider = new MapperEditorProvider(context, activePanels, modelBridge);

  // NOTE: Known limitation with VS Code's Preview Mode
  // When users single-click mapper files in the file explorer, VS Code opens them in "preview mode"
  // (tab title in italics). Preview tabs are temporary and get replaced when clicking another file.
  // This causes tabs to close when opening a new mapper file.
  //
  // Workarounds for users:
  // 1. Double-click files to open as permanent tabs
  // 2. Disable preview mode globally: "workbench.editor.enablePreview": false
  // 3. Pin tabs manually after opening (right-click → "Keep Open")
  //
  // This is VS Code default behavior, not a bug in our extension.
  // Setting retainContextWhenHidden: false helps but doesn't fully solve the preview mode issue.

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'mapperEditor.canvas',
      editorProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: false  // Don't retain context to avoid tab reuse issues
        },
        supportsMultipleEditorsPerDocument: false  // Each document gets one editor, but multiple documents can be open
      }
    )
  );

  // Register command to open mapper files
  const openCommand = vscode.commands.registerCommand(
    'mapperEditor.open',
    async (uri?: vscode.Uri) => {
      console.log('[mapperEditor.open] Command called with URI:', uri?.toString());

      const mapperUri = uri ?? (
        await vscode.window.showOpenDialog({
          filters: { 'Amorphie Mapper': ['mapper.json'] },
          canSelectMany: false
        })
      )?.[0];

      if (!mapperUri) {
        console.log('[mapperEditor.open] No URI provided or selected');
        return;
      }

      console.log('[mapperEditor.open] Opening mapper:', mapperUri.toString());

      if (!isMapperFile(mapperUri.path)) {
        vscode.window.showErrorMessage('Please select a valid mapper file (*.mapper.json, *.mapping.json, *.condition.json, etc.)');
        return;
      }

      await openMapperEditor(mapperUri, context, activePanels);
      console.log('[mapperEditor.open] openMapperEditor completed');
    }
  );

  context.subscriptions.push(openCommand);

  console.log('Mapper Editor registered successfully');
}
