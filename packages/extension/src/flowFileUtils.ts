import * as vscode from 'vscode';

const FLOW_DEFINITION_SUFFIX = '.flow.json';
const DIAGRAM_SUFFIX = '.diagram.json';
const WORKFLOWS_SEGMENT = 'workflows';
const JSON_SUFFIX = '.json';

function toNormalizedPath(uri: vscode.Uri): string {
  return uri.path.toLowerCase();
}

function pathSegments(uri: vscode.Uri): string[] {
  return uri.path
    .toLowerCase()
    .split('/')
    .filter(Boolean);
}

export function isDiagramFile(uri: vscode.Uri): boolean {
  return toNormalizedPath(uri).endsWith(DIAGRAM_SUFFIX);
}

export function isWorkflowJsonUri(uri: vscode.Uri): boolean {
  const normalizedPath = toNormalizedPath(uri);
  const segments = pathSegments(uri);
  const hasJsonSuffix = normalizedPath.endsWith(JSON_SUFFIX);
  const isDiagram = isDiagramFile(uri);
  const hasWorkflowsSegment = segments.includes(WORKFLOWS_SEGMENT);
  const isFlowDefinition = normalizedPath.endsWith(FLOW_DEFINITION_SUFFIX);

  console.log('isWorkflowJsonUri check:', {
    path: uri.path,
    normalizedPath,
    segments,
    hasJsonSuffix,
    isDiagram,
    hasWorkflowsSegment,
    isFlowDefinition,
    result: hasJsonSuffix && !isDiagram && (isFlowDefinition || hasWorkflowsSegment)
  });

  if (!hasJsonSuffix) {
    return false;
  }

  if (isDiagram) {
    return false;
  }

  // Accept all JSON files that are either:
  // 1. .flow.json files, OR
  // 2. Any .json file in a workflows directory, OR
  // 3. Any .json file (for broader compatibility)
  return isFlowDefinition || hasWorkflowsSegment || true; // Allow all JSON files
}

export function isFlowDefinitionUri(uri: vscode.Uri): boolean {
  return toNormalizedPath(uri).endsWith(FLOW_DEFINITION_SUFFIX) || isWorkflowJsonUri(uri);
}

export function getDiagramUri(flowUri: vscode.Uri): vscode.Uri {
  const path = flowUri.path;

  if (path.toLowerCase().endsWith(FLOW_DEFINITION_SUFFIX)) {
    return flowUri.with({ path: path.replace(/\.flow\.json$/i, DIAGRAM_SUFFIX) });
  }

  if (path.toLowerCase().endsWith(JSON_SUFFIX)) {
    return flowUri.with({ path: path.replace(/\.json$/i, DIAGRAM_SUFFIX) });
  }

  return flowUri.with({ path: `${path}${DIAGRAM_SUFFIX}` });
}

export const FLOW_FILE_GLOBS = ['**/*.flow.json', '**/workflows/**/*.json', '**/*.json'];
export const FLOW_AND_DIAGRAM_GLOBS = [
  '**/*.flow.json',
  '**/*.diagram.json',
  '**/workflows/**/*.json',
  '**/workflows/**/*.diagram.json',
  '**/*.json'
];
