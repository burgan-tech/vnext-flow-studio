// TypeScript types for Amorphie Mapper
// Based on specification: docs/mapper/04-mapspec-schema.md

/**
 * JSON Schema type reference
 */
export interface JSONSchema {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: any[];
  const?: any;
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  additionalProperties?: boolean | JSONSchema;
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  allOf?: JSONSchema[];
  if?: JSONSchema;
  then?: JSONSchema;
  else?: JSONSchema;
}

/**
 * Schema overlays - JSON Schema conditionals that extend base schemas
 * Stored in mapper file, does not modify original schemas
 * Uses standard JSON Schema if/then pattern for conditional extensions
 */
export interface SchemaOverlays {
  source?: SchemaOverlay[];
  target?: SchemaOverlay[];
}

/**
 * Schema overlay - A conditional schema extension
 * Applied when condition matches (e.g., type === 6)
 */
export interface SchemaOverlay extends JSONSchema {
  $id: string; // Unique overlay identifier (e.g., "mapper://overlay/http-task-headers")
  if: JSONSchema; // Condition to match
  then: JSONSchema; // Schema to apply when condition matches
  metadata?: OverlayMetadata; // Optional metadata for UI
}

/**
 * Overlay metadata for UI purposes
 */
export interface OverlayMetadata {
  createdAt?: string;
  description?: string;
  targetPath?: string; // Human-readable path this overlay targets (e.g., "$.attributes.config.[type=6] HTTP Task.headers")
  schemaPath?: string; // Schema path where overlay should be applied (e.g., "$.attributes")
}

/**
 * MapSpec - Semantic data model for a mapper
 */
export interface MapSpec {
  version: string;
  metadata: MapperMetadata;
  schemas: SchemaReferences;
  schemaOverlays?: SchemaOverlays;
  nodes: MapSpecNode[];
  edges: Edge[];
  tests?: TestCase[];
}

/**
 * Mapper metadata
 */
export interface MapperMetadata {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  tags?: string[];
  source: string;
  target: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Schema references
 */
export interface SchemaReferences {
  source: string; // Schema reference: 'none' (not set), 'custom' (embedded), or file path (referenced)
  target: string; // Schema reference: 'none' (not set), 'custom' (embedded), or file path (referenced)
  sourceSchema?: JSONSchema; // Embedded source schema (when custom or loaded from file)
  targetSchema?: JSONSchema; // Embedded target schema (when custom or loaded from file)
}

/**
 * Node kinds - all functoid types
 */
export type NodeKind =
  // Binary operations
  | 'Binary.Add'
  | 'Binary.Subtract'
  | 'Binary.Multiply'
  | 'Binary.Divide'
  | 'Binary.Modulo'
  | 'Binary.Power'
  | 'Binary.Equal'
  | 'Binary.NotEqual'
  | 'Binary.LessThan'
  | 'Binary.LessThanOrEqual'
  | 'Binary.GreaterThan'
  | 'Binary.GreaterThanOrEqual'
  | 'Binary.And'
  | 'Binary.Or'
  // Unary operations
  | 'Unary.Negate'
  | 'Unary.Not'
  | 'Unary.Abs'
  | 'Unary.Ceil'
  | 'Unary.Floor'
  | 'Unary.Round'
  | 'Unary.Sqrt'
  // String operations
  | 'String.Concat'
  | 'String.Uppercase'
  | 'String.Lowercase'
  | 'String.Trim'
  | 'String.Length'
  | 'String.Substring'
  | 'String.Replace'
  | 'String.Split'
  | 'String.Join'
  | 'String.Template'
  // Conditional operations
  | 'Conditional.If'
  | 'Conditional.Switch'
  | 'Conditional.DefaultValue'
  // Collection operations
  | 'Collection.Map'
  | 'Collection.Filter'
  | 'Collection.Count'
  | 'Collection.Distinct'
  | 'Collection.Sort'
  | 'Collection.Reverse'
  | 'Collection.Flatten'
  // Aggregate operations
  | 'Aggregate.Sum'
  | 'Aggregate.Average'
  | 'Aggregate.Min'
  | 'Aggregate.Max'
  | 'Aggregate.Count'
  // Conversion operations
  | 'Convert.ToString'
  | 'Convert.ToNumber'
  | 'Convert.ToBoolean'
  | 'Convert.ToInteger'
  | 'Convert.ToArray'
  | 'Convert.ToDate'
  | 'Convert.ParseJSON'
  | 'Convert.StringifyJSON'
  // Date/Time operations
  | 'DateTime.Now'
  | 'DateTime.Format'
  | 'DateTime.Parse'
  | 'DateTime.AddDays'
  | 'DateTime.AddMonths'
  | 'DateTime.Diff'
  // Constant and Custom
  | 'Const.Value'
  | 'Custom.Function';

/**
 * Functoid category
 */
export type FunctoidCategory =
  | 'math'
  | 'string'
  | 'logical'
  | 'conditional'
  | 'collection'
  | 'aggregate'
  | 'conversion'
  | 'datetime'
  | 'custom';

/**
 * MapSpec node (functoid)
 * Note: Schema nodes (source-schema, target-schema) are implicit
 */
export interface MapSpecNode {
  id: string;
  kind: NodeKind;
  config: NodeConfig;
}

/**
 * Node configuration (varies by kind)
 */
export type NodeConfig = Record<string, any>;

/**
 * Edge (connection between nodes or terminals)
 */
export interface Edge {
  id: string;
  source: string; // Node ID or terminal ID (JSONPath)
  sourceHandle: string; // Handle ID
  target: string; // Node ID or terminal ID (JSONPath)
  targetHandle: string; // Handle ID
}

/**
 * Test case
 */
export interface TestCase {
  name: string;
  input: any;
  expected: any;
}

/**
 * GraphLayout - Visual presentation layer
 */
export interface GraphLayout {
  version: string;
  mapperFile: string; // Relative path to MapSpec file
  viewport: Viewport;
  nodes: NodeLayout[];
  metadata?: LayoutMetadata;
}

/**
 * Viewport state
 */
export interface Viewport {
  x: number; // Pan X offset
  y: number; // Pan Y offset
  zoom: number; // Zoom level (0.1 to 2.0)
}

/**
 * Node layout (visual properties)
 */
export interface NodeLayout {
  id: string; // Must match node ID in MapSpec
  position: Position;
  dimensions?: Dimensions;
  style?: NodeStyle;
  ui?: NodeUIState;
}

/**
 * Position on canvas
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Node dimensions
 */
export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Node visual style
 */
export interface NodeStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  opacity?: number;
  zIndex?: number;
}

