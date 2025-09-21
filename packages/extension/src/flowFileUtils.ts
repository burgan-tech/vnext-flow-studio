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
  if (!toNormalizedPath(uri).endsWith(JSON_SUFFIX)) {
    return false;
  }

  if (isDiagramFile(uri)) {
    return false;
  }

  return pathSegments(uri).includes(WORKFLOWS_SEGMENT);
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

export const FLOW_FILE_GLOBS = ['**/*.flow.json', '**/workflows/**/*.json'];
export const FLOW_AND_DIAGRAM_GLOBS = [
  '**/*.flow.json',
  '**/*.diagram.json',
  '**/workflows/**/*.json',
  '**/workflows/**/*.diagram.json'
];
