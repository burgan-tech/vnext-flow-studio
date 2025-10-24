# Functoid Library

## Overview

Functoids are visual transformation nodes that represent operations in the mapping pipeline. The library includes **40+ functoids** organized into 7 categories, inspired by BizTalk Mapper but adapted for JSON transformations.

## Functoid Palette

Right-click the canvas or use the toolbox panel to add functoids.

---

## String Functoids 🟦

**Color:** Blue (#3B82F6)

| Functoid | Icon | Inputs | Output | Description | JSONata |
|----------|------|--------|--------|-------------|---------|
| **Concat** | `[&]` | 2+ | string | String concatenation | `a & b & c` |
| **Uppercase** | `[ABC]` | 1 | string | Convert to uppercase | `$uppercase(str)` |
| **Lowercase** | `[abc]` | 1 | string | Convert to lowercase | `$lowercase(str)` |
| **Substring** | `[...]` | 3 | string | Extract substring (str, start, length) | `$substring(str, start, len)` |
| **Replace** | `[A→B]` | 3 | string | Replace pattern (str, search, replace) | `$replace(str, search, replace)` |
| **Trim** | `[" "]` | 1 | string | Remove leading/trailing whitespace | `$trim(str)` |
| **Length** | `[#]` | 1 | number | String length | `$length(str)` |

**Example Use Cases:**

- Concat first + last name: `firstName & ' ' & lastName`
- Normalize emails: `$lowercase($trim(email))`
- Extract area code: `$substring(phone, 0, 3)`

---

## Mathematical Functoids 🟩

**Color:** Green (#10B981)

| Functoid | Icon | Inputs | Output | Description | JSONata |
|----------|------|--------|--------|-------------|---------|
| **Add** | `[+]` | 2+ | number | Addition (variadic) | `a + b + c` |
| **Subtract** | `[-]` | 2 | number | Subtraction | `a - b` |
| **Multiply** | `[×]` | 2+ | number | Multiplication (variadic) | `a * b * c` |
| **Divide** | `[÷]` | 2 | number | Division | `a / b` |
| **Modulo** | `[%]` | 2 | number | Remainder | `a % b` |
| **Round** | `[≈]` | 2 | number | Round to N decimal places | `$round(num, decimals)` |
| **Abs** | `[\|x\|]` | 1 | number | Absolute value | `$abs(num)` |
| **Min** | `[↓]` | 2+ | number | Minimum value | `$min([a, b, c])` |
| **Max** | `[↑]` | 2+ | number | Maximum value | `$max([a, b, c])` |

**Example Use Cases:**

- Calculate line total: `quantity * price`
- Round currency: `$round(amount, 2)`
- Tax calculation: `subtotal * 0.1`

---

## Logical Functoids 🟪

**Color:** Purple (#8B5CF6)

| Functoid | Icon | Inputs | Output | Description | JSONata |
|----------|------|--------|--------|-------------|---------|
| **Equal** | `[=]` | 2 | boolean | Equality check | `a = b` |
| **NotEqual** | `[≠]` | 2 | boolean | Inequality check | `a != b` |
| **GreaterThan** | `[>]` | 2 | boolean | Greater than | `a > b` |
| **LessThan** | `[<]` | 2 | boolean | Less than | `a < b` |
| **GreaterOrEqual** | `[≥]` | 2 | boolean | Greater than or equal | `a >= b` |
| **LessOrEqual** | `[≤]` | 2 | boolean | Less than or equal | `a <= b` |
| **And** | `[∧]` | 2+ | boolean | Logical AND | `a and b and c` |
| **Or** | `[∨]` | 2+ | boolean | Logical OR | `a or b or c` |
| **Not** | `[¬]` | 1 | boolean | Logical NOT | `$not(bool)` |
| **IsNull** | `[?]` | 1 | boolean | Check if null/undefined | `$not($exists(val))` |

**Example Use Cases:**

- Age verification: `age >= 18`
- Null coalescing: `$exists(value) ? value : default`
- Multi-condition: `status = 'active' and balance > 0`

---

## Conditional Functoids 🟧

**Color:** Orange (#F59E0B)

| Functoid | Icon | Inputs | Output | Description | JSONata |
|----------|------|--------|--------|-------------|---------|
| **Conditional** | `[?:]` | 3 | any | If-then-else (test, then, else) | `test ? then : else` |
| **Switch** | `[⎇]` | 2+ | any | Multi-way branch (discriminator + cases) | `disc='A'?1 : disc='B'?2 : 0` |
| **Coalesce** | `[??]` | 2+ | any | Return first non-null value | `$coalesce([a, b, c])` |
| **Default** | `[D]` | 2 | any | Return value or default if null | `$exists(val) ? val : default` |

**Ports:**

- **Conditional:** `test` (boolean), `then` (any), `else` (any)
- **Switch:** `discriminator` (any), `case1`, `case2`, ..., `default`

**Example Use Cases:**

- Status mapping: `code = 200 ? 'success' : 'error'`
- Priority routing: `amount > 10000 ? 'high' : amount > 1000 ? 'medium' : 'low'`
- Null safety: `$coalesce([customer.email, customer.phone, 'no-contact'])`

---

## Conversion Functoids 🟨

**Color:** Yellow (#F59E0B)

| Functoid | Icon | Inputs | Output | Description | JSONata |
|----------|------|--------|--------|-------------|---------|
| **ToString** | `[""]` | 1 | string | Convert to string | `$string(val)` |
| **ToNumber** | `[123]` | 1 | number | Parse number | `$number(val)` |
| **ToBoolean** | `[T/F]` | 1 | boolean | Convert to boolean | `$boolean(val)` |
| **ParseJSON** | `[{}]` | 1 | any | Parse JSON string | `$parseJSON(str)` |
| **Stringify** | `[→""]` | 1 | string | Serialize to JSON string | `$string(obj)` |

**Example Use Cases:**

- Parse string to number: `$number('42')` → `42`
- Serialize object: `$string({ "key": "value" })` → `'{"key":"value"}'`
- Type coercion: `$boolean('true')` → `true`

---

## Collection Functoids 🟥

**Color:** Red (#EF4444)

| Functoid | Icon | Inputs | Output | Description | JSONata |
|----------|------|--------|--------|-------------|---------|
| **ForEach** | `[⟳]` | 2 | array | Map/project over collection | `list.( expr )` |
| **Filter** | `[⊂]` | 2 | array | Filter by predicate | `list[ pred ]` |
| **Sum** | `[Σ]` | 1 | number | Sum array elements | `$sum(list)` |
| **Count** | `[#]` | 1 | number | Count array length | `$count(list)` |
| **Average** | `[μ]` | 1 | number | Average of array | `$average(list)` |
| **GroupBy** | `[∥]` | 2 | object | Group and aggregate | `list{ key: agg }` |
| **Flatten** | `[⊔]` | 1 | array | Flatten nested arrays | `$flatten(list)` |
| **Distinct** | `[∪]` | 1 | array | Unique values | `$distinct(list)` |
| **Sort** | `[↕]` | 2 | array | Sort by field/comparator | `$sort(list, fn)` |

**Example Use Cases:**

- Calculate order total: `$sum(items.(quantity * price))`
- Filter active users: `users[status = 'active']`
- Project fields: `orders.( { id: orderId, total: amount } )`
- Group by category: `products{ category: $sum(price) }`

---

## Object Functoids ⬜

**Color:** Gray (#6B7280)

| Functoid | Icon | Inputs | Output | Description | JSONata |
|----------|------|--------|--------|-------------|---------|
| **InitObject** | `[{}]` | 0+ | object | Create object literal (dynamic properties) | `{ "k": v, ... }` |
| **InitArray** | `[[]]` | 0+ | array | Create array literal | `[ v1, v2, ... ]` |
| **GetProperty** | `[.]` | 2 | any | Access object property (obj, key) | `obj.key` or `obj[key]` |
| **SetProperty** | `[.=]` | 3 | object | Set object property (obj, key, value) | `obj ~> \| $ \| { key: value } \|` |
| **MergeObjects** | `[⊕]` | 2+ | object | Merge objects (variadic) | `$merge([obj1, obj2])` |

**Example Use Cases:**

- Build custom object: `{ "id": orderId, "total": sum }`
- Dynamic property access: `data[fieldName]`
- Merge configs: `$merge([defaults, overrides])`

---

## Advanced Functoids ⬛

**Color:** Dark (#1F2937)

| Functoid | Icon | Inputs | Output | Description | Notes |
|----------|------|--------|--------|-------------|-------|
| **CustomExpression** | `[fx]` | 0+ | any | Manual JSONata expression (textarea editor) | Validation bypass for power users |
| **Lookup** | `[⊷]` | 2 | any | Dictionary/lookup table (key, table) | `table[key]` |
| **Regex** | `[/./]` | 2 | boolean | Regex match (str, pattern) | `$match(str, /pattern/)` |

**Example Use Cases:**

- Lookup table: `statusCodes[code]` → `"OK"`
- Regex validation: `$match(email, /^[\w.]+@[\w.]+$/)`
- Complex expression: Custom JSONata for edge cases

---

## Functoid → MapSpec Node Mapping

| Functoid Category | Functoid Name | MapSpec Node Kind | Notes |
|-------------------|---------------|-------------------|-------|
| String | Concat | `Concat` | Variadic string concatenation |
| String | Uppercase, Lowercase, Trim, etc. | `Call` | name: "uppercase", "lowercase", "trim" |
| Mathematical | Add, Subtract, Multiply, Divide, Modulo | `Binary` | op: "Add", "Sub", "Mul", "Div", "Mod" |
| Mathematical | Round, Abs, Min, Max | `Call` | name: "round", "abs", "min", "max" |
| Logical | Equal, NotEqual, GreaterThan, etc. | `Binary` | op: "Eq", "Ne", "Gt", "Lt", "Ge", "Le" |
| Logical | And, Or | `Binary` | op: "And", "Or" |
| Logical | Not, IsNull | `Call` | name: "not", "exists" |
| Conditional | Conditional | `Conditional` | if/then/else via ports |
| Conditional | Switch | `Switch` | Multi-way branch |
| Conditional | Coalesce, Default | Helper or `Conditional` | Emits `$coalesce` or ternary |
| Conversion | ToString, ToNumber, etc. | `Call` | name: "string", "number", "boolean" |
| Collection | ForEach | `ForEach` | Projection over array |
| Collection | Filter | `Filter` | Predicate-based filtering |
| Collection | Sum, Count, Average | `Aggregate` | op: "sum", "count", "avg" |
| Collection | GroupBy | `GroupBy` | Group + aggregate |
| Collection | Flatten, Distinct, Sort | `Call` | name: "flatten", "distinct", "sort" |
| Object | InitObject | `InitObject` | Object literal |
| Object | InitArray | `InitArray` | Array literal |
| Object | GetProperty, MergeObjects | `Call` | name: "getProperty", "merge" |
| Advanced | CustomExpression, Lookup, Regex | `Call` | Inline JSONata or function call |

## Allow-List (safeops-v1)

The `Call` node's `allowListId: "safeops-v1"` restricts function names to:

**String operations:**
- `uppercase`, `lowercase`, `trim`, `substring`, `replace`, `length`, `pad`, `split`

**Math operations:**
- `round`, `abs`, `floor`, `ceil`, `sqrt`, `power`, `min`, `max`

**Logic operations:**
- `not`, `exists`, `boolean`

**Conversion:**
- `string`, `number`, `parseJSON`

**Collection operations:**
- `map`, `filter`, `reduce`, `flatten`, `distinct`, `sort`, `reverse`, `join`, `sum`, `count`, `average`

**Object operations:**
- `keys`, `values`, `entries`, `merge`, `spread`

**Utility:**
- `lookup`, `match` (regex)

**Disallowed:** `eval`, `exec`, `require`, `import`, `fetch`, filesystem access

---

## Next Steps

- [Functoid Visual Design](./08-functoid-visuals.md) — Colors, icons, animations
- [JSONata Codegen](./09-jsonata-codegen.md) — How functoids become JSONata
- [Complete Example](./14-example-order-invoice.md) — See functoids in action
