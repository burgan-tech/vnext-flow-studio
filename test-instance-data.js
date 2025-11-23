/**
 * Test script to check instance data fetching
 * Usage: node test-instance-data.js
 */

const instanceId = '019a9690-f8e5-7b71-8147-d7e7ae0cac96';
const domain = 'core';
const workflow = 'test';

// Get environment config from your active environment
// You may need to update this with your actual API base URL
const baseUrl = 'https://your-api-base-url'; // UPDATE THIS

async function testInstanceData() {
  console.log('Testing instance data fetch...\n');

  // Step 1: Get instance status
  console.log('Step 1: Fetching instance status...');
  const statusUrl = `${baseUrl}/api/v1/${domain}/workflows/${workflow}/instances/${instanceId}`;
  console.log('URL:', statusUrl);

  try {
    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add auth headers if needed
        // 'Authorization': 'Bearer YOUR_TOKEN'
      }
    });

    if (!statusResponse.ok) {
      const error = await statusResponse.text();
      console.error('Status fetch failed:', statusResponse.status, error);
      return;
    }

    const statusData = await statusResponse.json();
    console.log('\nInstance Status Response:');
    console.log(JSON.stringify(statusData, null, 2));

    // Step 2: Check for data.href
    if (statusData.data?.href) {
      console.log('\n✓ Found data.href:', statusData.data.href);

      // Step 3: Fetch instance data from href
      const dataUrl = `${baseUrl}/api/v1/${statusData.data.href}`;
      console.log('\nStep 2: Fetching instance data from href...');
      console.log('URL:', dataUrl);

      const dataResponse = await fetch(dataUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Add auth headers if needed
          // 'Authorization': 'Bearer YOUR_TOKEN'
        }
      });

      if (!dataResponse.ok) {
        const error = await dataResponse.text();
        console.error('Data fetch failed:', dataResponse.status, error);
        return;
      }

      const instanceData = await dataResponse.json();
      console.log('\nInstance Data Response:');
      console.log(JSON.stringify(instanceData, null, 2));
      console.log('\nInstance Data Keys:', Object.keys(instanceData));

    } else {
      console.log('\n✗ No data.href found in response');
      console.log('statusData.data:', statusData.data);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testInstanceData();
