# VS Code & Flow Studio Integration

**Status:** Draft
**Last Updated:** 2025-10-22

## Overview

This document describes how the Amorphie Mapper integrates with VS Code as a custom editor and with Amorphie Flow Studio for workflow integration.

## VS Code Extension Architecture

The mapper is delivered as a VS Code extension with:
- Custom editor for `.mapper.json` files
- Webview-based canvas (React Flow)
- Language server for validation
- Commands and keybindings
- Test runner integration

```
Extension Host (Node.js)
  ├─ Extension.ts - Activation and commands
  ├─ MapperEditorProvider.ts - Custom editor implementation
  ├─ Language Server - Validation and diagnostics
  └─ Webview (React)
      ├─ Canvas - React Flow mapper canvas
      ├─ Toolbar - Functoid palette
      └─ Properties Panel - Node configuration
```

## Custom Editor Registration

Register the custom editor for `.mapper.json` files:

```typescript
// extension.ts
import * as vscode from 'vscode';
import { MapperEditorProvider } from './MapperEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  // Register custom editor
  const provider = new MapperEditorProvider(context);
  const registration = vscode.window.registerCustomEditorProvider(
    'amorphie.mapperEditor',
    provider,
    {
      webviewOptions: {
        retainContextWhenHidden: true,
        enableScripts: true
      },
      supportsMultipleEditorsPerDocument: false
    }
  );

  context.subscriptions.push(registration);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('amorphie.mapper.open', openMapper),
    vscode.commands.registerCommand('amorphie.mapper.generateCode', generateCode),
    vscode.commands.registerCommand('amorphie.mapper.runTests', runTests),
    vscode.commands.registerCommand('amorphie.mapper.validate', validate)
  );
}
```

## Custom Editor Provider

Implement the custom editor:

```typescript
// MapperEditorProvider.ts
import * as vscode from 'vscode';

export class MapperEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    // Setup webview
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist')
      ]
    };

    // Load webview HTML
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // Handle messages from webview
    webviewPanel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'update':
            await this.updateDocument(document, message.content);
            break;

          case 'requestSchemas':
            await this.loadSchemas(webviewPanel.webview, message.mapSpec);
            break;

          case 'generateCode':
            await this.generateCode(document);
            break;

          case 'runTests':
            await this.runTests(document);
            break;
        }
      }
    );

    // Send initial document content to webview
    this.updateWebview(webviewPanel.webview, document);

    // Listen for document changes
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === document.uri.toString()) {
          this.updateWebview(webviewPanel.webview, document);
        }
      }
    );

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });
  }

  private async updateDocument(
    document: vscode.TextDocument,
    content: string
  ): Promise<void> {
    const edit = new vscode.WorkspaceEdit();

    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      content
    );

    await vscode.workspace.applyEdit(edit);
  }

  private updateWebview(
    webview: vscode.Webview,
    document: vscode.TextDocument
  ): void {
    webview.postMessage({
      type: 'update',
      content: document.getText()
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js')
    );

    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.css')
    );

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="${styleUri}" rel="stylesheet">
        </head>
        <body>
          <div id="root"></div>
          <script src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }
}
```

## Webview Communication

### Extension → Webview

```typescript
// In extension
webviewPanel.webview.postMessage({
  type: 'update',
  content: mapSpec
});

webviewPanel.webview.postMessage({
  type: 'schemas',
  sourceSchema: sourceSchema,
  targetSchema: targetSchema
});

webviewPanel.webview.postMessage({
  type: 'validation',
  errors: validationErrors
});
```

### Webview → Extension

```typescript
// In webview (React)
const vscode = acquireVsCodeApi();

// Update document
vscode.postMessage({
  type: 'update',
  content: JSON.stringify(mapSpec, null, 2)
});

// Request schemas
vscode.postMessage({
  type: 'requestSchemas',
  mapSpec: mapSpec
});

// Generate code
vscode.postMessage({
  type: 'generateCode'
});

// Run tests
vscode.postMessage({
  type: 'runTests'
});
```

## Schema Loading

Load JSON schemas from workspace:

