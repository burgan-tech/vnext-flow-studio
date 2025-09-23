#!/usr/bin/env node

// Test extension file pattern recognition
const path = require('path');
const fs = require('fs');

console.log('🔍 Extension File Pattern Recognition Test');
console.log('==========================================\n');

// Test files
const testFiles = [
    'samples/ecommerce/Workflows/ecommerce-workflow.json',
    'samples/payments/Workflows/scheduled-payments-workflow.json',
    'scheduled-payments-workflow.flow.json'
];

// Test VS Code pattern matching
function testVSCodePattern(filePath) {
    const normalized = filePath.toLowerCase();
    const segments = normalized.split('/').filter(Boolean);

    // Test different pattern conditions
    const tests = {
        'Ends with .json': normalized.endsWith('.json'),
        'Contains workflows segment': segments.includes('workflows'),
        'Is .flow.json file': normalized.endsWith('.flow.json'),
        'Is diagram file': normalized.endsWith('.diagram.json'),
        'Should be recognized (workflows)': segments.includes('workflows') && normalized.endsWith('.json') && !normalized.endsWith('.diagram.json'),
        'Should be recognized (.flow.json)': normalized.endsWith('.flow.json'),
        'Overall recognition': (segments.includes('workflows') && normalized.endsWith('.json') && !normalized.endsWith('.diagram.json')) || normalized.endsWith('.flow.json')
    };

    return tests;
}

// Test each file
testFiles.forEach(file => {
    console.log(`📁 File: ${file}`);

    // Check if file exists
    if (fs.existsSync(file)) {
        console.log('   ✅ File exists');

        // Test patterns
        const tests = testVSCodePattern(file);
        Object.entries(tests).forEach(([test, result]) => {
            const icon = result ? '✅' : '❌';
            console.log(`   ${icon} ${test}: ${result}`);
        });

        // Check file size
        const stats = fs.statSync(file);
        console.log(`   📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);

        // Test JSON validity
        try {
            const content = fs.readFileSync(file, 'utf8');
            const json = JSON.parse(content);
            console.log('   ✅ Valid JSON');
            console.log(`   📋 Workflow key: ${json.key || 'N/A'}`);
            console.log(`   🔢 States count: ${json.attributes?.states?.length || 0}`);
        } catch (e) {
            console.log(`   ❌ Invalid JSON: ${e.message}`);
        }
    } else {
        console.log('   ❌ File does not exist');
    }

    console.log('');
});

// Test extension package.json
console.log('🔧 Extension Configuration Test');
console.log('===============================\n');

const extensionPackage = 'packages/extension/package.json';
if (fs.existsSync(extensionPackage)) {
    try {
        const pkg = JSON.parse(fs.readFileSync(extensionPackage, 'utf8'));

        console.log('📦 Extension Info:');
        console.log(`   Name: ${pkg.name}`);
        console.log(`   Version: ${pkg.version}`);
        console.log(`   Main: ${pkg.main}`);

        console.log('\n🎯 Activation Events:');
        pkg.activationEvents?.forEach(event => {
            console.log(`   - ${event}`);
        });

        console.log('\n📋 Custom Editors:');
        pkg.contributes?.customEditors?.forEach(editor => {
            console.log(`   - ViewType: ${editor.viewType}`);
            console.log(`   - Priority: ${editor.priority}`);
            console.log(`   - Selectors:`);
            editor.selector?.forEach(sel => {
                console.log(`     * ${sel.filenamePattern}`);
            });
        });

        console.log('\n🎮 Commands:');
        pkg.contributes?.commands?.forEach(cmd => {
            console.log(`   - ${cmd.command}: ${cmd.title}`);
        });

        console.log('\n📝 Menu Contributions:');
        if (pkg.contributes?.menus?.['explorer/context']) {
            console.log('   Explorer Context Menu:');
            pkg.contributes.menus['explorer/context'].forEach(menu => {
                console.log(`     - When: ${menu.when}`);
                console.log(`     - Command: ${menu.command}`);
            });
        }

    } catch (e) {
        console.log(`❌ Error reading extension package.json: ${e.message}`);
    }
} else {
    console.log('❌ Extension package.json not found');
}

console.log('\n🚀 Next Steps:');
console.log('==============');
console.log('1. Check VS Code Developer Console (Help → Developer Tools)');
console.log('2. Try Command Palette: "Developer: Show Running Extensions"');
console.log('3. Try Command Palette: "Open in Amorphie Flow Studio"');
console.log('4. Check if context menu appears on workflow files');
console.log('5. Restart VS Code extension host if needed');
