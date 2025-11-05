import * as vscode from 'vscode';

const FLOW_DEFINITION_SUFFIX = '.json';
const SUBFLOW_DEFINITION_SUFFIX = '-subflow.json';
const WORKFLOW_DEFINITION_SUFFIX = '-workflow.json';
const DIAGRAM_SUFFIX = '.diagram.json';
const WORKFLOWS_SEGMENT = 'workflows';
const WORKFLOWS_CAPITAL_SEGMENT = 'Workflows';
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
  const hasWorkflowsCapitalSegment = segments.includes(WORKFLOWS_CAPITAL_SEGMENT);
  const isFlowDefinition = normalizedPath.endsWith(FLOW_DEFINITION_SUFFIX);
  const isSubflowDefinition = normalizedPath.endsWith(SUBFLOW_DEFINITION_SUFFIX);
  const isWorkflowDefinition = normalizedPath.endsWith(WORKFLOW_DEFINITION_SUFFIX);


  if (!hasJsonSuffix) {
    return false;
  }

  if (isDiagram) {
    return false;
  }

  // Accept JSON files that are either:
  // 1. .flow.json files, OR
  // 2. -subflow.json files, OR
  // 3. -workflow.json files, OR
  // 4. Any .json file in a workflows directory (lowercase), OR
  // 5. Any .json file in a Workflows directory (capital W)
  return isFlowDefinition || isSubflowDefinition || isWorkflowDefinition || hasWorkflowsSegment || hasWorkflowsCapitalSegment;
}

export function isFlowDefinitionUri(uri: vscode.Uri): boolean {
  const normalizedPath = toNormalizedPath(uri);
  return normalizedPath.endsWith(FLOW_DEFINITION_SUFFIX) ||
         normalizedPath.endsWith(SUBFLOW_DEFINITION_SUFFIX) ||
         normalizedPath.endsWith(WORKFLOW_DEFINITION_SUFFIX) ||
         isWorkflowJsonUri(uri);
}

export function getDiagramUri(flowUri: vscode.Uri): vscode.Uri {
  const path = flowUri.path;
  const dir = path.substring(0, path.lastIndexOf('/'));
  const filename = path.substring(path.lastIndexOf('/') + 1);

  let diagramFilename: string;

  if (filename.toLowerCase().endsWith('.flow.json')) {
    diagramFilename = filename.replace(/\.flow\.json$/i, DIAGRAM_SUFFIX);
  } else if (filename.toLowerCase().endsWith('-subflow.json')) {
    diagramFilename = filename.replace(/-subflow\.json$/i, DIAGRAM_SUFFIX);
  } else if (filename.toLowerCase().endsWith('-workflow.json')) {
    diagramFilename = filename.replace(/-workflow\.json$/i, DIAGRAM_SUFFIX);
  } else if (filename.toLowerCase().endsWith('.json')) {
    diagramFilename = filename.replace(/\.json$/i, DIAGRAM_SUFFIX);
  } else {
    diagramFilename = `${filename}${DIAGRAM_SUFFIX}`;
  }

  // Put diagram in .meta subdirectory
  const diagramPath = `${dir}/.meta/${diagramFilename}`;
  return flowUri.with({ path: diagramPath });
}

export const FLOW_FILE_GLOBS = [
  '**/*.flow.json',
  '**/*-subflow.json',
  '**/*-workflow.json',
  '**/workflows/**/*.json',
  '**/Workflows/**/*.json'
];
export const FLOW_AND_DIAGRAM_GLOBS = [
  '**/*.flow.json',
  '**/*-subflow.json',
  '**/*-workflow.json',
  '**/*.diagram.json',
  '**/workflows/**/*.json',
  '**/workflows/**/*.diagram.json',
  '**/Workflows/**/*.json',
  '**/Workflows/**/*.diagram.json'
];
