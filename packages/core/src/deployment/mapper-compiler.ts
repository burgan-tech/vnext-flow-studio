// Mapper compiler for deployment normalization
// Compiles mapper.json files to C# code and base64 encodes

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  Workflow,
  Mapping,
  ExecutionTask,
  Transition,
  State,
  SharedTransition
} from '../types/workflow.js';
import type { MapSpec } from '../mapper/types.js';
import { generateCSharp } from '../mapper/csharpGenerator.js';
import type {
  NormalizationContext,
  NormalizationError,
  NormalizationWarning
} from './types.js';

/**
 * Compiles mapper.json files to C# code
 */
export class MapperCompiler {
  /**
   * Compile all mapper.json references in a workflow
   */
  async compileMappers(
    workflow: Workflow,
    context: NormalizationContext
  ): Promise<Workflow> {
    // Deep clone to avoid mutating original
    const compiled = JSON.parse(JSON.stringify(workflow)) as Workflow;

    // Compile mappers in start transition
    if (compiled.attributes.startTransition.onExecutionTasks) {
      for (const task of compiled.attributes.startTransition.onExecutionTasks) {
        await this.compileExecutionTaskMapper(task, 'startTransition', context);
      }
    }

    // Compile mappers in shared transitions
    if (compiled.attributes.sharedTransitions) {
      for (let i = 0; i < compiled.attributes.sharedTransitions.length; i++) {
        await this.compileSharedTransitionMappers(
          compiled.attributes.sharedTransitions[i],
          i,
          context
        );
      }
    }

    // Compile mappers in states
    for (const state of compiled.attributes.states) {
      await this.compileStateMappers(state, context);
    }

    return compiled;
  }

  /**
   * Compile mappers in a state
   */
  private async compileStateMappers(
    state: State,
    context: NormalizationContext
  ): Promise<void> {
    // Compile onEntry task mappers
    if (state.onEntries) {
      for (let i = 0; i < state.onEntries.length; i++) {
        await this.compileExecutionTaskMapper(
          state.onEntries[i],
          `state:${state.key}.onEntries[${i}]`,
          context
        );
      }
    }

    // Compile onExit task mappers
    if (state.onExits) {
      for (let i = 0; i < state.onExits.length; i++) {
        await this.compileExecutionTaskMapper(
          state.onExits[i],
          `state:${state.key}.onExits[${i}]`,
          context
        );
      }
    }

    // Compile transition mappers
    if (state.transitions) {
      for (let i = 0; i < state.transitions.length; i++) {
        await this.compileTransitionMappers(
          state.transitions[i],
          `state:${state.key}.transitions[${i}]`,
          context
        );
      }
    }

    // Compile subflow mapping
    if (state.subFlow?.mapping) {
      await this.compileMapping(
        state.subFlow.mapping,
        `state:${state.key}.subFlow.mapping`,
        context
      );
    }
  }

  /**
   * Compile mappers in a shared transition
   */
  private async compileSharedTransitionMappers(
    transition: SharedTransition,
    index: number,
    context: NormalizationContext
  ): Promise<void> {
    await this.compileTransitionMappers(
      transition,
      `sharedTransition[${index}]`,
      context
    );
  }

  /**
   * Compile mappers in a transition
   */
  private async compileTransitionMappers(
    transition: Transition,
    location: string,
    context: NormalizationContext
  ): Promise<void> {
    // Compile execution task mappers
    if (transition.onExecutionTasks) {
      for (let i = 0; i < transition.onExecutionTasks.length; i++) {
        await this.compileExecutionTaskMapper(
          transition.onExecutionTasks[i],
          `${location}.onExecutionTasks[${i}]`,
          context
        );
      }
    }
  }

  /**
   * Compile mapper in an execution task
   */
  private async compileExecutionTaskMapper(
    task: ExecutionTask,
    location: string,
    context: NormalizationContext
  ): Promise<void> {
    if (task.mapping) {
      await this.compileMapping(task.mapping, `${location}.mapping`, context);
    }
  }

  /**
   * Compile a mapping if it references a mapper.json file
   */
  private async compileMapping(
    mapping: Mapping,
    location: string,
    context: NormalizationContext
  ): Promise<void> {
    // Skip if location is 'inline' or already has content
    if (mapping.location === 'inline' || !mapping.location) {
      return;
    }

    // Check if it's a mapper.json file
    if (mapping.location.endsWith('.mapper.json') || mapping.location.endsWith('/mapper.json')) {
      await this.compileMapperFile(mapping, location, context);
    }
  }

  /**
   * Load a mapper.json file, compile to C#, and inline as base64
   */
  private async compileMapperFile(
    mapping: Mapping,
    location: string,
    context: NormalizationContext
  ): Promise<void> {
    // Skip if no location (should not happen, but guard for type safety)
    if (!mapping.location) {
      return;
    }

    try {
      // Resolve file path relative to base directory
      const filePath = path.resolve(context.options.baseDir, mapping.location);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        const warning: NormalizationWarning = {
          type: 'missing-script',
          message: `Mapper file not found: ${mapping.location}`,
          location
        };
        context.warnings.push(warning);
        return;
      }

      // Read mapper file
      const mapperContent = await fs.readFile(filePath, 'utf-8');
      const mapSpec: MapSpec = JSON.parse(mapperContent);

      // Generate C# code from mapper
      const csharpCode = generateCSharp(mapSpec);

      // Base64 encode
      const base64Content = Buffer.from(csharpCode, 'utf-8').toString('base64');

      // Replace code field with base64 content
      mapping.code = base64Content;

      // Update stats
      context.stats.mappersCompiled++;
    } catch (error) {
      const err: NormalizationError = {
        type: 'mapper',
        message: `Failed to compile mapper file: ${mapping.location}`,
        location,
        details: error
      };
      context.errors.push(err);
    }
  }
}