```typescript
private async loadSchemas(
  webview: vscode.Webview,
  mapSpec: MapSpec
): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return;

  // Resolve schema paths
  const sourceSchemaPath = this.resolveSchemaPath(
    workspaceFolder.uri,
    mapSpec.schemas.source
  );

  const targetSchemaPath = this.resolveSchemaPath(
    workspaceFolder.uri,
    mapSpec.schemas.target
  );

  // Load schemas
  const sourceSchema = await this.loadSchemaFile(sourceSchemaPath);
  const targetSchema = await this.loadSchemaFile(targetSchemaPath);

  // Send to webview
  webview.postMessage({
    type: 'schemas',
    sourceSchema,
    targetSchema
  });
}

private resolveSchemaPath(
  workspaceUri: vscode.Uri,
  schemaPath: string
): vscode.Uri {
  if (path.isAbsolute(schemaPath)) {
    return vscode.Uri.file(schemaPath);
  } else {
    return vscode.Uri.joinPath(workspaceUri, schemaPath);
  }
}

private async loadSchemaFile(uri: vscode.Uri): Promise<any> {
  const content = await vscode.workspace.fs.readFile(uri);
  return JSON.parse(Buffer.from(content).toString());
}
```

## Diagnostics Integration

Integrate validation with VS Code diagnostics:

```typescript
// DiagnosticsProvider.ts
export class MapperDiagnosticsProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection(
      'amorphie-mapper'
    );
  }

  public async updateDiagnostics(document: vscode.TextDocument) {
    const diagnostics: vscode.Diagnostic[] = [];

    try {
      // Parse MapSpec
      const mapSpec = JSON.parse(document.getText());

      // Run validation
      const results = await validateMapSpec(mapSpec);

      // Convert to VS Code diagnostics
      for (const error of results.errors) {
        const range = this.getErrorRange(document, error.location);

        const diagnostic = new vscode.Diagnostic(
          range,
          error.message,
          this.mapSeverity(error.level)
        );

        diagnostic.code = error.code;
        diagnostic.source = 'amorphie-mapper';

        diagnostics.push(diagnostic);
      }
    } catch (err) {
      // JSON parse error
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        `Invalid JSON: ${err.message}`,
        vscode.DiagnosticSeverity.Error
      );

      diagnostics.push(diagnostic);
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  private mapSeverity(level: string): vscode.DiagnosticSeverity {
    switch (level) {
      case 'error':
        return vscode.DiagnosticSeverity.Error;
      case 'warning':
        return vscode.DiagnosticSeverity.Warning;
      case 'info':
        return vscode.DiagnosticSeverity.Information;
      default:
        return vscode.DiagnosticSeverity.Hint;
    }
  }

  private getErrorRange(
    document: vscode.TextDocument,
    location: any
  ): vscode.Range {
    // Try to find location in document
    if (location.node) {
      const nodeId = location.node;
      const text = document.getText();
      const match = text.match(new RegExp(`"id":\\s*"${nodeId}"`));

      if (match && match.index !== undefined) {
        const pos = document.positionAt(match.index);
        return new vscode.Range(pos, pos);
      }
    }

    // Default to first line
    return new vscode.Range(0, 0, 0, 0);
  }
}
```

## Commands

### Generate Code Command

```typescript
async function generateCode(uri?: vscode.Uri) {
  const document = await getActiveMapperDocument(uri);
  if (!document) return;

  try {
    const mapSpec = JSON.parse(document.getText());
    const code = generateJSONata(mapSpec);

    // Create output file
    const outputUri = vscode.Uri.file(
      document.uri.fsPath.replace('.mapper.json', '.mapper.jsonata')
    );

    await vscode.workspace.fs.writeFile(
      outputUri,
      Buffer.from(code, 'utf8')
    );

    // Open generated file
    await vscode.window.showTextDocument(outputUri);

    vscode.window.showInformationMessage(
      `Generated ${path.basename(outputUri.fsPath)}`
    );
  } catch (err) {
    vscode.window.showErrorMessage(`Code generation failed: ${err.message}`);
  }
}
```

### Run Tests Command

