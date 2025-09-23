# 🔧 Troubleshooting Extension Rendering Issues

## Problem: Extension cannot render the workflow file

Based on your `scheduled-payments-workflow.json`, here are the most likely causes and solutions:

### **🔍 Possible Causes**

1. **File Pattern Recognition**
   - The extension looks for `*.flow.json` files or files in `/workflows/` directories
   - Your file is named `scheduled-payments-workflow.json` (missing `.flow.` part)

2. **Schema Validation Errors**
   - Complex workflow with many states and Base64-encoded mappings
   - Large file size (467 lines) might cause parsing issues

3. **WebView Loading Issues**
   - Monaco Editor or React components not initializing properly
   - JavaScript errors in the webview

4. **Extension Activation Issues**
   - Extension not properly activated for JSON files
   - VS Code extension host problems

### **🛠️ Solutions to Try**

#### **1. Fix File Naming (Most Likely)**
```bash
# Rename the file to match the expected pattern
mv scheduled-payments-workflow.json scheduled-payments-workflow.flow.json
```

#### **2. Check Extension Status**
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "Amorphie Flow Studio"
4. Verify it's installed and enabled
5. Check if there are any error messages

#### **3. Test with Simpler File First**
```json
{
  "key": "simple-test",
  "flow": "test-flow",
  "domain": "test",
  "version": "1.0.0",
  "tags": ["test"],
  "attributes": {
    "type": "F",
    "startTransition": {
      "key": "start",
      "target": "initial",
      "triggerType": 0,
      "versionStrategy": "Major"
    },
    "states": [
      {
        "key": "initial",
        "stateType": 1,
        "versionStrategy": "Major",
        "labels": [{"label": "Test State", "language": "en"}],
        "onEntries": [],
        "transitions": []
      }
    ]
  }
}
```

#### **4. Check VS Code Developer Console**
1. Open the workflow file
2. Right-click → "Open in Amorphie Flow Studio"
3. If webview opens, press `F12` to open Developer Tools
4. Check Console tab for JavaScript errors
5. Look for network errors in Network tab

#### **5. Check Extension Logs**
1. `Help` → `Developer Tools` → `Console` in main VS Code window
2. Look for extension-related errors
3. Check for webview creation failures

#### **6. Restart Extension Host**
1. `Ctrl+Shift+P` → "Developer: Restart Extension Host"
2. Try opening the file again

#### **7. Check File Association**
1. Right-click on the `.flow.json` file
2. Look for "Open in Amorphie Flow Studio" in context menu
3. If missing, the file pattern might not match

### **🔬 Diagnostic Commands**

#### **Check Extension Installation**
```bash
code --list-extensions | grep amorphie
```

#### **Validate JSON Syntax**
```bash
cat scheduled-payments-workflow.flow.json | python -m json.tool > /dev/null && echo "Valid JSON" || echo "Invalid JSON"
```

#### **Check File Size**
```bash
wc -c scheduled-payments-workflow.flow.json
ls -lah scheduled-payments-workflow.flow.json
```

### **🎯 Step-by-Step Debugging**

1. **Rename the file** to `scheduled-payments-workflow.flow.json`
2. **Open VS Code** in this directory
3. **Right-click the file** → Look for "Open in Amorphie Flow Studio"
4. **If context menu missing**: Extension not recognizing file pattern
5. **If context menu present but fails**: Check Developer Console for errors
6. **If webview opens but empty**: Check for JavaScript/React errors

### **🔄 Alternative Testing Methods**

#### **Method 1: Force Extension Activation**
1. Open any `.flow.json` file
2. `Ctrl+Shift+P` → "Open in Amorphie Flow Studio"
3. Select your workflow file

#### **Method 2: Development Mode**
```bash
cd /Volumes/Data/burgan-tech/vnext-flow-studio
npm run watch
```
Then press `F5` in VS Code to open Extension Development Host

#### **Method 3: Check Extension Manifest**
```bash
cd packages/extension
cat package.json | grep -A 10 "contributes"
```

### **📊 Expected Behavior**

When working correctly:
1. Right-click → "Open in Amorphie Flow Studio" appears
2. Webview opens with canvas showing workflow diagram
3. States appear as nodes connected by transitions
4. Property panel shows on the right for editing
5. Enhanced mapping editors work with IntelliSense

### **⚠️ Known Issues**

1. **Large workflows** might take time to render
2. **Base64-encoded mappings** need to be decoded for editing
3. **Complex state machines** might have layout issues
4. **Missing task definitions** might cause rendering failures

### **📝 If Still Not Working**

1. Check VS Code version compatibility (`>=1.92.0`)
2. Try creating a fresh workflow from scratch
3. Verify webview security settings
4. Check if other extensions interfere
5. Try in a clean VS Code workspace

### **🆘 Last Resort**

If nothing works:
1. Uninstall extension: `code --uninstall-extension amorphie-flow-studio`
2. Reinstall: `code --install-extension packages/extension/amorphie-flow-studio-0.3.0.vsix --force`
3. Restart VS Code completely
4. Test with simple workflow first

---

## Quick Test Script

Run this to test everything:

```bash
#!/bin/bash
echo "🔧 Amorphie Flow Studio Diagnostics"
echo "=================================="

echo "1. Checking extension..."
code --list-extensions | grep -i amorphie || echo "❌ Extension not found"

echo "2. Checking file..."
[ -f "scheduled-payments-workflow.flow.json" ] && echo "✅ File exists" || echo "❌ File missing"

echo "3. Validating JSON..."
python -c "import json; json.load(open('scheduled-payments-workflow.flow.json'))" 2>/dev/null && echo "✅ Valid JSON" || echo "❌ Invalid JSON"

echo "4. File size..."
wc -c < scheduled-payments-workflow.flow.json | awk '{print $1 " bytes"}'

echo "5. Testing file pattern..."
[[ "scheduled-payments-workflow.flow.json" =~ \.flow\.json$ ]] && echo "✅ Correct pattern" || echo "❌ Wrong pattern"

echo "Done! Now try opening the file in VS Code."
```
