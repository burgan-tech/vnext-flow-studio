# Complete Example: Order to Invoice Mapping

## Scenario

Transform an order with line items into an invoice with calculated totals (subtotal, tax, grand total).

**Business Rules:**

- Copy order metadata (order number, customer info)
- Transform `items[]` into `lineItems[]` with calculated line totals
- Calculate subtotal by summing all line totals
- Calculate 10% tax on subtotal
- Calculate grand total (subtotal + tax)

## Source Schema

**File:** `schemas/order.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Order",
  "type": "object",
  "required": ["orderNumber", "customer", "items"],
  "properties": {
    "orderNumber": {
      "type": "string",
      "description": "Unique order identifier"
    },
    "customer": {
      "type": "object",
      "required": ["name", "id"],
      "properties": {
        "name": { "type": "string" },
        "id": { "type": "string" }
      }
    },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["productId", "quantity", "price"],
        "properties": {
          "productId": { "type": "string" },
          "quantity": { "type": "number" },
          "price": { "type": "number" }
        }
      }
    }
  }
}
```

## Target Schema

**File:** `schemas/invoice.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Invoice",
  "type": "object",
  "required": ["invoiceNumber", "customerId", "customerName", "lineItems", "subtotal", "tax", "total"],
  "properties": {
    "invoiceNumber": { "type": "string" },
    "customerId": { "type": "string" },
    "customerName": { "type": "string" },
    "lineItems": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["productId", "qty", "unitPrice", "lineTotal"],
        "properties": {
          "productId": { "type": "string" },
          "qty": { "type": "number" },
          "unitPrice": { "type": "number" },
          "lineTotal": { "type": "number" }
        }
      }
    },
    "subtotal": { "type": "number" },
    "tax": { "type": "number" },
    "total": { "type": "number" }
  }
}
```

## Visual Mapping Canvas

```
SOURCE                   CANVAS                           TARGET
─────────────────────────────────────────────────────────────────
orderNumber ──────────────────────────────────────────► invoiceNumber
customer.id ──────────────────────────────────────────► customerId
customer.name ────────────────────────────────────────► customerName

items[] ──┬──► [ForEach] ──┬───────────────────────────► lineItems[]
          │      [⟳]       ├─► productId ───────────────► .productId
          │                ├─► quantity ─────────────────► .qty
          │                ├─► price ────────────────────► .unitPrice
          │                │
          │                └─► quantity ──┐
          │                              ├──► [Multiply] ─► .lineTotal
          │                   price ─────┘       [×]
          │
          └──► [Sum] ──────────────────────────────────► subtotal
                [Σ]
                 │
                 ├──────────┬──► [Multiply] ───────────► tax
                 │          │        [×]
                 │      [Const]
                 │       0.1
                 │
                 └──────────┬──► [Add] ─────────────────► total
                            │      [+]
                            │
                   tax ─────┘
```

## User Workflow

### Step 1: Create Mapper

```bash
# Command Palette (Ctrl+Shift+P)
> Amorphie Mapper: Create New Mapper

# Prompts:
Source Schema: [Browse...] → schemas/order.schema.json
Target Schema: [Browse...] → schemas/invoice.schema.json
Mapper Name: order-to-invoice

# Creates:
# - mappers/order-to-invoice.mapper.json
# - mappers/order-to-invoice.mapper.diagram.json
```

### Step 2: Direct Field Mappings

**Action:** Drag `orderNumber` from source tree → `invoiceNumber` in target tree

**Result:** Direct 1:1 mapping created (no functoid needed)

**Repeat for:**
- `customer.id` → `customerId`
- `customer.name` → `customerName`

### Step 3: Transform Line Items

**Action:** Drag `items[]` to canvas

**Result:** Creates `ForEach` functoid node

**Configuration:**
- ForEach node properties: `listPath: "$.items[]"`
- Input port connected to source `items[]`

**Sub-mappings within ForEach:**

1. Drag `items[].productId` → `lineItems[].productId` (direct)
2. Drag `items[].quantity` → `lineItems[].qty` (direct)
3. Drag `items[].price` → `lineItems[].unitPrice` (direct)
4. Calculate line total:
   - Right-click canvas → Add Functoid → Mathematical → Multiply
   - Connect `items[].quantity` → Multiply input 1
   - Connect `items[].price` → Multiply input 2
   - Connect Multiply output → `lineItems[].lineTotal`

### Step 4: Calculate Subtotal

**Action:** Right-click canvas → Add Functoid → Collection → Sum

**Configuration:**
- Connect source `items[]` to Sum functoid
- In Sum properties, set expression: `quantity * price` (operates on each item)
- Connect Sum output → `subtotal`

