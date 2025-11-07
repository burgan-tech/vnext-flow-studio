# Development Tasks

This file tracks ongoing development tasks, known issues, and planned improvements for the Amorphie Flow Studio extension.

## Current Session (2025-11-07)

### Completed ✅
- [x] Created popup dialog for new mapper creation
  - Replaced top-bar input prompts with centered popup form
  - Single dialog with name, description, and "Open in Editor" checkbox
  - Real-time validation and error handling
  - Direct file creation without additional save dialog
- [x] Fixed panel management for mapper editor
  - Properly handles panel reuse when VS Code provides existing panels
  - Cleans up stale panel mappings
  - Added debug logging for troubleshooting
- [x] Documented VS Code preview mode limitation
  - Added code comments explaining the behavior
  - Documented in CHANGELOG with workarounds

### Completed ✅ (Current Session)
- [x] Fixed critical workflow editor caching issue
  - **Issue**: Editor showed stale cached content even after closing and reopening
  - **Root Cause**: `VSCodeModelIntegration` cache returned stale models without reloading from disk
  - **Solution**: Force `model.load()` after getting model from cache to refresh from disk
  - **Impact**: Models stay cached for cross-model queries but always show fresh content in editor
  - Files: `ModelBridge.ts` (lines 252-262), `extension.ts` (external change detection)

### In Progress 🚧
None currently

## Pending Tasks 📋

### High Priority
None currently

### Medium Priority
- [ ] Consider removing verbose debug logging
  - Debug logs added for cache investigation: `[ModelBridge] File content loaded from disk`, mismatch detection
  - These are helpful for troubleshooting but could be reduced for production
  - Consider keeping key logs and removing verbose ones

### Low Priority
- [ ] Improve VS Code preview mode handling
  - Investigate if we can programmatically disable preview mode for mapper files
  - Consider adding a notification on first use suggesting to disable preview mode
  - Add to extension README/docs

## Known Issues 🐛

### Documented
- **VS Code Preview Mode**: Single-clicking mapper files opens them in preview mode, causing tabs to be replaced
  - Workaround: Double-click files or disable preview mode globally
  - Documented in CHANGELOG and code comments
  - Not a bug in our extension - VS Code default behavior

### Under Investigation
None currently

## Future Enhancements 💡

### Mapper Editor
- [ ] Add "New Mapper" button directly in mapper editor toolbar
- [ ] Support templates for common mapping patterns
- [ ] Add recent mappers list in command palette

### General
- [ ] Add telemetry/analytics (opt-in) to understand feature usage
- [ ] Improve error messages with actionable suggestions
- [ ] Add keyboard shortcuts for common operations

## Technical Debt 🔧

- [ ] Refactor mapper editor provider for better separation of concerns
- [ ] Consider splitting large files (MapperEditorProvider.ts is quite large)
- [ ] Add unit tests for mapper creation logic
- [ ] Add integration tests for panel management

## Notes 📝

### Session Notes
- VS Code's `CustomTextEditorProvider` reuses panels when files are opened in preview mode
- Setting `retainContextWhenHidden: false` helps but doesn't fully solve preview mode issue
- Panel disposal happens when a preview tab is replaced by another file
- **Cache Architecture**: Core's `VSCodeModelIntegration` maintains a model cache for cross-model queries (subflows, references)
  - Cache is intentional and should NOT be cleared
  - Solution: Force `model.load()` after getting cached model to refresh from disk
  - This preserves cache benefits while ensuring fresh content in editor

### Decisions Made
- Decided to document preview mode as "Known Issue" rather than trying to work around it
- Chose to create file directly without save dialog for better UX
- Added file existence check to prevent accidental overwrites

---

**Last Updated:** 2025-11-07
**Session:** New Mapper Dialog Implementation + Workflow Caching Fix
