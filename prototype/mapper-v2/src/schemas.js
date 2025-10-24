// Sample schemas for prototype

export const sourceSchema = {
  type: 'object',
  properties: {
    orderNumber: { type: 'string' },
    customer: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' }
      }
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          quantity: { type: 'number' },
          price: { type: 'number' }
        }
      }
    }
  }
};

export const targetSchema = {
  type: 'object',
  properties: {
    invoiceNumber: { type: 'string' },
    customerId: { type: 'string' },
    customerName: { type: 'string' },
    lineItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          qty: { type: 'number' },
          unitPrice: { type: 'number' },
          lineTotal: { type: 'number' }
        }
      }
    },
    subtotal: { type: 'number' },
    tax: { type: 'number' },
    total: { type: 'number' }
  }
};

// Flatten schema to terminals (simplified for prototype)
export function flattenSchema(schema, path = '$', result = []) {
  if (schema.type === 'object' && schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      const newPath = `${path}.${key}`;
      if (prop.type === 'object') {
        flattenSchema(prop, newPath, result);
      } else if (prop.type === 'array') {
        flattenSchema(prop.items, `${newPath}[]`, result);
      } else {
        result.push({
          id: newPath,
          name: key,
          path: newPath,
          type: prop.type
        });
      }
    }
  }
  return result;
}
