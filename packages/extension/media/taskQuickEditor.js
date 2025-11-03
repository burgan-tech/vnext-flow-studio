/* global acquireVsCodeApi, document, window */
// VS Code API
const vscode = acquireVsCodeApi();

// Current task data
let currentTask = null;
let isDirty = false;

// DOM Elements
const elements = {
  app: null,
  loading: null,
  error: null,
  notTask: null,
  editor: null,
  saveBtn: null,
  openJsonBtn: null,
  typeSelector: null,
  advancedSection: null
};

// Field mappings by type
const typeFields = {
  '1': ['endpointName', 'path', 'method'],
  '2': ['bindingName', 'bindingType', 'operation'],
  '3': ['appId', 'methodName', 'protocol'],
  '4': ['pubSubName', 'topic'],
  '5': ['title', 'instructions', 'assignedTo', 'dueDate', 'reminderIntervalMinutes', 'escalationTimeoutMinutes', 'escalationAssignee'],
  '6': ['url', 'httpMethod', 'timeoutSeconds', 'validateSsl'],
  '7': [] // Script task has no specific fields
};

// Binding-specific field mappings
// Note: These define the UI field mappings but aren't directly referenced
// const bindingFields = {
//   'http': ['httpBindingUrl', 'httpBindingMethod'],
//   'kafka': ['kafkaTopic', 'kafkaKey', 'kafkaPartition', 'kafkaHeaders'],
//   'redis': ['redisKey', 'redisCommand', 'redisTtl'],
//   'postgresql': ['postgresqlTable', 'postgresqlQuery', 'postgresqlOperation']
// };

// const advancedFields = {
//   common: ['maxRetries', 'initialIntervalMs', 'apiTokenSecretRef', 'mtlsRequired'],
//   '4': ['orderingKey', 'ttlInSeconds'],
//   '5': ['reminderIntervalMinutes', 'escalationTimeoutMinutes', 'escalationAssignee'],
//   '6': ['timeoutSeconds', 'validateSsl']
// };

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initializeElements();
  attachEventListeners();

  // Signal ready to extension
  vscode.postMessage({ type: 'ready' });
});

function initializeElements() {
  elements.app = document.getElementById('app');
  elements.loading = document.getElementById('loading');
  elements.error = document.getElementById('error');
  elements.notTask = document.getElementById('not-task');
  elements.editor = document.getElementById('editor');
  elements.saveBtn = document.getElementById('saveBtn');
  elements.openJsonBtn = document.getElementById('openJsonBtn');
  elements.typeSelector = document.getElementById('type');
  elements.advancedSection = document.getElementById('advancedSection');
}

function attachEventListeners() {
  // Save button
  elements.saveBtn.addEventListener('click', saveTask);

  // Open as JSON button
  elements.openJsonBtn.addEventListener('click', openAsJson);
  document.querySelector('#not-task button').addEventListener('click', openAsJson);

  // Type selector change
  elements.typeSelector.addEventListener('change', (e) => {
    showTypeFields(e.target.value);
    markDirty();
  });

  // Binding type selector change (for Type 2)
  const bindingTypeSelector = document.getElementById('bindingType');
  if (bindingTypeSelector) {
    bindingTypeSelector.addEventListener('change', (e) => {
      showBindingFields(e.target.value);
      markDirty();
    });
  }

  // Track changes
  document.querySelectorAll('input, select').forEach(input => {
    input.addEventListener('change', markDirty);
    input.addEventListener('input', markDirty);
  });

  // Handle messages from extension
  window.addEventListener('message', handleMessage);
}

function handleMessage(event) {
  const message = event.data;

  switch (message.type) {
    case 'init':
      loadTask(message.content);
      break;
    case 'reload':
      if (!isDirty) {
        loadTask(message.content);
      } else {
        showToast('External changes detected. Save or reload to see changes.', 'warning');
      }
      break;
    case 'saved':
      isDirty = false;
      updateSaveButton();
      showToast('Task saved successfully!', 'success');
      break;
    case 'error':
      showToast(message.message, 'error');
      break;
  }
}

function loadTask(content) {
  try {
    // Parse JSON
    const task = JSON.parse(content);
    currentTask = task;

    // Validate it's a task
    if (task.flow !== 'sys-tasks') {
      showNotTask();
      return;
    }

    // Initialize if needed
    ensureTaskStructure(task);

    // Show editor
    showEditor();

    // Populate fields
    populateFields(task);

    // Show correct type fields
    showTypeFields(task.attributes?.type || '1');

    isDirty = false;
    updateSaveButton();

  } catch (error) {
    if (content.trim() === '') {
      // New file - create minimal task
      createNewTask();
    } else {
      showError(`Invalid JSON: ${error.message}`);
    }
  }
}

