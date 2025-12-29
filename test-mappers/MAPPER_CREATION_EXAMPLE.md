# Updated Mapper Creation Dialog

The mapper creation dialog has been updated to support contract-based mappers with correct schema templates.

## New Features

### 1. Contract Type Selection
Users can now select from 6 contract types:
- **IMapping** - Task input/output data binding
- **IConditionMapping** - Boolean conditional logic
- **ITransitionMapping** - Transition data transformation
- **ISubFlowMapping** - Subflow input/output handlers
- **ISubProcessMapping** - Subprocess input preparation
- **ITimerMapping** - Timer schedule calculation

### 2. File Extension Based on Contract Type
The dialog automatically uses the correct file extension:
- IMapping → `.mapping.json`
- IConditionMapping → `.condition.json`
- ITransitionMapping → `.transition.json`
- ISubFlowMapping → `.subflow.json`
- ISubProcessMapping → `.subprocess.json`
- ITimerMapping → `.timer.json`

### 3. Correct Schema Structure
Each contract type generates the correct handler structure with proper schemaParts.

## Example: IMapping Mapper

When creating an IMapping mapper named "order-mapper", the generated file will be:

**File:** `order-mapper.mapping.json`

```json
{
  "key": "order-mapper",
  "domain": "custom",
  "flow": "mappers",
  "version": "1.0.0",
  "contractType": "IMapping",
  "namespace": "Custom.Mappers",
  "className": "OrderMapper",
  "handlers": {
    "InputHandler": {
      "schemaParts": {
        "source": {
          "context": {
            "schemaRef": "platform://ScriptContext",
            "label": "Workflow Context",
            "schemaSourcePath": "platform://ScriptContext"
          }
        },
        "target": {
          "task": {
            "schemaRef": "platform://WorkflowTask",
            "label": "Task Configuration (to modify)",
            "schemaSourcePath": "platform://WorkflowTask"
          },
          "audit": {
            "schemaRef": "platform://ScriptResponse",
            "label": "Audit Response",
            "schemaSourcePath": "platform://ScriptResponse"
          }
        }
      },
      "nodes": [],
      "edges": []
    },
    "OutputHandler": {
      "schemaParts": {
        "source": {
          "context": {
            "schemaRef": "platform://ScriptContext",
            "label": "Context (with TaskResponse)",
            "schemaSourcePath": "platform://ScriptContext"
          }
        },
        "target": {
          "data": {
            "schemaRef": "platform://ScriptResponse",
            "label": "Instance Data (to merge)",
            "schemaSourcePath": "platform://ScriptResponse"
          }
        }
      },
      "nodes": [],
      "edges": []
    }
  }
}
```

## Example: IConditionMapping Mapper

When creating an IConditionMapping mapper named "credit-check", the generated file will be:

**File:** `credit-check.condition.json`

```json
{
  "key": "credit-check",
  "domain": "custom",
  "flow": "mappers",
  "version": "1.0.0",
  "contractType": "IConditionMapping",
  "namespace": "Custom.Mappers",
  "className": "CreditCheck",
  "handlers": {
    "Handler": {
      "schemaParts": {
        "source": {
          "context": {
            "schemaRef": "platform://ScriptContext",
            "label": "Context",
            "schemaSourcePath": "platform://ScriptContext"
          }
        },
        "target": {
          "result": {
            "schemaRef": "custom",
            "label": "Boolean Result",
            "schemaSourcePath": "custom"
          }
        }
      },
      "nodes": [],
      "edges": []
    }
  }
}
```

## Changes Summary

### NewMapperDialog.ts Updates:
1. **Import contract templates**: Added import for `CONTRACT_SCHEMA_TEMPLATES` and `ContractType`
2. **Updated interface**: Added `contractType: ContractType` to `MapperCreationParams`
3. **Contract selector in UI**: Added dropdown with all 6 contract types
4. **Template-based generation**: Uses `CONTRACT_SCHEMA_TEMPLATES` to generate correct handler structures
5. **Dynamic file extension**: Uses contract-specific file extensions
6. **PascalCase helper**: Added `toPascalCase()` function for className generation

### Benefits:
- ✅ No manual schema configuration needed
- ✅ Correct schema structure from the start
- ✅ Consistent with C# contract definitions
- ✅ Multi-handler support (IMapping, ISubFlowMapping)
- ✅ Platform schemas automatically referenced
- ✅ Type-safe contract selection
