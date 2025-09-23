/**
 * BBT Workflow IntelliSense Definitions
 * Generated from BBT.Workflow.Domain.dll and BBT.Workflow.Scripting.dll XML documentation
 * These provide accurate IntelliSense for C# mapping and rule scripts
 */

import type { IntelliSenseItem } from './workflow-types';
import {
  parseBBTWorkflowXml,
  BBT_WORKFLOW_DOMAIN_XML,
  BBT_WORKFLOW_SCRIPTING_XML,
  type ParsedMember
} from './bbt-workflow-xml-parser';

// Core BBT Workflow IntelliSense suggestions
export const BBT_WORKFLOW_INTELLISENSE: IntelliSenseItem[] = [

  // ==== ScriptBase Class ====
  {
    label: 'ScriptBase',
    kind: 'Class',
    insertText: 'ScriptBase',
    documentation: 'Base class for scripts that provides access to global functions',
    detail: 'BBT.Workflow.Scripting.Functions.ScriptBase',
    sortText: '001'
  },

  // ==== IMapping Interface ====
  {
    label: 'IMapping',
    kind: 'Interface',
    insertText: 'IMapping',
    documentation: 'Interface for implementing workflow task mappings with InputHandler and OutputHandler methods',
    detail: 'BBT.Workflow.Scripting.IMapping',
    sortText: '002'
  },
  {
    label: 'InputHandler',
    kind: 'Method',
    insertText: 'public async Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)\n{\n\tvar response = new ScriptResponse();\n\t\\$1\n\treturn response;\n}',
    documentation: 'Handles input processing for the workflow task',
    detail: 'Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)',
    sortText: '003'
  },
  {
    label: 'OutputHandler',
    kind: 'Method',
    insertText: 'public async Task<ScriptResponse> OutputHandler(ScriptContext context)\n{\n\tvar response = new ScriptResponse();\n\t\\$1\n\treturn response;\n}',
    documentation: 'Handles output processing for the workflow task',
    detail: 'Task<ScriptResponse> OutputHandler(ScriptContext context)',
    sortText: '004'
  },

  // ==== IConditionMapping Interface ====
  {
    label: 'IConditionMapping',
    kind: 'Interface',
    insertText: 'IConditionMapping',
    documentation: 'Interface for implementing conditional mappings that return boolean results',
    detail: 'BBT.Workflow.Scripting.IConditionMapping',
    sortText: '005'
  },
  {
    label: 'Handler (condition)',
    kind: 'Method',
    insertText: 'public async Task<bool> Handler(ScriptContext context)\n{\n\t\\$1\n\treturn true;\n}',
    documentation: 'Handles condition evaluation for the workflow task',
    detail: 'Task<bool> Handler(ScriptContext context)',
    sortText: '006'
  },

  // ==== ScriptContext Properties ====
  {
    label: 'context.Instance',
    kind: 'Property',
    insertText: 'context.Instance',
    documentation: 'Workflow instance information including UserId, Id, CorrelationId',
    detail: 'BBT.Workflow.Instances.Instance',
    sortText: '010'
  },
  {
    label: 'context.Instance.UserId',
    kind: 'Property',
    insertText: 'context.Instance.UserId',
    documentation: 'ID of the user who initiated the workflow instance',
    detail: 'string',
    sortText: '011'
  },
  {
    label: 'context.Instance.Id',
    kind: 'Property',
    insertText: 'context.Instance.Id',
    documentation: 'Unique identifier for this workflow instance',
    detail: 'Guid',
    sortText: '012'
  },
  {
    label: 'context.Instance.CorrelationId',
    kind: 'Property',
    insertText: 'context.Instance.CorrelationId',
    documentation: 'Correlation ID for tracking requests across services',
    detail: 'string',
    sortText: '013'
  },
  {
    label: 'context.Body',
    kind: 'Property',
    insertText: 'context.Body',
    documentation: 'Request body data containing task execution results and metadata',
    detail: 'dynamic',
    sortText: '020'
  },
  {
    label: 'context.Body.StatusCode',
    kind: 'Property',
    insertText: 'context.Body.StatusCode',
    documentation: 'HTTP status code from task execution (for HTTP and Dapr tasks)',
    detail: 'int?',
    sortText: '021'
  },
  {
    label: 'context.Body.Data',
    kind: 'Property',
    insertText: 'context.Body.Data',
    documentation: 'Response data from the executed task',
    detail: 'object',
    sortText: '022'
  },
  {
    label: 'context.Body.ErrorMessage',
    kind: 'Property',
    insertText: 'context.Body.ErrorMessage',
    documentation: 'Error message if the task execution failed',
    detail: 'string',
    sortText: '023'
  },
  {
    label: 'context.Body.IsSuccess',
    kind: 'Property',
    insertText: 'context.Body.IsSuccess',
    documentation: 'Boolean indicating if the task execution was successful',
    detail: 'bool?',
    sortText: '024'
  },
  {
    label: 'context.Body.TaskType',
    kind: 'Property',
    insertText: 'context.Body.TaskType',
    documentation: 'Type of the executed task (HTTP, Dapr, etc.)',
    detail: 'string',
    sortText: '025'
  },
  {
    label: 'context.Body.ExecutionDurationMs',
    kind: 'Property',
    insertText: 'context.Body.ExecutionDurationMs',
    documentation: 'Execution duration in milliseconds',
    detail: 'long?',
    sortText: '026'
  },
  {
    label: 'context.Body.Headers',
    kind: 'Property',
    insertText: 'context.Body.Headers',
    documentation: 'HTTP headers from the task response',
    detail: 'Dictionary<string, string>',
    sortText: '027'
  },
  {
    label: 'context.Body.Metadata',
    kind: 'Property',
    insertText: 'context.Body.Metadata',
    documentation: 'Additional metadata from task execution',
    detail: 'Dictionary<string, object>',
    sortText: '028'
  },

  // ==== ScriptResponse Class ====
  {
    label: 'ScriptResponse',
    kind: 'Class',
    insertText: 'ScriptResponse',
    documentation: 'Response object for script execution results',
    detail: 'BBT.Workflow.Scripting.ScriptResponse',
    sortText: '030'
  },
  {
    label: 'new ScriptResponse()',
    kind: 'Method',
    insertText: 'new ScriptResponse()',
    documentation: 'Creates a new script response object',
    detail: 'ScriptResponse',
    sortText: '031'
  },
  {
    label: 'response.Data',
    kind: 'Property',
    insertText: 'response.Data',
    documentation: 'Data to be returned from the script execution',
    detail: 'object',
    sortText: '032'
  },
  {
    label: 'response.Headers',
    kind: 'Property',
    insertText: 'response.Headers',
    documentation: 'HTTP headers to be included in the response',
    detail: 'Dictionary<string, string>',
    sortText: '033'
  },

  // ==== WorkflowTask Properties ====
  {
    label: 'task.Key',
    kind: 'Property',
    insertText: 'task.Key',
    documentation: 'Unique key identifier for the workflow task',
    detail: 'string',
    sortText: '040'
  },
  {
    label: 'task.Version',
    kind: 'Property',
    insertText: 'task.Version',
    documentation: 'Version of the workflow task',
    detail: 'string',
    sortText: '041'
  },
  {
    label: 'task.Domain',
    kind: 'Property',
    insertText: 'task.Domain',
    documentation: 'Domain the task belongs to',
    detail: 'string',
    sortText: '042'
  },

  // ==== Secret Management Functions ====
  {
    label: 'GetSecret',
    kind: 'Method',
    insertText: 'GetSecret("${1:storeName}", "${2:secretStore}", "${3:secretKey}")',
    documentation: 'Gets a secret from Dapr secret store',
    detail: 'string GetSecret(string storeName, string secretStore, string secretKey)',
    sortText: '050'
  },
  {
    label: 'GetSecretAsync',
    kind: 'Method',
    insertText: 'await GetSecretAsync("${1:storeName}", "${2:secretStore}", "${3:secretKey}")',
    documentation: 'Gets a secret from Dapr secret store asynchronously',
    detail: 'Task<string> GetSecretAsync(string storeName, string secretStore, string secretKey)',
    sortText: '051'
  },
  {
    label: 'GetSecrets',
    kind: 'Method',
    insertText: 'GetSecrets("${1:storeName}", "${2:secretStore}")',
    documentation: 'Gets multiple secrets from Dapr secret store',
    detail: 'Dictionary<string, string> GetSecrets(string storeName, string secretStore)',
    sortText: '052'
  },
  {
    label: 'GetSecretsAsync',
    kind: 'Method',
    insertText: 'await GetSecretsAsync("${1:storeName}", "${2:secretStore}")',
    documentation: 'Gets multiple secrets from Dapr secret store asynchronously',
    detail: 'Task<Dictionary<string, string>> GetSecretsAsync(string storeName, string secretStore)',
    sortText: '053'
  },

  // ==== Common Patterns ====
  {
    label: 'Standard Success Response',
    kind: 'Keyword',
    insertText: 'response.Data = new {\n\tsuccess = true,\n\tresult = \\$1,\n\tprocessedAt = DateTime.UtcNow\n};',
    documentation: 'Standard success response pattern',
    detail: 'Success Response Pattern',
    sortText: '060'
  },
  {
    label: 'Standard Error Response',
    kind: 'Keyword',
    insertText: 'response.Data = new {\n\tsuccess = false,\n\terror = "${1:Error message}",\n\tshouldRetry = false,\n\tprocessedAt = DateTime.UtcNow\n};',
    documentation: 'Standard error response pattern',
    detail: 'Error Response Pattern',
    sortText: '061'
  },
  {
    label: 'HTTP Status Code Handler',
    kind: 'Keyword',
    insertText: 'if (context.Body.StatusCode != null)\n{\n\tvar statusCode = (int)context.Body.StatusCode;\n\tif (statusCode == 200)\n\t{\n\t\t// Success handling\n\t\t\\$1\n\t}\n\telse if (statusCode >= 400)\n\t{\n\t\t// Error handling\n\t\t\\$2\n\t}\n}',
    documentation: 'HTTP status code handling pattern',
    detail: 'HTTP Status Handler',
    sortText: '062'
  },
  {
    label: 'Task Success/Failure Handler',
    kind: 'Keyword',
    insertText: 'if (context.Body.IsSuccess != null)\n{\n\tif ((bool)context.Body.IsSuccess)\n\t{\n\t\t// Task succeeded\n\t\t\\$1\n\t}\n\telse\n\t{\n\t\t// Task failed\n\t\t\\$2\n\t}\n}',
    documentation: 'Task success/failure handling pattern',
    detail: 'Task Success Handler',
    sortText: '063'
  },
  {
    label: 'Retry Logic Helper',
    kind: 'Method',
    insertText: 'private bool ShouldRetryBasedOnError(string errorMessage)\n{\n\tif (string.IsNullOrEmpty(errorMessage))\n\t\treturn false;\n\t\t\t\n\tvar retryableErrors = new[]\n\t{\n\t\t"timeout",\n\t\t"connection",\n\t\t"network",\n\t\t"service unavailable",\n\t\t"internal server error"\n\t};\n\t\n\treturn retryableErrors.Any(error => \n\t\terrorMessage.ToLowerInvariant().Contains(error));\n}',
    documentation: 'Helper method to determine if a task should be retried based on error message',
    detail: 'bool ShouldRetryBasedOnError(string errorMessage)',
    sortText: '064'
  },

  // ==== Validation Patterns ====
  {
    label: 'Null Check Pattern',
    kind: 'Keyword',
    insertText: 'if (\\$1 == null)\n{\n\treturn new {\n\t\tsuccess = false,\n\t\terror = "Input data cannot be null"\n\t};\n}',
    documentation: 'Null validation pattern',
    detail: 'Null Check Validation',
    sortText: '070'
  },
  {
    label: 'Amount Validation',
    kind: 'Keyword',
    insertText: 'if (input.Amount <= 0)\n{\n\treturn false;\n}',
    documentation: 'Amount validation for rules',
    detail: 'Amount Validation',
    sortText: '071'
  },
  {
    label: 'Business Hours Check',
    kind: 'Keyword',
    insertText: 'var now = DateTime.Now;\nreturn now.Hour >= 9 && now.Hour <= 17 && \n       now.DayOfWeek != DayOfWeek.Saturday && \n       now.DayOfWeek != DayOfWeek.Sunday;',
    documentation: 'Business hours validation',
    detail: 'Business Hours Check',
    sortText: '072'
  }
];