function ensureTaskStructure(task) {
  // Ensure required top-level fields
  task.flow = 'sys-tasks';
  task.flowVersion = task.flowVersion || '1.0.0';
  task.version = task.version || '1.0.0';
  task.tags = task.tags || ['task'];

  // Ensure attributes
  if (!task.attributes) {
    task.attributes = {};
  }

  // Ensure type
  if (!task.attributes.type) {
    task.attributes.type = '1';
  }

  // Ensure config for current type
  ensureConfigForType(task, task.attributes.type);
}

function ensureConfigForType(task, type) {
  if (!task.attributes.config) {
    task.attributes.config = {};
  }

  const config = task.attributes.config;

  // Initialize minimal fields based on type
  switch (type) {
    case '1':
      config.endpointName = config.endpointName || '';
      config.path = config.path || '';
      config.method = config.method || 'GET';
      break;
    case '2':
      config.bindingName = config.bindingName || '';
      config.operation = config.operation || 'create';
      // Initialize metadata for binding-specific fields if needed
      if (!config.metadata) {
        config.metadata = {};
      }
      break;
    case '3':
      config.appId = config.appId || '';
      config.methodName = config.methodName || '';
      config.protocol = config.protocol || 'http';
      break;
    case '4':
      config.pubSubName = config.pubSubName || '';
      config.topic = config.topic || '';
      break;
    case '5':
      config.title = config.title || '';
      config.instructions = config.instructions || '';
      config.assignedTo = config.assignedTo || '';
      break;
    case '6':
      config.url = config.url || '';
      config.method = config.method || 'GET';
      break;
    case '7':
      // Script task - no specific fields required
      break;
  }
}

function createNewTask() {
  currentTask = {
    key: '',
    domain: '',
    version: '1.0.0',
    flow: 'sys-tasks',
    flowVersion: '1.0.0',
    tags: ['task'],
    attributes: {
      type: '1',
      config: {}
    }
  };

  ensureConfigForType(currentTask, '1');
  showEditor();
  populateFields(currentTask);
  showTypeFields('1');
  isDirty = true;
  updateSaveButton();
}

