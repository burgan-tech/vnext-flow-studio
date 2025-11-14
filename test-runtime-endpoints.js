async function testEndpoints() {
  const baseUrl = 'http://localhost:4201';
  const domain = 'core';

  const endpoints = [
    `/workflow`,
    `/workflow?domain=${domain}`,
    `/workflow-instance`,
    `/workflow-instance?domain=${domain}`,
    `/api/workflow`,
    `/api/workflow?domain=${domain}`,
  ];

  console.log('Testing runtime endpoints...\n');

  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint}`;
    console.log(`Testing: ${url}`);

    try {
      const response = await fetch(url);
      console.log(`  Status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`  Success! Got ${Array.isArray(data) ? data.length : 'object'} items`);
        if (Array.isArray(data) && data.length > 0) {
          console.log(`  Sample keys:`, Object.keys(data[0]).slice(0, 5));
        }
      } else {
        const text = await response.text();
        console.log(`  Error:`, text.substring(0, 200));
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
    console.log('');
  }
}

testEndpoints();
