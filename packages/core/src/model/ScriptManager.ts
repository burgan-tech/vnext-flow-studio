// Script manager for handling C# script files (.csx)

import * as path from 'path';
import * as fs from 'fs/promises';
import type { IScriptManager, ResolvedScript } from './types.js';

/**
 * Default C# script template for mappings
 */
const DEFAULT_MAPPING_TEMPLATE = `using System;
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

/**
 * Default C# script template for rules
 */
const DEFAULT_RULE_TEMPLATE = `using System;
using System.Threading.Tasks;
using BBT.Workflow.Scripting;
using BBT.Workflow.Definitions;

public class RuleHandler : ScriptBase, IRule
{
    public Task<bool> EvaluateRule(ScriptContext context)
    {
        // Access instance data
        var instanceData = context.Instance.Data;
        var currentState = context.Instance.CurrentState;

        // Example rule: Check if a condition is met
        // Modify this logic based on your requirements
        if (instanceData != null)
        {
            // Example: Check if amount > 1000
            // var amount = instanceData.amount;
            // return Task.FromResult(amount > 1000);
        }

        // Default: Allow transition
        return Task.FromResult(true);
    }
}`;

/**
 * Task-specific templates
 */
const TASK_TEMPLATES: Record<string, string> = {
  DaprHttpEndpoint: `using System;
using System.Threading.Tasks;
using BBT.Workflow.Scripting;
using BBT.Workflow.Definitions;

public class DaprHttpEndpointMapping : ScriptBase, IMapping
{
    public Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
    {
        var response = new ScriptResponse();

        // Prepare HTTP request body
        response.Data = new
        {
            // Add your request data here
            instanceId = context.Instance.Id,
            timestamp = DateTime.UtcNow
        };

        // Set HTTP headers if needed
        response.Headers = new Dictionary<string, string>
        {
            ["Content-Type"] = "application/json"
        };

        return Task.FromResult(response);
    }

    public Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
        var response = new ScriptResponse();

        // Process HTTP response
        response.Data = context.Body?.Data;

        return Task.FromResult(response);
    }
}`,

  HumanTask: `using System;
using System.Threading.Tasks;
using BBT.Workflow.Scripting;
using BBT.Workflow.Definitions;

public class HumanTaskMapping : ScriptBase, IMapping
{
    public Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
    {
        var response = new ScriptResponse();

        // Prepare form data for human task
        response.Data = new
        {
            title = "Task Title",
            description = "Task Description",
            assignee = "user@example.com",
            dueDate = DateTime.UtcNow.AddDays(7),
            formData = context.Instance.Data
        };

        return Task.FromResult(response);
    }

    public Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
        var response = new ScriptResponse();

        // Process human task completion
        response.Data = new
        {
            completedBy = context.Body?.Data?.completedBy,
            completionDate = DateTime.UtcNow,
            formData = context.Body?.Data
        };