function populateFields(task) {
  // Basic fields
  setFieldValue('key', task.key || '');
  setFieldValue('domain', task.domain || '');
  setFieldValue('version', task.version || '1.0.0');
  setFieldValue('type', task.attributes?.type || '1');

  const config = task.attributes?.config || {};
  const type = task.attributes?.type || '1';
  const isDaprType = ['1', '2', '3', '4'].includes(type);

  // Type-specific fields
  if (typeFields[type]) {
    typeFields[type].forEach(field => {
      // Handle special field mappings
      if (field === 'httpMethod' && type === '6') {
        setFieldValue(field, config.method || 'GET');
      } else if (field === 'validateSsl' && type === '6') {
        setFieldValue(field, config.validateSsl !== false); // Default true
      } else {
        setFieldValue(field, config[field] || '');
      }
    });
  }

  // Type 2 Binding-specific fields from metadata
  if (type === '2') {
    // First check if bindingType is explicitly set
    if (config.bindingType) {
      setFieldValue('bindingType', config.bindingType);
      showBindingFields(config.bindingType);
    } else if (config.metadata) {
      // Detect binding type from metadata for backward compatibility
      let detectedBindingType = '';

      if (config.metadata.url) {
        detectedBindingType = 'http';
        setFieldValue('bindingType', 'http');
        setFieldValue('httpBindingUrl', config.metadata.url || '');
        setFieldValue('httpBindingMethod', config.metadata.method || 'POST');
      } else if (config.metadata.topic) {
        detectedBindingType = 'kafka';
        setFieldValue('bindingType', 'kafka');
        setFieldValue('kafkaTopic', config.metadata.topic || '');
        setFieldValue('kafkaKey', config.metadata.key || '');
        setFieldValue('kafkaPartition', config.metadata.partition);
        if (config.metadata.headers) {
          const headersEl = document.getElementById('kafkaHeaders');
          if (headersEl) {
            headersEl.value = JSON.stringify(config.metadata.headers, null, 2);
          }
        }
      } else if (config.metadata.key && (config.metadata.command || config.bindingName?.includes('redis'))) {
        detectedBindingType = 'redis';
        setFieldValue('bindingType', 'redis');
        setFieldValue('redisKey', config.metadata.key || '');
        setFieldValue('redisCommand', config.metadata.command || 'SET');
        setFieldValue('redisTtl', config.metadata.ttl);
      } else if (config.metadata.sql || config.metadata.table || config.bindingName?.includes('postgresql')) {
        detectedBindingType = 'postgresql';
        setFieldValue('bindingType', 'postgresql');
        setFieldValue('postgresqlTable', config.metadata.table || '');
        setFieldValue('postgresqlQuery', config.metadata.sql || '');
        setFieldValue('postgresqlOperation', config.metadata.operation || 'exec');
      }

      // Show the appropriate binding fields
      if (detectedBindingType) {
        showBindingFields(detectedBindingType);
      }
    }
  }

  // Dapr Advanced fields (only for types 1-4)
  if (isDaprType && config.dapr) {
    const dapr = config.dapr;

    if (dapr.retry) {
      setFieldValue('maxRetries', dapr.retry.maxRetries);
      setFieldValue('initialIntervalMs', dapr.retry.initialIntervalMs);
    }

    if (dapr.auth) {
      setFieldValue('apiTokenSecretRef', dapr.auth.apiTokenSecretRef || '');
      setFieldValue('mtlsRequired', dapr.auth.mtlsRequired || false);
    }
  }

  // Type-specific advanced/extra fields
  if (type === '4') {
    setFieldValue('orderingKey', config.orderingKey || '');
    setFieldValue('ttlInSeconds', config.ttlInSeconds);
  } else if (type === '6') {
    // Set headers and body as JSON strings
    if (config.headers) {
      const headersEl = document.getElementById('headers');
      if (headersEl) {
        headersEl.value = JSON.stringify(config.headers, null, 2);
      }
    }
    if (config.body) {
      const bodyEl = document.getElementById('body');
      if (bodyEl) {
        bodyEl.value = JSON.stringify(config.body, null, 2);
      }
    }
  }
}

function setFieldValue(id, value) {
  const field = document.getElementById(id);
  if (!field) return;

  if (field.type === 'checkbox') {
    field.checked = value;
  } else if (value !== undefined && value !== null && value !== '') {
    field.value = value;
  }
}

function getFieldValue(id) {
  const field = document.getElementById(id);
  if (!field) return undefined;

  if (field.type === 'checkbox') {
    return field.checked;
  }

  const value = field.value.trim();

  // Return undefined for empty strings
  if (value === '') return undefined;

  // Convert numbers
  if (field.type === 'number' && value !== '') {
    return parseInt(value, 10);
  }

  return value;
}

function showTypeFields(type) {
  // Hide all type fields
  document.querySelectorAll('.type-fields').forEach(el => {
    el.classList.add('hidden');
  });

  // Show selected type fields
  const typeFieldsEl = document.getElementById(`type${type}Fields`);
  if (typeFieldsEl) {
    typeFieldsEl.classList.remove('hidden');
  }

  // Show/hide type-specific advanced options
  const daprAdvanced = document.getElementById('daprAdvanced');
  const type4Advanced = document.getElementById('type4Advanced');
  const type5Advanced = document.getElementById('type5Advanced');
  const type6Advanced = document.getElementById('type6Advanced');

  // Show Dapr advanced section only for types 1-4
  const isDaprType = ['1', '2', '3', '4'].includes(type);
  if (daprAdvanced) {
    daprAdvanced.classList.toggle('hidden', !isDaprType);
  }

  if (type4Advanced) {
    type4Advanced.classList.toggle('hidden', type !== '4');
  }
  if (type5Advanced) {
    type5Advanced.classList.toggle('hidden', type !== '5');
  }
  if (type6Advanced) {
    type6Advanced.classList.toggle('hidden', type !== '6');
  }

  // When switching types, ensure config structure
  if (currentTask) {
    ensureConfigForType(currentTask, type);
  }

  // If Type 2 (Binding), also handle binding type
  if (type === '2') {
    const bindingType = getFieldValue('bindingType') || '';
    showBindingFields(bindingType);
  }
}

