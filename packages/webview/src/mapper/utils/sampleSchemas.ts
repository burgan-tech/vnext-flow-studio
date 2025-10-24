import type { JSONSchema } from '../../../../core/src/mapper';

/**
 * Sample schemas for testing and development
 */

export const sampleSourceSchema: JSONSchema = {
  type: 'object',
  properties: {
    orderNumber: { type: 'string', description: 'Unique order identifier' },
    customer: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Customer ID' },
        name: { type: 'string', description: 'Customer full name' },
        email: { type: 'string', format: 'email', description: 'Customer email' }
      },
      required: ['id', 'name']
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Product identifier' },
          quantity: { type: 'integer', description: 'Quantity ordered' },
          price: { type: 'number', description: 'Unit price' }
        },
        required: ['productId', 'quantity', 'price']
      }
    },
    orderDate: { type: 'string', format: 'date-time', description: 'Order timestamp' }
  },
  required: ['orderNumber', 'customer', 'items']
};

export const sampleTargetSchema: JSONSchema = {
  type: 'object',
  properties: {
    invoiceNumber: { type: 'string', description: 'Invoice number' },
    customerId: { type: 'string', description: 'Customer ID' },
    customerName: { type: 'string', description: 'Customer name' },
    lineItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Product ID' },
          qty: { type: 'integer', description: 'Quantity' },
          unitPrice: { type: 'number', description: 'Unit price' },
          lineTotal: { type: 'number', description: 'Line total (qty × unitPrice)' }
        },
        required: ['productId', 'qty', 'unitPrice', 'lineTotal']
      }
    },
    subtotal: { type: 'number', description: 'Subtotal before tax' },
    tax: { type: 'number', description: 'Tax amount' },
    total: { type: 'number', description: 'Total amount' },
    invoiceDate: { type: 'string', format: 'date', description: 'Invoice date' }
  },
  required: ['invoiceNumber', 'customerId', 'lineItems', 'total']
};
