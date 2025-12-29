import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { CONTRACT_SCHEMA_TEMPLATES, ContractType, parseWorkflowSchemaUri, type WorkflowSchemasConfig } from '@amorphie-flow-studio/core/mapper';

interface MapperCreationParams {
  name: string;
  description: string;
  contractType: ContractType;
  parentWorkflowSchema?: string;
  childWorkflowSchema?: string;
  targetFolder: string;
  openInEditor: boolean;
}

/**
 * Show a dialog to create a new mapper
 * Returns the URI of the created mapper file and whether to open in editor, or undefined if cancelled
 */
export async function showNewMapperDialog(
  targetFolder: string,
  context: vscode.ExtensionContext
): Promise<{ uri: vscode.Uri; openInEditor: boolean } | undefined> {
  return new Promise((resolve) => {
    const panel = vscode.window.createWebviewPanel(
      'newMapperDialog',
      'Create New Mapper',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: false
      }
    );

    // Set HTML content
    panel.webview.html = getWebviewContent(targetFolder);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'cancel':
            panel.dispose();
            resolve(undefined);
            break;

          case 'create':
            try {
              const { name, description, contractType, parentWorkflowSchema, childWorkflowSchema, openInEditor } = message.params as MapperCreationParams;

              // Validate name
              if (!name || !/^[a-z0-9-]+$/.test(name)) {
                panel.webview.postMessage({
                  type: 'error',
                  message: 'Name must contain only lowercase letters, numbers, and dashes'
                });
                return;
              }

              // Get contract template
              const contractTemplate = CONTRACT_SCHEMA_TEMPLATES[contractType];
              if (!contractTemplate) {
                panel.webview.postMessage({
                  type: 'error',
                  message: `Invalid contract type: ${contractType}`
                });
                return;
              }

              // Build handlers structure from template
              const handlers: Record<string, any> = {};
              for (const handlerTemplate of contractTemplate.handlers) {
                handlers[handlerTemplate.methodName] = {
                  schemaParts: {
                    source: handlerTemplate.source,
                    target: handlerTemplate.target
                  },
                  nodes: [],
                  edges: []
                };
              }

              // Determine file extension based on contract type
              const extensionMap: Record<ContractType, string> = {
                'IMapping': '.mapping.json',
                'IConditionMapping': '.condition.json',
                'ITransitionMapping': '.transition.json',
                'ISubFlowMapping': '.subflow.json',
                'ISubProcessMapping': '.subprocess.json',
                'ITimerMapping': '.timer.json'
              };
              const fileExtension = extensionMap[contractType] || '.mapper.json';

              // Parse and validate workflow schema URIs
              const workflowSchemas: WorkflowSchemasConfig = {};

              if (parentWorkflowSchema && parentWorkflowSchema.trim()) {
                try {
                  const parentRef = parseWorkflowSchemaUri(parentWorkflowSchema.trim());
                  workflowSchemas.parent = parentRef;
                } catch (error) {
                  panel.webview.postMessage({
                    type: 'error',
                    message: `Invalid parent workflow schema URI: ${error instanceof Error ? error.message : String(error)}`
                  });
                  return;
                }
              }

              if (childWorkflowSchema && childWorkflowSchema.trim()) {
                try {
                  const childRef = parseWorkflowSchemaUri(childWorkflowSchema.trim());
                  workflowSchemas.child = childRef;
                } catch (error) {
                  panel.webview.postMessage({
                    type: 'error',
                    message: `Invalid child workflow schema URI: ${error instanceof Error ? error.message : String(error)}`
                  });
                  return;
                }
              }

              // Create metadata with workflow schemas if configured
              const metadata: any = {
                key: name,
                domain: 'custom',
                flow: 'mappers',
                name: description || name,
                version: '1.0.0'
              };

              if (Object.keys(workflowSchemas).length > 0) {
                metadata.workflowSchemas = workflowSchemas;
              }

              // Create the contract-based mapper template
              const mapper: any = {
                key: name,
                domain: 'custom',
                flow: 'mappers',
                version: '1.0.0',
                contractType,
                namespace: 'Custom.Mappers',
                className: toPascalCase(name),
                metadata,
                handlers
              };

              // Ensure directory exists
              await fs.mkdir(targetFolder, { recursive: true });

              // Create the file path with contract-specific extension
              const filePath = path.join(targetFolder, `${name}${fileExtension}`);
              const saveUri = vscode.Uri.file(filePath);

              // Check if file already exists
              try {
                await fs.access(filePath);
                panel.webview.postMessage({
                  type: 'error',
                  message: `File already exists: ${name}${fileExtension}`
                });
                return;
              } catch {
                // File doesn't exist, good to proceed
              }

              // Write the mapper file
              const content = JSON.stringify(mapper, null, 2);
              await fs.writeFile(filePath, content, 'utf-8');

              console.log('[NewMapperDialog] File written:', filePath);
              console.log('[NewMapperDialog] Resolving with:', { uri: saveUri.toString(), openInEditor });

              vscode.window.showInformationMessage(`Created ${contractType} mapper: ${name}`);

              panel.dispose();
              resolve({ uri: saveUri, openInEditor });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              panel.webview.postMessage({
                type: 'error',
                message: `Failed to create mapper: ${errorMessage}`
              });
            }
            break;
        }
      },
      undefined,
      context.subscriptions
    );

    // Handle panel disposal
    panel.onDidDispose(() => {
      resolve(undefined);
    });
  });
}

