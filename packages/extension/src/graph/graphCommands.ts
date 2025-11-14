/**
 * VS Code commands for graph analysis
 */

import * as vscode from 'vscode';
import {
  buildLocalGraph,
  AmorphieRuntimeAdapter,
  diffGraphs,
  impactCone,
  ConfigManager,
  type Graph,
  type GraphDelta,
  type ImpactCone,
  getGraphStats
} from '@amorphie-flow-studio/graph-core';

/**
 * Graph analysis manager
 */
export class GraphAnalysisManager {
  private configManager: ConfigManager;
  private localGraph?: Graph;
  private runtimeGraph?: Graph;
  private outputChannel: vscode.OutputChannel;

  constructor(private context: vscode.ExtensionContext) {
    this.configManager = new ConfigManager();
    this.outputChannel = vscode.window.createOutputChannel('Graph Analysis');
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<void> {
    // Load configuration
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const config = vscode.workspace.getConfiguration();

    await this.configManager.load({
      workspaceRoot: workspaceFolder?.uri.fsPath,
      vscodeSettings: config
    });
  }

  /**
   * Build local dependency graph
   */
  async buildLocalGraph(customPath?: string): Promise<void> {
    this.outputChannel.show();

    let basePath: string | undefined;

    if (customPath) {
      // Use provided custom path
      basePath = customPath;
    } else {
      // Check for configured base path
      const config = vscode.workspace.getConfiguration();
      const configuredPath = config.get<string>('amorphie.basePath');

      if (configuredPath) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
          vscode.window.showErrorMessage('No workspace folder found');
          return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        // Check if path is relative or absolute
        const path = await import('path');
        if (path.isAbsolute(configuredPath)) {
          basePath = configuredPath;
          this.outputChannel.appendLine(`Using configured base path (absolute): ${configuredPath}`);
        } else {
          basePath = path.join(workspaceRoot, configuredPath);
          this.outputChannel.appendLine(`Using configured base path (relative to workspace): ${configuredPath}`);
          this.outputChannel.appendLine(`Resolved to: ${basePath}`);
        }
      } else {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
          vscode.window.showErrorMessage('No workspace folder found');
          return;
        }

        // If multiple workspace folders, let user choose
        if (workspaceFolders.length === 1) {
          basePath = workspaceFolders[0].uri.fsPath;
        } else {
          // Add option to select custom directory
          const options = [
            ...workspaceFolders.map(folder => ({
              label: folder.name,
              description: folder.uri.fsPath,
              folder
            })),
            {
              label: '$(folder) Browse for folder...',
              description: 'Select a custom directory',
              folder: null as vscode.WorkspaceFolder | null
            }
          ];

          const selected = await vscode.window.showQuickPick(
            options,
            {
              placeHolder: 'Select workspace folder to scan for components'
            }
          );

          if (!selected) {
            return;
          }

          if (!selected.folder) {
            // User chose to browse
            const folders = await vscode.window.showOpenDialog({
              canSelectFiles: false,
              canSelectFolders: true,
              canSelectMany: false,
              title: 'Select folder containing workflow components'
            });

            if (!folders || folders.length === 0) {
              return;
            }

            basePath = folders[0].fsPath;

            // Ask if they want to save this path
            const saveChoice = await vscode.window.showQuickPick(
              ['Yes', 'No'],
              {
                placeHolder: 'Save this path to workspace settings?'
              }
            );

            if (saveChoice === 'Yes') {
              await config.update(
                'amorphie.basePath',
                basePath,
                vscode.ConfigurationTarget.Workspace
              );
            }
          } else {
            basePath = selected.folder.uri.fsPath;
          }
        }
      }
    }

    if (!basePath) {
      vscode.window.showErrorMessage('No base path selected');
      return;
    }

