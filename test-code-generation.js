const { generateContractClass } = require('./packages/core/dist/mapper/contractCodeGenerator.js');
const fs = require('fs').promises;
const path = require('path');

async function testCodeGeneration() {
  console.log('Testing Contract Code Generation...\n');

  // Load test mapper
  const mapperPath = path.join(__dirname, 'test-mappers', 'order-mapper.mapping.json');
  const mapperContent = await fs.readFile(mapperPath, 'utf-8');
  const mapSpec = JSON.parse(mapperContent);

  console.log(`Generating C# code for: ${mapSpec.key} (${mapSpec.contractType})\n`);

  // Generate C# class
  const result = generateContractClass(mapSpec, {
    includeComments: true,
    nullSafeNavigation: true
  });

  if (result.success) {
    console.log('✓ Code generation successful!\n');
    console.log('Generated C# Class:');
    console.log('─'.repeat(80));
    console.log(result.code);
    console.log('─'.repeat(80));

    // Save to file
    const outputPath = path.join(__dirname, 'test-mappers', `${mapSpec.key}.cs`);
    await fs.writeFile(outputPath, result.code, 'utf-8');
    console.log(`\n✓ Saved to: ${outputPath}`);
  } else {
    console.error('✗ Code generation failed:');
    result.errors?.forEach(err => console.error(`  - ${err}`));
  }
}

testCodeGeneration().catch(console.error);
