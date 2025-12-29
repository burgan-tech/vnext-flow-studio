/**
 * Test script for the new /definitions/publish API
 *
 * This script validates the package publishing structure by:
 * 1. Creating a sample package with multiple components
 * 2. Testing different PublishInput structures
 * 3. Reporting what works with the API
 *
 * Usage: node test-package-publish.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = 'http://localhost:4201';
const DOMAIN = 'cardion-next'; // Must match server config
const PACKAGE_VERSION = '1.0.0';
const TEST_DIR = './test-mappers';

/**
 * Load all component files from a directory
 */
function loadComponents(directory) {
  const components = [];

  if (!fs.existsSync(directory)) {
    console.log(`Directory ${directory} does not exist`);
    return components;
  }

  const files = fs.readdirSync(directory);

  for (const file of files) {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);

    if (stat.isFile() && file.endsWith('.json') && !file.includes('diagram')) {
      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        // Determine component type from filename
        let type = 'workflow';
        if (file.endsWith('.task.json')) type = 'task';
        else if (file.endsWith('.schema.json')) type = 'schema';
        else if (file.endsWith('.view.json')) type = 'view';
        else if (file.endsWith('.function.json')) type = 'function';
        else if (file.endsWith('.condition.json')) type = 'condition';
        else if (file.endsWith('.timer.json')) type = 'timer';
        else if (file.endsWith('.mapping.json')) type = 'mapper';

        components.push({
          type,
          file,
          content
        });
      } catch (error) {
        console.log(`Failed to parse ${file}: ${error.message}`);
      }
    }
  }

  return components;
}

/**
 * Build version string with package metadata
 */
function buildVersionString(componentVersion, packageVersion, packageName) {
  return `${componentVersion}-pkg.${packageVersion}+${packageName}`;
}

/**
 * Test 1: Minimal package structure
 */
async function test1_MinimalPackage() {
  console.log('\n=== Test 1: Minimal Package Structure ===');

  const payload = {
    key: 'test-package',
    flow: 'core',
    domain: DOMAIN,
    version: buildVersionString('1.0.0', PACKAGE_VERSION, DOMAIN),
    attributes: {
      description: 'Test package'
    }
  };

  console.log('Payload:', JSON.stringify(payload, null, 2));

  return sendRequest(payload);
}

/**
 * Test 2: Package with single component in data array
 */
async function test2_SingleComponent() {
  console.log('\n=== Test 2: Package with Single Component ===');

  const payload = {
    key: 'test-package',
    flow: 'core',
    domain: DOMAIN,
    version: buildVersionString('1.0.0', PACKAGE_VERSION, DOMAIN),
    attributes: {
      description: 'Test package with one component'
    },
    data: [
      {
        key: 'test-workflow',
        version: '1.0.0',
        attributes: {
          key: 'test-workflow',
          version: '1.0.0',
          domain: DOMAIN,
          flow: 'core',
          states: [
            {
              name: 'Start',
              type: 'initial'
            },
            {
              name: 'End',
              type: 'final'
            }
          ]
        }
      }
    ]
  };

  console.log('Payload:', JSON.stringify(payload, null, 2));

  return sendRequest(payload);
}

/**
 * Test 3: Package with all components from test-mappers directory
 */
async function test3_RealPackage() {
  console.log('\n=== Test 3: Real Package with All Components ===');

  const components = loadComponents(TEST_DIR);
  console.log(`Found ${components.length} components in ${TEST_DIR}`);

  if (components.length === 0) {
    console.log('No components found, skipping test');
    return { success: false, error: 'No components found' };
  }

  // Build data array
  const data = components.map(comp => {
    const content = comp.content;
    return {
      key: content.key || path.basename(comp.file, '.json'),
      version: content.version || '1.0.0',
      attributes: content
    };
  });

  const payload = {
    key: DOMAIN + '-package',
    flow: 'core',
    domain: DOMAIN,
    version: buildVersionString('1.0.0', PACKAGE_VERSION, DOMAIN),
    attributes: {
      description: `${DOMAIN} package`,
      packageName: DOMAIN,
      packageVersion: PACKAGE_VERSION,
      componentCount: data.length
    },
    data
  };

  console.log(`Package contains ${data.length} components:`);
  data.forEach(d => console.log(`  - ${d.key} @ ${d.version}`));

  console.log('\nPayload structure:', JSON.stringify({
    ...payload,
    data: `[${data.length} components]`
  }, null, 2));

  return sendRequest(payload);
}

/**
 * Test 4: Package with top-level component attributes
 * Maybe the package itself IS a component?
 */
async function test4_PackageAsComponent() {
  console.log('\n=== Test 4: Package as Component (attributes = workflow def) ===');

  const payload = {
    key: 'test-workflow',
    flow: 'core',
    domain: DOMAIN,
    version: buildVersionString('1.0.0', PACKAGE_VERSION, DOMAIN),
    attributes: {
      key: 'test-workflow',
      version: '1.0.0',
      domain: DOMAIN,
      flow: 'core',
      states: [
        {
          name: 'Start',
          type: 'initial'
        },
        {
          name: 'End',
          type: 'final'
        }
      ]
    },
    data: []
  };

  console.log('Payload:', JSON.stringify(payload, null, 2));

  return sendRequest(payload);
}

/**
 * Send request to API
 */
async function sendRequest(payload) {
  const url = `${API_BASE_URL}/api/v1/definitions/publish`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const contentType = response.headers.get('content-type');
    let responseData;

    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (response.ok) {
      console.log('✅ SUCCESS');
      console.log('Response:', responseData);
      return { success: true, data: responseData };
    } else {
      console.log('❌ FAILED');
      console.log('Status:', response.status);
      console.log('Response:', responseData);
      return { success: false, error: responseData };
    }
  } catch (error) {
    console.log('❌ EXCEPTION');
    console.log('Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('Testing /definitions/publish API');
  console.log('API URL:', API_BASE_URL);
  console.log('Domain:', DOMAIN);
  console.log('Package Version:', PACKAGE_VERSION);

  // Check if API is reachable
  console.log('\n=== Checking API connectivity ===');
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    console.log('API is reachable, status:', response.status);
  } catch (error) {
    console.log('❌ API is not reachable:', error.message);
    console.log('Make sure the API is running on', API_BASE_URL);
    process.exit(1);
  }

  // Run tests
  const tests = [
    test1_MinimalPackage,
    test2_SingleComponent,
    test4_PackageAsComponent,
    test3_RealPackage  // Run this last as it's the most complex
  ];

  const results = [];

  for (const test of tests) {
    const result = await test();
    results.push({ test: test.name, result });

    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n=== Test Summary ===');
  results.forEach(({ test, result }) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${test}`);
  });

  const successCount = results.filter(r => r.result.success).length;
  console.log(`\n${successCount}/${results.length} tests passed`);
}

// Run
main().catch(console.error);