```typescript
async function runTests(uri?: vscode.Uri) {
  const document = await getActiveMapperDocument(uri);
  if (!document) return;

  // Create output channel
  const outputChannel = vscode.window.createOutputChannel('Mapper Tests');
  outputChannel.show();

  try {
    const mapSpec = JSON.parse(document.getText());

    if (!mapSpec.tests || mapSpec.tests.length === 0) {
      outputChannel.appendLine('No tests found');
      return;
    }

    // Generate code
    const code = generateJSONata(mapSpec);

    // Run tests
    const results = await runMapperTests(code, mapSpec.tests);

    // Display results
    outputChannel.appendLine('='.repeat(70));
    outputChannel.appendLine('Test Results');
    outputChannel.appendLine('='.repeat(70));

    for (const result of results) {
      const icon = result.status === 'pass' ? '✓' : '✗';
      outputChannel.appendLine(
        `${icon} ${result.name} (${result.duration.toFixed(2)}ms)`
      );

      if (result.status === 'fail') {
        outputChannel.appendLine('  Differences:');
        for (const diff of result.diff || []) {
          outputChannel.appendLine(`    ${formatDiff(diff)}`);
        }
      }

      if (result.status === 'error') {
        outputChannel.appendLine(`  Error: ${result.error}`);
      }
    }

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;

    outputChannel.appendLine('='.repeat(70));
    outputChannel.appendLine(
      `Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`
    );
  } catch (err) {
    outputChannel.appendLine(`Error: ${err.message}`);
  }
}
```

### Validate Command

```typescript
async function validate(uri?: vscode.Uri) {
  const document = await getActiveMapperDocument(uri);
  if (!document) return;

  try {
    const mapSpec = JSON.parse(document.getText());
    const results = await validateMapSpec(mapSpec);

    if (results.level === 'success') {
      vscode.window.showInformationMessage('Validation passed ✓');
    } else {
      const errorCount = results.errors.filter(e => e.level === 'error').length;
      const warningCount = results.errors.filter(e => e.level === 'warning').length;

      vscode.window.showWarningMessage(
        `Validation failed: ${errorCount} errors, ${warningCount} warnings`
      );
    }
  } catch (err) {
    vscode.window.showErrorMessage(`Validation failed: ${err.message}`);
  }
}
```

## Keybindings

Define keyboard shortcuts:

```json
// package.json
{
  "contributes": {
    "keybindings": [
      {
        "command": "amorphie.mapper.generateCode",
        "key": "ctrl+shift+g",
        "mac": "cmd+shift+g",
        "when": "resourceExtname == .mapper.json"
      },
      {
        "command": "amorphie.mapper.runTests",
        "key": "ctrl+shift+t",
        "mac": "cmd+shift+t",
        "when": "resourceExtname == .mapper.json"
      },
      {
        "command": "amorphie.mapper.validate",
        "key": "ctrl+shift+v",
        "mac": "cmd+shift+v",
        "when": "resourceExtname == .mapper.json"
      }
    ]
  }
}
```

## Context Menus

Add context menu items:

```json
// package.json
{
  "contributes": {
    "menus": {
      "explorer/context": [
        {
          "command": "amorphie.mapper.open",
          "when": "resourceExtname == .mapper.json",
          "group": "navigation"
        },
        {
          "command": "amorphie.mapper.generateCode",
          "when": "resourceExtname == .mapper.json",
          "group": "1_modification"
        },
        {
          "command": "amorphie.mapper.runTests",
          "when": "resourceExtname == .mapper.json",
          "group": "1_modification"
        }
      ],
      "editor/title": [
        {
          "command": "amorphie.mapper.generateCode",
          "when": "resourceExtname == .mapper.json",
          "group": "navigation"
        }
      ]
    }
  }
}
```

## Flow Studio Integration

Integrate mapper into Flow Studio workflow editor:

### Mapper Task Node

Add a "Mapper" task type to Flow Studio:

```json
{
  "name": "Execute Mapper",
  "type": "mapper",
  "config": {
    "mapperFile": "./mappers/order-to-invoice.mapper.json",
    "inputVariable": "orderData",
    "outputVariable": "invoiceData"
  }
}
```

### Mapper Execution

Execute mapper within workflow:

```typescript
// In Flow Studio task executor
async function executeMapperTask(task: MapperTask, context: WorkflowContext) {
  // Load mapper
  const mapperPath = resolvePath(task.config.mapperFile);
  const mapSpec = await loadMapSpec(mapperPath);

  // Generate code (cached)
  const code = await generateOrLoadCachedCode(mapSpec);

  // Get input data
  const inputData = context.variables[task.config.inputVariable];

  // Execute transformation
  const expression = jsonata(code);
  const outputData = await expression.evaluate(inputData);

  // Store result
  context.variables[task.config.outputVariable] = outputData;

  return { success: true };
}
```

