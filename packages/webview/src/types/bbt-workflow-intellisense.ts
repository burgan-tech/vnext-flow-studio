/**
 * BBT Workflow IntelliSense Definitions
 * Generated from BBT.Workflow.Domain.dll and BBT.Workflow.Scripting.dll XML documentation
 * These provide accurate IntelliSense for C# mapping and rule scripts
 */

import type { IntelliSenseItem } from './ui-helpers';
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
    documentation: 'Workflow instance information including Id, Key, Flow, CurrentState, Status, Data',
    detail: 'BBT.Workflow.Instances.Instance',
    sortText: '010'
  },
  {
    label: 'context.Instance.Id',
    kind: 'Property',
    insertText: 'context.Instance.Id',
    documentation: 'Unique identifier for this workflow instance',
    detail: 'Guid',
    sortText: '011'
  },
  {
    label: 'context.Instance.Key',
    kind: 'Property',
    insertText: 'context.Instance.Key',
    documentation: 'Human-readable key for the workflow instance',
    detail: 'string',
    sortText: '012'
  },
  {
    label: 'context.Instance.Flow',
    kind: 'Property',
    insertText: 'context.Instance.Flow',
    documentation: 'Flow name that this instance belongs to',
    detail: 'string',
    sortText: '013'
  },
  {
    label: 'context.Instance.CurrentState',
    kind: 'Property',
    insertText: 'context.Instance.CurrentState',
    documentation: 'Current state of the workflow instance',
    detail: 'string',
    sortText: '014'
  },
  {
    label: 'context.Instance.Status',
    kind: 'Property',
    insertText: 'context.Instance.Status',
    documentation: 'Status of the workflow instance (Active, Completed, etc.)',
    detail: 'InstanceStatus',
    sortText: '015'
  },
  {
    label: 'context.Instance.Data',
    kind: 'Property',
    insertText: 'context.Instance.Data',
    documentation: 'Latest instance data containing workflow variables and state',
    detail: 'dynamic',
    sortText: '016'
  },
  {
    label: 'context.Instance.CreatedAt',
    kind: 'Property',
    insertText: 'context.Instance.CreatedAt',
    documentation: 'When the workflow instance was created',
    detail: 'DateTime',
    sortText: '017'
  },
  {
    label: 'context.Instance.ModifiedAt',
    kind: 'Property',
    insertText: 'context.Instance.ModifiedAt',
    documentation: 'When the workflow instance was last modified',
    detail: 'DateTime?',
    sortText: '018'
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
  {
    label: 'context.Headers',
    kind: 'Property',
    insertText: 'context.Headers',
    documentation: 'HTTP headers from request/response',
    detail: 'dynamic',
    sortText: '029'
  },
  {
    label: 'context.RouteValues',
    kind: 'Property',
    insertText: 'context.RouteValues',
    documentation: 'Route parameter values',
    detail: 'Dictionary<string, dynamic>',
    sortText: '030'
  },
  {
    label: 'context.Workflow',
    kind: 'Property',
    insertText: 'context.Workflow',
    documentation: 'Workflow definition and metadata',
    detail: 'BBT.Workflow.Definitions.Workflow',
    sortText: '031'
  },
  {
    label: 'context.Transition',
    kind: 'Property',
    insertText: 'context.Transition',
    documentation: 'Current transition being executed',
    detail: 'BBT.Workflow.Definitions.Transition',
    sortText: '032'
  },
  {
    label: 'context.TaskResponse',
    kind: 'Property',
    insertText: 'context.TaskResponse',
    documentation: 'Results from previous task executions',
    detail: 'Dictionary<string, dynamic?>',
    sortText: '033'
  },
  {
    label: 'context.MetaData',
    kind: 'Property',
    insertText: 'context.MetaData',
    documentation: 'Custom metadata for the execution context',
    detail: 'Dictionary<string, dynamic>',
    sortText: '034'
  },
  {
    label: 'context.Runtime',
    kind: 'Property',
    insertText: 'context.Runtime',
    documentation: 'Runtime information provider',
    detail: 'BBT.Workflow.Runtime.IRuntimeInfoProvider',
    sortText: '035'
  },
  {
    label: 'context.Definitions',
    kind: 'Property',
    insertText: 'context.Definitions',
    documentation: 'Workflow definitions and references',
    detail: 'Dictionary<string, dynamic>',
    sortText: '036'
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
  {
    label: 'task.Type',
    kind: 'Property',
    insertText: 'task.Type',
    documentation: 'Type of the workflow task (1=DaprHttpEndpoint, 2=DaprBinding, 3=DaprService, 4=DaprPubSub, 5=Human, 6=Http, 7=Script)',
    detail: 'string',
    sortText: '043'
  },
  {
    label: 'task.Config',
    kind: 'Property',
    insertText: 'task.Config',
    documentation: 'Task configuration as JsonElement',
    detail: 'JsonElement',
    sortText: '044'
  },

  // ==== Task Type Specific Properties ====
  // HttpTask (type: "6")
  {
    label: 'httpTask.Url',
    kind: 'Property',
    insertText: 'httpTask.Url',
    documentation: 'HTTP endpoint URL for the task',
    detail: 'string',
    sortText: '050'
  },
  {
    label: 'httpTask.HttpMethod',
    kind: 'Property',
    insertText: 'httpTask.HttpMethod',
    documentation: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
    detail: 'string',
    sortText: '051'
  },
  {
    label: 'httpTask.Headers',
    kind: 'Property',
    insertText: 'httpTask.Headers',
    documentation: 'HTTP headers for the request',
    detail: 'Dictionary<string, string>',
    sortText: '052'
  },
  {
    label: 'httpTask.Timeout',
    kind: 'Property',
    insertText: 'httpTask.Timeout',
    documentation: 'Request timeout duration',
    detail: 'TimeSpan',
    sortText: '053'
  },

  // DaprServiceTask (type: "3")
  {
    label: 'daprTask.AppId',
    kind: 'Property',
    insertText: 'daprTask.AppId',
    documentation: 'DAPR application ID for service invocation',
    detail: 'string',
    sortText: '060'
  },
  {
    label: 'daprTask.MethodName',
    kind: 'Property',
    insertText: 'daprTask.MethodName',
    documentation: 'Method name to invoke on the DAPR service',
    detail: 'string',
    sortText: '061'
  },
  {
    label: 'daprTask.HttpVerb',
    kind: 'Property',
    insertText: 'daprTask.HttpVerb',
    documentation: 'HTTP verb for the DAPR service call',
    detail: 'string',
    sortText: '062'
  },

  // DaprBindingTask (type: "2")
  {
    label: 'bindingTask.BindingName',
    kind: 'Property',
    insertText: 'bindingTask.BindingName',
    documentation: 'Name of the DAPR binding component',
    detail: 'string',
    sortText: '070'
  },
  {
    label: 'bindingTask.Operation',
    kind: 'Property',
    insertText: 'bindingTask.Operation',
    documentation: 'Operation to perform on the binding',
    detail: 'string',
    sortText: '071'
  },
  {
    label: 'bindingTask.Metadata',
    kind: 'Property',
    insertText: 'bindingTask.Metadata',
    documentation: 'Metadata for the binding operation',
    detail: 'Dictionary<string, string>',
    sortText: '072'
  },

  // HumanTask (type: "5")
  {
    label: 'humanTask.Title',
    kind: 'Property',
    insertText: 'humanTask.Title',
    documentation: 'Title of the human task',
    detail: 'string',
    sortText: '080'
  },
  {
    label: 'humanTask.Instructions',
    kind: 'Property',
    insertText: 'humanTask.Instructions',
    documentation: 'Instructions for the human task',
    detail: 'string',
    sortText: '081'
  },
  {
    label: 'humanTask.AssignedTo',
    kind: 'Property',
    insertText: 'humanTask.AssignedTo',
    documentation: 'User or group assigned to the human task',
    detail: 'string',
    sortText: '082'
  },
  {
    label: 'humanTask.DueDate',
    kind: 'Property',
    insertText: 'humanTask.DueDate',
    documentation: 'Due date for the human task',
    detail: 'DateTime?',
    sortText: '083'
  },
  {
    label: 'humanTask.Form',
    kind: 'Property',
    insertText: 'humanTask.Form',
    documentation: 'Form definition for the human task',
    detail: 'object',
    sortText: '084'
  },

  // ScriptTask (type: "7")
  {
    label: 'scriptTask.Script',
    kind: 'Property',
    insertText: 'scriptTask.Script',
    documentation: 'Script code and language for the script task',
    detail: 'ScriptCode',
    sortText: '090'
  },
  {
    label: 'scriptTask.Script.Code',
    kind: 'Property',
    insertText: 'scriptTask.Script.Code',
    documentation: 'C# script code to execute',
    detail: 'string',
    sortText: '091'
  },
  {
    label: 'scriptTask.Script.Language',
    kind: 'Property',
    insertText: 'scriptTask.Script.Language',
    documentation: 'Script language (csharp)',
    detail: 'string',
    sortText: '092'
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
            instanceId = context.Instance.Id,
            instanceKey = context.Instance.Key,
            currentState = context.Instance.CurrentState,
            requestTime = DateTime.UtcNow
        };

        response.Headers = new Dictionary<string, string>
        {
            ["X-Instance-Id"] = context.Instance.Id.ToString(),
            ["X-Flow"] = context.Instance.Flow
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
  },
  {
    label: 'HttpTask Mapping Template',
    kind: 'Keyword',
    insertText: `/// <summary>
/// HttpTask mapping for API calls
/// </summary>
public class \${1:ApiName}HttpMapping : ScriptBase, IMapping
{
    public async Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
    {
        var httpTask = (task as HttpTask)!;
        var response = new ScriptResponse();

        // Access instance data
        var customerId = context.Instance.Data?.customerId;
        var userId = context.Instance.Data?.userId;

        // Prepare request data
        response.Data = new
        {
            customerId = customerId,
            userId = userId,
            timestamp = DateTime.UtcNow
        };

        // Set authorization header
        response.Headers = new Dictionary<string, string>
        {
            ["Authorization"] = "Bearer " + GetSecret("dapr_store", "api_store", "auth_token"),
            ["Content-Type"] = "application/json"
        };

        return response;
    }

    public async Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
        var response = new ScriptResponse();

        // Transform response data
        response.Data = new
        {
            success = context.Body?.success ?? false,
            message = context.Body?.message ?? "No message",
            timestamp = DateTime.UtcNow
        };

        return response;
    }
}`,
    documentation: 'HttpTask mapping template for API calls',
    detail: 'HttpTask Mapping Template',
    sortText: '003'
  },
  {
    label: 'DaprServiceTask Mapping Template',
    kind: 'Keyword',
    insertText: `/// <summary>
/// DaprServiceTask mapping for service invocations
/// </summary>
public class \${1:ServiceName}DaprMapping : ScriptBase, IMapping
{
    public async Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
    {
        var daprTask = (task as DaprServiceTask)!;
        var response = new ScriptResponse();

        // Access instance data
        var instanceData = context.Instance.Data;
        var workflowId = context.Instance.Id;

        // Prepare service call data
        response.Data = new
        {
            workflowInstanceId = workflowId,
            flow = context.Instance.Flow,
            currentState = context.Instance.CurrentState,
            data = instanceData
        };

        return response;
    }

    public async Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
        var response = new ScriptResponse();

        // Process service response
        response.Data = new
        {
            processed = true,
            result = context.Body?.result,
            timestamp = DateTime.UtcNow
        };

        return response;
    }
}`,
    documentation: 'DaprServiceTask mapping template for service invocations',
    detail: 'DaprServiceTask Mapping Template',
    sortText: '004'
  },
  {
    label: 'HumanTask Mapping Template',
    kind: 'Keyword',
    insertText: `/// <summary>
/// HumanTask mapping for human approval tasks
/// </summary>
public class \${1:TaskName}HumanMapping : ScriptBase, IMapping
{
    public async Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
    {
        var humanTask = (task as HumanTask)!;
        var response = new ScriptResponse();

        // Prepare human task data
        response.Data = new
        {
            taskId = Guid.NewGuid(),
            instanceId = context.Instance.Id,
            title = humanTask.Title,
            instructions = humanTask.Instructions,
            assignedTo = humanTask.AssignedTo,
            dueDate = humanTask.DueDate,
            form = humanTask.Form,
            instanceData = context.Instance.Data
        };

        return response;
    }

    public async Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
        var response = new ScriptResponse();

        // Process human task result
        response.Data = new
        {
            approved = context.Body?.approved ?? false,
            comments = context.Body?.comments ?? "",
            completedBy = context.Body?.completedBy ?? "",
            completedAt = DateTime.UtcNow
        };

        return response;
    }
}`,
    documentation: 'HumanTask mapping template for human approval tasks',
    detail: 'HumanTask Mapping Template',
    sortText: '005'
  },
  {
    label: 'ScriptTask Mapping Template',
    kind: 'Keyword',
    insertText: `/// <summary>
/// ScriptTask mapping for C# script execution
/// </summary>
public class \${1:ScriptName}ScriptMapping : ScriptBase, IMapping
{
    public async Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
    {
        var scriptTask = (task as ScriptTask)!;
        var response = new ScriptResponse();

        // Prepare script execution data
        response.Data = new
        {
            instanceId = context.Instance.Id,
            scriptCode = scriptTask.Script.Code,
            language = scriptTask.Script.Language,
            inputData = context.Instance.Data
        };

        return response;
    }

    public async Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
        var response = new ScriptResponse();

        // Process script execution result
        response.Data = new
        {
            executed = true,
            result = context.Body,
            executionTime = DateTime.UtcNow
        };

        return response;
    }
}`,
    documentation: 'ScriptTask mapping template for C# script execution',
    detail: 'ScriptTask Mapping Template',
    sortText: '006'
  },
  {
    label: 'DaprBindingTask Mapping Template',
    kind: 'Keyword',
    insertText: `/// <summary>
/// DaprBindingTask mapping for external integrations
/// </summary>
public class \${1:BindingName}BindingMapping : ScriptBase, IMapping
{
    public async Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
    {
        var bindingTask = (task as DaprBindingTask)!;
        var response = new ScriptResponse();

        // Prepare binding data
        response.Data = new
        {
            bindingName = bindingTask.BindingName,
            operation = bindingTask.Operation,
            metadata = bindingTask.Metadata,
            instanceData = context.Instance.Data
        };

        return response;
    }

    public async Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
        var response = new ScriptResponse();

        // Process binding result
        response.Data = new
        {
            success = true,
            result = context.Body,
            processedAt = DateTime.UtcNow
        };

        return response;
    }
}`,
    documentation: 'DaprBindingTask mapping template for external integrations',
    detail: 'DaprBindingTask Mapping Template',
    sortText: '007'
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

  // Combine all suggestions
  const allSuggestions = [
    ...BBT_WORKFLOW_INTELLISENSE,
    ...BBT_WORKFLOW_USINGS,
    ...BBT_WORKFLOW_TEMPLATES,
    ...domainSuggestions,
    ...scriptingSuggestions
  ];

  // Remove duplicates based on label
  const uniqueSuggestions = allSuggestions.filter((item, index, self) =>
    index === self.findIndex(s => s.label === item.label)
  );

  return uniqueSuggestions;
}
