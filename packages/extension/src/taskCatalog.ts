import * as vscode from 'vscode';
import type { TaskDefinition } from '@nextcredit/core';

export const TASK_FILE_GLOBS = [
  '**/Tasks/**/*.json',
  '**/tasks/**/*.json',
  '**/sys-tasks/**/*.json'
];

async function readJson<T>(uri: vscode.Uri): Promise<T | null> {
  try {
    const buffer = await vscode.workspace.fs.readFile(uri);
    const text = new TextDecoder().decode(buffer);
    return JSON.parse(text) as T;
  } catch (error) {
    console.warn(`Failed to read task definition at ${uri.toString()}:`, error);
    return null;
  }
}

function extractTaskDefinition(raw: any, uri: vscode.Uri): TaskDefinition | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const key = typeof raw.key === 'string' ? raw.key.trim() : '';
  const domain = typeof raw.domain === 'string' ? raw.domain.trim() : '';
  const version = typeof raw.version === 'string' ? raw.version.trim() : '';
  const flow = typeof raw.flow === 'string' ? raw.flow.trim() : 'sys-tasks';

  if (!key || !domain || !version) {
    return null;
  }

  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((tag: unknown): tag is string => typeof tag === 'string').map((tag: string) => tag.trim()).filter(Boolean)
    : undefined;

  const metadataTitle =
    typeof raw.metadata?.title === 'string'
      ? raw.metadata.title.trim()
      : typeof raw.attributes?.metadata?.title === 'string'
        ? raw.attributes.metadata.title.trim()
        : typeof raw.attributes?.title === 'string'
          ? raw.attributes.title.trim()
          : undefined;

  const flowVersion =
    typeof raw.flowVersion === 'string'
      ? raw.flowVersion.trim()
      : typeof raw.attributes?.flowVersion === 'string'
        ? raw.attributes.flowVersion.trim()
        : undefined;

  return {
    key,
    domain,
    version,
    flow,
    flowVersion,
    tags,
    title: metadataTitle,
    path: uri.fsPath
  } satisfies TaskDefinition;
}

export async function loadTaskCatalog(): Promise<TaskDefinition[]> {
  const results: TaskDefinition[] = [];
  const seen = new Set<string>();

  for (const pattern of TASK_FILE_GLOBS) {
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

      const definition = extractTaskDefinition(raw, uri);
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
