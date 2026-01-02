/**
 * VS Code commands for vnext-template project tools
 */

import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ProjectDetector, type ProjectInfo } from './ProjectDetector';
import type { VNextToolsProvider } from './VNextToolsProvider';

const execAsync = promisify(exec);

export class VNextToolsManager {
  private outputChannel: vscode.OutputChannel;
  private projectDetector: ProjectDetector;

  constructor(
    private context: vscode.ExtensionContext,
    private provider?: VNextToolsProvider
  ) {
    this.outputChannel = vscode.window.createOutputChannel('vNext Tools');
    this.projectDetector = new ProjectDetector();
  }

  /**
   * Create a new vnext-template project
   */
  async createProject(): Promise<void> {
    // Prompt for domain name
    const domainName = await vscode.window.showInputBox({
      prompt: 'Enter the domain name for the new project',
      placeHolder: 'my-domain',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Domain name is required';
        }
        if (!/^[a-z][a-z0-9-]*$/.test(value)) {
          return 'Domain name must start with a letter and contain only lowercase letters, numbers, and hyphens';
        }
        return undefined;
      }
    });

    if (!domainName) {
      return; // User cancelled
    }

    // Prompt for parent folder
    const folderUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select Parent Folder',
      title: 'Select folder to create project in'
    });

    if (!folderUri || folderUri.length === 0) {
      return; // User cancelled
    }

    const parentPath = folderUri[0].fsPath;

    this.outputChannel.show();
    this.outputChannel.appendLine('');
    this.outputChannel.appendLine('='.repeat(60));
    this.outputChannel.appendLine(`Creating new vnext-template project: ${domainName}`);
    this.outputChannel.appendLine(`Location: ${parentPath}`);
    this.outputChannel.appendLine('='.repeat(60));
    this.outputChannel.appendLine('');

    try {
      // Run npx to create the project
      const command = `npx @burgan-tech/vnext-template ${domainName}`;
      this.outputChannel.appendLine(`Running: ${command}`);
      this.outputChannel.appendLine('');

      const { stdout, stderr } = await execAsync(command, {
        cwd: parentPath,
        env: { ...process.env, FORCE_COLOR: '0' }
      });

      if (stdout) {
        this.outputChannel.appendLine(stdout);
      }
      if (stderr) {
        this.outputChannel.appendLine(stderr);
      }

      this.outputChannel.appendLine('');
      this.outputChannel.appendLine('Project created successfully!');

      // Offer to open the new project
      const path = await import('path');
      const projectPath = path.join(parentPath, domainName);

      const action = await vscode.window.showInformationMessage(
        `Project "${domainName}" created successfully!`,
        'Open in New Window',
        'Open in Current Window',
        'Close'
      );

      if (action === 'Open in New Window') {
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath), true);
      } else if (action === 'Open in Current Window') {
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath), false);
      } else {
        // User chose "Close" - refresh the sidebar in case project was created in current workspace
        this.provider?.refresh();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine('');
      this.outputChannel.appendLine(`ERROR: ${errorMessage}`);

      // Show stdout/stderr from error if available
      if (error && typeof error === 'object' && 'stdout' in error) {
        this.outputChannel.appendLine((error as { stdout: string }).stdout);
      }
      if (error && typeof error === 'object' && 'stderr' in error) {
        this.outputChannel.appendLine((error as { stderr: string }).stderr);
      }

      vscode.window.showErrorMessage(`Failed to create project: ${errorMessage}`);
    }
  }

  /**
   * Run validate script
   */
  async validate(): Promise<void> {
    const project = await this.ensureVNextProject();
    if (!project) return;

    if (!project.hasValidateScript) {
      vscode.window.showWarningMessage('This project does not have a validate script in package.json');
      return;
    }

    await this.runNpmScript('validate', project.rootPath!);
  }

  /**
   * Run build script with type selection
   */
  async build(): Promise<void> {
    const project = await this.ensureVNextProject();
    if (!project) return;

    if (!project.hasBuildScript) {
      vscode.window.showWarningMessage('This project does not have a build script in package.json');
      return;
    }

    // Ask for build type
    const buildType = await vscode.window.showQuickPick([
      {
        label: 'Runtime Package',
        description: 'For deployment to vNext runtime',
        value: 'runtime'
      },
      {
        label: 'Reference Package',
        description: 'For use by other domains',
        value: 'reference'
      },
      {
        label: 'Both',
        description: 'Build both package types',
        value: 'both'
      }
    ], {
      placeHolder: 'Select build type'
    });

    if (!buildType) {
      return; // User cancelled
    }

    let buildArg = '';
    if (buildType.value === 'runtime') {
      buildArg = ' -- --runtime';
    } else if (buildType.value === 'reference') {
      buildArg = ' -- --reference';
    }
    // 'both' uses default (no args)

    await this.runNpmScript(`build${buildArg}`, project.rootPath!);
  }

  /**
   * Run runtime build directly
   */
  async buildRuntime(): Promise<void> {
    const project = await this.ensureVNextProject();
    if (!project) return;

    if (!project.hasBuildScript) {
      vscode.window.showWarningMessage('This project does not have a build script in package.json');
      return;
    }

    await this.runNpmScript('build -- --runtime', project.rootPath!);
  }

  /**
   * Run reference build directly
   */
  async buildReference(): Promise<void> {
    const project = await this.ensureVNextProject();
    if (!project) return;

    if (!project.hasBuildScript) {
      vscode.window.showWarningMessage('This project does not have a build script in package.json');
      return;
    }

    await this.runNpmScript('build -- --reference', project.rootPath!);
  }

  /**
   * Run setup script
   */
  async setup(): Promise<void> {
    const project = await this.ensureVNextProject();
    if (!project) return;

    if (!project.hasSetupScript) {
      vscode.window.showWarningMessage('This project does not have a setup script in package.json');
      return;
    }

    await this.runNpmScript('setup', project.rootPath!);
  }

  /**
   * Refresh project status
   */
  async refreshStatus(): Promise<void> {
    this.projectDetector.clearCache();
    this.provider?.refresh();
    vscode.window.showInformationMessage('Project status refreshed');
  }

  /**
   * Get current project info
   */
  async getProjectInfo(): Promise<ProjectInfo> {
    return this.projectDetector.detectProject();
  }

  /**
   * Show output channel
   */
  showOutput(): void {
    this.outputChannel.show();
  }

  /**
   * Ensure we're in a vnext project, show error if not
   */
  private async ensureVNextProject(): Promise<ProjectInfo | null> {
    const project = await this.projectDetector.detectProject();

    if (!project.isVNextProject) {
      const action = await vscode.window.showWarningMessage(
        'This is not a vnext-template project. Would you like to create one?',
        'Create Project',
        'Cancel'
      );

      if (action === 'Create Project') {
        await this.createProject();
      }
      return null;
    }

    return project;
  }

  /**
   * Run an npm script and display output
   */
  private async runNpmScript(script: string, cwd: string): Promise<void> {
    this.outputChannel.show();
    this.outputChannel.appendLine('');
    this.outputChannel.appendLine('='.repeat(60));
    this.outputChannel.appendLine(`Running: npm run ${script}`);
    this.outputChannel.appendLine(`Directory: ${cwd}`);
    this.outputChannel.appendLine(`Started: ${new Date().toLocaleString()}`);
    this.outputChannel.appendLine('='.repeat(60));
    this.outputChannel.appendLine('');

    try {
      const startTime = Date.now();
      const { stdout, stderr } = await execAsync(`npm run ${script}`, {
        cwd,
        env: { ...process.env, FORCE_COLOR: '0' },
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      if (stdout) {
        this.outputChannel.appendLine(stdout);
      }
      if (stderr) {
        this.outputChannel.appendLine(stderr);
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.outputChannel.appendLine('');
      this.outputChannel.appendLine('='.repeat(60));
      this.outputChannel.appendLine(`Completed in ${elapsed}s`);
      this.outputChannel.appendLine('='.repeat(60));

      vscode.window.showInformationMessage(`npm run ${script.split(' ')[0]} completed successfully`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Show stdout/stderr from error if available
      if (error && typeof error === 'object' && 'stdout' in error) {
        this.outputChannel.appendLine((error as { stdout: string }).stdout);
      }
      if (error && typeof error === 'object' && 'stderr' in error) {
        this.outputChannel.appendLine((error as { stderr: string }).stderr);
      }

      this.outputChannel.appendLine('');
      this.outputChannel.appendLine('='.repeat(60));
      this.outputChannel.appendLine(`FAILED: ${errorMessage}`);
      this.outputChannel.appendLine('='.repeat(60));

      vscode.window.showErrorMessage(`npm run ${script.split(' ')[0]} failed. Check output for details.`);
    }
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}

/**
 * Register all vnext-tools commands
 */
export function registerVNextToolsCommands(
  context: vscode.ExtensionContext,
  provider?: VNextToolsProvider
): VNextToolsManager {
  const manager = new VNextToolsManager(context, provider);

  context.subscriptions.push(
    vscode.commands.registerCommand('vnextTools.createProject', () => manager.createProject()),
    vscode.commands.registerCommand('vnextTools.validate', () => manager.validate()),
    vscode.commands.registerCommand('vnextTools.build', () => manager.build()),
    vscode.commands.registerCommand('vnextTools.buildRuntime', () => manager.buildRuntime()),
    vscode.commands.registerCommand('vnextTools.buildReference', () => manager.buildReference()),
    vscode.commands.registerCommand('vnextTools.setup', () => manager.setup()),
    vscode.commands.registerCommand('vnextTools.refreshStatus', () => manager.refreshStatus()),
    vscode.commands.registerCommand('vnextTools.openOutput', () => manager.showOutput()),
    manager
  );

  return manager;
}