function showBindingFields(bindingType) {
  // Hide all binding-specific fields
  document.querySelectorAll('.binding-specific').forEach(el => {
    el.classList.add('hidden');
  });

  // Show selected binding type fields
  if (bindingType) {
    const bindingFieldsEl = document.getElementById(`${bindingType}BindingFields`);
    if (bindingFieldsEl) {
      bindingFieldsEl.classList.remove('hidden');
    }
  }
}

function collectTaskData() {
  const task = JSON.parse(JSON.stringify(currentTask || {}));

  // Update basic fields
  task.key = getFieldValue('key') || task.key;
  task.domain = getFieldValue('domain') || task.domain;
  task.version = getFieldValue('version') || '1.0.0';

  // Update type
  const type = getFieldValue('type') || '1';
  task.attributes = task.attributes || {};
  task.attributes.type = type;

  // Initialize config
  task.attributes.config = task.attributes.config || {};
  const config = task.attributes.config;

  // Collect type-specific fields
  if (typeFields[type]) {
    typeFields[type].forEach(field => {
      // Handle special field mappings
      if (field === 'httpMethod' && type === '6') {
        const value = getFieldValue(field);
        if (value !== undefined) {
          config.method = value; // Map httpMethod to method
        } else {
          delete config.method;
        }
      } else if (field === 'validateSsl' && type === '6') {
        const value = getFieldValue(field);
        if (value !== undefined) {
          config.validateSsl = value;
        } else {
          delete config.validateSsl;
        }
      } else if (field === 'timeoutSeconds' && (type === '5' || type === '6')) {
        const value = getFieldValue(field);
        if (value !== undefined) {
          config.timeoutSeconds = value;
        } else {
          delete config.timeoutSeconds;
        }
      } else {
        const value = getFieldValue(field);
        if (value !== undefined) {
          config[field] = value;
        } else {
          delete config[field];
        }
      }
    });
  }

  // Collect Type 2 binding-specific metadata
  if (type === '2') {
    const bindingType = getFieldValue('bindingType');

    // Save bindingType to config if specified
    if (bindingType) {
      config.bindingType = bindingType;

      // Initialize metadata object if needed
      if (!config.metadata) {
        config.metadata = {};
      }

      // Clear previous metadata fields
      delete config.metadata.url;
      delete config.metadata.method;
      delete config.metadata.topic;
      delete config.metadata.key;
      delete config.metadata.partition;
      delete config.metadata.headers;
      delete config.metadata.command;
      delete config.metadata.ttl;
      delete config.metadata.sql;
      delete config.metadata.table;
      delete config.metadata.operation;

      // Collect binding-specific fields
      switch (bindingType) {
        case 'http': {
          const httpUrl = getFieldValue('httpBindingUrl');
          const httpMethod = getFieldValue('httpBindingMethod');
          if (httpUrl) config.metadata.url = httpUrl;
          if (httpMethod) config.metadata.method = httpMethod;
          break;
        }

        case 'kafka': {
          const kafkaTopic = getFieldValue('kafkaTopic');
          const kafkaKey = getFieldValue('kafkaKey');
          const kafkaPartition = getFieldValue('kafkaPartition');
          const kafkaHeadersText = document.getElementById('kafkaHeaders')?.value;

          if (kafkaTopic) config.metadata.topic = kafkaTopic;
          if (kafkaKey) config.metadata.key = kafkaKey;
          if (kafkaPartition !== undefined) config.metadata.partition = kafkaPartition;
          if (kafkaHeadersText) {
            try {
              config.metadata.headers = JSON.parse(kafkaHeadersText);
            } catch {
              // Keep as is if invalid JSON
            }
          }
          break;
        }

        case 'redis': {
          const redisKey = getFieldValue('redisKey');
          const redisCommand = getFieldValue('redisCommand');
          const redisTtl = getFieldValue('redisTtl');

          if (redisKey) config.metadata.key = redisKey;
          if (redisCommand) config.metadata.command = redisCommand;
          if (redisTtl !== undefined) config.metadata.ttl = redisTtl;
          break;
        }

        case 'postgresql': {
          const table = getFieldValue('postgresqlTable');
          const query = getFieldValue('postgresqlQuery');
          const operation = getFieldValue('postgresqlOperation');

          if (table) config.metadata.table = table;
          if (query) config.metadata.sql = query;
          if (operation) config.metadata.operation = operation;
          break;
        }
      }

      // Clean up empty metadata
      if (Object.keys(config.metadata).length === 0) {
        delete config.metadata;
      }
    } else {
      // No specific binding type, clean up bindingType and metadata
      delete config.bindingType;
      delete config.metadata;
    }
  }

  // Collect Dapr advanced fields (only for types 1-4)
  const isDaprType = ['1', '2', '3', '4'].includes(type);

  if (isDaprType) {
    const maxRetries = getFieldValue('maxRetries');
    const initialIntervalMs = getFieldValue('initialIntervalMs');
    const apiTokenSecretRef = getFieldValue('apiTokenSecretRef');
    const mtlsRequired = getFieldValue('mtlsRequired');

    // Build dapr object only if needed
    let hasDaprConfig = false;
    const dapr = {};

    if (maxRetries !== undefined || initialIntervalMs !== undefined) {
      dapr.retry = {};
      if (maxRetries !== undefined) {
        dapr.retry.maxRetries = maxRetries;
        hasDaprConfig = true;
      }
      if (initialIntervalMs !== undefined) {
        dapr.retry.initialIntervalMs = initialIntervalMs;
        hasDaprConfig = true;
      }
    }

    if (apiTokenSecretRef || mtlsRequired) {
      dapr.auth = {};
      if (apiTokenSecretRef) {
        dapr.auth.apiTokenSecretRef = apiTokenSecretRef;
        hasDaprConfig = true;
      }
      if (mtlsRequired) {
        dapr.auth.mtlsRequired = true;
        hasDaprConfig = true;
      }
    }

    if (hasDaprConfig) {
      config.dapr = dapr;
    } else {
      delete config.dapr;
    }
  } else {
    // Non-Dapr types shouldn't have dapr config
    delete config.dapr;
  }

  // Type-specific advanced fields
  if (type === '4') {
    const orderingKey = getFieldValue('orderingKey');
    const ttlInSeconds = getFieldValue('ttlInSeconds');

    if (orderingKey) {
      config.orderingKey = orderingKey;
    } else {
      delete config.orderingKey;
    }

    if (ttlInSeconds !== undefined) {
      config.ttlInSeconds = ttlInSeconds;
    } else {
      delete config.ttlInSeconds;
    }
  } else if (type === '5') {
    // Type 5 advanced fields are already in the main fields list
    // No additional processing needed
  } else if (type === '6') {
    // Type 6 advanced fields are already in the main fields list
    // Headers handling
    const headersText = document.getElementById('headers')?.value;
    if (headersText) {
      try {
        config.headers = JSON.parse(headersText);
      } catch {
        // Keep as is if invalid JSON
      }
    } else {
      delete config.headers;
    }

    // Body handling
    const bodyText = document.getElementById('body')?.value;
    if (bodyText) {
      try {
        config.body = JSON.parse(bodyText);
      } catch {
        // Keep as is if invalid JSON
      }
    } else {
      delete config.body;
    }
  }

  return task;
}

