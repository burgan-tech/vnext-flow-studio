/**
 * BBT Workflow XML Documentation Parser
 * Parses XML documentation from BBT.Workflow.Domain.dll and BBT.Workflow.Scripting.dll
 */

export interface ParsedMember {
  name: string;
  type: 'class' | 'interface' | 'method' | 'property' | 'field';
  summary?: string;
  parameters?: Array<{
    name: string;
    description: string;
  }>;
  returns?: string;
  fullName: string;
}

export interface ParsedAssembly {
  name: string;
  members: ParsedMember[];
}

/**
 * Parse XML documentation from BBT Workflow assemblies
 */
export function parseBBTWorkflowXml(xmlContent: string): ParsedAssembly {
  // Simple XML parser for documentation
  const members: ParsedMember[] = [];

  // Extract assembly name
  const assemblyMatch = xmlContent.match(/<name>(.*?)<\/name>/);
  const assemblyName = assemblyMatch ? assemblyMatch[1] : 'Unknown';

  // Extract all member elements
  const memberRegex = /<member name="([^"]+)">(.*?)<\/member>/gs;
  let match;

  while ((match = memberRegex.exec(xmlContent)) !== null) {
    const fullName = match[1];
    const content = match[2];

    // Parse member type from name
    const memberType = getMemberType(fullName);
    const name = getSimpleName(fullName);

    // Extract summary
    const summaryMatch = content.match(/<summary>\s*(.*?)\s*<\/summary>/s);
    const summary = summaryMatch ? summaryMatch[1].trim().replace(/\s+/g, ' ') : undefined;

    // Extract parameters
    const parameters: Array<{ name: string; description: string }> = [];
    const paramRegex = /<param name="([^"]+)">\s*(.*?)\s*<\/param>/gs;
    let paramMatch;
    while ((paramMatch = paramRegex.exec(content)) !== null) {
      parameters.push({
        name: paramMatch[1],
        description: paramMatch[2].trim().replace(/\s+/g, ' ')
      });
    }

    // Extract returns
    const returnsMatch = content.match(/<returns>\s*(.*?)\s*<\/returns>/s);
    const returns = returnsMatch ? returnsMatch[1].trim().replace(/\s+/g, ' ') : undefined;

    members.push({
      name,
      type: memberType,
      summary,
      parameters: parameters.length > 0 ? parameters : undefined,
      returns,
      fullName
    });
  }

  return {
    name: assemblyName,
    members
  };
}

function getMemberType(fullName: string): ParsedMember['type'] {
  if (fullName.startsWith('T:')) {
    return fullName.includes('Interface') || fullName.includes('IMapping') || fullName.includes('ICondition') ? 'interface' : 'class';
  }
  if (fullName.startsWith('M:')) return 'method';
  if (fullName.startsWith('P:')) return 'property';
  if (fullName.startsWith('F:')) return 'field';
  return 'class';
}

function getSimpleName(fullName: string): string {
  // Remove prefix (T:, M:, P:, F:)
  const withoutPrefix = fullName.substring(2);

  // Get the last part after the last dot, before any parentheses
  const parts = withoutPrefix.split('.');
  const lastPart = parts[parts.length - 1];

  // Remove method parameters
  const nameOnly = lastPart.split('(')[0];

  // Remove #ctor for constructors
  return nameOnly === '#ctor' ? parts[parts.length - 2] : nameOnly;
}

