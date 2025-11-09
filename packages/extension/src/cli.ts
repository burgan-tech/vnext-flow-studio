import * as vscode from 'vscode';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Strip ANSI color codes from text
 */
function stripAnsiCodes(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

export interface CliStatus {
  installed: boolean;
  version?: string;
  configured: boolean;
  projectRoot?: string;
  apiReachable?: boolean;
  dbReachable?: boolean;
}

export interface DeployResult {
  success: boolean;
  message: string;
  output: string;
}

/**
 * Check if vnext-workflow-cli is installed
 */
export async function checkCliInstalled(): Promise<boolean> {
  try {
    await execAsync('wf --version');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get CLI version
 */
export async function getCliVersion(): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync('wf --version');
    return stdout.trim();
  } catch {
    return undefined;
  }
}

/**
 * Get current PROJECT_ROOT configuration
 */
export async function getProjectRoot(): Promise<string | undefined> {
  try {
    const { stdout, stderr } = await execAsync('wf config get PROJECT_ROOT');
    console.log('[CLI] getProjectRoot stdout:', stdout);
    console.log('[CLI] getProjectRoot stderr:', stderr);
    const value = stdout.trim();

    // Filter out any empty strings or error messages
    if (!value || value.includes('not found') || value.includes('not set')) {
      return undefined;
    }

    // Parse output format: "PROJECT_ROOT: /path/to/project"
    // Extract the path after the colon
    if (value.includes('PROJECT_ROOT:')) {
      const parts = value.split('PROJECT_ROOT:');
      if (parts.length > 1) {
        return parts[1].trim();
      }
    }

    // Fallback: return the whole value if it doesn't match expected format
    return value;
  } catch (error: unknown) {
    console.error('[CLI] getProjectRoot error:', error);
    return undefined;
  }
}

/**
 * Check CLI status (installation, configuration, connectivity)
 */
export async function checkStatus(outputChannel?: vscode.OutputChannel): Promise<CliStatus> {
  const status: CliStatus = {
    installed: false,
    configured: false,
  };

  // Check if installed
  status.installed = await checkCliInstalled();
  if (!status.installed) {
    console.log('[CLI] checkStatus: CLI not installed');
    return status;
  }

  // Get version
  status.version = await getCliVersion();
  console.log('[CLI] checkStatus: version =', status.version);

  // Get project root
  status.projectRoot = await getProjectRoot();
  console.log('[CLI] checkStatus: projectRoot =', status.projectRoot);

  // Run wf check command
  return new Promise((resolve) => {
    const options: any = {
      shell: true,  // Run through shell to get proper environment
      env: {
        ...process.env,
        FORCE_COLOR: '1',  // Enable colored output
        CLICOLOR_FORCE: '1'  // Force color for some CLIs
      }
    };

    // Set working directory to project root if available
    if (status.projectRoot) {
      options.cwd = status.projectRoot;
      console.log('[CLI] Running wf check with cwd:', status.projectRoot);
    }

    const childProcess = spawn('wf', ['check'], options);
    let output = '';

    childProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      if (outputChannel) {
        outputChannel.append(stripAnsiCodes(text));
      }
    });

    childProcess.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      if (outputChannel) {
        outputChannel.append(stripAnsiCodes(text));
      }
    });

    childProcess.on('close', (code) => {
      console.log('[CLI] wf check output:', output);
      console.log('[CLI] wf check exit code:', code);

      // Parse output to determine status
      status.configured = !output.includes('PROJECT_ROOT not set') && !output.includes('not found');
      status.apiReachable = output.includes('API') && output.includes('✓') || output.includes('OK');
      status.dbReachable = output.includes('DB') && output.includes('✓') || output.includes('OK');

      console.log('[CLI] checkStatus final:', status);
      resolve(status);
    });

    childProcess.on('error', (err) => {
      console.error('[CLI] wf check error:', err);
      resolve(status);
    });
  });
}

/**
 * Deploy a single workflow file
 */
export async function deployFile(
  filePath: string,
  terminal: vscode.Terminal
): Promise<DeployResult> {
  terminal.show(true);

  // Get project root and build command
  const projectRoot = await getProjectRoot();

  let command = `wf update --file "${filePath}"`;
  if (projectRoot) {
    // Change to project root directory first
    command = `cd "${projectRoot}" && ${command}`;
  }

  terminal.sendText(command);

  // Since we can't easily capture exit codes from terminal.sendText,
  // we'll assume success and let the user see the output in the terminal
  // TODO: Consider using a pseudo-terminal for better integration if needed
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Deployment command sent to terminal',
        output: command
      });
    }, 500);
  });
}

/**
 * Deploy all Git-changed workflow files
 */
