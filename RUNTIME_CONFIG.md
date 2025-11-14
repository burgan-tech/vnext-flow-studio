# Runtime Environment Configuration

The VS Code extension now supports configuring runtime environments for graph analysis and drift detection.

## Configuration Methods

### 1. Settings Editor (Easiest)

Open the Amorphie Settings editor from Command Palette:
- Press `Cmd+Shift+P` (or `Ctrl+Shift+P` on Windows/Linux)
- Type "Amorphie: Open Settings"
- Configure all settings in a simple UI

The settings editor provides:
- ✅ Visual environment management (add/edit/delete)
- ✅ Set active environment with one click
- ✅ Configure base path for local graph
- ✅ Manage cache settings
- ✅ Real-time validation
- ✅ No JSON editing required

### 2. VS Code Settings File

Configure environments manually in `.vscode/settings.json`:

```json
{
  "amorphie.environments": {
    "local": {
      "id": "local",
      "name": "Local Development",
      "baseUrl": "http://localhost:4201",
      "domain": "core"
    },
    "dev": {
      "id": "dev",
      "name": "Development Server",
      "baseUrl": "https://dev.example.com",
      "domain": "core",
      "auth": {
        "type": "bearer",
        "token": "your-token-here"
      }
    },
    "prod": {
      "id": "prod",
      "name": "Production",
      "baseUrl": "https://prod.example.com",
      "domain": "core",
      "auth": {
        "type": "basic",
        "username": "admin",
        "password": "secret"
      },
      "timeout": 60000,
      "verifySsl": true
    }
  },
  "amorphie.activeEnvironment": "local"
}
```

### 3. Environment Files (.env)

Create `.env.local` file in workspace root:

```bash
# Active environment
AMORPHIE_ACTIVE_ENV=local

# Local development
AMORPHIE_ENV_LOCAL_URL=http://localhost:4201
AMORPHIE_ENV_LOCAL_DOMAIN=core

# Development server
AMORPHIE_ENV_DEV_NAME=Development
AMORPHIE_ENV_DEV_URL=https://dev.example.com
AMORPHIE_ENV_DEV_DOMAIN=core
AMORPHIE_ENV_DEV_AUTH_TOKEN=your-token

# Production
AMORPHIE_ENV_PROD_NAME=Production
AMORPHIE_ENV_PROD_URL=https://prod.example.com
AMORPHIE_ENV_PROD_DOMAIN=core
AMORPHIE_ENV_PROD_AUTH_USERNAME=admin
AMORPHIE_ENV_PROD_AUTH_PASSWORD=secret
AMORPHIE_ENV_PROD_TIMEOUT=60000
AMORPHIE_ENV_PROD_VERIFY_SSL=true
```

### 4. CLI Integration

If using `vnext-workflow-cli`, environments can be configured in `.vnext/config.json`:

```json
{
  "environments": {
    "dev": {
      "id": "dev",
      "name": "Development",
      "baseUrl": "https://dev.example.com",
      "domain": "core"
    }
  },
  "activeEnvironment": "dev"
}
```

## Configuration Precedence

When multiple configuration sources exist:
1. **VS Code Settings** (highest priority) - Set via Settings Editor or settings.json
2. **Environment Files** (.env.local, .env)
3. **CLI Integration** (.vnext/config.json, lowest priority)

**Note:** The Settings Editor modifies VS Code workspace settings, which take precedence over all other sources.

## Environment Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | Yes | Unique environment identifier |
| `name` | string | No | Display name for the environment |
| `baseUrl` | string | Yes | Runtime base URL |
| `domain` | string | Yes | Workflow domain (e.g., "core") |
| `auth` | object | No | Authentication configuration |
| `timeout` | number | No | Request timeout (ms, default: 30000) |
| `verifySsl` | boolean | No | Verify SSL certificates (default: true) |

### Authentication Types

