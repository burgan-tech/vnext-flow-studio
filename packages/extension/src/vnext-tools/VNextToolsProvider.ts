/**
 * Tree view provider for vNext Tools sidebar
 */

import * as vscode from 'vscode';
import { ProjectDetector, type ProjectInfo } from './ProjectDetector';

type TreeItemContextValue =
  | 'category'
  | 'status-item'
  | 'action-create'
  | 'action-open'
  | 'action-validate'
  | 'action-build'
  | 'action-build-runtime'
  | 'action-build-reference'
  | 'action-setup';

export class VNextTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly contextValue: TreeItemContextValue,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
    public readonly command?: vscode.Command,
    public readonly description?: string,
    public readonly iconPath?: vscode.ThemeIcon
  ) {
    super(label, collapsibleState);
    this.contextValue = contextValue;
    this.description = description;
    this.iconPath = iconPath;
    this.command = command;
  }
}

export class VNextToolsProvider implements vscode.TreeDataProvider<VNextTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<VNextTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private projectDetector: ProjectDetector;
  private cachedProjectInfo?: ProjectInfo;
  private fileWatcher?: vscode.FileSystemWatcher;

  constructor(private context: vscode.ExtensionContext) {
    this.projectDetector = new ProjectDetector();

    // Watch for workspace changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.setupFileWatcher();
        this.refresh();
      })
    );

    // Watch for window focus (detects when VS Code regains focus after folder operations)
    context.subscriptions.push(
      vscode.window.onDidChangeWindowState((e) => {
        if (e.focused) {
          // Delay slightly to ensure filesystem is ready
          setTimeout(() => this.refresh(), 500);
        }
      })
    );

    // Initial file watcher setup
    this.setupFileWatcher();
  }

  /**
   * Setup file watcher for vnext.config.json and package.json
   */
  private setupFileWatcher(): void {
    // Dispose existing watcher
    this.fileWatcher?.dispose();

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    // Watch for vnext.config.json and package.json changes
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceFolders[0], '{vnext.config.json,package.json}')
    );

    this.fileWatcher.onDidCreate(() => this.refresh());
    this.fileWatcher.onDidChange(() => this.refresh());
    this.fileWatcher.onDidDelete(() => this.refresh());

    this.context.subscriptions.push(this.fileWatcher);
  }

  refresh(): void {
    this.projectDetector.clearCache();
    this.cachedProjectInfo = undefined;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: VNextTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: VNextTreeItem): Promise<VNextTreeItem[]> {
    if (!element) {
      // Root level
      return this.getRootItems();
    }

    // Children of categories
    const project = this.cachedProjectInfo;
    if (!project) {
      return [];
    }

    if (element.label === 'Project Status' && project.isVNextProject) {
      return this.getStatusItems(project);
    }

    if (element.label === 'Actions' && project.isVNextProject) {
      return this.getActionItems(project);
    }

    if (element.label === 'Build Project') {
      return this.getBuildSubItems();
    }

    return [];
  }

  private async getRootItems(): Promise<VNextTreeItem[]> {
    const project = await this.projectDetector.detectProject();
    this.cachedProjectInfo = project;

    if (!project.isVNextProject) {
      // Not a vnext project - show create/open options
      return [
        new VNextTreeItem(
          'Create New Project',
          'action-create',
          vscode.TreeItemCollapsibleState.None,
          { command: 'vnextTools.createProject', title: 'Create New Project' },
          undefined,
          new vscode.ThemeIcon('add')
        ),
        new VNextTreeItem(
          'Open Existing Project',
          'action-open',
          vscode.TreeItemCollapsibleState.None,
          { command: 'vscode.openFolder', title: 'Open Folder' },
          undefined,
          new vscode.ThemeIcon('folder-opened')
        )
      ];
    }

    // Is a vnext project - show status and actions
    return [
      new VNextTreeItem(
        'Project Status',
        'category',
        vscode.TreeItemCollapsibleState.Expanded,
        undefined,
        undefined,
        new vscode.ThemeIcon('info')
      ),
      new VNextTreeItem(
        'Actions',
        'category',
        vscode.TreeItemCollapsibleState.Expanded,
        undefined,
        undefined,
        new vscode.ThemeIcon('play')
      )
    ];
  }

  private getStatusItems(project: ProjectInfo): VNextTreeItem[] {
    const items: VNextTreeItem[] = [];

    if (project.domain) {
      items.push(
        new VNextTreeItem(
          'Domain',
          'status-item',
          vscode.TreeItemCollapsibleState.None,
          undefined,
          project.domain,
          new vscode.ThemeIcon('symbol-namespace')
        )
      );
    }

    if (project.config?.runtimeVersion) {
      items.push(
        new VNextTreeItem(
          'Runtime Version',
          'status-item',
          vscode.TreeItemCollapsibleState.None,
          undefined,
          project.config.runtimeVersion,
          new vscode.ThemeIcon('versions')
        )
      );
    }

    if (project.config?.schemaVersion) {
      items.push(
        new VNextTreeItem(
          'Schema Version',
          'status-item',
          vscode.TreeItemCollapsibleState.None,
          undefined,
          project.config.schemaVersion,
          new vscode.ThemeIcon('symbol-interface')
        )
      );
    }

    // Show available scripts
    const scripts: string[] = [];
    if (project.hasValidateScript) scripts.push('validate');
    if (project.hasBuildScript) scripts.push('build');
    if (project.hasSetupScript) scripts.push('setup');

    if (scripts.length > 0) {
      items.push(
        new VNextTreeItem(
          'Available Scripts',
          'status-item',
          vscode.TreeItemCollapsibleState.None,
          undefined,
          scripts.join(', '),
          new vscode.ThemeIcon('terminal')
        )
      );
    }

    return items;
  }

  private getActionItems(project: ProjectInfo): VNextTreeItem[] {
    const items: VNextTreeItem[] = [];

    if (project.hasValidateScript) {
      items.push(
        new VNextTreeItem(
          'Validate Project',
          'action-validate',
          vscode.TreeItemCollapsibleState.None,
          { command: 'vnextTools.validate', title: 'Validate Project' },
          undefined,
          new vscode.ThemeIcon('check')
        )
      );
    }

    if (project.hasBuildScript) {
      items.push(
        new VNextTreeItem(
          'Build Project',
          'action-build',
          vscode.TreeItemCollapsibleState.Collapsed,
          undefined,
          undefined,
          new vscode.ThemeIcon('package')
        )
      );
    }

    if (project.hasSetupScript) {
      items.push(
        new VNextTreeItem(
          'Initialize Domain',
          'action-setup',
          vscode.TreeItemCollapsibleState.None,
          { command: 'vnextTools.setup', title: 'Initialize Domain' },
          undefined,
          new vscode.ThemeIcon('gear')
        )
      );
    }

    return items;
  }

  private getBuildSubItems(): VNextTreeItem[] {
    return [
      new VNextTreeItem(
        'Runtime Package',
        'action-build-runtime',
        vscode.TreeItemCollapsibleState.None,
        { command: 'vnextTools.buildRuntime', title: 'Build Runtime Package' },
        'For deployment',
        new vscode.ThemeIcon('rocket')
      ),
      new VNextTreeItem(
        'Reference Package',
        'action-build-reference',
        vscode.TreeItemCollapsibleState.None,
        { command: 'vnextTools.buildReference', title: 'Build Reference Package' },
        'For cross-domain use',
        new vscode.ThemeIcon('references')
      )
    ];
  }

  dispose(): void {
    this.fileWatcher?.dispose();
    this._onDidChangeTreeData.dispose();
  }
}