function saveTask() {
  try {
    // Validate required fields
    const key = getFieldValue('key');
    const domain = getFieldValue('domain');

    if (!key) {
      showToast('Task key is required', 'error');
      return;
    }

    if (!domain) {
      showToast('Domain is required', 'error');
      return;
    }

    // Collect data
    const task = collectTaskData();

    // Format JSON
    const content = JSON.stringify(task, null, 2);

    // Send save message
    vscode.postMessage({
      type: 'save',
      content: content
    });

  } catch (error) {
    showToast(`Save failed: ${error.message}`, 'error');
  }
}

function openAsJson() {
  vscode.postMessage({ type: 'openAsJson' });
}

function markDirty() {
  isDirty = true;
  updateSaveButton();
}

function updateSaveButton() {
  if (elements.saveBtn) {
    elements.saveBtn.textContent = isDirty ? 'Save *' : 'Save';
    elements.saveBtn.classList.toggle('dirty', isDirty);
  }
}

function showEditor() {
  elements.loading.classList.add('hidden');
  elements.error.classList.add('hidden');
  elements.notTask.classList.add('hidden');
  elements.editor.classList.remove('hidden');
}

function showNotTask() {
  elements.loading.classList.add('hidden');
  elements.error.classList.add('hidden');
  elements.editor.classList.add('hidden');
  elements.notTask.classList.remove('hidden');
}

function showError(message) {
  elements.loading.classList.add('hidden');
  elements.notTask.classList.add('hidden');
  elements.editor.classList.add('hidden');
  elements.error.classList.remove('hidden');
  elements.error.textContent = message;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Log helper (available for debugging if needed)
// function log(message) {
//   vscode.postMessage({
//     type: 'log',
//     message: message
//   });
// }