function getWebviewContent(targetFolder: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Create New Mapper</title>
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 0;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }

    .dialog {
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      width: 90%;
      max-width: 500px;
      padding: 24px;
    }

    h1 {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 20px 0;
      color: var(--vscode-foreground);
    }

    .form-group {
      margin-bottom: 20px;
    }

    label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 6px;
      color: var(--vscode-foreground);
    }

    input[type="text"],
    textarea,
    select {
      width: 100%;
      padding: 8px 10px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      outline: none;
    }

    input[type="text"]:focus,
    textarea:focus,
    select:focus {
      border-color: var(--vscode-focusBorder);
    }

    textarea {
      resize: vertical;
      min-height: 60px;
    }

    .help-text {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
    }

    .error-message {
      display: none;
      padding: 10px;
      margin-bottom: 16px;
      background-color: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      color: var(--vscode-inputValidation-errorForeground);
      border-radius: 4px;
      font-size: 13px;
    }

    .error-message.visible {
      display: block;
    }

    .folder-info {
      padding: 10px;
      margin-bottom: 16px;
      background-color: var(--vscode-textBlockQuote-background);
      border-left: 3px solid var(--vscode-textBlockQuote-border);
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      border-radius: 4px;
    }

    .buttons {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 24px;
    }

    button {
      padding: 8px 16px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      outline: none;
      font-weight: 500;
    }

    button:hover {
      opacity: 0.9;
    }

    button.primary {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    button.primary:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    button.secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    button.secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  </style>
</head>
<body>
  <div class="dialog">
    <h1>Create New Mapper</h1>

    <div class="folder-info">
      📁 Target folder: <strong>${escapeHtml(targetFolder)}</strong>
    </div>

    <div id="errorMessage" class="error-message"></div>

    <form id="mapperForm">
      <div class="form-group">
        <label for="contractType">Contract Type *</label>
        <select id="contractType" name="contractType" required>
          <option value="IMapping">IMapping - Task input/output data binding</option>
          <option value="IConditionMapping">IConditionMapping - Boolean conditional logic</option>
          <option value="ITransitionMapping">ITransitionMapping - Transition data transformation</option>
          <option value="ISubFlowMapping">ISubFlowMapping - Subflow input/output handlers</option>
          <option value="ISubProcessMapping">ISubProcessMapping - Subprocess input preparation</option>
          <option value="ITimerMapping">ITimerMapping - Timer schedule calculation</option>
        </select>
        <div class="help-text">Select the contract interface to implement</div>
      </div>

      <div class="form-group">
        <label for="name">Mapper Name *</label>
        <input
          type="text"
          id="name"
          name="name"
          placeholder="order-to-invoice"
          required
          pattern="[a-z0-9-]+"
        />
        <div class="help-text">Lowercase letters, numbers, and dashes only</div>
      </div>

      <div class="form-group">
        <label for="description">Description</label>
        <textarea
          id="description"
          name="description"
          placeholder="Maps order data to invoice format"
        ></textarea>
        <div class="help-text">Optional description of the mapper's purpose</div>
      </div>

      <div class="form-group" id="workflowSchemaGroup" style="display: none;">
        <label for="parentWorkflowSchema">Parent Workflow Schema (Optional)</label>
        <input
          type="text"
          id="parentWorkflowSchema"
          name="parentWorkflowSchema"
          placeholder="workflow://core/app-root@1.0.0"
          pattern="workflow://[a-z0-9-]+/[a-z0-9-]+@.+"
        />
        <div class="help-text">
          Constrains Instance.Data with workflow schema (format: workflow://domain/key@version)
        </div>
      </div>

      <div class="form-group" id="childWorkflowSchemaGroup" style="display: none;">
        <label for="childWorkflowSchema">Child Workflow Schema (Optional)</label>
        <input
          type="text"
          id="childWorkflowSchema"
          name="childWorkflowSchema"
          placeholder="workflow://loan/loan-approval@1.0.0"
          pattern="workflow://[a-z0-9-]+/[a-z0-9-]+@.+"
        />
        <div class="help-text">
          For SubFlow/SubProcess: schema of the child workflow being invoked
        </div>
      </div>

      <div class="form-group">
        <label style="display: flex; align-items: center; cursor: pointer;">
          <input
            type="checkbox"
            id="openInEditor"
            name="openInEditor"
            checked
            style="margin-right: 8px;"
          />
          Open in Mapper Editor after creation
        </label>
      </div>

      <div class="buttons">
        <button type="button" class="secondary" id="cancelBtn">Cancel</button>
        <button type="submit" class="primary" id="createBtn">Create Mapper</button>
      </div>
    </form>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const form = document.getElementById('mapperForm');
    const contractTypeSelect = document.getElementById('contractType');
    const nameInput = document.getElementById('name');
    const descriptionInput = document.getElementById('description');
    const parentWorkflowSchemaInput = document.getElementById('parentWorkflowSchema');
    const childWorkflowSchemaInput = document.getElementById('childWorkflowSchema');
    const openInEditorCheckbox = document.getElementById('openInEditor');
    const cancelBtn = document.getElementById('cancelBtn');
    const errorMessage = document.getElementById('errorMessage');
    const workflowSchemaGroup = document.getElementById('workflowSchemaGroup');
    const childWorkflowSchemaGroup = document.getElementById('childWorkflowSchemaGroup');

    function showError(message) {
      errorMessage.textContent = message;
      errorMessage.classList.add('visible');
    }

    function hideError() {
      errorMessage.classList.remove('visible');
    }

    // Show/hide workflow schema fields based on contract type
    function updateWorkflowSchemaVisibility() {
      const contractType = contractTypeSelect.value;

      // All contract types support parent workflow schema
      workflowSchemaGroup.style.display = 'block';

      // Only SubFlow and SubProcess support child workflow schema
      if (contractType === 'ISubFlowMapping' || contractType === 'ISubProcessMapping') {
        childWorkflowSchemaGroup.style.display = 'block';
      } else {
        childWorkflowSchemaGroup.style.display = 'none';
      }
    }

    // Update visibility on contract type change
    contractTypeSelect.addEventListener('change', updateWorkflowSchemaVisibility);

    // Initial visibility update
    updateWorkflowSchemaVisibility();

    // Validate name as user types
    nameInput.addEventListener('input', () => {
      const value = nameInput.value;
      if (value && !/^[a-z0-9-]+$/.test(value)) {
        nameInput.setCustomValidity('Name must contain only lowercase letters, numbers, and dashes');
      } else {
        nameInput.setCustomValidity('');
      }
      hideError();
    });

    // Handle form submission
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      hideError();

      const contractType = contractTypeSelect.value;
      const name = nameInput.value.trim();
      const description = descriptionInput.value.trim();
      const parentWorkflowSchema = parentWorkflowSchemaInput.value.trim();
      const childWorkflowSchema = childWorkflowSchemaInput.value.trim();
      const openInEditor = openInEditorCheckbox.checked;

      if (!contractType) {
        showError('Contract type is required');
        return;
      }

      if (!name) {
        showError('Mapper name is required');
        return;
      }

      if (!/^[a-z0-9-]+$/.test(name)) {
        showError('Name must contain only lowercase letters, numbers, and dashes');
        return;
      }

      // Disable form while creating
      form.querySelectorAll('input, textarea, button, select').forEach(el => {
        el.disabled = true;
      });

      vscode.postMessage({
        type: 'create',
        params: { contractType, name, description, parentWorkflowSchema, childWorkflowSchema, openInEditor }
      });
    });

    // Handle cancel button
    cancelBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'cancel' });
    });

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
        case 'error':
          showError(message.message);
          // Re-enable form
          form.querySelectorAll('input, textarea, button, select').forEach(el => {
            el.disabled = false;
          });
          break;
      }
    });

    // Focus contract type select on load
    contractTypeSelect.focus();
  </script>
</body>
</html>`;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}