### Step 5: Calculate Tax

**Actions:**

1. Right-click canvas → Add Functoid → Advanced → Const
   - Set value: `0.1` (10% tax rate)
2. Right-click canvas → Add Functoid → Mathematical → Multiply
3. Connect `subtotal` (from Sum functoid) → Multiply input 1
4. Connect Const(0.1) → Multiply input 2
5. Connect Multiply output → `tax`

### Step 6: Calculate Total

**Actions:**

1. Right-click canvas → Add Functoid → Mathematical → Add
2. Connect `subtotal` → Add input 1
3. Connect `tax` (from Multiply functoid) → Add input 2
4. Connect Add output → `total`

### Step 7: Add Test Case

**Action:** Click bottom panel → Tests tab → + Add Test

**Test Configuration:**

```json
{
  "name": "Basic order with 2 items",
  "input": {
    "orderNumber": "ORD-001",
    "customer": {
      "name": "Acme Corp",
      "id": "CUST-123"
    },
    "items": [
      { "productId": "PROD-A", "quantity": 2, "price": 10.0 },
      { "productId": "PROD-B", "quantity": 1, "price": 25.0 }
    ]
  },
  "expect": {
    "invoiceNumber": "ORD-001",
    "customerId": "CUST-123",
    "customerName": "Acme Corp",
    "lineItems": [
      { "productId": "PROD-A", "qty": 2, "unitPrice": 10.0, "lineTotal": 20.0 },
      { "productId": "PROD-B", "qty": 1, "unitPrice": 25.0, "lineTotal": 25.0 }
    ],
    "subtotal": 45.0,
    "tax": 4.5,
    "total": 49.5
  }
}
```

### Step 8: Run Test

**Action:** Click ▶ Run All button

**Result:**

```
✅ Basic order with 2 items  PASS  12ms
```

**Console Output:**

```
✅ 14:23:50 [Tests] All 1 tests passed (12ms)
```

### Step 9: Export JSONata

**Action:** Click 📤 Export JSONata button

**Generated Files:**

1. `dist/order-to-invoice.mapping-table.json`
2. `dist/order-to-invoice.whole-object.jsonata`

## Generated MapSpec

**File:** `mappers/order-to-invoice.mapper.json` (simplified)

```json
{
  "id": "order-to-invoice",
  "version": "1.0.0",
  "engine": "jsonata",
  "inputSchemaRef": "./schemas/order.schema.json",
  "outputSchemaRef": "./schemas/invoice.schema.json",
  "tests": [
    {
      "name": "Basic order with 2 items",
      "input": { "orderNumber": "ORD-001", "customer": {...}, "items": [...] },
      "expect": { "invoiceNumber": "ORD-001", ... }
    }
  ],
  "nodes": [
    {
      "id": "n1",
      "kind": "SourceField",
      "data": { "jsonPath": "$.orderNumber" },
      "in": [],
      "out": ["p1"]
    },
    {
      "id": "n2",
      "kind": "TargetField",
      "data": { "jsonPath": "$.invoiceNumber" },
      "in": ["p1"],
      "out": []
    },
    {
      "id": "n3",
      "kind": "ForEach",
      "data": { "listPath": "$.items[]" },
      "in": ["p2"],
      "out": ["p3"]
    },
    {
      "id": "n4",
      "kind": "Binary",
      "data": { "op": "Mul" },
      "in": ["p4", "p5"],
      "out": ["p6"]
    },
    {
      "id": "n5",
      "kind": "Aggregate",
      "data": { "op": "sum" },
      "in": ["p7"],
      "out": ["p8"]
    },
    {
      "id": "n6",
      "kind": "Const",
      "data": { "value": 0.1 },
      "in": [],
      "out": ["p9"]
    },
    {
      "id": "n7",
      "kind": "Binary",
      "data": { "op": "Mul" },
      "in": ["p8", "p9"],
      "out": ["p10"]
    },
    {
      "id": "n8",
      "kind": "Binary",
      "data": { "op": "Add" },
      "in": ["p8", "p10"],
      "out": ["p11"]
    }
  ],
  "edges": [
    { "from": "n1", "fromPort": "p1", "to": "n2", "toPort": "p1" },
    { "from": "source", "fromPort": "items", "to": "n3", "toPort": "p2" },
    { "from": "n3", "fromPort": "quantity", "to": "n4", "toPort": "p4" },
    { "from": "n3", "fromPort": "price", "to": "n4", "toPort": "p5" },
    { "from": "n4", "fromPort": "p6", "to": "target", "toPort": "lineTotal" },
    { "from": "source", "fromPort": "items", "to": "n5", "toPort": "p7" },
    { "from": "n5", "fromPort": "p8", "to": "target", "toPort": "subtotal" },
    { "from": "n5", "fromPort": "p8", "to": "n7", "toPort": "p8" },
    { "from": "n6", "fromPort": "p9", "to": "n7", "toPort": "p9" },
    { "from": "n7", "fromPort": "p10", "to": "target", "toPort": "tax" },
    { "from": "n5", "fromPort": "p8", "to": "n8", "toPort": "p8" },
    { "from": "n7", "fromPort": "p10", "to": "n8", "toPort": "p10" },
    { "from": "n8", "fromPort": "p11", "to": "target", "toPort": "total" }
  ]
}
```

