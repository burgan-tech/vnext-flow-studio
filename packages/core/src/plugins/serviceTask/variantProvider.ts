/**
 * Service Task Variant Provider
 *
 * Discovers task presets from the project's task registry.
 */

import type { VariantProvider, StateVariant } from '../types.js';
import type { State, TaskRef } from '../../types/index.js';
import type { AssetDef, Registries } from '../../registry.js';

/**
 * Common service task categories
 */
export const SERVICE_TASK_CATEGORIES = {
  HTTP: 'HTTP & REST',
  MESSAGING: 'Messaging',
  DATABASE: 'Database',
  INTEGRATION: 'Integration',
  UTILITY: 'Utility',
  CUSTOM: 'Custom'
};

/**
 * Service Task Variant Provider implementation
 */
export class ServiceTaskVariantProvider implements VariantProvider {
  id = 'service-task-variants';
  private registries: Registries | null = null;
  private variantCache: StateVariant[] = [];
  private watchCallback: ((variants: StateVariant[]) => void) | null = null;

  /**
   * Set registries for variant discovery
   */
  setRegistries(registries: Registries): void {
    this.registries = registries;
    this.refreshVariants();
  }

  /**
   * Discover variants from task registry
   */
  async discoverVariants(): Promise<StateVariant[]> {
    if (!this.registries) {
      // Return some default variants if no registry available
      return this.getDefaultVariants();
    }

    const variants: StateVariant[] = [];

    // Process tasks from registry
    for (const taskDef of this.registries.tasks) {
      const variant = this.createVariantFromTask(taskDef);
      if (variant) {
        variants.push(variant);
      }
    }

    // Add default variants if registry is empty
    if (variants.length === 0) {
      variants.push(...this.getDefaultVariants());
    }

    this.variantCache = variants;

    // Notify watchers
    if (this.watchCallback) {
      this.watchCallback(variants);
    }

    return variants;
  }

  /**
   * Watch for variant changes
   */
  watchVariants(callback: (variants: StateVariant[]) => void): () => void {
    this.watchCallback = callback;

    // Return unsubscribe function
    return () => {
      this.watchCallback = null;
    };
  }

  /**
   * Get variant by ID
   */
  async getVariant(id: string): Promise<StateVariant | null> {
    const variant = this.variantCache.find(v => v.id === id);
    return variant || null;
  }

  /**
   * Create variant from task definition
   */
  private createVariantFromTask(taskDef: AssetDef): StateVariant | null {
    const { key, domain, flow, version, def } = taskDef;

    // Determine category based on task metadata or naming
    const category = this.detectCategory(key, def);

    // Create task reference
    const taskRef: TaskRef = {
      key,
      domain,
      flow,
      version
    };

    // Generate unique variant ID
    const variantId = `task-${domain}-${flow}-${key}-${version}`;

    // Extract label from definition or use key
    const label = def?.title || def?.label || this.humanizeKey(key);
    const description = def?.description || `Execute ${label} task`;

    // Create the variant
    const variant: StateVariant = {
      id: variantId,
      label,
      description,
      icon: this.getIconForCategory(category),
      category,
      stateTemplate: {
        stateType: 2, // Intermediate
        xProfile: 'ServiceTask', // Mark as ServiceTask
        versionStrategy: 'Minor',
        labels: [
          {
            label,
            language: 'en'
          }
        ],
        onEntries: [
          {
            order: 1,
            task: taskRef,
            mapping: this.createDefaultMapping(def)
          }
        ],
        transitions: []
      },
      defaultMapping: def?.defaultMapping || {},
      metadata: {
        taskDef,
        source: 'registry'
      }
    };

    return variant;
  }

