/**
 * Settings editor for Amorphie VS Code configuration
 */

import * as vscode from 'vscode';

export class SettingsEditorProvider {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new SettingsEditorProvider(context);

    const command = vscode.commands.registerCommand(
      'amorphie.openSettings',
      () => provider.openSettings()
    );

    return command;
  }

  constructor(private context: vscode.ExtensionContext) {}

  async openSettings(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'amorphieSettings',
      'Amorphie Settings',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = this.getWebviewContent(panel.webview);

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'load':
          await this.loadSettings(panel.webview);
          break;
        case 'save':
          await this.saveSettings(message.settings);
          break;
        case 'addEnvironment':
          await this.addEnvironment(panel.webview, message.environment);
          break;
        case 'deleteEnvironment':
          await this.deleteEnvironment(panel.webview, message.id);
          break;
        case 'setActiveEnvironment':
          await this.setActiveEnvironment(panel.webview, message.id);
          break;
      }
    });

    // Load initial settings
    await this.loadSettings(panel.webview);
  }

  private async loadSettings(webview: vscode.Webview): Promise<void> {
    const config = vscode.workspace.getConfiguration();
    let environments = config.get('amorphie.environments') || {};
    let activeEnvironment = config.get('amorphie.activeEnvironment') || null;

    // If no environments configured, set up defaults
    if (Object.keys(environments).length === 0) {
      const shouldSetupDefaults = await vscode.window.showInformationMessage(
        'No deployment environment configured. Would you like to set up the default development environment?',
        'Set up defaults',
        'Skip'
      );

      if (shouldSetupDefaults === 'Set up defaults') {
        const defaultEnv = {
          id: 'local',
          name: 'local',
          baseUrl: 'http://localhost:4201',
          domain: 'core',
          database: {
            database: 'vNext_WorkflowDb',
            user: 'postgres',
            password: 'postgres',
            useDocker: true,
            dockerContainer: 'vnext-postgres'
          }
        };

        environments = { local: defaultEnv };
        activeEnvironment = 'local';

        // Save the defaults
        await config.update('amorphie.environments', environments, vscode.ConfigurationTarget.Workspace);
        await config.update('amorphie.activeEnvironment', activeEnvironment, vscode.ConfigurationTarget.Workspace);

        vscode.window.showInformationMessage('Default development environment configured successfully!');
      }
    }

    const settings = {
      environments,
      activeEnvironment,
      basePath: config.get('amorphie.basePath') || null,
      cacheEnabled: config.get('amorphie.cache.enabled') ?? true,
      cacheTtlMs: config.get('amorphie.cache.ttlMs') || 300000
    };

    webview.postMessage({
      type: 'settings',
      settings
    });
  }

  private async saveSettings(settings: any): Promise<void> {
    const config = vscode.workspace.getConfiguration();

    await config.update(
      'amorphie.environments',
      settings.environments,
      vscode.ConfigurationTarget.Workspace
    );

    await config.update(
      'amorphie.activeEnvironment',
      settings.activeEnvironment,
      vscode.ConfigurationTarget.Workspace
    );

    if (settings.basePath !== null && settings.basePath !== '') {
      await config.update(
        'amorphie.basePath',
        settings.basePath,
        vscode.ConfigurationTarget.Workspace
      );
    }

    await config.update(
      'amorphie.cache.enabled',
      settings.cacheEnabled,
      vscode.ConfigurationTarget.Workspace
    );

    await config.update(
      'amorphie.cache.ttlMs',
      settings.cacheTtlMs,
      vscode.ConfigurationTarget.Workspace
    );

    vscode.window.showInformationMessage('Amorphie settings saved successfully');
  }

  private async addEnvironment(webview: vscode.Webview, environment: any): Promise<void> {
    const config = vscode.workspace.getConfiguration();
    const environments = config.get('amorphie.environments') as any || {};

    environments[environment.id] = environment;

    await config.update(
      'amorphie.environments',
      environments,
      vscode.ConfigurationTarget.Workspace
    );

    await this.loadSettings(webview);
    vscode.window.showInformationMessage(`Environment '${environment.name}' added`);
  }

  private async deleteEnvironment(webview: vscode.Webview, id: string): Promise<void> {
    const config = vscode.workspace.getConfiguration();
    const environments = config.get('amorphie.environments') as any || {};

    delete environments[id];

    await config.update(
      'amorphie.environments',
      environments,
      vscode.ConfigurationTarget.Workspace
    );

    // If this was the active environment, clear it
    const activeEnv = config.get('amorphie.activeEnvironment');
    if (activeEnv === id) {
      await config.update(
        'amorphie.activeEnvironment',
        null,
        vscode.ConfigurationTarget.Workspace
      );
    }

    await this.loadSettings(webview);
    vscode.window.showInformationMessage(`Environment '${id}' deleted`);
  }

  private async setActiveEnvironment(webview: vscode.Webview, id: string): Promise<void> {
    const config = vscode.workspace.getConfiguration();

    await config.update(
      'amorphie.activeEnvironment',
      id,
      vscode.ConfigurationTarget.Workspace
    );

    await this.loadSettings(webview);
    vscode.window.showInformationMessage(`Active environment set to '${id}'`);
  }

  private getWebviewContent(_webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Amorphie Settings</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 20px;
      line-height: 1.6;
    }

    h1 {
      font-size: 24px;
      margin-bottom: 8px;
      font-weight: 600;
    }

    h2 {
      font-size: 18px;
      margin: 24px 0 12px 0;
      font-weight: 600;
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 8px;
    }

    .subtitle {
      color: var(--vscode-descriptionForeground);
      margin-bottom: 24px;
    }

    .section {
      margin-bottom: 32px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    label {
      display: block;
      margin-bottom: 4px;
      font-weight: 500;
    }

    input[type="text"],
    input[type="number"],
    select {
      width: 100%;
      padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    input[type="text"]:focus,
    input[type="number"]:focus,
    select:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }

    input[type="checkbox"] {
      margin-right: 8px;
    }

    button {
      padding: 6px 14px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 2px;
      cursor: pointer;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      margin-right: 8px;
      margin-top: 8px;
    }

    button:hover {
      background: var(--vscode-button-hoverBackground);
    }

    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    button.danger {
      background: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-inputValidation-errorForeground);
    }

    .env-list {
      margin-top: 16px;
    }

    .env-item {
      padding: 12px;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      margin-bottom: 8px;
    }

    .env-item.active {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-activeSelectionBackground);
    }

    .env-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .env-title {
      font-weight: 600;
      font-size: 14px;
    }

    .env-badge {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 500;
    }

    .env-details {
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }

    .env-actions {
      display: flex;
      gap: 8px;
    }

    .env-actions button {
      margin: 0;
      padding: 4px 12px;
      font-size: 12px;
    }

    .add-env-form {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 16px;
      margin-top: 16px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .help-text {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
    }

    .empty-state {
      text-align: center;
      padding: 32px;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <h1>Amorphie Settings</h1>
  <p class="subtitle">Configure runtime environments and graph analysis settings</p>

  <!-- General Settings -->
  <div class="section">
    <h2>General Settings</h2>

    <div class="form-group">
      <label for="basePath">Base Path for Local Graph</label>
      <input type="text" id="basePath" placeholder="/path/to/workflow/components">
      <p class="help-text">Optional: Directory to scan for workflow components. Leave empty to use workspace folder.</p>
    </div>
  </div>

  <!-- Cache Settings -->
  <div class="section">
    <h2>Cache Settings</h2>

    <div class="form-group">
      <label>
        <input type="checkbox" id="cacheEnabled">
        Enable runtime graph caching
      </label>
      <p class="help-text">Cache runtime graph fetches to improve performance</p>
    </div>

    <div class="form-group">
      <label for="cacheTtl">Cache TTL (milliseconds)</label>
      <input type="number" id="cacheTtl" min="0" step="1000">
      <p class="help-text">How long to cache runtime graph data (default: 300000ms = 5 minutes)</p>
    </div>
  </div>

  <!-- Runtime Environments -->
  <div class="section">
    <h2>Runtime Environments</h2>

    <div id="envList" class="env-list"></div>

    <button id="toggleAddEnv" class="secondary">+ Add Environment</button>

    <div id="addEnvForm" class="add-env-form" style="display: none;">
      <h3 style="margin-bottom: 16px;">New Environment</h3>

      <div class="form-row">
        <div class="form-group">
          <label for="envId">Environment ID*</label>
          <input type="text" id="envId" placeholder="local">
          <p class="help-text">Unique identifier (lowercase, no spaces). Use "local" for local development.</p>
        </div>

        <div class="form-group">
          <label for="envName">Display Name*</label>
          <input type="text" id="envName" placeholder="Local Development">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="envUrl">Base URL*</label>
          <input type="text" id="envUrl" placeholder="http://localhost:4201">
        </div>

        <div class="form-group">
          <label for="envDomain">Domain*</label>
          <input type="text" id="envDomain" placeholder="core" value="core">
        </div>
      </div>

      <div class="form-group">
        <label for="envAuthType">Authentication</label>
        <select id="envAuthType">
          <option value="">None</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
        </select>
      </div>

      <div id="authTokenGroup" class="form-group" style="display: none;">
        <label for="envAuthToken">Bearer Token</label>
        <input type="text" id="envAuthToken" placeholder="your-token-here">
      </div>

      <div id="authBasicGroup" style="display: none;">
        <div class="form-row">
          <div class="form-group">
            <label for="envAuthUsername">Username</label>
            <input type="text" id="envAuthUsername">
          </div>
          <div class="form-group">
            <label for="envAuthPassword">Password</label>
            <input type="text" id="envAuthPassword">
          </div>
        </div>
      </div>

      <h3 style="margin: 24px 0 16px 0;">Database Configuration</h3>
      <p class="help-text" style="margin-bottom: 16px;"><strong>Required for deployment</strong> - Used to clean up existing workflow instances before deployment. Defaults are configured for local development with Docker.</p>

      <div class="form-group">
        <label>
          <input type="checkbox" id="envDbUseDocker" checked>
          Use Docker exec (psql via Docker container)
        </label>
        <p class="help-text">Enable this if PostgreSQL is running in a Docker container (recommended for local development)</p>
      </div>

      <div id="dbDockerGroup" style="display: block;">
        <div class="form-row">
          <div class="form-group">
            <label for="envDbContainer">Docker Container Name*</label>
            <input type="text" id="envDbContainer" placeholder="vnext-postgres" value="vnext-postgres">
            <p class="help-text">The name of the Docker container running PostgreSQL (e.g. "vnext-postgres"), NOT the database name</p>
          </div>
          <div class="form-group">
            <label for="envDbName">Database Name*</label>
            <input type="text" id="envDbName" placeholder="vNext_WorkflowDb" value="vNext_WorkflowDb">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="envDbUser">Database User*</label>
            <input type="text" id="envDbUser" placeholder="postgres" value="postgres">
          </div>
          <div class="form-group">
            <label for="envDbPassword">Database Password*</label>
            <input type="password" id="envDbPassword" placeholder="postgres" value="postgres">
          </div>
        </div>
      </div>

      <div id="dbDirectGroup" style="display: none;">
        <div class="form-row">
          <div class="form-group">
            <label for="envDbHost">Database Host</label>
            <input type="text" id="envDbHost" placeholder="localhost" value="localhost">
          </div>
          <div class="form-group">
            <label for="envDbPort">Database Port</label>
            <input type="number" id="envDbPort" placeholder="5432" value="5432">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="envDbNameDirect">Database Name</label>
            <input type="text" id="envDbNameDirect" placeholder="vnext" value="vnext">
          </div>
          <div class="form-group">
            <label for="envDbUserDirect">Database User</label>
            <input type="text" id="envDbUserDirect" placeholder="postgres" value="postgres">
          </div>
        </div>
        <div class="form-group">
          <label for="envDbPasswordDirect">Database Password</label>
          <input type="text" id="envDbPasswordDirect" placeholder="postgres" value="postgres">
        </div>
      </div>

      <div>
        <button id="saveEnv">Add Environment</button>
        <button id="cancelEnv" class="secondary">Cancel</button>
      </div>
    </div>
  </div>

  <!-- Save Button -->
  <div class="section">
    <button id="saveSettings">Save All Settings</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentSettings = null;

    // Load settings on init
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'settings') {
        currentSettings = message.settings;
        renderSettings(message.settings);
      }
    });

    vscode.postMessage({ type: 'load' });

    function renderSettings(settings) {
      // General settings
      document.getElementById('basePath').value = settings.basePath || '';
      document.getElementById('cacheEnabled').checked = settings.cacheEnabled;
      document.getElementById('cacheTtl').value = settings.cacheTtlMs;

      // Environments
      renderEnvironments(settings.environments, settings.activeEnvironment);
    }

    function renderEnvironments(environments, activeId) {
      const envList = document.getElementById('envList');

      if (Object.keys(environments).length === 0) {
        envList.innerHTML = '<div class="empty-state">No environments configured. Add one to get started.</div>';
        return;
      }

      envList.innerHTML = Object.entries(environments).map(([id, env]) => {
        const isActive = id === activeId;
        const hasDb = env.database && env.database.database;
        const dbInfo = hasDb ? (env.database.useDocker ?
          \`Docker: \${env.database.dockerContainer}\` :
          \`Host: \${env.database.host}:\${env.database.port}\`) : 'Not configured';

        return \`
          <div class="env-item \${isActive ? 'active' : ''}">
            <div class="env-header">
              <div class="env-title">\${env.name || env.id}</div>
              \${isActive ? '<span class="env-badge">ACTIVE</span>' : ''}
            </div>
            <div class="env-details">
              <div><strong>ID:</strong> \${env.id}</div>
              <div><strong>URL:</strong> \${env.baseUrl}</div>
              <div><strong>Domain:</strong> \${env.domain}</div>
              <div><strong>Database:</strong> \${dbInfo}</div>
            </div>
            <div class="env-actions">
              \${!isActive ? \`<button onclick="setActive('\${id}')">Set Active</button>\` : ''}
              <button class="danger" onclick="deleteEnv('\${id}')">Delete</button>
            </div>
          </div>
        \`;
      }).join('');
    }

    // Toggle add environment form
    document.getElementById('toggleAddEnv').addEventListener('click', () => {
      const form = document.getElementById('addEnvForm');
      const isHidden = form.style.display === 'none' || form.style.display === '';

      if (isHidden) {
        // Show form and pre-fill defaults
        form.style.display = 'block';
        clearAddEnvForm();
        console.log('[Settings] Form opened and cleared, envId:', document.getElementById('envId').value);
      } else {
        // Hide form
        form.style.display = 'none';
      }
    });

    document.getElementById('cancelEnv').addEventListener('click', () => {
      document.getElementById('addEnvForm').style.display = 'none';
      clearAddEnvForm();
    });

    // Auth type change
    document.getElementById('envAuthType').addEventListener('change', (e) => {
      const authType = e.target.value;
      document.getElementById('authTokenGroup').style.display = authType === 'bearer' ? 'block' : 'none';
      document.getElementById('authBasicGroup').style.display = authType === 'basic' ? 'block' : 'none';
    });

    // Database Docker toggle
    document.getElementById('envDbUseDocker').addEventListener('change', (e) => {
      const useDocker = e.target.checked;
      document.getElementById('dbDockerGroup').style.display = useDocker ? 'block' : 'none';
      document.getElementById('dbDirectGroup').style.display = useDocker ? 'none' : 'block';
    });

    function clearAddEnvForm() {
      console.log('[clearAddEnvForm] Starting to pre-fill form with defaults...');
      // Pre-fill with sensible defaults
      document.getElementById('envId').value = 'local';
      document.getElementById('envName').value = 'local';
      document.getElementById('envUrl').value = 'http://localhost:4201';
      document.getElementById('envDomain').value = 'core';
      console.log('[clearAddEnvForm] Basic fields filled');
      document.getElementById('envAuthType').value = '';
      document.getElementById('envAuthToken').value = '';
      document.getElementById('envAuthUsername').value = '';
      document.getElementById('envAuthPassword').value = '';
      document.getElementById('authTokenGroup').style.display = 'none';
      document.getElementById('authBasicGroup').style.display = 'none';

      // Database fields with defaults matching the "local" environment
      document.getElementById('envDbUseDocker').checked = true;
      document.getElementById('dbDockerGroup').style.display = 'block';
      document.getElementById('dbDirectGroup').style.display = 'none';
      document.getElementById('envDbContainer').value = 'vnext-postgres';
      document.getElementById('envDbName').value = 'vNext_WorkflowDb';
      document.getElementById('envDbUser').value = 'postgres';
      document.getElementById('envDbPassword').value = 'postgres';
      document.getElementById('envDbHost').value = 'localhost';
      document.getElementById('envDbPort').value = '5432';
      document.getElementById('envDbNameDirect').value = 'vNext_WorkflowDb';
      document.getElementById('envDbUserDirect').value = 'postgres';
      document.getElementById('envDbPasswordDirect').value = 'postgres';
      console.log('[clearAddEnvForm] Database fields filled - Docker:', document.getElementById('envDbUseDocker').checked, 'Container:', document.getElementById('envDbContainer').value);
    }

    // Save environment
    document.getElementById('saveEnv').addEventListener('click', () => {
      const id = document.getElementById('envId').value.trim().toLowerCase();
      const name = document.getElementById('envName').value.trim();
      const baseUrl = document.getElementById('envUrl').value.trim();
      const domain = document.getElementById('envDomain').value.trim();
      const authType = document.getElementById('envAuthType').value;

      if (!id || !name || !baseUrl || !domain) {
        alert('Please fill in all required fields (Environment ID, Name, URL, Domain)');
        return;
      }

      // Validate database configuration
      const useDocker = document.getElementById('envDbUseDocker').checked;
      let hasValidDbConfig = false;

      if (useDocker) {
        const database = document.getElementById('envDbName').value.trim();
        const user = document.getElementById('envDbUser').value.trim();
        const password = document.getElementById('envDbPassword').value.trim();
        if (database && user && password) {
          hasValidDbConfig = true;
        }
      } else {
        const database = document.getElementById('envDbNameDirect').value.trim();
        const user = document.getElementById('envDbUserDirect').value.trim();
        const password = document.getElementById('envDbPasswordDirect').value.trim();
        if (database && user && password) {
          hasValidDbConfig = true;
        }
      }

      if (!hasValidDbConfig) {
        alert('Database configuration is required. Please fill in:\n' +
          (useDocker ?
            '- Database Name\n- Database User\n- Database Password' :
            '- Database Host\n- Database Port\n- Database Name\n- Database User\n- Database Password'));
        return;
      }

      const environment = {
        id,
        name,
        baseUrl,
        domain
      };

      if (authType === 'bearer') {
        const token = document.getElementById('envAuthToken').value.trim();
        if (token) {
          environment.auth = { type: 'bearer', token };
        }
      } else if (authType === 'basic') {
        const username = document.getElementById('envAuthUsername').value.trim();
        const password = document.getElementById('envAuthPassword').value.trim();
        if (username && password) {
          environment.auth = { type: 'basic', username, password };
        }
      }

      // Add database configuration
      const useDocker = document.getElementById('envDbUseDocker').checked;
      if (useDocker) {
        const container = document.getElementById('envDbContainer').value.trim();
        const database = document.getElementById('envDbName').value.trim();
        const user = document.getElementById('envDbUser').value.trim();
        const password = document.getElementById('envDbPassword').value.trim();

        if (database && user && password) {
          environment.database = {
            database,
            user,
            password,
            useDocker: true,
            dockerContainer: container || 'vnext-postgres'
          };
        }
      } else {
        const host = document.getElementById('envDbHost').value.trim();
        const port = parseInt(document.getElementById('envDbPort').value, 10);
        const database = document.getElementById('envDbNameDirect').value.trim();
        const user = document.getElementById('envDbUserDirect').value.trim();
        const password = document.getElementById('envDbPasswordDirect').value.trim();

        if (database && user && password) {
          environment.database = {
            host: host || 'localhost',
            port: port || 5432,
            database,
            user,
            password,
            useDocker: false
          };
        }
      }

      vscode.postMessage({ type: 'addEnvironment', environment });
      document.getElementById('addEnvForm').style.display = 'none';
      clearAddEnvForm();
    });

    // Save all settings
    document.getElementById('saveSettings').addEventListener('click', () => {
      const settings = {
        ...currentSettings,
        basePath: document.getElementById('basePath').value.trim() || null,
        cacheEnabled: document.getElementById('cacheEnabled').checked,
        cacheTtlMs: parseInt(document.getElementById('cacheTtl').value, 10)
      };

      vscode.postMessage({ type: 'save', settings });
    });

    function setActive(id) {
      vscode.postMessage({ type: 'setActiveEnvironment', id });
    }

    function deleteEnv(id) {
      if (confirm(\`Are you sure you want to delete the '\${id}' environment?\`)) {
        vscode.postMessage({ type: 'deleteEnvironment', id });
      }
    }
  </script>
</body>
</html>`;
  }
}