        return Task.FromResult(response);
    }
}`
};

/**
 * Manages C# script files for workflow models
 */
export class ScriptManager implements IScriptManager {
  private scriptCache: Map<string, ResolvedScript> = new Map();

  /**
   * Load a script file from disk
   */
  async loadScript(location: string, basePath: string): Promise<ResolvedScript | null> {
    if (!this.validateScriptPath(location)) {
      return null;
    }

    // Resolve absolute path
    const absolutePath = path.isAbsolute(location)
      ? location
      : path.resolve(basePath, location);

    // Check cache
    const cached = this.scriptCache.get(absolutePath);
    if (cached) {
      // Check if file has been modified
      try {
        const stats = await fs.stat(absolutePath);
        if (cached.lastModified && stats.mtime <= cached.lastModified) {
          return cached;
        }
      } catch {
        // File might have been deleted, continue to reload
      }
    }

    try {
      // Read file
      const content = await fs.readFile(absolutePath, 'utf-8');
      const stats = await fs.stat(absolutePath);

      // Create resolved script
      const script: ResolvedScript = {
        location,
        absolutePath,
        content,
        base64: this.encodeBase64(content),
        exists: true,
        lastModified: stats.mtime,
        size: stats.size
      };

      // Cache it
      this.scriptCache.set(absolutePath, script);

      return script;
    } catch {
      // File doesn't exist or can't be read
      return {
        location,
        absolutePath,
        content: '',
        base64: '',
        exists: false
      };
    }
  }

  /**
   * Save a script file to disk
   */
  async saveScript(location: string, content: string, basePath: string): Promise<void> {
    if (!this.validateScriptPath(location)) {
      throw new Error(`Invalid script path: ${location}`);
    }

    // Resolve absolute path
    const absolutePath = path.isAbsolute(location)
      ? location
      : path.resolve(basePath, location);

    // Ensure directory exists
    const dir = path.dirname(absolutePath);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(absolutePath, content, 'utf-8');

    // Update cache
    const stats = await fs.stat(absolutePath);
    const script: ResolvedScript = {
      location,
      absolutePath,
      content,
      base64: this.encodeBase64(content),
      exists: true,
      lastModified: stats.mtime,
      size: stats.size
    };
    this.scriptCache.set(absolutePath, script);
  }

  /**
   * Create a new script file from template
   */
  async createScript(location: string, template: string, basePath: string): Promise<ResolvedScript> {
    const content = this.getTemplate(template);
    await this.saveScript(location, content, basePath);

    const script = await this.loadScript(location, basePath);
    if (!script) {
      throw new Error(`Failed to create script at ${location}`);
    }

    return script;
  }

  /**
   * Get a template for a specific task type
   */
  getTemplate(taskType?: string): string {
    if (taskType && TASK_TEMPLATES[taskType]) {
      return TASK_TEMPLATES[taskType];
    }

    // Check if it's a rule template request
    if (taskType === 'rule') {
      return DEFAULT_RULE_TEMPLATE;
    }

    // Default to mapping template
    return DEFAULT_MAPPING_TEMPLATE;
  }

  /**
   * Encode content to Base64
   */
  encodeBase64(content: string): string {
    return Buffer.from(content, 'utf-8').toString('base64');
  }

  /**
   * Decode Base64 to content
   */
  decodeBase64(base64: string): string {
    try {
      return Buffer.from(base64, 'base64').toString('utf-8');
    } catch {
      // If decoding fails, return empty string
      return '';
    }
  }

  /**
   * Validate script file path
   */
  validateScriptPath(location: string): boolean {
    if (!location) {
      return false;
    }

    // Must end with .csx, .cs, .js, or .mapper.json
    const validExtensions = ['.csx', '.cs', '.js', '.mapper.json'];
    const hasValidExtension = validExtensions.some(ext => location.endsWith(ext));
    if (!hasValidExtension) {
      return false;
    }

    // Should start with ./ or be absolute
    if (!location.startsWith('./') && !location.startsWith('../') && !path.isAbsolute(location)) {
      return false;
    }

    // No special characters that could cause issues
    const invalidChars = /[<>:"|?*]/;
    if (invalidChars.test(location)) {
      return false;
    }

    return true;
  }

  /**
   * Clear the script cache
   */
  clearCache(): void {
    this.scriptCache.clear();
  }

  /**
   * Get all cached scripts
   */
  getCachedScripts(): Map<string, ResolvedScript> {
    return new Map(this.scriptCache);
  }

  /**
   * Remove a script from cache
   */
  removeFromCache(absolutePath: string): void {
    this.scriptCache.delete(absolutePath);
  }

  /**
   * Invalidate a specific script from cache
   * Called when script file changes or is deleted
   * Handles both relative and absolute paths
   */
  invalidateScript(scriptPath: string): void {
    // Try direct removal if it's an absolute path
    if (path.isAbsolute(scriptPath)) {
      this.scriptCache.delete(scriptPath);
      return;
    }

    // For relative paths, check all cached entries
    // The cache uses absolute paths as keys, so we need to find matching entries
    for (const [cachedAbsolutePath, cachedScript] of this.scriptCache.entries()) {
      // Match by absolute path
      if (cachedAbsolutePath === scriptPath) {
        this.scriptCache.delete(cachedAbsolutePath);
        continue;
      }

      // Match by location (relative path stored in the script object)
      if (cachedScript.location === scriptPath) {
        this.scriptCache.delete(cachedAbsolutePath);
        continue;
      }

      // Match by checking if the absolute path ends with the relative path
      // This handles cases where scriptPath is like "Scripts/foo.csx"
      // and cachedAbsolutePath is like "/workspace/Scripts/foo.csx"
      const normalizedScriptPath = scriptPath.replace(/^\.\//, '');
      if (cachedAbsolutePath.endsWith(normalizedScriptPath)) {
        this.scriptCache.delete(cachedAbsolutePath);
      }
    }
  }

  /**
   * Discover and load all .csx script files in the workspace recursively
   * Returns scripts categorized by type based on implemented interface (IMapping or ICondition/IRule)
   */
  async discoverScripts(basePath: string): Promise<{ mappers: ResolvedScript[]; rules: ResolvedScript[] }> {
    const maxDepth = 10;

    console.log('='.repeat(80));
    console.log('[ScriptManager] ==================== DISCOVERY STARTED ====================');
    console.log('[ScriptManager] Discovering scripts and mappers in workspace:', basePath);
    console.log('='.repeat(80));

    const mappers: ResolvedScript[] = [];
    const rules: ResolvedScript[] = [];

    try {
      // Find .csx script files
      const csxFiles = await this.findCsxFiles(basePath, maxDepth);
      console.log(`[ScriptManager] Found ${csxFiles.length} .csx files in workspace`);

      for (const absolutePath of csxFiles) {
        try {
          // Calculate relative path from basePath
          let relativePath = path.relative(basePath, absolutePath);
          if (!relativePath.startsWith('./') && !relativePath.startsWith('../')) {
            relativePath = `./${relativePath}`;
          }

          // Load the script
          const script = await this.loadScript(relativePath, basePath);
          if (script && script.exists) {
            // Analyze script content to determine type
            const scriptType = this.analyzeScriptType(script.content);

            if (scriptType === 'mapping') {
              mappers.push(script);
              console.log(`[ScriptManager] ✓ Loaded mapper (IMapping): ${relativePath}`);
            } else if (scriptType === 'rule') {
              rules.push(script);
              console.log(`[ScriptManager] ✓ Loaded rule (ICondition/IRule): ${relativePath}`);
            } else {
              console.log(`[ScriptManager] ⚠ Unknown type for: ${relativePath}`);
            }
          }
        } catch (err) {
          console.log(`[ScriptManager] ✗ Failed to load ${absolutePath}:`, err);
          continue;
        }
      }

      console.log('[ScriptManager] ===== FINISHED CSX DISCOVERY, STARTING MAPPER.JSON DISCOVERY =====');

      // Also find .mapper.json files (visual mapper editor files)
      try {
        console.log(`[ScriptManager] Starting search for .mapper.json files in: ${basePath}`);
        const mapperJsonFiles = await this.findMapperJsonFiles(basePath, maxDepth);
        console.log(`[ScriptManager] Found ${mapperJsonFiles.length} .mapper.json files in workspace`);

        if (mapperJsonFiles.length > 0) {
          console.log(`[ScriptManager] Mapper.json files found:`, mapperJsonFiles);
        }

        for (const absolutePath of mapperJsonFiles) {
          try {
            // Calculate relative path from basePath
            let relativePath = path.relative(basePath, absolutePath);
            if (!relativePath.startsWith('./') && !relativePath.startsWith('../')) {
              relativePath = `./${relativePath}`;
            }

            console.log(`[ScriptManager] Processing mapper.json: ${relativePath}`);

            // Load the mapper.json file as a script entry
            const script = await this.loadScript(relativePath, basePath);
            if (script && script.exists) {
              mappers.push(script);
              console.log(`[ScriptManager] ✓ Loaded visual mapper: ${relativePath}`);
            } else {
              console.log(`[ScriptManager] ✗ Script load failed or doesn't exist: ${relativePath}`);
            }
          } catch (err) {
            console.log(`[ScriptManager] ✗ Failed to load ${absolutePath}:`, err);
            continue;
          }
        }
      } catch (err) {
        console.log(`[ScriptManager] ✗✗✗ FATAL ERROR during mapper.json discovery:`, err);
      }
    } catch (err) {
      console.log(`[ScriptManager] ✗ Failed to scan workspace:`, err);
    }

    console.log(`[ScriptManager] Total discovered - Mappers: ${mappers.length}, Rules: ${rules.length}`);
    return { mappers, rules };
  }

  /**
   * Analyze script content to determine if it implements IMapping (mappers) or IConditionMapping/ICondition/IRule (rules)
   */
  private analyzeScriptType(content: string): 'mapping' | 'rule' | 'unknown' {
    // Check for IMapping, ITransitionMapping, or ISubFlowMapping interfaces (these are mappers)
    if (content.includes(': IMapping') ||
        content.includes(':IMapping') ||
        content.includes(', IMapping') ||
        content.includes(',IMapping') ||
        content.includes(': ITransitionMapping') ||
        content.includes(':ITransitionMapping') ||
        content.includes(', ITransitionMapping') ||
        content.includes(',ITransitionMapping') ||
        content.includes(': ISubFlowMapping') ||
        content.includes(':ISubFlowMapping') ||
        content.includes(', ISubFlowMapping') ||
        content.includes(',ISubFlowMapping')) {
      return 'mapping';
    }

    // Check for IConditionMapping, ICondition, or IRule interfaces (these are rules/conditions)
    if (content.includes(': IConditionMapping') ||
        content.includes(':IConditionMapping') ||
        content.includes(', IConditionMapping') ||
        content.includes(',IConditionMapping') ||
        content.includes(': ICondition') ||
        content.includes(':ICondition') ||
        content.includes(', ICondition') ||
        content.includes(',ICondition') ||
        content.includes(': IRule') ||
        content.includes(':IRule') ||
        content.includes(', IRule') ||
        content.includes(',IRule')) {
      return 'rule';
    }

    // Fallback: check for method signatures
    if (content.includes('InputHandler') && content.includes('OutputHandler')) {
      return 'mapping';
    }

    if (content.includes('EvaluateRule') || content.includes('Evaluate')) {
      return 'rule';
    }

    return 'unknown';
  }

  /**
   * Find all .csx files in a directory recursively
   */
  private async findCsxFiles(dir: string, maxDepth: number = 5): Promise<string[]> {
    const results: string[] = [];

    const walk = async (currentDir: string, depth: number) => {
      if (depth > maxDepth) return;

      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);

          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await walk(fullPath, depth + 1);
          } else if (entry.isFile() && entry.name.endsWith('.csx')) {
            results.push(fullPath);
          }
        }
      } catch {
        // Directory doesn't exist or can't be read
      }
    };

    await walk(dir, 0);
    return results;
  }

  /**
   * Find all .mapper.json files in a directory recursively
   */
  private async findMapperJsonFiles(dir: string, maxDepth: number = 5): Promise<string[]> {
    const results: string[] = [];

    const walk = async (currentDir: string, depth: number) => {
      if (depth > maxDepth) return;

      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        // Debug: Log all files in the directory
        console.log(`[ScriptManager] Scanning directory (depth ${depth}): ${currentDir}`);
        const jsonFiles = entries.filter(e => e.isFile() && e.name.endsWith('.json'));
        if (jsonFiles.length > 0) {
          console.log(`[ScriptManager] JSON files in directory:`, jsonFiles.map(e => e.name));
        }

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);

          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await walk(fullPath, depth + 1);
          } else if (entry.isFile() && entry.name.endsWith('.mapper.json')) {
            console.log(`[ScriptManager] ✓ Found mapper.json file: ${fullPath}, isFile: ${entry.isFile()}, isDirectory: ${entry.isDirectory()}`);
            results.push(fullPath);
          } else if (entry.name.endsWith('.mapper.json')) {
            console.log(`[ScriptManager] ⚠ Found .mapper.json but NOT a file: ${fullPath}, isFile: ${entry.isFile()}, isDirectory: ${entry.isDirectory()}`);
          }
        }
      } catch (err) {
        console.log(`[ScriptManager] ✗ Error reading ${currentDir}:`, err);
      }
    };

    await walk(dir, 0);
    console.log(`[ScriptManager] findMapperJsonFiles - Total found: ${results.length}`);
    return results;
  }
}