  /**
   * Detect category from task key or definition
   */
  private detectCategory(key: string, def: any): string {
    const lowerKey = key.toLowerCase();

    // Check for HTTP/REST patterns
    if (lowerKey.includes('http') || lowerKey.includes('rest') ||
        lowerKey.includes('api') || lowerKey.includes('webhook')) {
      return SERVICE_TASK_CATEGORIES.HTTP;
    }

    // Check for messaging patterns
    if (lowerKey.includes('kafka') || lowerKey.includes('rabbit') ||
        lowerKey.includes('queue') || lowerKey.includes('publish') ||
        lowerKey.includes('message') || lowerKey.includes('email') ||
        lowerKey.includes('sms')) {
      return SERVICE_TASK_CATEGORIES.MESSAGING;
    }

    // Check for database patterns
    if (lowerKey.includes('database') || lowerKey.includes('sql') ||
        lowerKey.includes('query') || lowerKey.includes('mongo') ||
        lowerKey.includes('redis')) {
      return SERVICE_TASK_CATEGORIES.DATABASE;
    }

    // Check for integration patterns
    if (lowerKey.includes('integration') || lowerKey.includes('connector') ||
        lowerKey.includes('adapter') || lowerKey.includes('transform')) {
      return SERVICE_TASK_CATEGORIES.INTEGRATION;
    }

    // Check for utility patterns
    if (lowerKey.includes('util') || lowerKey.includes('helper') ||
        lowerKey.includes('validate') || lowerKey.includes('calculate') ||
        lowerKey.includes('format')) {
      return SERVICE_TASK_CATEGORIES.UTILITY;
    }

    // Check definition metadata
    if (def?.category) {
      return def.category;
    }

    return SERVICE_TASK_CATEGORIES.CUSTOM;
  }

  /**
   * Get icon for category
   */
  private getIconForCategory(category: string): string {
    switch (category) {
      case SERVICE_TASK_CATEGORIES.HTTP:
        return '🌐';
      case SERVICE_TASK_CATEGORIES.MESSAGING:
        return '📨';
      case SERVICE_TASK_CATEGORIES.DATABASE:
        return '🗄';
      case SERVICE_TASK_CATEGORIES.INTEGRATION:
        return '🔌';
      case SERVICE_TASK_CATEGORIES.UTILITY:
        return '🛠';
      default:
        return '⚙';
    }
  }

  /**
   * Create default mapping for task
   */
  private createDefaultMapping(def: any): { location: string; code: string } {
    // Check if definition provides default mapping
    if (def?.defaultMapping) {
      return {
        location: 'inline',
        code: typeof def.defaultMapping === 'string'
          ? def.defaultMapping
          : JSON.stringify(def.defaultMapping, null, 2)
      };
    }

    // Generate basic mapping template
    const mappingTemplate = `// Input mapping for task
return {
  // Map input parameters here
  ${def?.inputs ? this.generateInputTemplate(def.inputs) : '// No inputs defined'}
};`;

    return {
      location: 'inline',
      code: mappingTemplate
    };
  }

  /**
   * Generate input template from definition
   */
  private generateInputTemplate(inputs: any): string {
    if (Array.isArray(inputs)) {
      return inputs.map(input => {
        if (typeof input === 'string') {
          return `${input}: context.${input}`;
        } else if (input.name) {
          const defaultValue = input.default ? ` || ${JSON.stringify(input.default)}` : '';
          return `${input.name}: context.${input.name}${defaultValue}`;
        }
        return '// Unknown input';
      }).join(',\n  ');
    } else if (typeof inputs === 'object') {
      return Object.keys(inputs).map(key => {
        return `${key}: context.${key}`;
      }).join(',\n  ');
    }
    return '// Configure inputs';
  }