export async function deployChanged(terminal: vscode.Terminal): Promise<DeployResult> {
  terminal.show(true);

  // Get project root and build command
  const projectRoot = await getProjectRoot();

  let command = 'wf update';
  if (projectRoot) {
    // Change to project root directory first
    command = `cd "${projectRoot}" && ${command}`;
  }

  terminal.sendText(command);

  // Since we can't easily capture exit codes from terminal.sendText,
  // we'll assume success and let the user see the output in the terminal
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Deployment command sent to terminal',
        output: command
      });
    }, 500);
  });
}

/**
 * Install the vnext-workflow-cli package globally
 */
export async function installCli(outputChannel: vscode.OutputChannel): Promise<DeployResult> {
  return new Promise((resolve) => {
    outputChannel.appendLine('\n📦 Installing vnext-workflow-cli...\n');
    outputChannel.show(true);

    const options: any = {
      shell: true,  // Run through shell to get proper environment
      env: process.env  // Use the current process environment
    };

    const childProcess = spawn('npm', ['install', '-g', '@burgan-tech/vnext-workflow-cli'], options);
    let output = '';

    childProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      outputChannel.append(stripAnsiCodes(text));
    });

    childProcess.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      outputChannel.append(stripAnsiCodes(text));
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        outputChannel.appendLine('\n✓ CLI installed successfully\n');
        resolve({
          success: true,
          message: 'CLI installed successfully',
          output
        });
      } else {
        outputChannel.appendLine(`\n✗ Installation failed with exit code ${code}\n`);
        resolve({
          success: false,
          message: `Installation failed with exit code ${code}`,
          output
        });
      }
    });

    childProcess.on('error', (error) => {
      const message = `Failed to install CLI: ${error.message}`;
      outputChannel.appendLine(`\n✗ ${message}\n`);
      resolve({
        success: false,
        message,
        output
      });
    });
  });
}

/**
 * Configure the CLI with project root
 */
export async function configureCli(
  projectRoot: string,
  outputChannel: vscode.OutputChannel
): Promise<DeployResult> {
  return new Promise((resolve) => {
    outputChannel.appendLine(`\n⚙️ Configuring CLI with project root: ${projectRoot}\n`);
    outputChannel.show(true);

    const options: any = {
      shell: true,  // Run through shell to get proper environment
      env: process.env  // Use the current process environment
    };

    const childProcess = spawn('wf', ['config', 'set', 'PROJECT_ROOT', projectRoot], options);
    let output = '';

    childProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      outputChannel.append(stripAnsiCodes(text));
    });

    childProcess.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      outputChannel.append(stripAnsiCodes(text));
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        outputChannel.appendLine('\n✓ CLI configured successfully\n');
        resolve({
          success: true,
          message: 'CLI configured successfully',
          output
        });
      } else {
        outputChannel.appendLine(`\n✗ Configuration failed with exit code ${code}\n`);
        resolve({
          success: false,
          message: `Configuration failed with exit code ${code}`,
          output
        });
      }
    });

    childProcess.on('error', (error) => {
      const message = `Failed to configure CLI: ${error.message}`;
      outputChannel.appendLine(`\n✗ ${message}\n`);
      resolve({
        success: false,
        message,
        output
      });
    });
  });
}

/**
 * Change project root with folder picker
 */
export async function changeProjectRoot(outputChannel: vscode.OutputChannel): Promise<DeployResult> {
  // Show folder picker
  const folders = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Select Project Root',
    title: 'Select Project Root for vnext-workflow-cli'
  });

  if (!folders || folders.length === 0) {
    return {
      success: false,
      message: 'No folder selected',
      output: ''
    };
  }

  const selectedPath = folders[0].fsPath;
  return await configureCli(selectedPath, outputChannel);
}

/**
 * Show CLI installation guide
 */
export async function showInstallationGuide(): Promise<void> {
  const install = 'Install CLI';
  const cancel = 'Cancel';

  const choice = await vscode.window.showErrorMessage(
    'vnext-workflow-cli is not installed. Would you like to install it?',
    install,
    cancel
  );

  if (choice === install) {
    const terminal = vscode.window.createTerminal('Install vnext-workflow-cli');
    terminal.show();
    terminal.sendText('npm install -g @burgan-tech/vnext-workflow-cli');
  }
}

/**
 * Show CLI configuration guide
 */
export async function showConfigurationGuide(): Promise<void> {
  const configure = 'Configure';
  const cancel = 'Cancel';

  const choice = await vscode.window.showWarningMessage(
    'vnext-workflow-cli is not configured. Would you like to configure it?',
    configure,
    cancel
  );

  if (choice === configure) {
    const projectRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (projectRoot) {
      const terminal = vscode.window.createTerminal('Configure vnext-workflow-cli');
      terminal.show();
      terminal.sendText(`wf config set PROJECT_ROOT ${projectRoot}`);
      terminal.sendText('wf check');
    } else {
      vscode.window.showErrorMessage('No workspace folder found');
    }
  }
}
