# 🧪 Extension Testing Instructions

## **Updated Extension with Debugging**

The extension has been updated with:
1. ✅ **Enhanced activation events** - Now activates on command execution
2. ✅ **Improved file pattern matching** - Simplified `workflows` directory detection
3. ✅ **Debug logging** - Console output for troubleshooting
4. ✅ **BBT Workflow IntelliSense** - Complete integration of BBT interfaces

## **Testing Steps**

### **1. Test File Recognition**

**Target File:** `/samples/payments/Workflows/scheduled-payments-workflow.json`

1. Open VS Code in this directory: `/Volumes/Data/burgan-tech/vnext-flow-studio`
2. Navigate to `samples/payments/Workflows/scheduled-payments-workflow.json`
3. **Right-click** on the file
4. **Look for:** "Open in Amorphie Flow Studio" in context menu

**✅ Expected:** Context menu item should appear
**❌ If missing:** File pattern not recognized

### **2. Test Extension Activation**

1. **Command Palette** (`Ctrl+Shift+P`)
2. Type: "Open in Amorphie Flow Studio"
3. Select the command
4. **Choose:** `scheduled-payments-workflow.json`

**✅ Expected:** Webview opens with workflow canvas
**❌ If fails:** Check VS Code Developer Console

### **3. Check Debug Output**

1. **Open Developer Console**: `Help` → `Developer Tools` → `Console`
2. Open the workflow file with the extension
3. **Look for debug messages:**
   ```
   Opening flow editor for: file:///path/to/scheduled-payments-workflow.json
   Is flow definition URI: true
   isWorkflowJsonUri check: { path: "...", ... }
   Loading webview from: ...
   ```

**✅ Expected:** Debug messages appear showing successful recognition
**❌ If "Is flow definition URI: false":** Pattern matching issue

### **4. Test Workflow Rendering**

If the webview opens:
1. **Check Canvas:** Should show workflow nodes and connections
2. **Check Property Panel:** Right side should show editing options
3. **Test Mapping Editor:** Click on a state's mapping to test enhanced editors
4. **Test IntelliSense:** In mapping editor, type `IMapping` to see suggestions

**✅ Expected:** Full workflow visualization with enhanced editors
**❌ If blank/error:** Check webview console for JavaScript errors

## **🔧 Troubleshooting Commands**

### **Check Extension Status**
```bash
code --list-extensions | grep amorphie
```

### **Test File Pattern Recognition**
```bash
# This should return true for the workflow file
node -e "
const path = '/samples/payments/Workflows/scheduled-payments-workflow.json';
const segments = path.toLowerCase().split('/').filter(Boolean);
console.log('Segments:', segments);
console.log('Has workflows segment:', segments.includes('workflows'));
console.log('Ends with .json:', path.toLowerCase().endsWith('.json'));
"
```

### **Validate Workflow JSON**
```bash
python3 -c "
import json
with open('samples/payments/Workflows/scheduled-payments-workflow.json') as f:
    data = json.load(f)
    print(f'✅ Valid JSON - Key: {data[\"key\"]}')
    print(f'✅ States: {len(data[\"attributes\"][\"states\"])}')
    print(f'✅ Has mappings: {any(\"mapping\" in str(state) for state in data[\"attributes\"][\"states\"])}')
"
```

## **🚨 Common Issues & Solutions**

### **Issue 1: Context Menu Missing**
**Cause:** File pattern not recognized
**Solution:** 
- Ensure file is in `/Workflows/` directory (case-sensitive)
- Check file ends with `.json`
- Try using Command Palette instead

### **Issue 2: Webview Opens But Empty**
**Cause:** JavaScript/React errors in webview
**Solution:**
- Open webview Developer Tools (`F12` in webview)
- Check Console for errors
- Look for missing assets or network failures

### **Issue 3: Extension Not Activating**
**Cause:** Extension not properly installed or activated
**Solution:**
```bash
# Restart VS Code extension host
# Ctrl+Shift+P → "Developer: Restart Extension Host"

# Or reinstall extension
code --uninstall-extension amorphie-flow-studio
code --install-extension packages/extension/amorphie-flow-studio-0.3.0.vsix --force
```

### **Issue 4: Debug Messages Not Appearing**
**Cause:** Extension console output not visible
**Solution:**
- Open main VS Code Developer Console (not webview)
- Look in "Extension Host" log category
- Enable verbose logging if needed

## **📋 Success Criteria Checklist**

- [ ] Extension recognizes `scheduled-payments-workflow.json`
- [ ] Context menu shows "Open in Amorphie Flow Studio"
- [ ] Webview opens without errors
- [ ] Workflow canvas displays all 7 states
- [ ] States show proper connections and transitions
- [ ] Property panel appears on the right
- [ ] Mapping editors open when clicking on states
- [ ] BBT Workflow IntelliSense works in code editors
- [ ] No JavaScript errors in any console
- [ ] Base64 mappings decode properly for editing

## **📊 Expected Workflow Structure**

The scheduled payments workflow should show:
1. **payment-configuration** (Manual state)
2. **payment-active** (Active state with subprocess)
3. **payment-deactive** (Inactive state)
4. **payment-cycle-check** (Parallel subprocess state)
5. **payment-finished** (End state)
6. **payment-terminated** (End state)

With transitions showing:
- Manual triggers (triggerType: 0)
- Automatic triggers (triggerType: 1)
- Timeout triggers (triggerType: 2)

## **🎯 If Everything Works**

You should see:
1. **Rich workflow visualization** with all states and transitions
2. **Enhanced mapping editors** with BBT Workflow IntelliSense
3. **Real-time validation** and syntax highlighting
4. **Professional VS Code integration** with proper theming

The extension is now ready for production workflow development! 🚀
