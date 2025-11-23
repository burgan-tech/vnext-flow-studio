import * as vscode from 'vscode';
import * as path from 'path';

export class TaskQuickEditorProvider implements vscode.CustomTextEditorProvider {
  private static readonly viewType = 'vnext.taskQuickEditor';
  private readonly activePanels = new Map<string, vscode.WebviewPanel>();

  constructor(
    private readonly context: vscode.ExtensionContext
  ) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Store panel reference
    this.activePanels.set(document.uri.toString(), webviewPanel);

    // Configure webview
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
      ]
    };

    // Generate HTML content
    webviewPanel.webview.html = this.getHtmlContent(webviewPanel.webview);

    // Track save state to prevent loops
    let isSaving = false;
    let lastSavedContent = document.getText();

    // Handle messages from webview
    const messageDisposable = webviewPanel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'ready':
            // Send initial content
            webviewPanel.webview.postMessage({
              type: 'init',
              content: document.getText()
            });
            break;

          case 'save':
            if (isSaving) return;

            try {
              isSaving = true;
              const edit = new vscode.WorkspaceEdit();

              // Replace entire document
              const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
              );

              edit.replace(document.uri, fullRange, message.content);
              const success = await vscode.workspace.applyEdit(edit);

              if (success) {
                await document.save();
                lastSavedContent = message.content;

                // Send success feedback
                webviewPanel.webview.postMessage({
                  type: 'saved',
                  success: true
                });
              } else {
                throw new Error('Failed to apply edit');
              }
            } catch (error) {
              // Send error feedback
              webviewPanel.webview.postMessage({
                type: 'error',
                message: `Failed to save: ${error}`
              });
            } finally {
              isSaving = false;
            }
            break;

          case 'openAsJson':
            // Open in default JSON editor
            await vscode.commands.executeCommand(
              'vscode.openWith',
              document.uri,
              'default'
            );
            break;

          case 'log':
            console.log('Task Editor:', message.message);
            break;
        }
      }
    );

    // Handle document changes from outside
    const changeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        if (!isSaving && e.document.getText() !== lastSavedContent) {
          // External change detected
          webviewPanel.webview.postMessage({
            type: 'reload',
            content: e.document.getText()
          });
          lastSavedContent = e.document.getText();
        }
      }
    });

    // Clean up
    webviewPanel.onDidDispose(() => {
      this.activePanels.delete(document.uri.toString());
      messageDisposable.dispose();
      changeDisposable.dispose();
    });
  }

  private getHtmlContent(webview: vscode.Webview): string {
    // Get resource URIs
    const cssUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'taskQuickEditor.css'))
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'taskQuickEditor.js'))
    );

    // Generate nonce for CSP
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:;">
    <link href="${cssUri}" rel="stylesheet">
    <title>Task Quick Config</title>