**Bearer Token:**
```json
{
  "auth": {
    "type": "bearer",
    "token": "your-bearer-token"
  }
}
```

**Basic Authentication:**
```json
{
  "auth": {
    "type": "basic",
    "username": "your-username",
    "password": "your-password"
  }
}
```

## Using the Configuration

### VS Code Commands

1. **Open Settings**
   - Command: `Amorphie: Open Settings`
   - Visual UI for managing environments and all Amorphie settings

2. **Fetch Runtime Graph**
   - Command: `Amorphie: Fetch Runtime Graph`
   - Uses the active environment to fetch runtime workflow data

3. **Compare Graphs**
   - Command: `Amorphie: Compare Graphs`
   - Detects drift between local files and active runtime environment

### Programmatic Usage

```typescript
import { ConfigManager } from '@amorphie-flow-studio/graph-core';

const configManager = new ConfigManager();

// Load from VS Code settings
const config = vscode.workspace.getConfiguration();
await configManager.load({
  workspaceRoot: workspaceFolder.uri.fsPath,
  vscodeSettings: config
});

// Get active environment
const activeEnv = configManager.getActiveEnvironment();
// { id: 'local', name: 'Local Development', baseUrl: 'http://localhost:4201', ... }

// Fetch runtime graph
const adapter = new AmorphieRuntimeAdapter();
const graph = await adapter.fetchGraph(activeEnv, {
  computeHashes: true
});
```

## Cache Configuration

Control runtime graph caching:

```json
{
  "amorphie.cache.enabled": true,
  "amorphie.cache.ttlMs": 300000
}
```

- `enabled`: Enable/disable caching (default: true)
- `ttlMs`: Cache time-to-live in milliseconds (default: 300000 = 5 minutes)

## Configuring Base Path

You can configure a custom base path to scan for workflow components. The path can be either **absolute** or **relative to the workspace root**:

```json
{
  "amorphie.basePath": "core"  // Relative to workspace root
}
```

Or use an absolute path:

```json
{
  "amorphie.basePath": "/Users/username/projects/vnext-sys-flow/core"
}
```

**Relative paths** are resolved against the workspace root folder. For example:
- `"core"` → `/workspace-root/core`
- `"flows/core"` → `/workspace-root/flows/core`

**Absolute paths** are used as-is.

If not set, the extension will:
1. Use the workspace folder (if only one exists)
2. Prompt you to select a workspace folder (if multiple exist)
3. Offer the option to browse for a custom directory

When you browse and select a custom directory, the extension will ask if you want to save it to workspace settings.

## Example Workflow

1. **Configure your environment** in `.vscode/settings.json`:
   ```json
   {
     "amorphie.environments": {
       "local": {
         "id": "local",
         "name": "Local Development",
         "baseUrl": "http://localhost:4201",
         "domain": "core"
       }
     },
     "amorphie.activeEnvironment": "local",
     "amorphie.basePath": "core"  // Relative to workspace root
   }
   ```

2. **Build local graph**:
   - Run command: `Amorphie: Build Local Graph`
   - If multiple workspace folders exist, you'll be prompted to select one
   - Option to browse for a custom directory
   - Scans for: Tasks/, Schemas/, Views/, Functions/, Extensions/, Workflows/

3. **Fetch runtime graph**:
   - Run command: `Amorphie: Fetch Runtime Graph`
   - Connects to configured environment
   - Fetches workflow instances from runtime

4. **Compare graphs**:
   - Run command: `Amorphie: Compare Graphs`
   - Shows drift analysis with violations grouped by severity
   - Displays API hash mismatches (breaking changes)
   - Displays config hash mismatches (non-breaking changes)

## Security Notes

- **Do not commit** `.env.local` or files containing secrets to version control
- Add `.env.local` to `.gitignore`
- Use environment variables or secure vaults for production credentials
- VS Code settings in `.vscode/settings.json` are workspace-specific and may be committed, so avoid storing sensitive tokens there
