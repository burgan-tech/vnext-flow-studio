// Workflow template generator for creating new workflows from scratch

import type { Workflow } from '../types/index.js';

export interface WorkflowTemplateOptions {
  key: string;
  flow: string;
  domain: string;
  version?: string;
  type?: 'C' | 'F' | 'S' | 'P';
  labels?: Array<{ label: string; language: string }>;
  tags?: string[];
}

/**
 * Generate a minimal workflow template
 */
export function generateWorkflowTemplate(options: WorkflowTemplateOptions): Workflow {
  const {
    key,
    flow,
    domain,
    version = '1.0.0',
    type = 'F',
    labels = [{ label: 'New Workflow', language: 'en' }],
    tags = ['new']
  } = options;

  return {
    key,
    flow,
    domain,
    version,
    tags,
    attributes: {
      type,
      labels,
      functions: [],
      features: [],
      extensions: [],
      sharedTransitions: [],
      startTransition: {
        key: 'start',
        target: 'initial-state',
        triggerType: 0,
        versionStrategy: 'Minor',
        labels: [{ label: 'Start', language: 'en' }]
      },
      states: [
        {
          key: 'initial-state',
          stateType: 1,
          versionStrategy: 'Minor',
          labels: [{ label: 'Initial State', language: 'en' }],
          transitions: []
        }
      ]
    }
  };
}

/**
 * Generate a subflow template
 */
export function generateSubflowTemplate(options: WorkflowTemplateOptions): Workflow {
  const baseWorkflow = generateWorkflowTemplate({
    ...options,
    type: 'S'
  });

  // Add a final state for subflows
  baseWorkflow.attributes.states.push({
    key: 'final-state',
    stateType: 3,
    stateSubType: 1,
    versionStrategy: 'Minor',
    labels: [{ label: 'Complete', language: 'en' }],
    transitions: []
  });

  // Add transition from initial to final
  baseWorkflow.attributes.states[0].transitions = [
    {
      key: 'complete',
      target: 'final-state',
      triggerType: 1,
      versionStrategy: 'Minor',
      labels: [{ label: 'Complete', language: 'en' }]
    }
  ];

  return baseWorkflow;
}

/**
 * Generate a subprocess template
 */
export function generateSubprocessTemplate(options: WorkflowTemplateOptions): Workflow {
  return generateWorkflowTemplate({
    ...options,
    type: 'P'
  });
}

/**
 * Get template by type
 */
export function getWorkflowTemplate(
  type: 'F' | 'S' | 'P',
  options: WorkflowTemplateOptions
): Workflow {
  switch (type) {
    case 'S':
      return generateSubflowTemplate(options);
    case 'P':
      return generateSubprocessTemplate(options);
    case 'F':
    default:
      return generateWorkflowTemplate(options);
  }
}