</head>
<body>
    <div id="app">
        <div id="loading">Loading task configuration...</div>
        <div id="error" class="hidden"></div>
        <div id="not-task" class="hidden">
            <h2>Not a vNext Task</h2>
            <p>This file doesn't appear to be a vNext Task definition (flow !== "sys-tasks").</p>
            <button class="button" onclick="openAsJson()">Open as JSON</button>
        </div>
        <div id="editor" class="hidden">
            <header>
                <h1>vNext Task Quick Config</h1>
                <div class="header-actions">
                    <button id="saveBtn" class="button button-primary">Save</button>
                    <button id="openJsonBtn" class="button">Open as JSON</button>
                </div>
            </header>

            <div class="form-section">
                <h2>Basic Configuration</h2>

                <div class="form-group">
                    <label for="key">Task Key</label>
                    <input type="text" id="key" pattern="^[a-z0-9-]+$" placeholder="my-task-key" required>
                    <small>Lowercase letters, numbers, and hyphens only</small>
                </div>

                <div class="form-group">
                    <label for="domain">Domain</label>
                    <input type="text" id="domain" pattern="^[a-z0-9-]+$" placeholder="my-domain" required>
                </div>

                <div class="form-group">
                    <label for="version">Version</label>
                    <input type="text" id="version" pattern="^\\d+\\.\\d+\\.\\d+$" value="1.0.0" placeholder="1.0.0" required>
                    <small>Semantic version (e.g., 1.0.0)</small>
                </div>

                <div class="form-group">
                    <label for="type">Task Type</label>
                    <select id="type" required>
                        <option value="1">Type 1 - Dapr HTTP Endpoint</option>
                        <option value="2">Type 2 - Dapr Binding</option>
                        <option value="3">Type 3 - Dapr Service</option>
                        <option value="4">Type 4 - Dapr PubSub</option>
                        <option value="5">Type 5 - Human Task</option>
                        <option value="6">Type 6 - HTTP Task</option>
                        <option value="7">Type 7 - Script Task</option>
                        <option value="8">Type 8 - Condition Task</option>
                        <option value="9">Type 9 - Timer Task</option>
                        <option value="10">Type 10 - Notification Task</option>
                        <option value="11">Type 11 - Trigger Task</option>
                    </select>
                </div>
            </div>

            <!-- Type-specific fields -->
            <div class="form-section">
                <h2>Type Configuration</h2>

                <!-- Type 1: HTTP Endpoint -->
                <div id="type1Fields" class="type-fields hidden">
                    <div class="form-group">
                        <label for="endpointName">Endpoint Name *</label>
                        <input type="text" id="endpointName" placeholder="my-endpoint" required>
                    </div>
                    <div class="form-group">
                        <label for="path">Path *</label>
                        <input type="text" id="path" placeholder="/api/resource" required>
                    </div>
                    <div class="form-group">
                        <label for="method">HTTP Method *</label>
                        <select id="method" required>
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                            <option value="PATCH">PATCH</option>
                        </select>
                    </div>
                </div>

                <!-- Type 2: Binding -->
                <div id="type2Fields" class="type-fields hidden">
                    <div class="form-group">
                        <label for="bindingName">Binding Name *</label>
                        <input type="text" id="bindingName" placeholder="my-binding" required>
                    </div>
                    <div class="form-group">
                        <label for="bindingType">Binding Type</label>
                        <select id="bindingType">
                            <option value="">Generic Binding</option>
                            <option value="http">HTTP Output Binding</option>
                            <option value="kafka">Kafka Output Binding</option>
                            <option value="redis">Redis Output Binding</option>
                            <option value="postgresql">PostgreSQL Output Binding</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="operation">Operation *</label>
                        <input type="text" id="operation" placeholder="create" required>
                    </div>

                    <!-- HTTP Binding specific fields -->
                    <div id="httpBindingFields" class="binding-specific hidden">
                        <h4>HTTP Binding Configuration</h4>
                        <div class="form-group">
                            <label for="httpBindingUrl">URL *</label>
                            <input type="url" id="httpBindingUrl" placeholder="https://api.example.com/webhook">
                        </div>
                        <div class="form-group">
                            <label for="httpBindingMethod">HTTP Method</label>
                            <select id="httpBindingMethod">
                                <option value="POST">POST</option>
                                <option value="GET">GET</option>
                                <option value="PUT">PUT</option>
                                <option value="DELETE">DELETE</option>
                                <option value="PATCH">PATCH</option>
                            </select>
                        </div>
                    </div>

                    <!-- Kafka Binding specific fields -->
                    <div id="kafkaBindingFields" class="binding-specific hidden">
                        <h4>Kafka Binding Configuration</h4>
                        <div class="form-group">
                            <label for="kafkaTopic">Topic *</label>
                            <input type="text" id="kafkaTopic" placeholder="my-topic">
                        </div>
                        <div class="form-group">
                            <label for="kafkaKey">Key</label>
                            <input type="text" id="kafkaKey" placeholder="message-key">
                        </div>
                        <div class="form-group">
                            <label for="kafkaPartition">Partition</label>
                            <input type="number" id="kafkaPartition" min="0" placeholder="0">
                        </div>
                        <div class="form-group">
                            <label for="kafkaHeaders">Headers (JSON)</label>
                            <textarea id="kafkaHeaders" rows="2" placeholder='{"trace-id": "123"}'></textarea>
                        </div>
                    </div>

                    <!-- Redis Binding specific fields -->
                    <div id="redisBindingFields" class="binding-specific hidden">
                        <h4>Redis Binding Configuration</h4>
                        <div class="form-group">
                            <label for="redisKey">Key *</label>
                            <input type="text" id="redisKey" placeholder="cache:user:123">
                        </div>
                        <div class="form-group">
                            <label for="redisCommand">Command</label>
                            <select id="redisCommand">
                                <option value="SET">SET</option>
                                <option value="GET">GET</option>
                                <option value="DEL">DEL</option>
                                <option value="HSET">HSET</option>
                                <option value="HGET">HGET</option>
                                <option value="LPUSH">LPUSH</option>
                                <option value="RPUSH">RPUSH</option>
                                <option value="SADD">SADD</option>
                                <option value="ZADD">ZADD</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="redisTtl">TTL (seconds)</label>
                            <input type="number" id="redisTtl" min="0" placeholder="3600">
                        </div>
                    </div>

                    <!-- PostgreSQL Binding specific fields -->
                    <div id="postgresqlBindingFields" class="binding-specific hidden">
                        <h4>PostgreSQL Binding Configuration</h4>
                        <div class="form-group">
                            <label for="postgresqlTable">Table Name</label>
                            <input type="text" id="postgresqlTable" placeholder="users">
                        </div>
                        <div class="form-group">
                            <label for="postgresqlQuery">SQL Query</label>
                            <textarea id="postgresqlQuery" rows="3" placeholder="INSERT INTO users (name, email) VALUES ($1, $2)"></textarea>
                        </div>
                        <div class="form-group">
                            <label for="postgresqlOperation">Operation Type</label>
                            <select id="postgresqlOperation">
                                <option value="exec">Execute Query</option>
                                <option value="query">Query (SELECT)</option>
                                <option value="insert">Insert</option>
                                <option value="update">Update</option>
                                <option value="delete">Delete</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Type 3: Service -->
                <div id="type3Fields" class="type-fields hidden">
                    <div class="form-group">
                        <label for="appId">App ID *</label>
                        <input type="text" id="appId" placeholder="my-service" required>
                    </div>
                    <div class="form-group">
                        <label for="methodName">Method Name *</label>
                        <input type="text" id="methodName" placeholder="myMethod" required>
                    </div>
                    <div class="form-group">
                        <label for="protocol">Protocol</label>
                        <select id="protocol">
                            <option value="http">HTTP</option>
                            <option value="grpc">gRPC</option>
                        </select>
                    </div>
                </div>

                <!-- Type 4: PubSub -->
                <div id="type4Fields" class="type-fields hidden">
                    <div class="form-group">
                        <label for="pubSubName">PubSub Name *</label>
                        <input type="text" id="pubSubName" placeholder="my-pubsub" required>
                    </div>
                    <div class="form-group">
                        <label for="topic">Topic *</label>
                        <input type="text" id="topic" placeholder="my-topic" required>
                    </div>
                </div>

                <!-- Type 5: Human Task -->
                <div id="type5Fields" class="type-fields hidden">
                    <div class="form-group">
                        <label for="title">Title *</label>
                        <input type="text" id="title" placeholder="Review Document" required>
                    </div>
                    <div class="form-group">
                        <label for="instructions">Instructions *</label>
                        <textarea id="instructions" rows="3" placeholder="Please review and approve the document..." required></textarea>
                    </div>
                    <div class="form-group">
                        <label for="assignedTo">Assigned To *</label>
                        <input type="text" id="assignedTo" placeholder="user@example.com" required>
                    </div>
                    <div class="form-group">
                        <label for="dueDate">Due Date</label>
                        <input type="datetime-local" id="dueDate">
                    </div>
                </div>

                <!-- Type 6: HTTP Task -->
                <div id="type6Fields" class="type-fields hidden">
                    <div class="form-group">
                        <label for="url">URL *</label>
                        <input type="url" id="url" placeholder="https://api.example.com/endpoint" required>
                    </div>
                    <div class="form-group">
                        <label for="httpMethod">HTTP Method *</label>
                        <select id="httpMethod" required>
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                            <option value="PATCH">PATCH</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="headers">Headers (JSON)</label>
                        <textarea id="headers" rows="3" placeholder='{"Content-Type": "application/json"}'></textarea>
                    </div>
                    <div class="form-group">
                        <label for="body">Body (JSON)</label>
                        <textarea id="body" rows="4" placeholder='{"key": "value"}'></textarea>
                    </div>
                </div>

                <!-- Type 7: Script Task -->
                <div id="type7Fields" class="type-fields hidden">
                    <div class="form-group">
                        <p style="color: var(--vscode-descriptionForeground);">
                            Script Task type is a placeholder for future extensions.
                            No specific configuration is required at this time.
                        </p>
                    </div>
                </div>

                <!-- Type 8: Condition Task -->
                <div id="type8Fields" class="type-fields hidden">
                    <div class="form-group">
                        <p style="color: var(--vscode-descriptionForeground);">
                            Condition Task type. Configuration details to be defined.
                        </p>
                    </div>
                </div>

                <!-- Type 9: Timer Task -->
                <div id="type9Fields" class="type-fields hidden">
                    <div class="form-group">
                        <p style="color: var(--vscode-descriptionForeground);">
                            Timer Task type. Configuration details to be defined.
                        </p>
                    </div>
                </div>

                <!-- Type 10: Notification Task -->
                <div id="type10Fields" class="type-fields hidden">
                    <div class="form-group">
                        <label for="notificationMetadata">Metadata (JSON) *</label>
                        <textarea id="notificationMetadata" rows="6" placeholder='{"channel": "email", "to": "user@example.com"}' required></textarea>
                        <small>Notification binding metadata configuration</small>
                    </div>
                </div>

                <!-- Type 11: Trigger Task -->
                <div id="type11Fields" class="type-fields hidden">
                    <div class="form-group">
                        <label for="triggerTaskType">Trigger Type *</label>
                        <select id="triggerTaskType" required>
                            <option value="">Select trigger type...</option>
                            <option value="Start">Start - Start a new workflow instance</option>
                            <option value="Trigger">Trigger - Trigger an existing workflow</option>
                            <option value="SubProcess">SubProcess - Execute a subprocess</option>
                            <option value="GetInstanceData">GetInstanceData - Retrieve instance data</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="triggerDomain">Domain *</label>
                        <input type="text" id="triggerDomain" pattern="^[a-z0-9-]+$" placeholder="target-domain" required>
                    </div>

                    <div class="form-group">
                        <label for="triggerFlow">Flow *</label>
                        <input type="text" id="triggerFlow" pattern="^[a-z0-9-]+$" placeholder="target-workflow" required>
                    </div>

                    <div class="form-group">
                        <label for="triggerBody">Body (JSON) *</label>
                        <textarea id="triggerBody" rows="4" placeholder='{"data": "value"}' required></textarea>
                        <small>Request body to send to the target workflow</small>
                    </div>

                    <!-- SubProcess-specific fields -->
                    <div id="subProcessFields" class="hidden">
                        <div class="form-group">
                            <label for="triggerKey">Task Key *</label>
                            <input type="text" id="triggerKey" placeholder="target-task-key">
                            <small>Required for SubProcess type</small>
                        </div>

                        <div class="form-group">
                            <label for="triggerVersion">Task Version *</label>
                            <input type="text" id="triggerVersion" pattern="^\\d+\\.\\d+\\.\\d+$" placeholder="1.0.0">
                            <small>Required for SubProcess type</small>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="triggerTransitionName">Transition Name</label>
                        <input type="text" id="triggerTransitionName" placeholder="transition-key">
                        <small>Optional: Specific transition to trigger</small>
                    </div>

                    <div class="form-group">
                        <label for="triggerInstanceId">Instance ID</label>
                        <input type="text" id="triggerInstanceId" placeholder="instance-id">
                        <small>Optional: Target a specific instance</small>
                    </div>

                    <div class="form-group">
                        <label for="triggerExtensions">Extensions (JSON Array)</label>
                        <textarea id="triggerExtensions" rows="2" placeholder='["extension1", "extension2"]'></textarea>
                        <small>Optional: Extension strings</small>
                    </div>
                </div>
            </div>

            <!-- Advanced Options -->
            <div class="form-section">
                <details id="advancedSection">
                    <summary>
                        <h2>Advanced Options</h2>
                    </summary>

                    <div class="advanced-content">
                        <!-- Dapr types (1-4) advanced options -->
                        <div id="daprAdvanced" class="hidden">
                            <h3>Retry Configuration</h3>
                            <div class="form-group">
                                <label for="maxRetries">Max Retries</label>
                                <input type="number" id="maxRetries" min="0" placeholder="3">
                            </div>
                            <div class="form-group">
                                <label for="initialIntervalMs">Initial Interval (ms)</label>
                                <input type="number" id="initialIntervalMs" min="0" placeholder="1000">
                            </div>

                            <h3>Authentication</h3>
                            <div class="form-group">
                                <label for="apiTokenSecretRef">API Token Secret Ref</label>
                                <input type="text" id="apiTokenSecretRef" placeholder="my-secret">
                            </div>
                            <div class="form-group">
                                <label for="mtlsRequired">
                                    <input type="checkbox" id="mtlsRequired">
                                    mTLS Required
                                </label>
                            </div>
                        </div>

                        <!-- Type 4 specific advanced options -->
                        <div id="type4Advanced" class="hidden">
                            <h3>PubSub Specific</h3>
                            <div class="form-group">
                                <label for="orderingKey">Ordering Key</label>
                                <input type="text" id="orderingKey" placeholder="order-key">
                            </div>
                            <div class="form-group">
                                <label for="ttlInSeconds">TTL (seconds)</label>
                                <input type="number" id="ttlInSeconds" min="0" placeholder="3600">
                            </div>
                        </div>

                        <!-- Type 5 specific advanced options -->
                        <div id="type5Advanced" class="hidden">
                            <h3>Human Task Specific</h3>
                            <div class="form-group">
                                <label for="reminderIntervalMinutes">Reminder Interval (minutes)</label>
                                <input type="number" id="reminderIntervalMinutes" min="0" placeholder="60">
                            </div>
                            <div class="form-group">
                                <label for="escalationTimeoutMinutes">Escalation Timeout (minutes)</label>
                                <input type="number" id="escalationTimeoutMinutes" min="0" placeholder="1440">
                            </div>
                            <div class="form-group">
                                <label for="escalationAssignee">Escalation Assignee</label>
                                <input type="text" id="escalationAssignee" placeholder="manager@example.com">
                            </div>
                        </div>

                        <!-- Type 6 specific advanced options -->
                        <div id="type6Advanced" class="hidden">
                            <h3>HTTP Task Specific</h3>
                            <div class="form-group">
                                <label for="timeoutSeconds">Timeout (seconds)</label>
                                <input type="number" id="timeoutSeconds" min="1" placeholder="30">
                            </div>
                            <div class="form-group">
                                <label for="validateSsl">
                                    <input type="checkbox" id="validateSsl" checked>
                                    Validate SSL Certificate
                                </label>
                            </div>
                        </div>
                    </div>
                </details>
            </div>
        </div>
    </div>

    <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new TaskQuickEditorProvider(context);

    const providerDisposable = vscode.window.registerCustomEditorProvider(
      TaskQuickEditorProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
          enableFindWidget: false
        }
      }
    );

    // Register commands
    const openCommand = vscode.commands.registerCommand(
      'taskEditor.open',
      async (uri?: vscode.Uri) => {
        const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
        if (targetUri) {
          await vscode.commands.executeCommand('vscode.openWith', targetUri, TaskQuickEditorProvider.viewType);
        }
      }
    );

    const openAsJsonCommand = vscode.commands.registerCommand(
      'taskEditor.openAsJson',
      async (uri?: vscode.Uri) => {
        const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
        if (targetUri) {
          await vscode.commands.executeCommand('vscode.openWith', targetUri, 'default');
        }
      }
    );

    const newTaskCommand = vscode.commands.registerCommand(
      'taskEditor.newTask',
      async (contextUri?: vscode.Uri) => {
        await createNewTask(contextUri);
      }
    );

    return vscode.Disposable.from(providerDisposable, openCommand, openAsJsonCommand, newTaskCommand);
  }
}