## Generated JSONata

### Mapping Table (Field-by-Field)

**File:** `dist/order-to-invoice.mapping-table.json`

```json
{
  "$.invoiceNumber": "orderNumber",
  "$.customerId": "customer.id",
  "$.customerName": "customer.name",
  "$.lineItems": "items.{ 'productId': productId, 'qty': quantity, 'unitPrice': price, 'lineTotal': quantity * price }",
  "$.subtotal": "$sum(items.(quantity * price))",
  "$.tax": "$sum(items.(quantity * price)) * 0.1",
  "$.total": "$sum(items.(quantity * price)) * 1.1"
}
```

### Whole-Object Expression

**File:** `dist/order-to-invoice.whole-object.jsonata`

```jsonata
{
  "invoiceNumber": orderNumber,
  "customerId": customer.id,
  "customerName": customer.name,
  "lineItems": items.{
    "productId": productId,
    "qty": quantity,
    "unitPrice": price,
    "lineTotal": quantity * price
  },
  "subtotal": $sum(items.(quantity * price)),
  "tax": $sum(items.(quantity * price)) * 0.1,
  "total": $sum(items.(quantity * price)) * 1.1
}
```

## Test Execution

### Running the Test

**Preview Tab → Input:**

```json
{
  "orderNumber": "ORD-001",
  "customer": { "name": "Acme Corp", "id": "CUST-123" },
  "items": [
    { "productId": "PROD-A", "quantity": 2, "price": 10.0 },
    { "productId": "PROD-B", "quantity": 1, "price": 25.0 }
  ]
}
```

**Preview Tab → Output:**

```json
{
  "invoiceNumber": "ORD-001",
  "customerId": "CUST-123",
  "customerName": "Acme Corp",
  "lineItems": [
    { "productId": "PROD-A", "qty": 2, "unitPrice": 10.0, "lineTotal": 20.0 },
    { "productId": "PROD-B", "qty": 1, "unitPrice": 25.0, "lineTotal": 25.0 }
  ],
  "subtotal": 45.0,
  "tax": 4.5,
  "total": 49.5
}
```

**Test Result:** ✅ PASS

## Integration with Workflow

### Reference Mapper from ServiceTask

**File:** `flows/order-processing.flow.json`

```json
{
  "tasks": [
    {
      "id": "receive-order",
      "type": "Initial",
      "name": "Receive Order"
    },
    {
      "id": "transform-to-invoice",
      "type": "ServiceTask",
      "name": "Transform to Invoice",
      "properties": {
        "mapperRef": "./mappers/order-to-invoice.mapper.json",
        "executionMode": "mapping-table"
      }
    },
    {
      "id": "send-invoice",
      "type": "ServiceTask",
      "name": "Send Invoice"
    }
  ]
}
```

### Runtime Execution

1. Workflow engine reaches `transform-to-invoice` task
2. Loads `order-to-invoice.mapper.json`
3. Loads generated `order-to-invoice.mapping-table.json`
4. Executes JSONata transformations on workflow context data
5. Validates output against `invoice.schema.json`
6. Continues to next task

## Summary

This example demonstrates:

- ✅ Direct field mappings (1:1)
- ✅ Collection transformation (ForEach)
- ✅ Mathematical operations (Multiply, Add)
- ✅ Aggregations (Sum)
- ✅ Constants (0.1 tax rate)
- ✅ Test-driven development
- ✅ JSONata code generation
- ✅ Workflow integration

**Time to Complete:** ~5 minutes (vs. ~30 minutes writing JSONata by hand)

## Next Steps

- [Functoid Library](./07-functoid-library.md) — Explore all available functoids
- [JSONata Codegen](./09-jsonata-codegen.md) — Understand code generation
- [Implementation Plan](./16-implementation-plan.md) — Build this feature
