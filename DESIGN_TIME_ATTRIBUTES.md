# Design-Time Attributes Filtering

## Overview

During deployment, the extension automatically filters out design-time attributes that are only used in the editor/design environment and should not be sent to the runtime API.

## Filtered Attributes

The following attributes are removed from component definitions before deployment:

### UI/Visual Attributes
- `xprofile` / `xProfile` - X-axis profile data (case variants)
- `position` - Node position on canvas
- `layout` - Layout configuration
- `uiMetadata` - UI-specific metadata
- `editorMetadata` - Editor-specific metadata
- `canvas` - Canvas configuration
- `zoom` - Zoom level
- `viewport` - Viewport settings

### Editor-Specific Metadata
- `comments` - Design comments
- `notes` - Design notes
- `annotations` - Annotations
- `editorVersion` - Editor version information
- `lastModifiedBy` - Last modified by information
- `designNotes` - Design notes

### Development/Debugging Attributes
- `debugInfo` - Debug information
- `devMode` - Development mode flag
- `testData` - Test data

### Diagram-Specific Attributes
- `diagram` - Diagram data (stored separately in .diagram.json)
- `nodePositions` - Node positions
- `edgeRouting` - Edge routing information

## Implementation

The filtering is applied automatically during deployment:

1. **After normalization** (for workflows)
2. **Before API call** (for all component types)
3. **During change detection** (for accurate comparison)

### Code Location

- **Filter Implementation**: `packages/extension/src/deployment/DesignTimeFilter.ts`
- **Integration**: `packages/extension/src/deployment/DeploymentService.ts`

### API

```typescript
import { filterDesignTimeAttributes, addDesignTimeAttribute } from './DesignTimeFilter.js';

// Filter a component
const filtered = filterDesignTimeAttributes(component);

// Add custom design-time attribute (project-specific)
addDesignTimeAttribute('myCustomAttribute');

// Get list of all filtered attributes
const attributes = getDesignTimeAttributes();
```

## Adding Custom Attributes

If your project uses additional design-time attributes, you can add them programmatically:

```typescript
import { addDesignTimeAttribute } from '@amorphie-flow-studio/extension/deployment/DesignTimeFilter';

// Add project-specific design-time attributes
addDesignTimeAttribute('customUIData');
addDesignTimeAttribute('projectMetadata');
```

## Behavior

- **Recursive**: Filters attributes at all levels (root, attributes section, nested objects)
- **Non-destructive**: Original files are not modified, only the deployment payload is filtered
- **Safe**: If an attribute is not in the filter list, it is kept in the deployment
- **Automatic**: No manual configuration needed - filtering happens automatically during deployment

## Notes

- Design-time attributes are filtered from ALL component types (workflows, tasks, schemas, views, functions, extensions)
- The filtering happens after normalization to ensure scripts are inlined first
- Diagram data (`.diagram.json` files) are never sent to the API - they are editor-only
- Change detection compares filtered versions to ensure accurate change detection