/**
 * Find the closest Tasks folder to a workflow file by searching upwards in the directory tree
 */
async function findClosestTasksFolder(workflowPath: string): Promise<vscode.Uri | undefined> {
  let currentDir = path.dirname(workflowPath);
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  if (!workspaceRoot) {
    return undefined;
  }

  // Search upwards from workflow directory to workspace root
  while (currentDir.startsWith(workspaceRoot)) {
    const tasksFolder = vscode.Uri.file(path.join(currentDir, 'Tasks'));

    try {
      const stat = await vscode.workspace.fs.stat(tasksFolder);
      if (stat.type === vscode.FileType.Directory) {
        return tasksFolder;
      }
    } catch {
      // Tasks folder doesn't exist at this level, continue
    }

    // Move up one directory
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached filesystem root
      break;
    }
    currentDir = parentDir;
  }

  return undefined;
}

async function createNewTask(contextUri?: vscode.Uri) {
  // Get the folder from context or ask user to select
  let targetFolder: vscode.Uri | undefined = contextUri;

  if (!targetFolder) {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    // Try to find Tasks folder closest to active workflow
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.uri.fsPath.endsWith('.flow.json')) {
      const workflowPath = activeEditor.document.uri.fsPath;
      targetFolder = await findClosestTasksFolder(workflowPath);
    }

    // If no workflow is open or no Tasks folder found nearby, search workspace
    if (!targetFolder) {
      for (const folder of folders) {
        const tasksFolder = vscode.Uri.joinPath(folder.uri, 'Tasks');
        try {
          await vscode.workspace.fs.stat(tasksFolder);
          targetFolder = tasksFolder;
          break;
        } catch {
          // Tasks folder doesn't exist, continue
        }
      }
    }

    if (!targetFolder) {
      // No Tasks folder found, ask user to select a folder
      const result = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select folder for new task',
        title: 'Select folder for new task'
      });

      if (!result || result.length === 0) {
        return;
      }

      targetFolder = result[0];
    }
  }

  // Ensure we're working with a folder
  const stat = await vscode.workspace.fs.stat(targetFolder);
  if (stat.type !== vscode.FileType.Directory) {
    targetFolder = vscode.Uri.joinPath(targetFolder, '..');
  }

  // Ask for task name
  const taskName = await vscode.window.showInputBox({
    prompt: 'Enter task name',
    placeHolder: 'my-task',
    validateInput: (value) => {
      if (!value) {
        return 'Task name is required';
      }
      if (!/^[a-z0-9-]+$/.test(value)) {
        return 'Task name must contain only lowercase letters, numbers, and hyphens';
      }
      return undefined;
    }
  });

  if (!taskName) {
    return;
  }

  // Ask for task type
  const taskType = await vscode.window.showQuickPick(
    [
      { label: 'Type 1 - Dapr HTTP Endpoint', value: '1' },
      { label: 'Type 2 - Dapr Binding', value: '2' },
      { label: 'Type 3 - Dapr Service', value: '3' },
      { label: 'Type 4 - Dapr PubSub', value: '4' },
      { label: 'Type 5 - Human Task', value: '5' },
      { label: 'Type 6 - HTTP Task', value: '6' },
      { label: 'Type 7 - Script Task', value: '7' }
    ],
    {
      placeHolder: 'Select task type'
    }
  );

  if (!taskType) {
    return;
  }

  // Create task content based on type
  const taskContent = createTaskTemplate(taskName, taskType.value);

  // Create file path with version
  const fileName = `${taskName}.${taskContent.version}.json`;
  const filePath = vscode.Uri.joinPath(targetFolder, fileName);

  try {
    // Check if file already exists
    try {
      await vscode.workspace.fs.stat(filePath);
      const overwrite = await vscode.window.showWarningMessage(
        `File ${fileName} already exists. Overwrite?`,
        'Yes',
        'No'
      );
      if (overwrite !== 'Yes') {
        return;
      }
    } catch {
      // File doesn't exist, continue
    }

    // Write file
    await vscode.workspace.fs.writeFile(
      filePath,
      Buffer.from(JSON.stringify(taskContent, null, 2), 'utf8')
    );

    // Open in editor beside the flow editor to keep context
    const document = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(document, {
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: false
    });

    // Optionally open in Quick Editor
    const openInQuickEditor = await vscode.window.showInformationMessage(
      'Task created successfully',
      'Open in Quick Editor',
      'Keep as JSON'
    );

    if (openInQuickEditor === 'Open in Quick Editor') {
      // Close the JSON editor first
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      // Open Quick Editor beside the flow editor
      const uri = vscode.Uri.file(filePath.fsPath);
      await vscode.commands.executeCommand('vscode.openWith', uri, TaskQuickEditorProvider.viewType, vscode.ViewColumn.Beside);
    }

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to create task: ${error}`);
  }
}

function createTaskTemplate(name: string, type: string): any {
  const base = {
    key: name,
    domain: 'my-domain',
    version: '1.0.0',
    flow: 'sys-tasks',
    flowVersion: '1.0.0',
    tags: ['task'],
    attributes: {
      type: type,
      config: {}
    }
  };

  // Add type-specific default config
  switch (type) {
    case '1': // Dapr HTTP Endpoint
      base.attributes.config = {
        endpointName: '',
        path: '/api/resource',
        method: 'GET'
      };
      break;
    case '2': // Dapr Binding
      base.attributes.config = {
        bindingName: '',
        operation: 'create'
      };
      break;
    case '3': // Dapr Service
      base.attributes.config = {
        appId: '',
        methodName: '',
        protocol: 'http'
      };
      break;
    case '4': // Dapr PubSub
      base.attributes.config = {
        pubSubName: '',
        topic: ''
      };
      break;
    case '5': // Human Task
      base.attributes.config = {
        title: 'Review Task',
        instructions: 'Please review and approve',
        assignedTo: ''
      };
      break;
    case '6': // HTTP Task
      base.attributes.config = {
        url: 'https://api.example.com/endpoint',
        method: 'GET'
      };
      break;
    case '7': // Script Task
      // Minimal config for script task
      break;
  }

  return base;
}