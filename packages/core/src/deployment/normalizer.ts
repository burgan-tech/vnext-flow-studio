// Main deployment normalizer orchestrator
// Coordinates reference resolution, script inlining, mapper compilation, and validation

import type { Workflow } from '../types/workflow.js';
import type { ComponentResolver } from '../model/ComponentResolver.js';
import type {
  NormalizationOptions,
  NormalizationResult,
  NormalizationContext,
  NormalizationStats
} from './types.js';
import { ReferenceResolver } from './reference-resolver.js';
import { ScriptInliner } from './script-inliner.js';
import { MapperCompiler } from './mapper-compiler.js';
import { DeploymentValidator } from './validator.js';

/**
 * Main deployment normalizer
 * Orchestrates the normalization pipeline:
 * 1. Resolve all file references to explicit references
 * 2. Inline .csx scripts as base64
 * 3. Compile mapper.json files to C# and base64 encode
 * 4. Validate the normalized workflow
 */
export class DeploymentNormalizer {
  private referenceResolver: ReferenceResolver;
  private scriptInliner: ScriptInliner;
  private mapperCompiler: MapperCompiler;
  private validator: DeploymentValidator;

  constructor(private componentResolver: ComponentResolver) {
    this.referenceResolver = new ReferenceResolver(componentResolver);
    this.scriptInliner = new ScriptInliner();
    this.mapperCompiler = new MapperCompiler();
    this.validator = new DeploymentValidator();
  }

  /**
   * Normalize a workflow for deployment
   */
  async normalize(
    workflow: Workflow,
    options: NormalizationOptions
  ): Promise<NormalizationResult> {
    // Create normalization context
    const context: NormalizationContext = {
      options,
      errors: [],
      warnings: [],
      stats: {
        referencesResolved: 0,
        scriptsInlined: 0,
        mappersCompiled: 0,
        totalStates: workflow.attributes.states.length,
        totalTransitions: this.countTransitions(workflow)
      },
      componentCache: new Map()
    };

    try {
      // Step 1: Resolve all references
      console.log('[DeploymentNormalizer] Step 1: Resolving references...');
      let normalized = await this.referenceResolver.normalizeWorkflow(workflow, context);

      // Step 2: Inline scripts (if enabled)
      if (options.inlineScripts !== false) {
        console.log('[DeploymentNormalizer] Step 2: Inlining scripts...');
        normalized = await this.scriptInliner.inlineScripts(normalized, context);
      }

      // Step 3: Compile mappers (if enabled)
      if (options.compileMappers !== false) {
        console.log('[DeploymentNormalizer] Step 3: Compiling mappers...');
        normalized = await this.mapperCompiler.compileMappers(normalized, context);
      }

      // Step 4: Validate (if enabled)
      if (options.validate !== false) {
        console.log('[DeploymentNormalizer] Step 4: Validating...');
        this.validator.validate(normalized, context);
      }

      // Check for errors
      const hasErrors = context.errors.length > 0;
      const hasWarnings = context.warnings.length > 0;

      // Determine success
      const success = !hasErrors && (!hasWarnings || !options.failOnWarnings);

      // Log results
      console.log('[DeploymentNormalizer] Normalization complete:');
      console.log(`  - References resolved: ${context.stats.referencesResolved}`);
      console.log(`  - Scripts inlined: ${context.stats.scriptsInlined}`);
      console.log(`  - Mappers compiled: ${context.stats.mappersCompiled}`);
      console.log(`  - Errors: ${context.errors.length}`);
      console.log(`  - Warnings: ${context.warnings.length}`);
      console.log(`  - Success: ${success}`);

      return {
        success,
        workflow: success ? normalized : undefined,
        errors: context.errors,
        warnings: context.warnings,
        stats: context.stats
      };
    } catch (error) {
      // Handle unexpected errors
      console.error('[DeploymentNormalizer] Unexpected error during normalization:', error);
      context.errors.push({
        type: 'validation',
        message: `Unexpected error during normalization: ${error}`,
        details: error
      });

      return {
        success: false,
        errors: context.errors,
        warnings: context.warnings,
        stats: context.stats
      };
    }
  }

  /**
   * Count total transitions in a workflow
   */
  private countTransitions(workflow: Workflow): number {
    let count = 1; // Start transition

    // Count shared transitions
    if (workflow.attributes.sharedTransitions) {
      count += workflow.attributes.sharedTransitions.length;
    }

    // Count state transitions
    for (const state of workflow.attributes.states) {
      if (state.transitions) {
        count += state.transitions.length;
      }
    }

    return count;
  }

  /**
   * Quick validation check (without full normalization)
   * Useful for pre-flight checks
   */
  async validate(
    workflow: Workflow,
    options: Partial<NormalizationOptions>
  ): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const context: NormalizationContext = {
      options: {
        baseDir: options.baseDir || process.cwd(),
        validate: true,
        inlineScripts: false,
        compileMappers: false,
        failOnWarnings: false
      },
      errors: [],
      warnings: [],
      stats: {
        referencesResolved: 0,
        scriptsInlined: 0,
        mappersCompiled: 0,
        totalStates: workflow.attributes.states.length,
        totalTransitions: this.countTransitions(workflow)
      },
      componentCache: new Map()
    };

    this.validator.validate(workflow, context);

    return {
      valid: context.errors.length === 0,
      errors: context.errors.map(e => e.message),
      warnings: context.warnings.map(w => w.message)
    };
  }
}
