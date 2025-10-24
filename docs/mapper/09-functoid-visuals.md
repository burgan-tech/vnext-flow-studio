# Functoid Visual Design

**Status:** Draft
**Last Updated:** 2025-10-22

## Overview

This document defines the visual design system for functoid nodes in the mapper canvas. Consistent, intuitive visuals help users quickly identify functoid types and understand data flow.

## Design Principles

1. **Clarity** - Visual appearance instantly communicates functoid purpose
2. **Consistency** - Similar operations use similar visual patterns
3. **Scalability** - Designs work at different zoom levels
4. **Accessibility** - Color-blind friendly, sufficient contrast
5. **Minimalism** - Clean, uncluttered appearance

## Functoid Categories

Functoids are organized into visual categories:

| Category | Color | Icon Style | Use Case |
|----------|-------|------------|----------|
| **Math** | Amber (#fbbf24) | Mathematical symbols | Arithmetic, calculations |
| **String** | Blue (#3b82f6) | Text symbols | String manipulation |
| **Logical** | Purple (#a855f7) | Logic symbols | Boolean operations |
| **Conditional** | Indigo (#6366f1) | Branch symbols | If/then/else logic |
| **Collection** | Green (#10b981) | Array symbols | Array operations |
| **Aggregate** | Teal (#14b8a6) | Summary symbols | Sum, average, count |
| **Conversion** | Orange (#f97316) | Transform symbols | Type conversions |
| **Date/Time** | Pink (#ec4899) | Clock symbols | Date operations |
| **Custom** | Gray (#6b7280) | Function symbols | User-defined |

## Functoid Structure

Standard functoid node structure:

```
┌─────────────────────┐
│  Icon  Label        │ ← Header (colored by category)
├─────────────────────┤
│ • Input 1           │ ← Input handles (left side)
│ • Input 2           │
├─────────────────────┤
│      Output       • │ ← Output handle (right side)
└─────────────────────┘
```

**Dimensions:**
- Width: 120-160px (auto-sized to content)
- Height: Auto (based on number of inputs)
- Border radius: 8px
- Border: 2px solid (category color)
- Shadow: Subtle drop shadow for depth

## Category Visual Specifications

### Math Functoids

**Color:** Amber (#fbbf24)
**Background:** Light amber (#fef3c7)

| Functoid | Icon | Label | Description |
|----------|------|-------|-------------|
| `Binary.Add` | `+` | Add | Addition |
| `Binary.Subtract` | `−` | Subtract | Subtraction |
| `Binary.Multiply` | `×` | Multiply | Multiplication |
| `Binary.Divide` | `÷` | Divide | Division |
| `Binary.Modulo` | `%` | Modulo | Remainder |
| `Binary.Power` | `^` | Power | Exponentiation |
| `Unary.Abs` | `\|x\|` | Abs | Absolute value |
| `Unary.Ceil` | `⌈x⌉` | Ceil | Ceiling |
| `Unary.Floor` | `⌊x⌋` | Floor | Floor |
| `Unary.Round` | `≈` | Round | Round |
| `Unary.Sqrt` | `√` | Sqrt | Square root |

**CSS:**
```css
.functoid-math {
  background: #fef3c7;
  border-color: #fbbf24;
  color: #92400e;
}

.functoid-math .icon {
  font-size: 24px;
  font-weight: bold;
}
```

### String Functoids

**Color:** Blue (#3b82f6)
**Background:** Light blue (#dbeafe)

| Functoid | Icon | Label | Description |
|----------|------|-------|-------------|
| `String.Concat` | `&` | Concat | Concatenate |
| `String.Uppercase` | `ABC` | Upper | Uppercase |
| `String.Lowercase` | `abc` | Lower | Lowercase |
| `String.Trim` | `⎵⎵` | Trim | Trim whitespace |
| `String.Length` | `#` | Length | String length |
| `String.Substring` | `[…]` | Substr | Substring |
| `String.Replace` | `⤷` | Replace | Replace text |
| `String.Split` | `⊟` | Split | Split string |
| `String.Join` | `⊞` | Join | Join array |

**CSS:**
```css
.functoid-string {
  background: #dbeafe;
  border-color: #3b82f6;
  color: #1e3a8a;
}
```

### Logical Functoids

**Color:** Purple (#a855f7)
**Background:** Light purple (#f3e8ff)

| Functoid | Icon | Label | Description |
|----------|------|-------|-------------|
| `Binary.And` | `∧` | And | Logical AND |
| `Binary.Or` | `∨` | Or | Logical OR |
| `Unary.Not` | `¬` | Not | Logical NOT |
| `Binary.Equal` | `=` | Equal | Equality |
| `Binary.NotEqual` | `≠` | Not Equal | Inequality |
| `Binary.LessThan` | `<` | Less Than | Less than |
| `Binary.GreaterThan` | `>` | Greater | Greater than |
| `Binary.LessThanOrEqual` | `≤` | Less/Eq | Less or equal |
| `Binary.GreaterThanOrEqual` | `≥` | Greater/Eq | Greater or equal |

**CSS:**
```css
.functoid-logical {
  background: #f3e8ff;
  border-color: #a855f7;
  color: #581c87;
}
```

### Conditional Functoids

**Color:** Indigo (#6366f1)
**Background:** Light indigo (#e0e7ff)

| Functoid | Icon | Label | Description |
|----------|------|-------|-------------|
| `Conditional.If` | `?:` | If/Then/Else | Conditional |
| `Conditional.Switch` | `⋮` | Switch | Multi-branch |
| `Conditional.DefaultValue` | `??` | Default | Null coalescing |

**Visual:**
```
┌─────────────────────┐
│  ?:  If/Then/Else   │
├─────────────────────┤
│ • Condition         │
│ • Then              │
│ • Else              │
├─────────────────────┤
│      Output       • │
└─────────────────────┘
```

**CSS:**
```css
.functoid-conditional {
  background: #e0e7ff;
  border-color: #6366f1;
  color: #312e81;
}
```

### Collection Functoids

**Color:** Green (#10b981)
**Background:** Light green (#d1fae5)

| Functoid | Icon | Label | Description |
|----------|------|-------|-------------|
| `Collection.Map` | `[→]` | Map | Transform array |
| `Collection.Filter` | `[?]` | Filter | Filter array |
| `Collection.Count` | `#` | Count | Count items |
| `Collection.Distinct` | `[∪]` | Distinct | Unique items |
| `Collection.Sort` | `[↑]` | Sort | Sort array |
| `Collection.Reverse` | `[↓]` | Reverse | Reverse array |
| `Collection.Flatten` | `[[]]→[]` | Flatten | Flatten nested |

**CSS:**
```css
.functoid-collection {
  background: #d1fae5;
  border-color: #10b981;
  color: #064e3b;
}
```

### Aggregate Functoids

**Color:** Teal (#14b8a6)
**Background:** Light teal (#ccfbf1)

| Functoid | Icon | Label | Description |
|----------|------|-------|-------------|
| `Aggregate.Sum` | `Σ` | Sum | Sum values |
| `Aggregate.Average` | `x̄` | Average | Average |
| `Aggregate.Min` | `↓` | Min | Minimum |
| `Aggregate.Max` | `↑` | Max | Maximum |
| `Aggregate.Count` | `#` | Count | Count items |

**CSS:**
```css
.functoid-aggregate {
  background: #ccfbf1;
  border-color: #14b8a6;
  color: #134e4a;
}
```

### Conversion Functoids

**Color:** Orange (#f97316)
**Background:** Light orange (#ffedd5)

| Functoid | Icon | Label | Description |
|----------|------|-------|-------------|
| `Convert.ToString` | `→"` | ToString | To string |
| `Convert.ToNumber` | `→#` | ToNumber | To number |
| `Convert.ToBoolean` | `→✓` | ToBool | To boolean |
| `Convert.ToDate` | `→📅` | ToDate | To date |
| `Convert.ParseJSON` | `→{}` | Parse | Parse JSON |
| `Convert.StringifyJSON` | `{}→` | Stringify | To JSON string |

**CSS:**
```css
.functoid-conversion {
  background: #ffedd5;
  border-color: #f97316;
  color: #7c2d12;
}
```

### Date/Time Functoids

**Color:** Pink (#ec4899)
**Background:** Light pink (#fce7f3)

| Functoid | Icon | Label | Description |
|----------|------|-------|-------------|
| `DateTime.Now` | `🕐` | Now | Current date/time |
| `DateTime.Format` | `📅` | Format | Format date |
| `DateTime.Parse` | `→📅` | Parse | Parse date |
| `DateTime.AddDays` | `+d` | Add Days | Add days |
| `DateTime.AddMonths` | `+m` | Add Months | Add months |
| `DateTime.Diff` | `Δt` | Diff | Date difference |

**CSS:**
```css
.functoid-datetime {
  background: #fce7f3;
  border-color: #ec4899;
  color: #831843;
}
```

### Custom Functoids

**Color:** Gray (#6b7280)
**Background:** Light gray (#f3f4f6)

| Functoid | Icon | Label | Description |
|----------|------|-------|-------------|
| `Custom.Function` | `ƒ` | Custom | User function |

**CSS:**
```css
.functoid-custom {
  background: #f3f4f6;
  border-color: #6b7280;
  color: #1f2937;
}
```

## Handle Styles

### Input Handles

**Position:** Left side
**Style:** Filled circle
**Size:** 10px diameter
**Color:** Category color (darker shade)

```css
.handle-input {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--category-color-dark);
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
```

### Output Handles

**Position:** Right side
**Style:** Filled circle
**Size:** 10px diameter
**Color:** Category color (darker shade)

```css
.handle-output {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--category-color-dark);
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
```

## State Variants

### Default State

Normal appearance with subtle shadow:

```css
.functoid {
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
```

### Hover State

Elevated shadow and border highlight:

```css
.functoid:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  border-width: 3px;
  transform: translateY(-1px);
  transition: all 0.2s ease;
}
```

### Selected State

Bold border and elevated shadow:

```css
.functoid.selected {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);
  border-color: #3b82f6;
  border-width: 3px;
}
```

### Error State

Red border with error icon:

```css
.functoid.error {
  border-color: #ef4444;
  background: #fee2e2;
}

.functoid.error::after {
  content: '⚠';
  position: absolute;
  top: -8px;
  right: -8px;
  background: #ef4444;
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}
```

### Disabled State

Reduced opacity and grayscale:

```css
.functoid.disabled {
  opacity: 0.5;
  filter: grayscale(0.8);
  pointer-events: none;
}
```

## Size Variants

### Compact View

Minimal view with icon only:

```
┌───────┐
│  ×    │
└───────┘
```

**Dimensions:** 40px × 40px

```css
.functoid.compact {
  width: 40px;
  height: 40px;
  padding: 0;
}

.functoid.compact .label {
  display: none;
}

.functoid.compact .handles {
  display: none;
}
```

### Normal View

Standard view with icon and label:

```
┌─────────────┐
│  ×  Multiply│
├─────────────┤
│ • Input 1   │
│ • Input 2   │
├─────────────┤
│  Output   • │
└─────────────┘
```

**Dimensions:** 120px width, auto height

### Expanded View

Detailed view with descriptions:

```
┌───────────────────────┐
│  ×  Multiply          │
│  Multiply two numbers │
├───────────────────────┤
│ • Left operand        │
│ • Right operand       │
├───────────────────────┤
│  Product            • │
└───────────────────────┘
```

**Dimensions:** 180px width, auto height

```css
.functoid.expanded {
  width: 180px;
}

.functoid.expanded .description {
  display: block;
  font-size: 11px;
  color: #6b7280;
  padding: 4px 8px;
}
```

## Animations

### Connection Animation

Pulse effect when creating connection:

```css
@keyframes connection-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.functoid.connecting .handle {
  animation: connection-pulse 0.5s ease-in-out;
}
```

### Error Shake

Shake animation for validation errors:

```css
@keyframes error-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

.functoid.error {
  animation: error-shake 0.3s ease-in-out;
}
```

### Add Animation

Fade-in and scale when adding new functoid:

```css
@keyframes functoid-add {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.functoid.new {
  animation: functoid-add 0.3s ease-out;
}
```

## Dark Theme

Dark mode variant:

```css
[data-theme="dark"] .functoid-math {
  background: #451a03;
  border-color: #fbbf24;
  color: #fef3c7;
}

[data-theme="dark"] .functoid-string {
  background: #1e3a8a;
  border-color: #3b82f6;
  color: #dbeafe;
}

/* ... similar for other categories */
```

## Accessibility

### Color Blind Friendly

Ensure sufficient contrast and use patterns in addition to colors:

```css
.functoid::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 2px,
    var(--category-color) 2px,
    var(--category-color) 4px
  );
}
```

### Keyboard Navigation

Focus styles for keyboard navigation:

```css
.functoid:focus {
  outline: 3px solid #3b82f6;
  outline-offset: 2px;
}

.functoid:focus-visible {
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5);
}
```

### Screen Reader Support

ARIA labels for screen readers:

```html
<div
  class="functoid functoid-math"
  role="button"
  aria-label="Multiply functoid with 2 inputs and 1 output"
  tabindex="0"
>
  <div class="header">
    <span class="icon" aria-hidden="true">×</span>
    <span class="label">Multiply</span>
  </div>
  <div class="inputs">
    <div class="handle handle-input" aria-label="Input 1">Input 1</div>
    <div class="handle handle-input" aria-label="Input 2">Input 2</div>
  </div>
  <div class="outputs">
    <div class="handle handle-output" aria-label="Output">Output</div>
  </div>
</div>
```

## Complete CSS Example

```css
/* Base functoid styles */
.functoid {
  position: relative;
  border-radius: 8px;
  border-width: 2px;
  border-style: solid;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 14px;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
}

.functoid .header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  font-weight: 600;
  gap: 8px;
}

.functoid .icon {
  font-size: 20px;
  line-height: 1;
}

.functoid .label {
  flex: 1;
}

.functoid .inputs,
.functoid .outputs {
  padding: 4px 12px;
}

.functoid .handle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
}

/* Category-specific styles */
.functoid-math { background: #fef3c7; border-color: #fbbf24; color: #92400e; }
.functoid-string { background: #dbeafe; border-color: #3b82f6; color: #1e3a8a; }
.functoid-logical { background: #f3e8ff; border-color: #a855f7; color: #581c87; }
.functoid-conditional { background: #e0e7ff; border-color: #6366f1; color: #312e81; }
.functoid-collection { background: #d1fae5; border-color: #10b981; color: #064e3b; }
.functoid-aggregate { background: #ccfbf1; border-color: #14b8a6; color: #134e4a; }
.functoid-conversion { background: #ffedd5; border-color: #f97316; color: #7c2d12; }
.functoid-datetime { background: #fce7f3; border-color: #ec4899; color: #831843; }
.functoid-custom { background: #f3f4f6; border-color: #6b7280; color: #1f2937; }

/* State variants */
.functoid:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  border-width: 3px;
  transform: translateY(-1px);
}

.functoid.selected {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);
  border-color: #3b82f6;
  border-width: 3px;
}

.functoid.error {
  border-color: #ef4444;
  background: #fee2e2;
}
```

## React Component Example

```typescript
import React from 'react';
import { Handle, Position } from '@xyflow/react';

interface FunctoidNodeProps {
  data: {
    kind: NodeKind;
    label: string;
    icon: string;
    category: string;
    inputs: string[];
    output: string;
  };
  selected: boolean;
}

export function FunctoidNode({ data, selected }: FunctoidNodeProps) {
  const categoryClass = `functoid-${data.category}`;

  return (
    <div className={`functoid ${categoryClass} ${selected ? 'selected' : ''}`}>
      <div className="header">
        <span className="icon">{data.icon}</span>
        <span className="label">{data.label}</span>
      </div>

      <div className="inputs">
        {data.inputs.map((input, i) => (
          <div key={i} className="handle-wrapper">
            <Handle
              type="target"
              position={Position.Left}
              id={`input-${i + 1}`}
              className="handle handle-input"
            />
            <span>{input}</span>
          </div>
        ))}
      </div>

      <div className="outputs">
        <div className="handle-wrapper">
          <span>{data.output}</span>
          <Handle
            type="source"
            position={Position.Right}
            id="output"
            className="handle handle-output"
          />
        </div>
      </div>
    </div>
  );
}
```

## See Also

- [Canvas Architecture](./02-canvas-architecture.md) - Node structure
- [MapSpec Schema](./04-mapspec-schema.md) - Node kinds
- [GraphLayout Schema](./05-graphlayout-schema.md) - Node styling
- [React Flow Docs](https://reactflow.dev/) - Custom nodes