### Inline Mapper Editor

Open mapper editor from Flow Studio:

```typescript
// In Flow Studio task configuration panel
function openMapperEditor(mapperFile: string) {
  vscode.commands.executeCommand('amorphie.mapper.open', vscode.Uri.file(mapperFile));
}
```

### Mapper Validation in Workflow

Validate mapper before workflow deployment:

```typescript
async function validateWorkflow(workflow: Workflow) {
  const errors: ValidationError[] = [];

  for (const task of workflow.tasks) {
    if (task.type === 'mapper') {
      const mapperPath = resolvePath(task.config.mapperFile);

      try {
        const mapSpec = await loadMapSpec(mapperPath);
        const validationResult = await validateMapSpec(mapSpec);

        if (validationResult.level === 'error') {
          errors.push({
            task: task.name,
            mapper: mapperPath,
            errors: validationResult.errors
          });
        }
      } catch (err) {
        errors.push({
          task: task.name,
          mapper: mapperPath,
          error: err.message
        });
      }
    }
  }

  return errors;
}
```

## Settings

Define extension settings:

```json
// package.json
{
  "contributes": {
    "configuration": {
      "title": "Amorphie Mapper",
      "properties": {
        "amorphie.mapper.autoGenerateCode": {
          "type": "boolean",
          "default": false,
          "description": "Automatically generate JSONata code on save"
        },
        "amorphie.mapper.validateOnSave": {
          "type": "boolean",
          "default": true,
          "description": "Validate mapper on save"
        },
        "amorphie.mapper.defaultSchemaPath": {
          "type": "string",
          "default": "./schemas",
          "description": "Default path for schema files"
        },
        "amorphie.mapper.gridSize": {
          "type": "number",
          "default": 20,
          "description": "Grid size for node snapping"
        },
        "amorphie.mapper.theme": {
          "type": "string",
          "enum": ["light", "dark", "auto"],
          "default": "auto",
          "description": "Canvas theme"
        }
      }
    }
  }
}
```

## Extension Packaging

Package the extension:

```bash
# Install dependencies
npm install

# Build webview
npm run build:webview

# Build extension
npm run build:extension

# Package extension
vsce package

# Output: amorphie-mapper-1.0.0.vsix
```

**package.json:**
```json
{
  "name": "amorphie-mapper",
  "displayName": "Amorphie Mapper",
  "description": "Visual data mapping tool for Amorphie workflows",
  "version": "1.0.0",
  "publisher": "amorphie",
  "engines": {
    "vscode": "^1.80.0"
  },
  "categories": ["Other"],
  "activationEvents": [
    "onCustomEditor:amorphie.mapperEditor",
    "onCommand:amorphie.mapper.open"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "customEditors": [
      {
        "viewType": "amorphie.mapperEditor",
        "displayName": "Amorphie Mapper",
        "selector": [
          {
            "filenamePattern": "*.mapper.json"
          }
        ],
        "priority": "default"
      }
    ],
    "commands": [
      {
        "command": "amorphie.mapper.open",
        "title": "Open in Mapper",
        "category": "Amorphie"
      },
      {
        "command": "amorphie.mapper.generateCode",
        "title": "Generate JSONata Code",
        "category": "Amorphie"
      },
      {
        "command": "amorphie.mapper.runTests",
        "title": "Run Mapper Tests",
        "category": "Amorphie"
      },
      {
        "command": "amorphie.mapper.validate",
        "title": "Validate Mapper",
        "category": "Amorphie"
      }
    ]
  }
}
```

## Deployment

### VS Code Marketplace

Publish to VS Code Marketplace:

```bash
# Login to marketplace
vsce login amorphie

# Publish extension
vsce publish

# Or publish specific version
vsce publish 1.0.0
```

### Internal Distribution

For internal use, distribute `.vsix` file:

```bash
# Install extension from VSIX
code --install-extension amorphie-mapper-1.0.0.vsix
```

## See Also

- [VS Code Extension API](https://code.visualstudio.com/api) - VS Code extension documentation
- [Custom Editors](https://code.visualstudio.com/api/extension-guides/custom-editors) - Custom editor guide
- [Webview API](https://code.visualstudio.com/api/extension-guides/webview) - Webview guide
- [Canvas Architecture](./02-canvas-architecture.md) - Webview implementation
- [File Conventions](./03-file-conventions.md) - File structure
