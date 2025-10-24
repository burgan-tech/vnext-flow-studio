# Amorphie Mapper — JSON-to-JSON Transformation Editor

> **Visual, schema-aware mapper for building JSON transformations with BizTalk-style interface**

## Overview

Amorphie Mapper is a VS Code extension feature within Amorphie Flow Studio that provides a visual canvas for authoring JSON-to-JSON transformations. Using a React Flow-based interface with functoid nodes, developers can create complex data mappings without writing code.

**Key Features:**

- 🎨 **Visual mapping:** BizTalk-style 3-panel interface (source, canvas, target)
- 📋 **Schema-aware:** Automatic field discovery from JSON Schema
- 🧩 **Functoid library:** 40+ transformation functions (string, math, logic, collections)
- ⚡ **JSONata output:** Generates executable JSONata expressions
- ✅ **Built-in testing:** Run tests in webview with JSON diff
- 🔄 **Workflow integration:** Reference mappers from ServiceTask nodes

## 🎯 Working Prototypes

**Two working prototypes validate different canvas architectures!**

- **[Prototype V1 (Proxy Nodes)](./00-prototype.md)** — Separate trees + proxy nodes on canvas
- **[Prototype V2 (Schema Nodes)](./14-prototype-comparison.md)** — Schemas as React Flow nodes with terminals
- **[Detailed Comparison](./14-prototype-comparison.md)** — V1 vs V2 architectural trade-offs

**Quick Start:**
- V1: `cd prototype/mapper && npm install && npm run dev` → http://localhost:3000
- V2: `cd prototype/mapper-v2 && npm install && npm run dev` → http://localhost:3001

## Documentation Structure

### 📖 Core Concepts

- **[Architecture](./01-architecture.md)** — High-level system design, workspace packages
- **[Canvas Architecture](./02-canvas-architecture.md)** — React Flow scope: what's a node and what's not
- **[File Conventions](./03-file-conventions.md)** — File types, naming, project structure

### 📐 Data Models

- **[MapSpec Schema](./04-mapspec-schema.md)** — Domain model (nodes, edges, tests)
- **[GraphLayout Schema](./05-graphlayout-schema.md)** — UI layout model (positions, viewport)
- **[Schema Flattening](./06-schema-flattening.md)** — JSON Schema → terminals

### 🎨 User Interface

- **[Visual Interface Design](./07-ui-design.md)** — 3-panel layout, interaction patterns
- **[Functoid Library](./08-functoid-library.md)** — Complete catalog of 40+ functoids
- **[Functoid Visual Design](./09-functoid-visuals.md)** — Colors, icons, animations

### ⚙️ Code Generation

- **[JSONata Codegen](./10-jsonata-codegen.md)** — Mapping table vs whole-object expressions
- **[Lowering Rules](./11-lowering-rules.md)** — AST → JSONata transformation rules

### 🧪 Testing & Validation

- **[Validation Rules](./12-validation.md)** — Save validation, type checking
- **[Test Runner](./13-test-runner.md)** — In-webview test execution

### 🔒 Security

- **[Security & Limits](./14-security.md)** — Allow-lists, sandboxing, size limits

### 📝 Examples & Prototypes

- **[Prototype Comparison](./14-prototype-comparison.md)** — V1 (Proxy Nodes) vs V2 (Schema Nodes)
- **[Complete Example](./15-example-order-invoice.md)** — Order → Invoice transformation walkthrough

### 🚀 Implementation

- **[Integration Guide](./16-integration.md)** — How to integrate with existing packages
- **[Implementation Plan](./17-implementation-plan.md)** — 8-week phased roadmap
- **[Risk Assessment](./18-risk-assessment.md)** — Architectural decisions, mitigation

### 🗺️ Future

- **[Roadmap](./19-roadmap.md)** — Post-MVP features

## Quick Start

### Creating a New Mapper

```bash
# Command Palette (Ctrl+Shift+P)
> Amorphie Mapper: Create New Mapper

# Select source and target JSON Schema files
# Opens visual mapper canvas
```

### File Structure

```
/mappers/
  orders-to-shop-totals.mapper.json         # MapSpec (domain model)
  orders-to-shop-totals.mapper.diagram.json # GraphLayout (UI only)
  tests/
    orders-to-shop-totals.basic.json        # Test cases
/schemas/
  order.schema.json                         # Source schema
  shop-totals.schema.json                   # Target schema
```

### VS Code Commands

| Command | Description |
|---------|-------------|
| `mapper.open` | Open mapper editor for *.mapper.json file |
| `mapper.runTests` | Execute test suite and show results |
| `mapper.exportJsonata` | Generate JSONata artifacts to /dist/ |
| `mapper.validate` | Run static validation checks |
| `mapper.createNew` | Scaffold new mapper from schema pair |
| `mapper.autoLayout` | Apply ELK layout algorithm |
| `mapper.autoMap` | Auto-map fields by name similarity |

## Acceptance Criteria (MVP)

- [ ] Open a `*.mapper.json` and render React Flow graph with schema trees
- [ ] Drag source → target to create basic mappings
- [ ] Author transforms using functoid nodes (Concat, Conditional, ForEach, Aggregate, GroupBy)
- [ ] Collections/scopes work: `items[]` → `lines[]` projection and totals
- [ ] Generate mapping table and whole-object JSONata; export to files
- [ ] Run tests in webview; show results & diff; all pass on sample project
- [ ] MapSpec and GraphLayout save independently; layout edits never change MapSpec

## Contributing

See [Implementation Plan](./16-implementation-plan.md) for development roadmap.

## License

MIT — Part of Amorphie Flow Studio

---

**Status:** 📝 Specification Phase
**Version:** 1.0.0
**Last Updated:** 2025-10-22
