/**
 * Functoid Registry - Definitions for all functoid types
 * Based on specification: docs/mapper/09-functoid-visuals.md
 */

import type { NodeKind, FunctoidDefinition, FunctoidCategory } from './types';

/**
 * Complete functoid registry
 * Maps NodeKind to FunctoidDefinition with labels, icons, and metadata
 */
export const functoidRegistry: Record<NodeKind, FunctoidDefinition> = {
  // ========================================
  // MATH FUNCTOIDS (Amber)
  // ========================================
  'Binary.Add': {
    kind: 'Binary.Add',
    label: 'Add',
    icon: '+',
    category: 'math',
    inputs: ['Left', 'Right'],
    output: 'Sum',
    description: 'Add two numbers',
    inputTypes: ['number', 'number'],
    outputType: 'number'
  },
  'Binary.Subtract': {
    kind: 'Binary.Subtract',
    label: 'Subtract',
    icon: '−',
    category: 'math',
    inputs: ['Left', 'Right'],
    output: 'Difference',
    description: 'Subtract right from left',
    inputTypes: ['number', 'number'],
    outputType: 'number'
  },
  'Binary.Multiply': {
    kind: 'Binary.Multiply',
    label: 'Multiply',
    icon: '×',
    category: 'math',
    inputs: ['Left', 'Right'],
    output: 'Product',
    description: 'Multiply two numbers',
    inputTypes: ['number', 'number'],
    outputType: 'number'
  },
  'Binary.Divide': {
    kind: 'Binary.Divide',
    label: 'Divide',
    icon: '÷',
    category: 'math',
    inputs: ['Left', 'Right'],
    output: 'Quotient',
    description: 'Divide left by right',
    inputTypes: ['number', 'number'],
    outputType: 'number'
  },
  'Binary.Modulo': {
    kind: 'Binary.Modulo',
    label: 'Modulo',
    icon: '%',
    category: 'math',
    inputs: ['Left', 'Right'],
    output: 'Remainder',
    description: 'Get remainder after division',
    inputTypes: ['number', 'number'],
    outputType: 'number'
  },
  'Binary.Power': {
    kind: 'Binary.Power',
    label: 'Power',
    icon: '^',
    category: 'math',
    inputs: ['Base', 'Exponent'],
    output: 'Result',
    description: 'Raise base to exponent',
    inputTypes: ['number', 'number'],
    outputType: 'number'
  },
  'Unary.Abs': {
    kind: 'Unary.Abs',
    label: 'Abs',
    icon: '|x|',
    category: 'math',
    inputs: ['Value'],
    output: 'Result',
    description: 'Absolute value',
    inputTypes: ['number'],
    outputType: 'number'
  },
  'Unary.Ceil': {
    kind: 'Unary.Ceil',
    label: 'Ceil',
    icon: '⌈x⌉',
    category: 'math',
    inputs: ['Value'],
    output: 'Result',
    description: 'Round up to nearest integer',
    inputTypes: ['number'],
    outputType: 'integer'
  },
  'Unary.Floor': {
    kind: 'Unary.Floor',
    label: 'Floor',
    icon: '⌊x⌋',
    category: 'math',
    inputs: ['Value'],
    output: 'Result',
    description: 'Round down to nearest integer',
    inputTypes: ['number'],
    outputType: 'integer'
  },
  'Unary.Round': {
    kind: 'Unary.Round',
    label: 'Round',
    icon: '≈',
    category: 'math',
    inputs: ['Value'],
    output: 'Result',
    description: 'Round to nearest integer',
    inputTypes: ['number'],
    outputType: 'integer'
  },
  'Unary.Sqrt': {
    kind: 'Unary.Sqrt',
    label: 'Sqrt',
    icon: '√',
    category: 'math',
    inputs: ['Value'],
    output: 'Result',
    description: 'Square root',
    inputTypes: ['number'],
    outputType: 'number'
  },
  'Unary.Negate': {
    kind: 'Unary.Negate',
    label: 'Negate',
    icon: '−x',
    category: 'math',
    inputs: ['Value'],
    output: 'Result',
    description: 'Negate number',
    inputTypes: ['number'],
    outputType: 'number'
  },

  // ========================================
  // STRING FUNCTOIDS (Blue)
  // ========================================
  'String.Concat': {
    kind: 'String.Concat',
    label: 'Concat',
    icon: '&',
    category: 'string',
    inputs: ['String 1', 'String 2'],
    output: 'Result',
    description: 'Concatenate strings',
    inputTypes: ['string', 'string'],
    outputType: 'string'
  },
  'String.Uppercase': {
    kind: 'String.Uppercase',
    label: 'Upper',
    icon: 'ABC',
    category: 'string',
    inputs: ['String'],
    output: 'Result',
    description: 'Convert to uppercase',
    inputTypes: ['string'],
    outputType: 'string'
  },
  'String.Lowercase': {
    kind: 'String.Lowercase',
    label: 'Lower',
    icon: 'abc',
    category: 'string',
    inputs: ['String'],
    output: 'Result',
    description: 'Convert to lowercase',
    inputTypes: ['string'],
    outputType: 'string'
  },
  'String.Trim': {
    kind: 'String.Trim',
    label: 'Trim',
    icon: '⎵⎵',
    category: 'string',
    inputs: ['String'],
    output: 'Result',
    description: 'Remove leading/trailing whitespace',
    inputTypes: ['string'],
    outputType: 'string'
  },
  'String.Length': {
    kind: 'String.Length',
    label: 'Length',
    icon: '#',
    category: 'string',
    inputs: ['String'],
    output: 'Length',
    description: 'Get string length',
    inputTypes: ['string'],
    outputType: 'integer'
  },
  'String.Substring': {
    kind: 'String.Substring',
    label: 'Substr',
    icon: '[…]',
    category: 'string',
    inputs: ['String', 'Start', 'Length'],
    output: 'Result',
    description: 'Extract substring',
    inputTypes: ['string', 'integer', 'integer'],
    outputType: 'string'
  },
  'String.Replace': {
    kind: 'String.Replace',
    label: 'Replace',
    icon: '⤷',
    category: 'string',
    inputs: ['String', 'Search', 'Replace'],
    output: 'Result',
    description: 'Replace text',
    inputTypes: ['string', 'string', 'string'],
    outputType: 'string'
  },
  'String.Split': {
    kind: 'String.Split',
    label: 'Split',
    icon: '⊟',
    category: 'string',
    inputs: ['String', 'Separator'],
    output: 'Array',
    description: 'Split string into array',
    inputTypes: ['string', 'string'],
    outputType: 'array'
  },
  'String.Join': {
    kind: 'String.Join',
    label: 'Join',
    icon: '⊞',
    category: 'string',
    inputs: ['Array', 'Separator'],
    output: 'String',
    description: 'Join array elements',
    inputTypes: ['array', 'string'],
    outputType: 'string'
  },
  'String.UrlTemplate': {
    kind: 'String.UrlTemplate',
    label: 'URL Template',
    icon: '🔗',
    category: 'string',
    inputs: [], // Dynamic inputs based on template config
    output: 'URL',
    description: 'Build URL from template with named parameters',
    inputTypes: [],
    outputType: 'string'
  },

  // ========================================
  // LOGICAL FUNCTOIDS (Purple)
  // ========================================
  'Binary.And': {
    kind: 'Binary.And',
    label: 'And',
    icon: '∧',
    category: 'logical',
    inputs: ['Left', 'Right'],
    output: 'Result',
    description: 'Logical AND',
    inputTypes: ['boolean', 'boolean'],
    outputType: 'boolean'
  },
  'Binary.Or': {
    kind: 'Binary.Or',
    label: 'Or',
    icon: '∨',
    category: 'logical',
    inputs: ['Left', 'Right'],
    output: 'Result',
    description: 'Logical OR',
    inputTypes: ['boolean', 'boolean'],
    outputType: 'boolean'
  },
  'Unary.Not': {
    kind: 'Unary.Not',
    label: 'Not',
    icon: '¬',
    category: 'logical',
    inputs: ['Value'],
    output: 'Result',
    description: 'Logical NOT',
    inputTypes: ['boolean'],
    outputType: 'boolean'
  },
  'Binary.Equal': {
    kind: 'Binary.Equal',
    label: 'Equal',
    icon: '=',
    category: 'logical',
    inputs: ['Left', 'Right'],
    output: 'Result',
    description: 'Check equality',
    inputTypes: ['any', 'any'],
    outputType: 'boolean'
  },
  'Binary.NotEqual': {
    kind: 'Binary.NotEqual',
    label: 'Not Equal',
    icon: '≠',
    category: 'logical',
    inputs: ['Left', 'Right'],
    output: 'Result',
    description: 'Check inequality',
    inputTypes: ['any', 'any'],
    outputType: 'boolean'
  },
  'Binary.LessThan': {
    kind: 'Binary.LessThan',
    label: 'Less Than',
    icon: '<',
    category: 'logical',
    inputs: ['Left', 'Right'],
    output: 'Result',
    description: 'Check if less than',
    inputTypes: ['number', 'number'],
    outputType: 'boolean'
  },
  'Binary.LessThanOrEqual': {
    kind: 'Binary.LessThanOrEqual',
    label: 'Less/Eq',
    icon: '≤',
    category: 'logical',
    inputs: ['Left', 'Right'],
    output: 'Result',
    description: 'Check if less than or equal',
    inputTypes: ['number', 'number'],
    outputType: 'boolean'
  },
  'Binary.GreaterThan': {
    kind: 'Binary.GreaterThan',
    label: 'Greater',
    icon: '>',
    category: 'logical',
    inputs: ['Left', 'Right'],
    output: 'Result',
    description: 'Check if greater than',
    inputTypes: ['number', 'number'],
    outputType: 'boolean'
  },
  'Binary.GreaterThanOrEqual': {
    kind: 'Binary.GreaterThanOrEqual',
    label: 'Greater/Eq',
    icon: '≥',
    category: 'logical',
    inputs: ['Left', 'Right'],
    output: 'Result',
    description: 'Check if greater than or equal',
    inputTypes: ['number', 'number'],
    outputType: 'boolean'
  },

  // ========================================
  // CONDITIONAL FUNCTOIDS (Indigo)
  // ========================================
  'Conditional.If': {
    kind: 'Conditional.If',
    label: 'If/Then/Else',
    icon: '?:',
    category: 'conditional',
    inputs: ['Condition', 'Then', 'Else'],
    output: 'Result',
    description: 'Conditional expression',
    inputTypes: ['boolean', 'any', 'any'],
    outputType: 'any'
  },
  'Conditional.Switch': {
    kind: 'Conditional.Switch',
    label: 'Switch',
    icon: '⋮',
    category: 'conditional',
    inputs: ['Value', 'Cases'],
    output: 'Result',
    description: 'Multi-branch conditional',
    inputTypes: ['any', 'any'],
    outputType: 'any'
  },
  'Conditional.DefaultValue': {
    kind: 'Conditional.DefaultValue',
    label: 'Default',
    icon: '??',
    category: 'conditional',
    inputs: ['Value', 'Default'],
    output: 'Result',
    description: 'Provide default value if null',
    inputTypes: ['any', 'any'],
    outputType: 'any'
  },

  // ========================================
  // COLLECTION FUNCTOIDS (Green)
  // ========================================
  'Collection.Map': {
    kind: 'Collection.Map',
    label: 'Map',
    icon: '[→]',
    category: 'collection',
    inputs: ['Array', 'Transform'],
    output: 'Result',
    description: 'Transform array elements',
    inputTypes: ['array', 'function'],
    outputType: 'array'
  },
  'Collection.Filter': {
    kind: 'Collection.Filter',
    label: 'Filter',
    icon: '[?]',
    category: 'collection',
    inputs: ['Array', 'Predicate'],
    output: 'Result',
    description: 'Filter array elements',
    inputTypes: ['array', 'function'],
    outputType: 'array'
  },
  'Collection.Count': {
    kind: 'Collection.Count',
    label: 'Count',
    icon: '#',
    category: 'collection',
    inputs: ['Array'],
    output: 'Count',
    description: 'Count array elements',
    inputTypes: ['array'],
    outputType: 'integer'
  },
  'Collection.Distinct': {
    kind: 'Collection.Distinct',
    label: 'Distinct',
    icon: '[∪]',
    category: 'collection',
    inputs: ['Array'],
    output: 'Result',
    description: 'Get unique elements',
    inputTypes: ['array'],
    outputType: 'array'
  },
  'Collection.Sort': {
    kind: 'Collection.Sort',
    label: 'Sort',
    icon: '[↑]',
    category: 'collection',
    inputs: ['Array', 'Key'],
    output: 'Result',
    description: 'Sort array',
    inputTypes: ['array', 'string'],
    outputType: 'array'
  },
  'Collection.Reverse': {
    kind: 'Collection.Reverse',
    label: 'Reverse',
    icon: '[↓]',
    category: 'collection',
    inputs: ['Array'],
    output: 'Result',
    description: 'Reverse array',
    inputTypes: ['array'],
    outputType: 'array'
  },
  'Collection.Flatten': {
    kind: 'Collection.Flatten',
    label: 'Flatten',
    icon: '[[]]→[]',
    category: 'collection',
    inputs: ['Array'],
    output: 'Result',
    description: 'Flatten nested arrays',
    inputTypes: ['array'],
    outputType: 'array'
  },

  // ========================================
  // AGGREGATE FUNCTOIDS (Teal)
  // ========================================
  'Aggregate.Sum': {
    kind: 'Aggregate.Sum',
    label: 'Sum',
    icon: 'Σ',
    category: 'aggregate',
    inputs: ['Array'],
    output: 'Sum',
    description: 'Sum array values',
    inputTypes: ['array'],
    outputType: 'number'
  },
  'Aggregate.Average': {
    kind: 'Aggregate.Average',
    label: 'Average',
    icon: 'x̄',
    category: 'aggregate',
    inputs: ['Array'],
    output: 'Average',
    description: 'Average of array values',
    inputTypes: ['array'],
    outputType: 'number'
  },
  'Aggregate.Min': {
    kind: 'Aggregate.Min',
    label: 'Min',
    icon: '↓',
    category: 'aggregate',
    inputs: ['Array'],
    output: 'Minimum',
    description: 'Minimum value',
    inputTypes: ['array'],
    outputType: 'number'
  },
  'Aggregate.Max': {
    kind: 'Aggregate.Max',
    label: 'Max',
    icon: '↑',
    category: 'aggregate',
    inputs: ['Array'],
    output: 'Maximum',
    description: 'Maximum value',
    inputTypes: ['array'],
    outputType: 'number'
  },
  'Aggregate.Count': {
    kind: 'Aggregate.Count',
    label: 'Count',
    icon: '#',
    category: 'aggregate',
    inputs: ['Array'],
    output: 'Count',
    description: 'Count elements',
    inputTypes: ['array'],
    outputType: 'integer'
  },

  // ========================================
  // CONVERSION FUNCTOIDS (Orange)
  // ========================================
  'Convert.ToString': {
    kind: 'Convert.ToString',
    label: 'ToString',
    icon: '→"',
    category: 'conversion',
    inputs: ['Value'],
    output: 'String',
    description: 'Convert to string',
    inputTypes: ['any'],
    outputType: 'string'
  },
  'Convert.ToNumber': {
    kind: 'Convert.ToNumber',
    label: 'ToNumber',
    icon: '→#',
    category: 'conversion',
    inputs: ['Value'],
    output: 'Number',
    description: 'Convert to number',
    inputTypes: ['any'],
    outputType: 'number'
  },
  'Convert.ToBoolean': {
    kind: 'Convert.ToBoolean',
    label: 'ToBool',
    icon: '→✓',
    category: 'conversion',
    inputs: ['Value'],
    output: 'Boolean',
    description: 'Convert to boolean',
    inputTypes: ['any'],
    outputType: 'boolean'
  },
  'Convert.ToInteger': {
    kind: 'Convert.ToInteger',
    label: 'ToInt',
    icon: '→#',
    category: 'conversion',
    inputs: ['Value'],
    output: 'Integer',
    description: 'Convert to integer',
    inputTypes: ['any'],
    outputType: 'integer'
  },
  'Convert.ToArray': {
    kind: 'Convert.ToArray',
    label: 'ToArray',
    icon: '→[]',
    category: 'conversion',
    inputs: ['Value'],
    output: 'Array',
    description: 'Convert to array',
    inputTypes: ['any'],
    outputType: 'array'
  },
  'Convert.ToDate': {
    kind: 'Convert.ToDate',
    label: 'ToDate',
    icon: '→📅',
    category: 'conversion',
    inputs: ['Value'],
    output: 'Date',
    description: 'Convert to date',
    inputTypes: ['string'],
    outputType: 'string'
  },
  'Convert.ParseJSON': {
    kind: 'Convert.ParseJSON',
    label: 'Parse',
    icon: '→{}',
    category: 'conversion',
    inputs: ['String'],
    output: 'Object',
    description: 'Parse JSON string',
    inputTypes: ['string'],
    outputType: 'object'
  },
  'Convert.StringifyJSON': {
    kind: 'Convert.StringifyJSON',
    label: 'Stringify',
    icon: '{}→',
    category: 'conversion',
    inputs: ['Value'],
    output: 'String',
    description: 'Convert to JSON string',
    inputTypes: ['any'],
    outputType: 'string'
  },

  // ========================================
  // DATE/TIME FUNCTOIDS (Pink)
  // ========================================
  'DateTime.Now': {
    kind: 'DateTime.Now',
    label: 'Now',
    icon: '🕐',
    category: 'datetime',
    inputs: [],
    output: 'DateTime',
    description: 'Current date/time',
    inputTypes: [],
    outputType: 'string'
  },
  'DateTime.Format': {
    kind: 'DateTime.Format',
    label: 'Format',
    icon: '📅',
    category: 'datetime',
    inputs: ['Date', 'Format'],
    output: 'String',
    description: 'Format date',
    inputTypes: ['string', 'string'],
    outputType: 'string'
  },
  'DateTime.Parse': {
    kind: 'DateTime.Parse',
    label: 'Parse',
    icon: '→📅',
    category: 'datetime',
    inputs: ['String'],
    output: 'Date',
    description: 'Parse date string',
    inputTypes: ['string'],
    outputType: 'string'
  },
  'DateTime.AddDays': {
    kind: 'DateTime.AddDays',
    label: 'Add Days',
    icon: '+d',
    category: 'datetime',
    inputs: ['Date', 'Days'],
    output: 'Date',
    description: 'Add days to date',
    inputTypes: ['string', 'integer'],
    outputType: 'string'
  },
  'DateTime.AddMonths': {
    kind: 'DateTime.AddMonths',
    label: 'Add Months',
    icon: '+m',
    category: 'datetime',
    inputs: ['Date', 'Months'],
    output: 'Date',
    description: 'Add months to date',
    inputTypes: ['string', 'integer'],
    outputType: 'string'
  },
  'DateTime.Diff': {
    kind: 'DateTime.Diff',
    label: 'Diff',
    icon: 'Δt',
    category: 'datetime',
    inputs: ['Start', 'End'],
    output: 'Duration',
    description: 'Date difference',
    inputTypes: ['string', 'string'],
    outputType: 'number'
  },

  // ========================================
  // CUSTOM FUNCTOIDS (Gray)
  // ========================================
  'Const.Value': {
    kind: 'Const.Value',
    label: 'Const',
    icon: '123',
    category: 'custom',
    inputs: [],
    output: 'Value',
    description: 'Constant value',
    inputTypes: [],
    outputType: 'any'
  },
  'Custom.Function': {
    kind: 'Custom.Function',
    label: 'Custom',
    icon: 'ƒ',
    category: 'custom',
    inputs: ['Args'],
    output: 'Result',
    description: 'User-defined function',
    inputTypes: ['any'],
    outputType: 'any'
  }
};

/**
 * Get functoid definition by kind
 */
export function getFunctoidDefinition(kind: NodeKind): FunctoidDefinition | undefined {
  return functoidRegistry[kind];
}

/**
 * Get all functoids for a category
 */
export function getFunctoidsByCategory(category: FunctoidCategory): FunctoidDefinition[] {
  return Object.values(functoidRegistry).filter(def => def.category === category);
}

/**
 * Get all categories
 */
export function getCategories(): FunctoidCategory[] {
  return ['math', 'string', 'logical', 'conditional', 'collection', 'aggregate', 'conversion', 'datetime', 'custom'];
}

/**
 * Search functoids by name or description
 */
export function searchFunctoids(query: string): FunctoidDefinition[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(functoidRegistry).filter(def =>
    def.label.toLowerCase().includes(lowerQuery) ||
    def.description?.toLowerCase().includes(lowerQuery)
  );
}