  /**
   * Humanize a key into a readable label
   */
  private humanizeKey(key: string): string {
    return key
      .replace(/[-_]/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Get default variants when no registry available
   */
  private getDefaultVariants(): StateVariant[] {
    return [
      {
        id: 'http-call',
        label: 'HTTP Call',
        description: 'Make an HTTP request to an API',
        icon: '🌐',
        category: SERVICE_TASK_CATEGORIES.HTTP,
        stateTemplate: this.createHttpCallTemplate()
      },
      {
        id: 'send-email',
        label: 'Send Email',
        description: 'Send an email notification',
        icon: '✉️',
        category: SERVICE_TASK_CATEGORIES.MESSAGING,
        stateTemplate: this.createEmailTemplate()
      },
      {
        id: 'publish-kafka',
        label: 'Publish to Kafka',
        description: 'Publish a message to Kafka topic',
        icon: '📤',
        category: SERVICE_TASK_CATEGORIES.MESSAGING,
        stateTemplate: this.createKafkaTemplate()
      },
      {
        id: 'database-query',
        label: 'Database Query',
        description: 'Execute a database query',
        icon: '🗄',
        category: SERVICE_TASK_CATEGORIES.DATABASE,
        stateTemplate: this.createDatabaseTemplate()
      },
      {
        id: 'custom-task',
        label: 'Custom Task',
        description: 'Configure a custom task',
        icon: '⚙',
        category: SERVICE_TASK_CATEGORIES.CUSTOM,
        stateTemplate: this.createCustomTemplate()
      }
    ];
  }

  private createHttpCallTemplate(): Partial<State> {
    return {
      stateType: 2,
      versionStrategy: 'Minor',
      labels: [
        { label: 'HTTP Call', language: 'en' }
      ],
      onEntries: [
        {
          order: 1,
          task: { ref: 'system/http/call/1.0.0' },
          mapping: {
            location: 'inline',
            code: `// HTTP Request configuration
return {
  method: 'GET',
  url: 'https://api.example.com/endpoint',
  headers: {
    'Content-Type': 'application/json'
  },
  // body: context.requestData
};`
          }
        }
      ]
    };
  }

  private createEmailTemplate(): Partial<State> {
    return {
      stateType: 2,
      versionStrategy: 'Minor',
      labels: [
        { label: 'Send Email', language: 'en' }
      ],
      onEntries: [
        {
          order: 1,
          task: { ref: 'system/email/send/1.0.0' },
          mapping: {
            location: 'inline',
            code: `// Email configuration
return {
  to: context.recipientEmail,
  subject: 'Notification',
  template: 'default',
  data: {
    name: context.userName,
    message: context.message
  }
};`
          }
        }
      ]
    };
  }

  private createKafkaTemplate(): Partial<State> {
    return {
      stateType: 2,
      versionStrategy: 'Minor',
      labels: [
        { label: 'Publish to Kafka', language: 'en' }
      ],
      onEntries: [
        {
          order: 1,
          task: { ref: 'system/kafka/publish/1.0.0' },
          mapping: {
            location: 'inline',
            code: `// Kafka message configuration
return {
  topic: 'events',
  key: context.id,
  value: {
    eventType: 'workflow.task.completed',
    timestamp: new Date().toISOString(),
    data: context.data
  },
  headers: {
    source: 'workflow'
  }
};`
          }
        }
      ]
    };
  }

  private createDatabaseTemplate(): Partial<State> {
    return {
      stateType: 2,
      versionStrategy: 'Minor',
      labels: [
        { label: 'Database Query', language: 'en' }
      ],
      onEntries: [
        {
          order: 1,
          task: { ref: 'system/database/query/1.0.0' },
          mapping: {
            location: 'inline',
            code: `// Database query configuration
return {
  query: 'SELECT * FROM users WHERE id = :userId',
  parameters: {
    userId: context.userId
  },
  database: 'main'
};`
          }
        }
      ]
    };
  }

  private createCustomTemplate(): Partial<State> {
    return {
      stateType: 2,
      versionStrategy: 'Minor',
      labels: [
        { label: 'Custom Task', language: 'en' }
      ],
      onEntries: [
        {
          order: 1,
          task: { ref: '' }, // To be configured
          mapping: {
            location: 'inline',
            code: `// Configure task input mapping
return {
  // Add your mapping here
};`
          }
        }
      ]
    };
  }

  /**
   * Refresh variants (e.g., when registry changes)
   */
  private async refreshVariants(): Promise<void> {
    await this.discoverVariants();
  }
}