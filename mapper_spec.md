# Amorphie Mapper — Specification

> **📖 This specification has been organized into separate documents for better navigation and maintainability.**

## Quick Links

**Primary Documentation:** [docs/mapper/README.md](./docs/mapper/README.md)

**Key Documents:**

- [Architecture](./docs/mapper/01-architecture.md) — System design and workspace packages
- [UI Design](./docs/mapper/06-ui-design.md) — Visual interface and interaction patterns
- [Functoid Library](./docs/mapper/07-functoid-library.md) — Complete catalog of 40+ functoids
- [Complete Example](./docs/mapper/14-example-order-invoice.md) — Order → Invoice walkthrough

## Overview

Amorphie Mapper is a BizTalk-style JSON-to-JSON transformation editor for VS Code. It provides a visual canvas with functoid nodes for building complex data mappings without writing code.

**Key Features:**

- 🎨 Visual 3-panel interface (source, canvas, target)
- 📋 Schema-aware field discovery from JSON Schema
- 🧩 40+ functoids (string, math, logic, collections)
- ⚡ Generates executable JSONata expressions
- ✅ Built-in testing with JSON diff
- 🔄 Workflow integration via ServiceTask references

## Documentation Structure

### Core Concepts
1. [Architecture](./docs/mapper/01-architecture.md)
2. [File Conventions](./docs/mapper/02-file-conventions.md)

### Data Models
3. [MapSpec Schema](./docs/mapper/03-mapspec-schema.md)
4. [GraphLayout Schema](./docs/mapper/04-graphlayout-schema.md)
5. [Schema Flattening](./docs/mapper/05-schema-flattening.md)

### User Interface
6. [Visual Interface Design](./docs/mapper/06-ui-design.md)
7. [Functoid Library](./docs/mapper/07-functoid-library.md)
8. [Functoid Visual Design](./docs/mapper/08-functoid-visuals.md)

### Code Generation
9. [JSONata Codegen](./docs/mapper/09-jsonata-codegen.md)
10. [Lowering Rules](./docs/mapper/10-lowering-rules.md)

### Testing & Validation
11. [Validation Rules](./docs/mapper/11-validation.md)
12. [Test Runner](./docs/mapper/12-test-runner.md)

### Security
13. [Security & Limits](./docs/mapper/13-security.md)

### Examples
14. [Complete Example: Order → Invoice](./docs/mapper/14-example-order-invoice.md)

### Implementation
15. [Integration Guide](./docs/mapper/15-integration.md)
16. [Implementation Plan](./docs/mapper/16-implementation-plan.md)
17. [Risk Assessment](./docs/mapper/17-risk-assessment.md)

### Future
18. [Roadmap](./docs/mapper/18-roadmap.md)

## Quick Start

```bash
# Open Command Palette (Ctrl+Shift+P)
> Amorphie Mapper: Create New Mapper

# Select schemas and start mapping visually
```

## Status

📝 **Specification Phase** — Version 1.0.0 — Last Updated: 2025-10-22

---

**Note:** The original monolithic spec has been reorganized into the `/docs/mapper/` directory. Each section is now a separate markdown file for easier navigation, maintenance, and collaboration.

See [docs/mapper/README.md](./docs/mapper/README.md) to get started.
