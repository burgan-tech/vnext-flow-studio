// Build tree structure from JSON Schema (preserves hierarchy)

export function buildSchemaTree(schema, path = '$', name = 'root') {
  if (!schema) return null;

  const node = {
    id: path,
    name: name,
    path: path,
    type: schema.type,
    children: []
  };

  if (schema.type === 'object' && schema.properties) {
    // Object type: add children for each property
    for (const [key, prop] of Object.entries(schema.properties)) {
      const childPath = path === '$' ? `$.${key}` : `${path}.${key}`;
      const child = buildSchemaTree(prop, childPath, key);
      if (child) {
        node.children.push(child);
      }
    }
  } else if (schema.type === 'array' && schema.items) {
    // Array type: add array indicator and recurse into items
    const childPath = `${path}[]`;
    const child = buildSchemaTree(schema.items, childPath, 'items');
    if (child) {
      child.isArrayItem = true;
      node.children.push(child);
    }
  }

  // Mark leaf nodes (nodes with no children = actual data fields)
  node.isLeaf = node.children.length === 0 &&
                node.type !== 'object' &&
                node.type !== 'array';

  return node;
}

// Example output structure:
// {
//   id: '$',
//   name: 'root',
//   type: 'object',
//   children: [
//     {
//       id: '$.orderNumber',
//       name: 'orderNumber',
//       type: 'string',
//       isLeaf: true,
//       children: []
//     },
//     {
//       id: '$.customer',
//       name: 'customer',
//       type: 'object',
//       isLeaf: false,
//       children: [
//         { id: '$.customer.id', name: 'id', type: 'string', isLeaf: true },
//         { id: '$.customer.name', name: 'name', type: 'string', isLeaf: true }
//       ]
//     },
//     {
//       id: '$.items',
//       name: 'items',
//       type: 'array',
//       isLeaf: false,
//       children: [
//         {
//           id: '$.items[]',
//           name: 'items',
//           type: 'object',
//           isArrayItem: true,
//           children: [
//             { id: '$.items[].productId', name: 'productId', type: 'string', isLeaf: true },
//             { id: '$.items[].quantity', name: 'quantity', type: 'number', isLeaf: true },
//             { id: '$.items[].price', name: 'price', type: 'number', isLeaf: true }
//           ]
//         }
//       ]
//     }
//   ]
// }
