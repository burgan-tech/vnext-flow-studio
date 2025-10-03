import * as vscode from 'vscode';

export interface ReferenceDefinition {
  key: string;
  domain: string;
  version: string;
  flow: string;
  path: string;
  title?: string;
  tags?: string[];
}

export type ReferenceType = 'task' | 'schema' | 'view' | 'function' | 'extension' | 'workflow';

export const REFERENCE_PATTERNS: Record<ReferenceType, string[]> = {
  task: [
    '**/Tasks/**/*.json',
    '**/tasks/**/*.json',
    '**/sys-tasks/**/*.json'
  ],
  schema: [
    '**/Schemas/**/*.json',
    '**/schemas/**/*.json',
    '**/sys-schemas/**/*.json'
  ],
  view: [
    '**/Views/**/*.json',
    '**/views/**/*.json',
    '**/sys-views/**/*.json'
  ],
  function: [
    '**/Functions/**/*.json',
    '**/functions/**/*.json',
    '**/sys-functions/**/*.json'
  ],
  extension: [
    '**/Extensions/**/*.json',
    '**/extensions/**/*.json',
    '**/sys-extensions/**/*.json'
  ],
  workflow: [
    '**/*.flow.json',
    '**/*-subflow.json',
    '**/*-workflow.json',
    '**/workflows/**/*.json',
    '**/Workflows/**/*.json'
  ]
};

const DEFAULT_FLOWS: Record<ReferenceType, string> = {
  task: 'sys-tasks',
  schema: 'sys-schemas',
  view: 'sys-views',
  function: 'sys-functions',
  extension: 'sys-extensions',
  workflow: 'sys-flows'
};

async function readJson<T>(uri: vscode.Uri): Promise<T | null> {
  try {
    const buffer = await vscode.workspace.fs.readFile(uri);
    const text = new TextDecoder().decode(buffer);
    return JSON.parse(text) as T;
  } catch (error) {
    console.warn(`Failed to read definition at ${uri.toString()}:`, error);
    return null;
  }
}

function extractReferenceDefinition(
  raw: any,
  uri: vscode.Uri,
  type: ReferenceType
): ReferenceDefinition | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const key = typeof raw.key === 'string' ? raw.key.trim() : '';
  const domain = typeof raw.domain === 'string' ? raw.domain.trim() : '';
  const version = typeof raw.version === 'string' ? raw.version.trim() : '';
  const flow = typeof raw.flow === 'string' ? raw.flow.trim() : DEFAULT_FLOWS[type];

  if (!key || !domain || !version) {
    return null;
  }

  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((tag: unknown): tag is string => typeof tag === 'string')
        .map((tag: string) => tag.trim())
        .filter(Boolean)
    : undefined;

  // Try different paths for title/metadata
  const metadataTitle =
    typeof raw.metadata?.title === 'string'
      ? raw.metadata.title.trim()
      : typeof raw.attributes?.metadata?.title === 'string'
        ? raw.attributes.metadata.title.trim()
        : typeof raw.attributes?.title === 'string'
          ? raw.attributes.title.trim()
          : typeof raw.title === 'string'
            ? raw.title.trim()
            : undefined;

  // Get workspace folder to create relative path
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  const relativePath = workspaceFolder
    ? vscode.workspace.asRelativePath(uri, false)
    : uri.fsPath;

  return {
    key,
    domain,
    version,
    flow,
    tags,
    title: metadataTitle,
    path: relativePath
  } satisfies ReferenceDefinition;
}

export async function loadReferenceCatalog(type: ReferenceType): Promise<ReferenceDefinition[]> {
  const results: ReferenceDefinition[] = [];
  const seen = new Set<string>();

  const patterns = REFERENCE_PATTERNS[type];
  if (!patterns) {
    console.warn(`Unknown reference type: ${type}`);
    return results;
  }

  for (const pattern of patterns) {
    const uris = await vscode.workspace.findFiles(pattern, '**/{node_modules,.git}/**');

    for (const uri of uris) {
      const key = uri.toString();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const raw = await readJson<any>(uri);
      if (!raw) {
        continue;
      }

      const definition = extractReferenceDefinition(raw, uri, type);
      if (definition) {
        results.push(definition);
      }
    }
  }

  return results.sort((a, b) => {
    const domainCompare = a.domain.localeCompare(b.domain);
    if (domainCompare !== 0) {
      return domainCompare;
    }

    const keyCompare = a.key.localeCompare(b.key);
    if (keyCompare !== 0) {
      return keyCompare;
    }

    return b.version.localeCompare(a.version, 'en', { numeric: true });
  });
}

export async function loadAllCatalogs(): Promise<Record<ReferenceType, ReferenceDefinition[]>> {
  const [tasks, schemas, views, functions, extensions] = await Promise.all([
    loadReferenceCatalog('task'),
    loadReferenceCatalog('schema'),
    loadReferenceCatalog('view'),
    loadReferenceCatalog('function'),
    loadReferenceCatalog('extension')
  ]);

  return {
    task: tasks,
    schema: schemas,
    view: views,
    function: functions,
    extension: extensions,
    workflow: [] // Workflows are loaded on-demand for navigation
  };
}

/**
 * Find a workflow file by its key, domain, version, and flow reference
 */
export async function findWorkflowByReference(
  key: string,
  domain?: string,
  version?: string,
  flow?: string
): Promise<vscode.Uri | null> {
  const workflows = await loadReferenceCatalog('workflow');

  for (const workflow of workflows) {
    const keyMatches = workflow.key === key;
    const domainMatches = !domain || workflow.domain === domain;
    const versionMatches = !version || workflow.version === version;
    const flowMatches = !flow || workflow.flow === flow;

    if (keyMatches && domainMatches && versionMatches && flowMatches) {
      // Convert the path back to a URI
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders) {
        for (const folder of workspaceFolders) {
          const uri = vscode.Uri.joinPath(folder.uri, workflow.path);
          try {
            await vscode.workspace.fs.stat(uri);
            return uri;
          } catch {
            // Try next workspace folder
            continue;
          }
        }
      }
    }
  }

  return null;
}