/**
 * UI-specific state
 */
export interface NodeUIState {
  collapsed?: boolean; // Tree expansion state
  collapsedPaths?: string[]; // JSONPath expressions for collapsed branches
  selected?: boolean; // Selection state
  highlighted?: boolean; // Highlight state
  hidden?: boolean; // Visibility toggle
  minimized?: boolean; // Minimized view
  scrollTop?: number; // Scroll position
  scrollLeft?: number; // Scroll position
}

/**
 * Layout metadata
 */
export interface LayoutMetadata {
  layoutAlgorithm?: 'manual' | 'dagre' | 'elk' | 'auto';
  gridSnap?: boolean;
  gridSize?: number;
  theme?: 'light' | 'dark';
  miniMapVisible?: boolean;
  controlsVisible?: boolean;
}

/**
 * Terminal - Connection point on schema node
 */
export interface Terminal {
  id: string; // JSONPath (e.g., "$.items[].quantity")
  name: string; // Field name (e.g., "quantity")
  type: string; // JSON Schema type (e.g., "number")
  path: string; // Full path (same as id)
  optional: boolean; // Is field optional?
  description?: string; // Field description from schema
  format?: string; // JSON Schema format (e.g., "date-time")
}

/**
 * Tree node (for hierarchical schema display)
 */
export interface TreeNode {
  id: string; // JSONPath (may include synthetic notation like [type=1])
  name: string; // Field name
  path: string; // JSONPath (may include synthetic notation like [type=1])
  realPath?: string; // Actual JSONPath without synthetic notation (for conditional branches)
  type?: string; // JSON Schema type
  children: TreeNode[]; // Child nodes
  isLeaf: boolean; // True if no children and not object/array
  isArrayItem?: boolean; // True if this is array items node
  isUserAdded?: boolean; // True if this property was added by user (not from schema)
  description?: string; // Field description
  format?: string; // JSON Schema format
}

/**
 * Functoid definition (from registry)
 */
export interface FunctoidDefinition {
  kind: NodeKind;
  label: string; // Display label
  icon: string; // Icon character or emoji
  category: FunctoidCategory;
  inputs: string[]; // Input labels
  output: string; // Output label
  description?: string;
  inputTypes?: string[]; // Expected input types
  outputType?: string; // Output type
}

/**
 * Validation result
 */
export interface ValidationResult {
  level: 'success' | 'error' | 'warning' | 'info';
  errors: ValidationError[];
}

/**
 * Validation error
 */
export interface ValidationError {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  location?: ValidationLocation;
  details?: Record<string, any>;
  suggestion?: string;
}

/**
 * Validation location
 */
export interface ValidationLocation {
  node?: string;
  edge?: string;
  targetField?: string;
  test?: string;
  graph?: boolean;
}

/**
 * Test result
 */
export interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'error';
  duration: number; // Milliseconds
  error?: string;
  diff?: Diff[];
  actual?: any;
  expected?: any;
}

/**
 * Diff entry
 */
export interface Diff {
  type: 'added' | 'removed' | 'changed' | 'unchanged';
  path: string;
  oldValue?: any;
  newValue?: any;
}

/**
 * Schema inference options
 */
export interface SchemaInferenceOptions {
  detectFormats?: boolean; // Detect date, email, UUID, etc.
  allRequired?: boolean; // Mark all present fields as required
  addConstraints?: boolean; // Add min/max length, items constraints
  strictTypes?: boolean; // Distinguish integer vs number
}

/**
 * Inferred schema with metadata
 */
export interface InferredSchema {
  schema: JSONSchema;
  confidence: number; // 0.0 to 1.0
  warnings: string[];
  examples: number; // Number of examples used
}