// BBT Workflow Domain XML content (embedded)
export const BBT_WORKFLOW_DOMAIN_XML = `<?xml version="1.0"?>
<doc>
    <assembly>
        <name>BBT.Workflow.Domain</name>
    </assembly>
    <members>
        <member name="T:BBT.Workflow.Domain.WorkflowTask">
            <summary>
            Represents a workflow task with configuration, input/output handlers, and execution context.
            </summary>
        </member>
        <member name="P:BBT.Workflow.Domain.WorkflowTask.Id">
            <summary>
            Gets or sets the unique identifier for the workflow task.
            </summary>
        </member>
        <member name="P:BBT.Workflow.Domain.WorkflowTask.Name">
            <summary>
            Gets or sets the name of the workflow task.
            </summary>
        </member>
        <member name="P:BBT.Workflow.Domain.WorkflowTask.Configuration">
            <summary>
            Gets or sets the task configuration as dynamic object.
            </summary>
        </member>
        <member name="T:BBT.Workflow.Domain.ScriptContext">
            <summary>
            Provides context information for script execution including workflow instance, body data, and headers.
            </summary>
        </member>
        <member name="P:BBT.Workflow.Domain.ScriptContext.Instance">
            <summary>
            Gets or sets the workflow instance associated with this script execution.
            </summary>
        </member>
        <member name="P:BBT.Workflow.Domain.ScriptContext.Body">
            <summary>
            Gets or sets the request/response body data for the script.
            </summary>
        </member>
        <member name="P:BBT.Workflow.Domain.ScriptContext.Headers">
            <summary>
            Gets or sets the HTTP headers associated with the request.
            </summary>
        </member>
        <member name="T:BBT.Workflow.Domain.ScriptResponse">
            <summary>
            Represents the response from a script execution including data and headers.
            </summary>
        </member>
        <member name="P:BBT.Workflow.Domain.ScriptResponse.Data">
            <summary>
            Gets or sets the response data as dynamic object.
            </summary>
        </member>
        <member name="P:BBT.Workflow.Domain.ScriptResponse.Headers">
            <summary>
            Gets or sets the response headers as key-value pairs.
            </summary>
        </member>
        <member name="T:BBT.Workflow.Domain.IMapping">
            <summary>
            Interface for workflow task input/output mapping handlers.
            </summary>
        </member>
        <member name="M:BBT.Workflow.Domain.IMapping.InputHandler(BBT.Workflow.Domain.WorkflowTask,BBT.Workflow.Domain.ScriptContext)">
            <summary>
            Handles input processing for the workflow task.
            </summary>
            <param name="task">The workflow task being executed</param>
            <param name="context">The script execution context</param>
            <returns>A ScriptResponse containing the processed input data</returns>
        </member>
        <member name="M:BBT.Workflow.Domain.IMapping.OutputHandler(BBT.Workflow.Domain.ScriptContext)">
            <summary>
            Handles output processing for the workflow task.
            </summary>
            <param name="context">The script execution context with response data</param>
            <returns>A ScriptResponse containing the processed output data</returns>
        </member>
        <member name="T:BBT.Workflow.Domain.IConditionMapping">
            <summary>
            Interface for workflow condition evaluation handlers.
            </summary>
        </member>
        <member name="M:BBT.Workflow.Domain.IConditionMapping.Handler(BBT.Workflow.Domain.ScriptContext)">
            <summary>
            Evaluates a condition for workflow transitions or rules.
            </summary>
            <param name="context">The script execution context</param>
            <returns>True if the condition is met, false otherwise</returns>
        </member>
        <member name="T:BBT.Workflow.Domain.WorkflowInstance">
            <summary>
            Represents a running instance of a workflow.
            </summary>
        </member>
        <member name="P:BBT.Workflow.Domain.WorkflowInstance.Id">
            <summary>
            Gets or sets the unique identifier for this workflow instance.
            </summary>
        </member>
        <member name="P:BBT.Workflow.Domain.WorkflowInstance.UserId">
            <summary>
            Gets or sets the user ID associated with this workflow instance.
            </summary>
        </member>
        <member name="P:BBT.Workflow.Domain.WorkflowInstance.CorrelationId">
            <summary>
            Gets or sets the correlation ID for tracking this workflow instance.
            </summary>
        </member>
        <member name="P:BBT.Workflow.Domain.WorkflowInstance.State">
            <summary>
            Gets or sets the current state of the workflow instance.
            </summary>
        </member>
        <member name="P:BBT.Workflow.Domain.WorkflowInstance.Data">
            <summary>
            Gets or sets the workflow instance data as dynamic object.
            </summary>
        </member>
    </members>
</doc>`;

// BBT Workflow Scripting XML content (embedded)
export const BBT_WORKFLOW_SCRIPTING_XML = `<?xml version="1.0"?>
<doc>
    <assembly>
        <name>BBT.Workflow.Scripting</name>
    </assembly>
    <members>
        <member name="T:BBT.Workflow.Scripting.Functions.ScriptBase">
            <summary>
            Base class for scripts that provides access to global functions
            </summary>
        </member>
        <member name="M:BBT.Workflow.Scripting.Functions.ScriptBase.GetSecret(System.String,System.String,System.String)">
            <summary>
            Gets a secret from Dapr secret store (synchronous version for script compatibility)
            </summary>
            <param name="storeName">The name of the dapr secret store</param>
            <param name="secretStore">The name of the secret store</param>
            <param name="secretKey">The key of the secret</param>
            <returns>The secret value</returns>
        </member>
        <member name="M:BBT.Workflow.Scripting.Functions.ScriptBase.GetSecrets(System.String,System.String)">
            <summary>
            Gets multiple secrets from Dapr secret store (synchronous version)
            </summary>
            <param name="storeName">The name of the dapr secret store</param>
            <param name="secretStore">The name of the secret store</param>
            <returns>Dictionary of secret keys and values</returns>
        </member>
        <member name="T:BBT.Workflow.Scripting.Functions.DaprSecretFunctions">
            <summary>
            Custom functions for accessing Dapr secret store from scripts
            </summary>
        </member>
        <member name="M:BBT.Workflow.Scripting.Functions.DaprSecretFunctions.GetSecret(System.String,System.String,System.String)">
            <summary>
            Gets a secret from Dapr secret store (synchronous version for script compatibility)
            </summary>
            <param name="storeName">The name of the dapr secret store</param>
            <param name="secretStore">The name of the secret store</param>
            <param name="secretKey">The key of the secret</param>
            <returns>The secret value</returns>
        </member>
    </members>
</doc>`;