// BBT Workflow using statements for IntelliSense
export const BBT_WORKFLOW_USINGS: IntelliSenseItem[] = [
  {
    label: 'using BBT.Workflow.Scripting;',
    kind: 'Keyword',
    insertText: 'using BBT.Workflow.Scripting;',
    documentation: 'Main BBT Workflow scripting namespace',
    detail: 'using statement',
    sortText: '001'
  },
  {
    label: 'using BBT.Workflow.Definitions;',
    kind: 'Keyword',
    insertText: 'using BBT.Workflow.Definitions;',
    documentation: 'BBT Workflow definitions namespace',
    detail: 'using statement',
    sortText: '002'
  },
  {
    label: 'using BBT.Workflow.Scripting.Functions;',
    kind: 'Keyword',
    insertText: 'using BBT.Workflow.Scripting.Functions;',
    documentation: 'BBT Workflow scripting functions namespace',
    detail: 'using statement',
    sortText: '003'
  }
];

// Complete class templates
export const BBT_WORKFLOW_TEMPLATES: IntelliSenseItem[] = [
  {
    label: 'IMapping Class Template',
    kind: 'Keyword',
    insertText: `/// <summary>
/// \${1:YourMappingName} - Implements IMapping for workflow processing
/// </summary>
public class \${1:YourMappingName}Mapping : ScriptBase, IMapping
{
    /// <summary>
    /// Handles input processing for the workflow task
    /// </summary>
    public async Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
    {
        var response = new ScriptResponse();

        response.Data = new
        {
            userId = context.Instance.UserId,
            workflowId = context.Instance.Id,
            requestTime = DateTime.UtcNow
        };

        response.Headers = new Dictionary<string, string>
        {
            ["X-Correlation-Id"] = context.Instance.CorrelationId,
            ["X-User-Id"] = context.Instance.UserId
        };

        return response;
    }

    /// <summary>
    /// Handles output processing for the workflow task
    /// </summary>
    public async Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
        var response = new ScriptResponse();

        \\\\$2

        return response;
    }
}`,
    documentation: 'Complete IMapping class template with InputHandler and OutputHandler',
    detail: 'IMapping Class Template',
    sortText: '001'
  },
  {
    label: 'IConditionMapping Class Template',
    kind: 'Keyword',
    insertText: `/// <summary>
/// \${1:YourMappingName} - Implements IConditionMapping for workflow conditions
/// </summary>
public class \${1:YourMappingName}MappingRule : IConditionMapping
{
    /// <summary>
    /// Handles condition evaluation for the workflow task
    /// </summary>
    public async Task<bool> Handler(ScriptContext context)
    {
        \\\\$2

        return true;
    }
}`,
    documentation: 'Complete IConditionMapping class template for rules',
    detail: 'IConditionMapping Class Template',
    sortText: '002'
  }
];

