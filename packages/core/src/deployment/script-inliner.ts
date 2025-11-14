// Script inliner for deployment normalization
// Inlines .csx script files as base64-encoded content

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  Workflow,
  Mapping,
  Rule,
  ExecutionTask,
  Transition,
  State,
  SharedTransition
} from '../types/workflow.js';
import type {
  NormalizationContext,
  NormalizationError,
  NormalizationWarning
} from './types.js';

/**
 * Inlines script files (.csx) as base64-encoded content
 */
export class ScriptInliner {
  /**
   * Inline all scripts in a workflow
   */
  async inlineScripts(
    workflow: Workflow,
    context: NormalizationContext
  ): Promise<Workflow> {
    // Deep clone to avoid mutating original
    const inlined = JSON.parse(JSON.stringify(workflow)) as Workflow;

    // Inline scripts in start transition
    if (inlined.attributes.startTransition.onExecutionTasks) {
      for (const task of inlined.attributes.startTransition.onExecutionTasks) {
        await this.inlineExecutionTaskScripts(task, 'startTransition', context);
      }
    }

    // Inline scripts in shared transitions
    if (inlined.attributes.sharedTransitions) {
      for (let i = 0; i < inlined.attributes.sharedTransitions.length; i++) {
        await this.inlineSharedTransitionScripts(
          inlined.attributes.sharedTransitions[i],
          i,
          context
        );
      }
    }

    // Inline scripts in states
    for (const state of inlined.attributes.states) {
      await this.inlineStateScripts(state, context);
    }

    return inlined;
  }

  /**
   * Inline scripts in a state
   */
  private async inlineStateScripts(
    state: State,
    context: NormalizationContext
  ): Promise<void> {
    // Inline onEntry task scripts
    if (state.onEntries) {
      for (let i = 0; i < state.onEntries.length; i++) {
        await this.inlineExecutionTaskScripts(
          state.onEntries[i],
          `state:${state.key}.onEntries[${i}]`,
          context
        );
      }
    }

    // Inline onExit task scripts
    if (state.onExits) {
      for (let i = 0; i < state.onExits.length; i++) {
        await this.inlineExecutionTaskScripts(
          state.onExits[i],
          `state:${state.key}.onExits[${i}]`,
          context
        );
      }
    }

    // Inline transition scripts
    if (state.transitions) {
      for (let i = 0; i < state.transitions.length; i++) {
        await this.inlineTransitionScripts(
          state.transitions[i],
          `state:${state.key}.transitions[${i}]`,
          context
        );
      }
    }

    // Inline subflow mapping script
    if (state.subFlow?.mapping) {
      await this.inlineMappingScript(
        state.subFlow.mapping,
        `state:${state.key}.subFlow.mapping`,
        context
      );
    }
  }

  /**
   * Inline scripts in a shared transition
   */
  private async inlineSharedTransitionScripts(
    transition: SharedTransition,
    index: number,
    context: NormalizationContext
  ): Promise<void> {
    await this.inlineTransitionScripts(
      transition,
      `sharedTransition[${index}]`,
      context
    );
  }

  /**
   * Inline scripts in a transition
   */
  private async inlineTransitionScripts(
    transition: Transition,
    location: string,
    context: NormalizationContext
  ): Promise<void> {
    // Inline rule script
    if (transition.rule) {
      await this.inlineRuleScript(transition.rule, `${location}.rule`, context);
    }

    // Inline execution task scripts
    if (transition.onExecutionTasks) {
      for (let i = 0; i < transition.onExecutionTasks.length; i++) {
        await this.inlineExecutionTaskScripts(
          transition.onExecutionTasks[i],
          `${location}.onExecutionTasks[${i}]`,
          context
        );
      }
    }
  }

  /**
   * Inline scripts in an execution task
   */
  private async inlineExecutionTaskScripts(
    task: ExecutionTask,
    location: string,
    context: NormalizationContext
  ): Promise<void> {
    if (task.mapping) {
      await this.inlineMappingScript(task.mapping, `${location}.mapping`, context);
    }
  }

  /**
   * Inline a mapping script if it references a .csx file
   */
  private async inlineMappingScript(
    mapping: Mapping,
    location: string,
    context: NormalizationContext
  ): Promise<void> {
    // Skip if location is 'inline' or already has content
    if (mapping.location === 'inline' || !mapping.location) {
      return;
    }

    // Check if it's a .csx file
    if (mapping.location.endsWith('.csx')) {
      await this.inlineScriptFile(mapping, location, context);
    }
    // If it's a mapper.json file, we'll handle it in mapper-compiler
  }

  /**
   * Inline a rule script if it references a .csx file
   */
  private async inlineRuleScript(
    rule: Rule,
    location: string,
    context: NormalizationContext
  ): Promise<void> {
    // Skip if location is 'inline' or already has content
    if (rule.location === 'inline' || !rule.location) {
      return;
    }

    // Check if it's a .csx file
    if (rule.location.endsWith('.csx')) {
      await this.inlineScriptFile(rule, location, context);
    }
  }

  /**
   * Read a script file and inline it as base64
   */
  private async inlineScriptFile(
    script: Mapping | Rule,
    location: string,
    context: NormalizationContext
  ): Promise<void> {
    try {
      // Resolve file path relative to base directory
      const filePath = path.resolve(context.options.baseDir, script.location);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        const warning: NormalizationWarning = {
          type: 'missing-script',
          message: `Script file not found: ${script.location}`,
          location
        };
        context.warnings.push(warning);
        return;
      }

      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');

      // Base64 encode
      const base64Content = Buffer.from(content, 'utf-8').toString('base64');

      // Replace code field with base64 content
      script.code = base64Content;

      // Update stats
      context.stats.scriptsInlined++;
    } catch (error) {
      const err: NormalizationError = {
        type: 'script',
        message: `Failed to inline script file: ${script.location}`,
        location,
        details: error
      };
      context.errors.push(err);
    }
  }
}
