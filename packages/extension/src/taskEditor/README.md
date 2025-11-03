# vNext Task Quick Config Editor

A lightweight visual editor for vNext Task JSON files in VS Code, providing a simplified interface for editing Dapr task configurations.

## Features

### Phase 0: JSON Validation & IntelliSense
- **Automatic schema validation** for files in `**/Tasks/*.json` and `**/Tasks/**/*.json`
- **IntelliSense support** with completions and documentation from the task-definition schema
- **Real-time validation** with error highlighting

### Phase 1: Quick Config Visual Editor
- **Minimal form-based UI** for quick task configuration
- **Type-specific fields** that dynamically show/hide based on task type
- **Advanced Dapr options** in a collapsible accordion
- **Clean JSON output** - only writes fields that have been modified

## Supported Task Types

### Dapr Task Types (1-4)

#### Type 1: Dapr HTTP Endpoint
- **Required Fields:** endpointName, path, method
- **Methods:** GET, POST, PUT, DELETE, PATCH
- **Advanced:** Dapr retry, authentication options

#### Type 2: Dapr Binding
- **Required Fields:** bindingName, operation
- **Binding Types Supported:**
  - **HTTP Output Binding:** URL, HTTP method
  - **Kafka Output Binding:** topic, key, partition, headers
  - **Redis Output Binding:** key, command (SET, GET, DEL, etc.), TTL
  - **PostgreSQL Output Binding:** table, SQL query, operation type
- **Advanced:** Dapr retry, authentication options

#### Type 3: Dapr Service
- **Required Fields:** appId, methodName
- **Optional:** protocol (http/grpc)
- **Advanced:** Dapr retry, authentication options

#### Type 4: Dapr PubSub
- **Required Fields:** pubSubName, topic
- **Type-Specific Advanced:** orderingKey, ttlInSeconds
- **Advanced:** Dapr retry, authentication options

### Non-Dapr Task Types (5-7)

#### Type 5: Human Task
- **Required Fields:** title, instructions, assignedTo
- **Optional:** dueDate (datetime picker)
- **Advanced:** reminderIntervalMinutes, escalationTimeoutMinutes, escalationAssignee

#### Type 6: HTTP Task
- **Required Fields:** url, method
- **Optional:** headers (JSON), body (JSON)
- **Advanced:** timeoutSeconds, validateSsl

#### Type 7: Script Task
- **Configuration:** Minimal (placeholder for future extensions)
- **Note:** Currently a placeholder type for future script execution capabilities

## Advanced Options

### Dapr Types (1-4) Advanced Options
- **Retry Configuration:** maxRetries, initialIntervalMs
- **Authentication:** apiTokenSecretRef, mtlsRequired

### Type-Specific Advanced Options
- **Type 4 (PubSub):** orderingKey, ttlInSeconds
- **Type 5 (Human):** reminderIntervalMinutes, escalationTimeoutMinutes, escalationAssignee
- **Type 6 (HTTP):** timeoutSeconds, validateSsl

## Usage

### Creating a New Task
1. **Right-click on a Tasks folder** in the Explorer
2. **Select "New Task Definition"** from the context menu
3. **Enter task name** (lowercase letters, numbers, hyphens)
4. **Select task type** (1-7)
5. **Choose to open** in Quick Editor or JSON editor

### Editing Existing Tasks
1. **Open a Task file** in the `Tasks/` directory
2. **VS Code will prompt** to open with "vNext Task Quick Config"
3. **Edit fields** using the visual interface
4. **Save** to update the JSON file
5. **Switch to JSON editor** anytime using "Open as JSON" button

## File Targeting

The editor automatically activates for:
- `**/Tasks/*.json` - Direct files in Tasks directories
- `**/Tasks/**/*.json` - Nested files in Tasks subdirectories

## Implementation Details

### Clean JSON Output
- Only modified fields are written to the file
- Preserves existing unrelated properties
- Maintains proper JSON formatting

### Type Switching
- Non-destructive - preserves data when switching between types
- Automatically initializes required fields for the selected type

### Binding Type Detection (Type 2)
The editor automatically detects the binding type from the metadata:
- **HTTP**: Presence of `metadata.url` field
- **Kafka**: Presence of `metadata.topic` field
- **Redis**: Presence of `metadata.key` and `metadata.command` or "redis" in binding name
- **PostgreSQL**: Presence of `metadata.sql` or `metadata.table` or "postgresql" in binding name

### Metadata Structure
Binding-specific configurations are stored in the `metadata` object:
```json
{
  "bindingName": "my-binding",
  "operation": "create",
  "metadata": {
    // Binding-specific fields go here
    "url": "https://example.com",  // HTTP binding
    "topic": "my-topic",           // Kafka binding
    "key": "cache:key",            // Redis binding
    "sql": "INSERT INTO...",      // PostgreSQL binding
  }
}
```

### Validation
- Validates `flow === "sys-tasks"` before loading
- Shows helpful message for non-task files
- Pattern validation for key, domain, and version fields

## Architecture

### Files
- `TaskQuickEditorProvider.ts` - Custom editor provider implementation
- `taskQuickEditor.css` - VS Code theme-aware styling
- `taskQuickEditor.js` - Message handling and form logic
- No frameworks - pure HTML/CSS/JavaScript

### Security
- Content Security Policy (CSP) compliant
- No external dependencies or network calls
- Safe JSON parsing with error handling

## Known Limitations

1. **No Monaco editor** in the webview - use "Open as JSON" for syntax highlighting
2. **Basic validation only** - full schema validation happens in the JSON editor
3. **No undo/redo** in visual mode - use JSON editor for version control features
4. **Type 7 (Script Task)** is a placeholder - no specific configuration fields yet

## Testing

Test files are provided in `/test/Tasks/`:

### Dapr Task Types (1-4)
- `http-endpoint-task.json` - Type 1 (Dapr HTTP Endpoint)
- `http-binding.json` - Type 2 with HTTP Output Binding
- `kafka-binding.json` - Type 2 with Kafka Output Binding
- `redis-binding.json` - Type 2 with Redis Output Binding
- `postgresql-binding.json` - Type 2 with PostgreSQL Output Binding
- `pubsub-task.json` - Type 4 (Dapr PubSub) with advanced options

### Non-Dapr Task Types (5-7)
- `type5-human-task.json` - Type 5 (Human Task)
- `type6-http-task.json` - Type 6 (HTTP Task)
- `type7-script-task.json` - Type 7 (Script Task)

### Other
- `new-task.json` - Empty file for testing new task creation

## Development Notes

- TypeScript strict mode enabled
- Follows existing extension patterns from workflow and mapper editors
- Reuses VS Code's theme CSS variables for consistent UI
- Message-based communication between webview and extension