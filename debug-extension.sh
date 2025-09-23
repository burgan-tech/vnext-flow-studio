#!/bin/bash

echo "🔧 VNext Flow Studio Extension Diagnostics"
echo "=========================================="

echo ""
echo "1. Extension Installation Check:"
echo "--------------------------------"
code --list-extensions | grep -i amorphie
if [ $? -eq 0 ]; then
    echo "✅ Extension is installed"
else
    echo "❌ Extension not found"
fi

echo ""
echo "2. Extension Files Check:"
echo "------------------------"
if [ -f "packages/extension/amorphie-flow-studio-0.3.0.vsix" ]; then
    echo "✅ VSIX file exists"
    ls -lah packages/extension/amorphie-flow-studio-0.3.0.vsix
else
    echo "❌ VSIX file missing"
fi

echo ""
echo "3. Built Extension Check:"
echo "------------------------"
if [ -f "packages/extension/dist/extension.js" ]; then
    echo "✅ Extension JavaScript built"
    ls -lah packages/extension/dist/extension.js
else
    echo "❌ Extension JavaScript missing"
fi

echo ""
echo "4. Webview Assets Check:"
echo "------------------------"
if [ -d "packages/extension/dist-web" ]; then
    echo "✅ Webview assets exist"
    ls -lah packages/extension/dist-web/
else
    echo "❌ Webview assets missing"
fi

echo ""
echo "5. Schema Files Check:"
echo "---------------------"
if [ -f "packages/extension/schemas/workflow-definition.schema.json" ]; then
    echo "✅ Schema file exists"
else
    echo "❌ Schema file missing"
fi

echo ""
echo "6. Test Workflow Files:"
echo "----------------------"
echo "Available workflow files:"
find . -name "*.json" -path "*/workflows/*" -o -name "*.flow.json" | head -5

echo ""
echo "7. File Pattern Test:"
echo "--------------------"
echo "Testing file pattern recognition..."
node -e "
const path = require('path');
const testFiles = [
    'samples/ecommerce/Workflows/ecommerce-workflow.json',
    'samples/payments/Workflows/scheduled-payments-workflow.json'
];

testFiles.forEach(file => {
    const segments = file.toLowerCase().split('/').filter(Boolean);
    const hasWorkflows = segments.includes('workflows');
    const endsWithJson = file.toLowerCase().endsWith('.json');
    const isDiagram = file.toLowerCase().endsWith('.diagram.json');

    console.log(\`File: \${file}\`);
    console.log(\`  - Has workflows segment: \${hasWorkflows}\`);
    console.log(\`  - Ends with .json: \${endsWithJson}\`);
    console.log(\`  - Is diagram: \${isDiagram}\`);
    console.log(\`  - Should be recognized: \${hasWorkflows && endsWithJson && !isDiagram}\`);
    console.log('');
});
"

echo ""
echo "8. Extension Manifest Check:"
echo "----------------------------"
if [ -f "packages/extension/package.json" ]; then
    echo "Extension info:"
    cat packages/extension/package.json | grep -A 3 -B 3 '"name"\|"version"\|"main"\|"activationEvents"'
fi

echo ""
echo "9. VS Code Logs Location:"
echo "------------------------"
echo "Check VS Code logs at:"
echo "macOS: ~/Library/Application Support/Code/logs/"
echo "To open: code ~/Library/Application\ Support/Code/logs/"

echo ""
echo "10. Manual Test Commands:"
echo "------------------------"
echo "Try these commands in VS Code:"
echo "1. Ctrl+Shift+P → 'Developer: Show Running Extensions'"
echo "2. Ctrl+Shift+P → 'Developer: Restart Extension Host'"
echo "3. Ctrl+Shift+P → 'Open in Amorphie Flow Studio'"
echo "4. Help → Developer Tools (check Console tab)"

echo ""
echo "Done! Check the output above for any ❌ items."