    try {
      this.outputChannel.appendLine(`Scanning for: Tasks, Schemas, Views, Functions, Extensions, Workflows`);

      const graph = await buildLocalGraph({
        basePath,
        computeHashes: true
      });

      this.localGraph = graph;

      const stats = getGraphStats(graph);

      if (stats.nodeCount === 0) {
        this.outputChannel.appendLine(`\n⚠️  No components found in ${basePath}`);
        this.outputChannel.appendLine(`\nExpected directories:`);
        this.outputChannel.appendLine(`  - Tasks/ or tasks/`);
        this.outputChannel.appendLine(`  - Schemas/ or schemas/`);
        this.outputChannel.appendLine(`  - Views/ or views/`);
        this.outputChannel.appendLine(`  - Functions/ or functions/`);
        this.outputChannel.appendLine(`  - Extensions/ or extensions/`);
        this.outputChannel.appendLine(`  - Workflows/ or workflows/ or flows/`);

        vscode.window.showWarningMessage(
          'No components found. Make sure the selected folder contains workflow component directories.'
        );
        return;
      }

      this.outputChannel.appendLine(`\n✓ Local graph built successfully`);
      this.outputChannel.appendLine(`  - ${stats.nodeCount} components`);
      this.outputChannel.appendLine(`  - ${stats.edgeCount} dependencies`);
      this.outputChannel.appendLine(`\nComponents by type:`);
      for (const [type, count] of Object.entries(stats.nodesByType)) {
        this.outputChannel.appendLine(`  - ${type}: ${count}`);
      }

      vscode.window.showInformationMessage(
        `Local graph built: ${stats.nodeCount} components, ${stats.edgeCount} dependencies`
      );
    } catch (error) {
      this.outputChannel.appendLine(`\n✗ Error building local graph: ${error}`);
      vscode.window.showErrorMessage(`Failed to build local graph: ${error}`);
    }
  }

  /**
   * Fetch runtime graph
   */
  async fetchRuntimeGraph(): Promise<void> {
    // Get active environment
    const activeEnv = this.configManager.getActiveEnvironment();

    if (!activeEnv) {
      // Prompt user to open settings
      const action = await vscode.window.showWarningMessage(
        'No active environment configured',
        'Open Settings'
      );

      if (action === 'Open Settings') {
        await vscode.commands.executeCommand('amorphie.openSettings');
        return;
      }
      return;
    }

    try {
      this.outputChannel.appendLine(`\nFetching runtime graph from ${activeEnv.name || activeEnv.id}...`);
      this.outputChannel.appendLine(`  Base URL: ${activeEnv.baseUrl}`);
      this.outputChannel.appendLine(`  Domain: ${activeEnv.domain}`);
      this.outputChannel.show();

      const adapter = new AmorphieRuntimeAdapter();
      const graph = await adapter.fetchGraph(activeEnv, {
        computeHashes: true
      });

      this.runtimeGraph = graph;

      const stats = getGraphStats(graph);
      this.outputChannel.appendLine(`\n✓ Runtime graph fetched successfully`);
      this.outputChannel.appendLine(`  - ${stats.nodeCount} components`);
      this.outputChannel.appendLine(`  - ${stats.edgeCount} dependencies`);
      this.outputChannel.appendLine(`\nComponents by type:`);
      for (const [type, count] of Object.entries(stats.nodesByType)) {
        this.outputChannel.appendLine(`  - ${type}: ${count}`);
      }

      vscode.window.showInformationMessage(
        `Runtime graph fetched: ${stats.nodeCount} components, ${stats.edgeCount} dependencies`
      );
    } catch (error) {
      this.outputChannel.appendLine(`\n✗ Error fetching runtime graph: ${error}`);
      vscode.window.showErrorMessage(`Failed to fetch runtime graph: ${error}`);
    }
  }

  /**
   * Compare local vs runtime graphs
   */
  async diffGraphs(): Promise<void> {
    // Auto-build local graph if needed
    if (!this.localGraph) {
      this.outputChannel.appendLine('Local graph not built, building now...');
      this.outputChannel.show();
      await this.buildLocalGraph();

      // If still no graph after building (user cancelled or error), abort
      if (!this.localGraph) {
        return;
      }
    }

    // Auto-fetch runtime graph if needed
    if (!this.runtimeGraph) {
      this.outputChannel.appendLine('\nRuntime graph not fetched, fetching now...');
      await this.fetchRuntimeGraph();

      // If still no graph after fetching (user cancelled or error), abort
      if (!this.runtimeGraph) {
        return;
      }
    }

    try {
      this.outputChannel.appendLine('\nComputing graph diff...');
      this.outputChannel.show();

      const delta = diffGraphs(this.localGraph, this.runtimeGraph);

      this.displayGraphDelta(delta);

      // Show summary
      if (delta.stats.totalViolations === 0) {
        vscode.window.showInformationMessage('No violations found - graphs are in sync');
      } else {
        const message = `Found ${delta.stats.totalViolations} violations: ${delta.stats.errorCount} errors, ${delta.stats.warningCount} warnings, ${delta.stats.infoCount} info`;
        if (delta.stats.errorCount > 0) {
          vscode.window.showErrorMessage(message);
        } else if (delta.stats.warningCount > 0) {
          vscode.window.showWarningMessage(message);
        } else {
          vscode.window.showInformationMessage(message);
        }
      }
    } catch (error) {
      this.outputChannel.appendLine(`\n✗ Error computing diff: ${error}`);
      vscode.window.showErrorMessage(`Failed to compute diff: ${error}`);
    }
  }

  /**
   * Analyze component impact
   */
  async impactAnalysis(): Promise<void> {
    if (!this.localGraph) {
      const action = await vscode.window.showWarningMessage(
        'Local graph not built',
        'Build Local Graph'
      );
      if (action === 'Build Local Graph') {
        await this.buildLocalGraph();
      }
      return;
    }

    // Ask user to select components
    const componentId = await vscode.window.showInputBox({
      prompt: 'Enter component ID (domain/flow/key@version)',
      placeHolder: 'core/sys-flows/my-workflow@1.0.0'
    });

    if (!componentId) {
      return;
    }

    try {
      this.outputChannel.appendLine(`\nAnalyzing impact of ${componentId}...`);
      this.outputChannel.show();

      const cone = impactCone(this.localGraph, [componentId]);

      this.displayImpactCone(cone);

      vscode.window.showInformationMessage(
        `Impact analysis: ${cone.stats.totalAffected} components affected`
      );
    } catch (error) {
      this.outputChannel.appendLine(`\n✗ Error analyzing impact: ${error}`);
      vscode.window.showErrorMessage(`Failed to analyze impact: ${error}`);
    }
  }

  /**
   * Deploy detected changes to runtime
   */
  async deployChanges(): Promise<void> {
    // Auto-build local graph if needed
    if (!this.localGraph) {
      this.outputChannel.appendLine('Local graph not built, building now...');
      this.outputChannel.show();
      await this.buildLocalGraph();

      if (!this.localGraph) {
        return;
      }
    }

    // Auto-fetch runtime graph if needed
    if (!this.runtimeGraph) {
      this.outputChannel.appendLine('\nRuntime graph not fetched, fetching now...');
      await this.fetchRuntimeGraph();

      if (!this.runtimeGraph) {
        return;
      }
    }

    try {
      this.outputChannel.appendLine('\nComputing changes to deploy...');
      this.outputChannel.show();

      const delta = diffGraphs(this.localGraph, this.runtimeGraph);

      // Filter violations to only deployable ones
      const deployableViolations = delta.violations.filter(v =>
        v.type === 'node-added' ||
        v.type === 'node-changed' ||
        v.type === 'api-drift' ||
        v.type === 'config-drift'
      );

      if (deployableViolations.length === 0) {
        vscode.window.showInformationMessage('No changes to deploy - graphs are in sync');
        return;
      }

      // Group by component ID
      const componentChanges = new Map<string, typeof deployableViolations>();
      for (const violation of deployableViolations) {
        const componentId = violation.componentIds[0];
        if (!componentChanges.has(componentId)) {
          componentChanges.set(componentId, []);
        }
        componentChanges.get(componentId)!.push(violation);
      }

      // Display what will be deployed
      this.outputChannel.appendLine('\n=== Changes to Deploy ===\n');
      this.outputChannel.appendLine(`Components: ${componentChanges.size}`);
      this.outputChannel.appendLine('');

      let newCount = 0;
      let updateCount = 0;

      for (const [componentId, violations] of componentChanges) {
        const isNew = violations.some(v => v.type === 'node-added');
        if (isNew) {
          newCount++;
          this.outputChannel.appendLine(`  + [NEW] ${componentId}`);
        } else {
          updateCount++;
          this.outputChannel.appendLine(`  ~ [UPDATE] ${componentId}`);
          for (const v of violations) {
            if (v.type === 'api-drift') {
              this.outputChannel.appendLine(`      - API changes detected`);
            } else if (v.type === 'config-drift') {
              this.outputChannel.appendLine(`      - Config changes detected`);
            }
          }
        }
      }

      this.outputChannel.appendLine('');
      this.outputChannel.appendLine(`New components: ${newCount}`);
      this.outputChannel.appendLine(`Updated components: ${updateCount}`);

      // Confirm deployment
      const confirmation = await vscode.window.showWarningMessage(
        `Deploy ${componentChanges.size} component(s)? (${newCount} new, ${updateCount} updated)`,
        { modal: true },
        'Deploy',
        'Cancel'
      );

      if (confirmation !== 'Deploy') {
        this.outputChannel.appendLine('\nDeployment cancelled by user');
        return;
      }

      // Get active environment
      const activeEnv = this.configManager.getActiveEnvironment();
      if (!activeEnv) {
        vscode.window.showErrorMessage('No active environment configured');
        return;
      }

      // Deploy changes
      this.outputChannel.appendLine('\n=== Deploying Changes ===\n');

      const adapter = new AmorphieRuntimeAdapter();
      let successCount = 0;
      let failureCount = 0;

      for (const [componentId, violations] of componentChanges) {
        const isNew = violations.some(v => v.type === 'node-added');
        const localNode = this.localGraph.nodes.get(componentId);

        if (!localNode) {
          this.outputChannel.appendLine(`✗ ${componentId}: Local node not found`);
          failureCount++;
          continue;
        }

        if (!localNode.definition) {
          this.outputChannel.appendLine(`✗ ${componentId}: No definition found`);
          failureCount++;
          continue;
        }

        this.outputChannel.appendLine(`${isNew ? 'Creating' : 'Updating'} ${componentId}...`);

        try {
          // Read the full document from the file
          let fullDocument: any;

          if (localNode.metadata?.filePath) {
            // Re-read the original file to get the full structure
            const fs = await import('fs/promises');
            const fileContent = await fs.readFile(localNode.metadata.filePath, 'utf-8');
            fullDocument = JSON.parse(fileContent);
          } else {
            // Fallback: reconstruct from GraphNode (shouldn't happen for local nodes)
            fullDocument = {
              key: localNode.ref.key,
              version: localNode.ref.version,
              domain: localNode.ref.domain,
              flow: localNode.ref.flow,
              flowVersion: localNode.ref.version,
              tags: localNode.tags || [],
              attributes: localNode.definition || {}
            };
          }

          if (isNew) {
            // Create new component
            const result = await adapter.createComponent(
              localNode.type,
              fullDocument,
              activeEnv
            );

            if (result.success) {
              this.outputChannel.appendLine(`  ✓ Created successfully (ID: ${result.instanceId})`);
              successCount++;
            } else {
              this.outputChannel.appendLine(`  ✗ Failed: ${result.error}`);
              failureCount++;
            }
          } else {
            // Update existing component
            const runtimeNode = this.runtimeGraph.nodes.get(componentId);
            const runtimeId = runtimeNode?.metadata?.runtimeId;
            const etag = runtimeNode?.metadata?.etag;

            if (!runtimeId) {
              this.outputChannel.appendLine(`  ✗ Runtime ID not found`);
              failureCount++;
              continue;
            }

            const result = await adapter.updateComponent(
              localNode.type,
              runtimeId,
              fullDocument,
              activeEnv,
              etag
            );

            if (result.success) {
              this.outputChannel.appendLine(`  ✓ Updated successfully`);
              successCount++;
            } else {
              this.outputChannel.appendLine(`  ✗ Failed: ${result.error}`);
              failureCount++;
            }
          }
        } catch (error) {
          this.outputChannel.appendLine(`  ✗ Exception: ${error}`);
          failureCount++;
        }
      }

      this.outputChannel.appendLine('');
      this.outputChannel.appendLine('=== Deployment Summary ===');
      this.outputChannel.appendLine(`Success: ${successCount}`);
      this.outputChannel.appendLine(`Failed: ${failureCount}`);

      if (failureCount === 0) {
        vscode.window.showInformationMessage(
          `Deployment successful: ${successCount} component(s) deployed`
        );
      } else {
        vscode.window.showWarningMessage(
          `Deployment completed with errors: ${successCount} succeeded, ${failureCount} failed`
        );
      }

      // Refresh runtime graph after deployment
      if (successCount > 0) {
        this.outputChannel.appendLine('\nRefreshing runtime graph...');
        await this.fetchRuntimeGraph();
      }
    } catch (error) {
      this.outputChannel.appendLine(`\n✗ Error during deployment: ${error}`);
      vscode.window.showErrorMessage(`Deployment failed: ${error}`);
    }
  }

  /**
   * Display graph delta in output channel
   */
  private displayGraphDelta(delta: GraphDelta): void {
    this.outputChannel.appendLine('\n=== Graph Diff Results ===\n');
    this.outputChannel.appendLine(`Total Violations: ${delta.stats.totalViolations}`);
    this.outputChannel.appendLine(`  Errors: ${delta.stats.errorCount}`);
    this.outputChannel.appendLine(`  Warnings: ${delta.stats.warningCount}`);
    this.outputChannel.appendLine(`  Info: ${delta.stats.infoCount}`);
    this.outputChannel.appendLine('');

    if (delta.bySeverity.error.length > 0) {
      this.outputChannel.appendLine('ERRORS:');
      for (const violation of delta.bySeverity.error) {
        this.outputChannel.appendLine(`  ✗ [${violation.type}] ${violation.message}`);
      }
      this.outputChannel.appendLine('');
    }

    if (delta.bySeverity.warning.length > 0) {
      this.outputChannel.appendLine('WARNINGS:');
      for (const violation of delta.bySeverity.warning) {
        this.outputChannel.appendLine(`  ⚠ [${violation.type}] ${violation.message}`);
      }
      this.outputChannel.appendLine('');
    }

    if (delta.bySeverity.info.length > 0) {
      this.outputChannel.appendLine('INFO:');
      for (const violation of delta.bySeverity.info) {
        this.outputChannel.appendLine(`  ℹ [${violation.type}] ${violation.message}`);
      }
      this.outputChannel.appendLine('');
    }
  }

  /**
   * Display impact cone in output channel
   */
  private displayImpactCone(cone: ImpactCone): void {
    this.outputChannel.appendLine('\n=== Impact Analysis ===\n');
    this.outputChannel.appendLine(`Total Affected: ${cone.stats.totalAffected}`);
    this.outputChannel.appendLine(`Max Depth: ${cone.stats.maxDepth}`);
    this.outputChannel.appendLine('');

    this.outputChannel.appendLine('Affected by Type:');
    for (const [type, count] of Object.entries(cone.stats.byType)) {
      this.outputChannel.appendLine(`  ${type}: ${count}`);
    }
    this.outputChannel.appendLine('');

    if (cone.dependencyPaths.length > 0) {
      this.outputChannel.appendLine('Dependency Paths:');
      for (const path of cone.dependencyPaths.slice(0, 10)) {
        this.outputChannel.appendLine(`  ${path.pathString}`);
      }
      if (cone.dependencyPaths.length > 10) {
        this.outputChannel.appendLine(`  ... and ${cone.dependencyPaths.length - 10} more paths`);
      }
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.outputChannel.dispose();
  }
}

/**
 * Register graph analysis commands
 */
export function registerGraphCommands(context: vscode.ExtensionContext): void {
  const manager = new GraphAnalysisManager(context);

  // Initialize on activation
  manager.initialize();

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('graphAnalysis.buildLocalGraph', () =>
      manager.buildLocalGraph()
    ),
    vscode.commands.registerCommand('graphAnalysis.fetchRuntimeGraph', () =>
      manager.fetchRuntimeGraph()
    ),
    vscode.commands.registerCommand('graphAnalysis.diffGraphs', () =>
      manager.diffGraphs()
    ),
    vscode.commands.registerCommand('graphAnalysis.impactAnalysis', () =>
      manager.impactAnalysis()
    ),
    vscode.commands.registerCommand('graphAnalysis.deployChanges', () =>
      manager.deployChanges()
    ),
    manager
  );
}