// Helper function to get all BBT Workflow IntelliSense items
/**
 * Convert parsed XML members to IntelliSense items
 */
function convertXmlToIntelliSense(members: ParsedMember[]): IntelliSenseItem[] {
  const suggestions: IntelliSenseItem[] = [];

  for (const member of members) {
    let kind: IntelliSenseItem['kind'] = 'Text';
    let insertText = member.name;
    let detail = member.type;

    switch (member.type) {
      case 'class':
      case 'interface':
        kind = 'Class';
        detail = `${member.type}: ${member.fullName}`;
        break;

      case 'method':
        kind = 'Method';
        if (member.parameters && member.parameters.length > 0) {
          const paramList = member.parameters.map((p, i) => `\${${i + 1}:${p.name}}`).join(', ');
          insertText = `${member.name}(${paramList})`;
        } else {
          insertText = `${member.name}()`;
        }
        detail = `method: ${member.name}`;
        break;

      case 'property':
        kind = 'Property';
        detail = `property: ${member.name}`;
        break;

      case 'field':
        kind = 'Field';
        detail = `field: ${member.name}`;
        break;
    }

    suggestions.push({
      label: member.name,
      kind,
      insertText,
      documentation: member.summary || `${member.type}: ${member.name}`,
      detail,
      sortText: member.type === 'interface' ? '001' : member.type === 'class' ? '002' : '999'
    });
  }

  return suggestions;
}

/**
 * Get all BBT Workflow IntelliSense suggestions including XML-parsed items
 */
export function getAllBBTWorkflowIntelliSense(): IntelliSenseItem[] {
  // Parse XML documentation
  const domainAssembly = parseBBTWorkflowXml(BBT_WORKFLOW_DOMAIN_XML);
  const scriptingAssembly = parseBBTWorkflowXml(BBT_WORKFLOW_SCRIPTING_XML);

  // Convert to IntelliSense items
  const domainSuggestions = convertXmlToIntelliSense(domainAssembly.members);
  const scriptingSuggestions = convertXmlToIntelliSense(scriptingAssembly.members);

  return [
    ...BBT_WORKFLOW_INTELLISENSE,
    ...BBT_WORKFLOW_USINGS,
    ...BBT_WORKFLOW_TEMPLATES,
    ...domainSuggestions,
    ...scriptingSuggestions
  ];
}
