# Amorphie Flow Studio v1.0.1 - Release Notes

## 🎉 Introducing Amorphie Mapper

We're excited to announce the **Amorphie Mapper** - a powerful visual JSON-to-JSON transformation editor built right into VS Code!

### What is it?

Amorphie Mapper brings BizTalk-style visual mapping to modern JSON transformations. Design complex data mappings using a drag-and-drop interface with schema-aware field discovery and a comprehensive library of transformation functions.

### Key Highlights

#### 🎨 Visual Mapping Interface
- **3-Panel Layout**: Source schema (left) → Canvas (center) → Target schema (right)
- **Drag & Drop**: Connect fields visually, no code required
- **Real-Time Validation**: Type checking and error detection as you build

#### 🧩 40+ Built-in Functoids
Transform your data with powerful functions organized by category:
- **String**: Concat, Replace, Split, Regex, Upper/Lower
- **Math**: Add, Multiply, Round, Min/Max, Power
- **Logic**: And, Or, Equal, GreaterThan, IsNull
- **Collections**: Map, Filter, ForEach, Flatten, Sort
- **Aggregates**: Sum, Count, Average, GroupBy
- **Date/Time**: Format, Parse, AddDays, DateDiff
- **Conversions**: ToString, ToNumber, JSON, Base64

#### 📋 Smart Schema Management
- **Auto-Inference**: Paste example JSON to generate schemas automatically
- **Format Detection**: Recognizes dates, emails, UUIDs, phone numbers
- **Schema Editor**: Add/edit/remove properties on the fly
- **File References**: Link to external JSON Schema files

#### ⚡ Live Testing & Code Generation
- **Execution Preview**: Test transformations with sample data instantly
- **JSONata Output**: Generate executable JSONata expressions
- **C# Preview**: View equivalent C# transformation code
- **Copy & Export**: One-click copy or export to files

### Example: Order → Invoice Transformation

Transform an e-commerce order into an invoice in minutes:

```
Source: order.json (customer, items[], totals)
   ↓ Visual Mapping
Target: invoice.json (billTo, lineItems[], amounts)
```

**Common Mappings:**
- Simple field mapping: `order.customer.name` → `invoice.customerName`
- Array transformation: `order.items[]` → `invoice.lineItems[]` (with mapping)
- Calculations: Sum all `items[].price` → `invoice.subtotal`
- Conditionals: Set payment terms based on customer type
- Date formatting: ISO 8601 → locale-specific format

### Getting Started

#### Create Your First Mapper

1. **Open Command Palette**: `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. **Run Command**: `New Amorphie Mapper`
3. **Select Schemas**: Choose source and target JSON Schema files (or create them from examples)
4. **Start Mapping**: Drag connections from source to target fields

#### Or Right-Click in Explorer

Right-click any folder → `New Amorphie Mapper`

#### Open Existing Mappers

Double-click any `*.mapper.json` file to open in the visual mapper editor.

### File Structure

```
/mappers/
  order-to-invoice.mapper.json          # Mapper definition
  order-to-invoice.mapper.diagram.json  # Layout (auto-generated)
  tests/
    order-to-invoice.basic.json         # Test cases

/schemas/
  order.schema.json                     # Source schema
  invoice.schema.json                   # Target schema
```

### Advanced Features

- **Polymorphic Schemas**: Handle `oneOf`/`anyOf` with discriminators
- **Free-Form Objects**: Extend schemas with custom properties
- **Auto-Layout**: Automatic graph organization with ELK algorithm
- **Mini-Map**: Navigate large mappings easily
- **Undo/Redo**: Full history support
- **Zoom Controls**: Pan, zoom, fit-to-screen

## 🔧 Technical Improvements

### Fixed
- **VS Code Webview Compatibility**: Resolved CSS preload errors in VS Code webviews by configuring Vite with relative paths

### Improved
- **Code Quality**: Fixed all ESLint errors (30 → 0 errors)
- **CI/CD**: GitHub Actions now pass cleanly (lint + build)
- **Build Config**: Optimized webview asset loading for VS Code

## 📚 Documentation

- **[Mapper Specification](./mapper_spec.md)** - Complete feature documentation
- **[Architecture Guide](./docs/mapper/01-architecture.md)** - System design overview
- **[Functoid Library](./docs/mapper/08-functoid-library.md)** - All 40+ functoids documented
- **[Example: Order → Invoice](./docs/mapper/15-example-order-invoice.md)** - Detailed walkthrough

## 🙏 Feedback Welcome!

We'd love to hear your thoughts! Please report issues or suggestions at:
**https://github.com/amorphie/amorphie-flow-studio/issues**

---

**Full Changelog**: [CHANGELOG.md](./CHANGELOG.md)

**Version**: 1.0.1
**Release Date**: January 24, 2025
**VS Code Compatibility**: 1.92.0 and above
