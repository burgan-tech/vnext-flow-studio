# 🔧 Extension Troubleshooting Guide

## Current Status: Extension Files ✅ - Runtime Issue ❓

Based on diagnostics, everything looks correct:
- ✅ Extension is installed (`your-org.amorphie-flow-studio`)
- ✅ All build files are present and correct
- ✅ File pattern recognition is working properly
- ✅ Workflow files are valid JSON with proper structure
- ✅ Extension configuration is correct

## 🎯 **Step-by-Step Debugging Process**

### **Step 1: Verify Extension is Running**

1. **Open VS Code**
2. **Press** `Ctrl+Shift+P` (Command Palette)
3. **Type:** "Developer: Show Running Extensions"
4. **Look for:** `amorphie-flow-studio` in the list
5. **Check status:** Should show as "Activated"

**Expected:** Extension appears and shows as activated
**If not:** Extension activation issue

---

### **Step 2: Check Developer Console**

1. **In VS Code:** `Help` → `Developer Tools`
2. **Go to Console tab**
3. **Try to open a workflow file**
4. **Look for errors or our debug messages:**
   ```
   Opening flow editor for: file:///.../workflow.json
   Is flow definition URI: true
   ```

**Expected:** Debug messages appear
**If errors:** JavaScript/extension runtime issues

---

### **Step 3: Test Context Menu**

1. **Right-click** on `samples/ecommerce/Workflows/ecommerce-workflow.json`
2. **Look for:** "Open in Amorphie Flow Studio"
3. **Check menu appears** in context menu

**Expected:** Menu item appears
**If missing:** Menu contribution issue

---

### **Step 4: Test Command Palette**

1. **Press** `Ctrl+Shift+P`
2. **Type:** "Open in Amorphie Flow Studio"
3. **Select the command**
4. **Choose a workflow file**

**Expected:** File picker opens, then webview opens
**If fails:** Command registration issue

---

### **Step 5: Check Extension Host Logs**

1. **Press** `Ctrl+Shift+P`
2. **Type:** "Developer: Toggle Developer Tools"
3. **Go to Console**
4. **Filter by:** "Extension Host"
5. **Look for extension errors**

---

## 🚨 **Common Issues & Solutions**

### **Issue: Context Menu Missing**

**Possible Causes:**
- File not in `workflows/` directory
- VS Code file association issue
- Extension not activated

**Solutions:**
```bash
# Restart extension host
Ctrl+Shift+P → "Developer: Restart Extension Host"

# Reload VS Code window
Ctrl+Shift+P → "Developer: Reload Window"
```

---

### **Issue: Extension Not Activating**

**Debug Steps:**
1. Check if extension is in running extensions list
2. Look for activation errors in console
3. Verify activation events in package.json

**Solutions:**
```bash
# Reinstall extension
code --uninstall-extension your-org.amorphie-flow-studio
code --install-extension packages/extension/amorphie-flow-studio-0.3.0.vsix --force

# Clear VS Code extension cache
rm -rf ~/.vscode/extensions/your-org.amorphie-flow-studio-*
```

---

### **Issue: Webview Opens But Empty**

**Debug Steps:**
1. Open webview Developer Tools (`F12` in webview)
2. Check Console for JavaScript errors
3. Check Network tab for failed asset loads

**Solutions:**
- Verify webview assets built correctly
- Check if `dist-web/` directory has all files
- Rebuild extension: `npm run build`

---

### **Issue: JavaScript Errors in Webview**

**Common Errors:**
- Module loading failures
- React rendering errors
- Monaco Editor initialization issues

**Debug:**
```bash
# Check webview assets
ls -la packages/extension/dist-web/

# Verify index.html exists
cat packages/extension/dist-web/index.html
```

---

## 🔍 **Advanced Debugging**

### **Enable Extension Development Mode**

1. **Open this project in VS Code**
2. **Press** `F5` to start Extension Development Host
3. **New VS Code window opens** with extension in development mode
4. **Test workflow files** in the new window
5. **Check original VS Code console** for detailed logs

### **Check Extension Activation Timing**

Add breakpoints in `packages/extension/src/extension.ts`:
- `activate()` function
- `openFlowEditor()` function
- Command registration

### **Test File Pattern Matching**

```javascript
// Test in VS Code Developer Console
const uri = vscode.Uri.file('/path/to/workflow.json');
console.log('Path:', uri.path);
console.log('Segments:', uri.path.split('/'));
```

---

## 📊 **Quick Diagnostic Commands**

Run these in terminal to verify build:

```bash
# Verify all files exist
ls -la packages/extension/dist/extension.js
ls -la packages/extension/dist-web/index.html
ls -la packages/extension/schemas/workflow-definition.schema.json

# Check extension is installed
code --list-extensions | grep amorphie

# Test JSON validity
python3 -c "import json; print('Valid JSON') if json.load(open('samples/ecommerce/Workflows/ecommerce-workflow.json')) else print('Invalid')"
```

---

## 🎯 **Most Likely Issues**

Based on symptoms, the most likely issues are:

1. **Extension Host Not Loading Extension** - VS Code internal issue
2. **Webview Assets Not Loading** - Build or path issue
3. **File Association Not Working** - VS Code settings issue
4. **Extension Activation Failure** - JavaScript runtime error

---

## 🚀 **Immediate Next Steps**

1. **Try Extension Development Mode** (`F5` in this project)
2. **Check VS Code Developer Console** for specific errors
3. **Test with Command Palette** instead of context menu
4. **Restart VS Code completely** if needed

The extension should work - all the files and configuration are correct! 🎯
