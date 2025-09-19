import * as vscode from 'vscode';

export interface GitAPI {
  getRepository(uri: vscode.Uri): Repository | null;
}

export interface Repository {
  rootUri: vscode.Uri;
  state: RepositoryState;
}

export interface RepositoryState {
  HEAD?: Ref;
  workingTreeChanges: Change[];
  indexChanges: Change[];
}

export interface Ref {
  name?: string;
  commit?: string;
}

export interface Change {
  uri: vscode.Uri;
  status: Status;
}

export enum Status {
  INDEX_MODIFIED,
  INDEX_ADDED,
  INDEX_DELETED,
  MODIFIED,
  DELETED,
  UNTRACKED,
  IGNORED
}

export async function getGitAPI(): Promise<GitAPI | undefined> {
  try {
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (!gitExtension) {
      return undefined;
    }

    const git = gitExtension.isActive ? gitExtension.exports : await gitExtension.activate();
    return git.getAPI(1);
  } catch (error) {
    console.warn('Failed to get Git API:', error);
    return undefined;
  }
}

export async function getWorkspaceRepository(): Promise<Repository | undefined> {
  const git = await getGitAPI();
  if (!git) return undefined;

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return undefined;

  return git.getRepository(workspaceFolder.uri) || undefined;
}

export async function isFileTracked(uri: vscode.Uri): Promise<boolean> {
  const repo = await getWorkspaceRepository();
  if (!repo) return false;

  const relativePath = vscode.workspace.asRelativePath(uri);
  try {
    // Simple check - if file is in working tree changes or index changes, it's tracked
    const allChanges = [...repo.state.workingTreeChanges, ...repo.state.indexChanges];
    return allChanges.some(change =>
      vscode.workspace.asRelativePath(change.uri) === relativePath
    );
  } catch {
    return false;
  }
}

export function onRepositoryChange(callback: (repo: Repository) => void): vscode.Disposable {
  return vscode.workspace.onDidChangeWorkspaceFolders(async () => {
    const repo = await getWorkspaceRepository();
    if (repo) {
      callback(repo);
    }
  });
}