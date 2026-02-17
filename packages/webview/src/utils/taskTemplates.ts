// Task-specific C# mapping templates
export function getTemplateForTaskType(taskType?: string): string {
  const baseTemplate = `using System;
using System.Threading.Tasks;
using BBT.Workflow.Scripting;
using BBT.Workflow.Definitions;

public class MappingHandler : ScriptBase, IMapping
{
    public Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
    {
        var response = new ScriptResponse();

        // Access instance data
        var instanceId = context.Instance.Id;
        var instanceKey = context.Instance.Key;
        var currentState = context.Instance.CurrentState;
        var instanceData = context.Instance.Data;

        // Prepare request data
        response.Data = new
        {
            instanceId = instanceId,
            instanceKey = instanceKey,
            currentState = currentState,
            data = instanceData,
            requestTime = DateTime.UtcNow
        };

        // Set headers
        response.Headers = new Dictionary<string, string>
        {
            ["X-Instance-Id"] = instanceId.ToString(),
            ["X-Flow"] = context.Instance.Flow
        };

        return Task.FromResult(response);
    }

    public Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
        var response = new ScriptResponse();

        // Transform response data
        response.Data = new
        {
            success = context.Body?.IsSuccess ?? true,
            message = context.Body?.ErrorMessage ?? "Success",
            result = context.Body?.Data,
            timestamp = DateTime.UtcNow
        };

        return Task.FromResult(response);
    }
}`;

  switch (taskType) {
    case '6': // HttpTask
      return `using System;
using System.Threading.Tasks;
using BBT.Workflow.Scripting;
using BBT.Workflow.Definitions;

public class HttpTaskMapping : ScriptBase, IMapping
{
    public Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
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

        return Task.FromResult(response);
    }

    public Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
        var response = new ScriptResponse();

        // Transform response data
        response.Data = new
        {
            success = context.Body?.success ?? false,
            message = context.Body?.message ?? "No message",
            timestamp = DateTime.UtcNow
        };

        return Task.FromResult(response);
    }
}`;

    case '3': // DaprServiceTask
      return `using System;
using System.Threading.Tasks;
using BBT.Workflow.Scripting;
using BBT.Workflow.Definitions;

public class DaprServiceMapping : ScriptBase, IMapping
{
    public Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
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

        return Task.FromResult(response);
    }

    public Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
        var response = new ScriptResponse();

        // Process service response
        response.Data = new
        {
            processed = true,
            result = context.Body?.result,
            timestamp = DateTime.UtcNow
        };

        return Task.FromResult(response);
    }
}`;

    case '5': // HumanTask
      return `using System;
using System.Threading.Tasks;
using BBT.Workflow.Scripting;
using BBT.Workflow.Definitions;

public class HumanTaskMapping : ScriptBase, IMapping
{
    public Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
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

        return Task.FromResult(response);
    }

    public Task<ScriptResponse> OutputHandler(ScriptContext context)
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

        return Task.FromResult(response);
    }
}`;

    case '7': // ScriptTask
      return `using System;
using System.Threading.Tasks;
using BBT.Workflow.Scripting;
using BBT.Workflow.Definitions;

public class ScriptTaskMapping : ScriptBase, IMapping
{
    public Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
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

        return Task.FromResult(response);
    }

    public Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
        var response = new ScriptResponse();

        // Process script execution result
        response.Data = new
        {
            executed = true,
            result = context.Body,
            executionTime = DateTime.UtcNow
        };

        return Task.FromResult(response);
    }
}`;

    case '2': // DaprBindingTask
      return `using System;
using System.Threading.Tasks;
using BBT.Workflow.Scripting;
using BBT.Workflow.Definitions;

public class DaprBindingMapping : ScriptBase, IMapping
{
    public Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
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

        return Task.FromResult(response);
    }

    public Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
        var response = new ScriptResponse();

        // Process binding result
        response.Data = new
        {
            success = true,
            result = context.Body,
            processedAt = DateTime.UtcNow
        };

        return Task.FromResult(response);
    }
}`;

    case '10': // NotificationTask
      return `using System;
using System.Threading.Tasks;
using amorphie.workflow.core.Models;

/// <summary>
/// Notification Task Mapping
/// Configures notification delivery settings.
/// Mapping type: G (Notification)
/// </summary>
public class ${className} : IMapping
{
    public Task<ScriptResponse> InputHandler(ScriptContext context, ScriptResponse response)
    {
        // Configure notification
        response.Data = new
        {
            // Notification settings
            title = "Notification Title",
            message = "Notification message content",
            channel = "email", // email, sms, push
            recipients = new[] { "user@example.com" }
        };

        return Task.FromResult(response);
    }

    public Task<ScriptResponse> OutputHandler(ScriptContext context, ScriptResponse response)
    {
        // Process notification result
        response.Data = new
        {
            success = context.Body.IsSuccess,
            sentAt = DateTime.UtcNow
        };

        return Task.FromResult(response);
    }
}`;

    default:
      return baseTemplate;
  }
}
