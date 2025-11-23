import * as vscode from 'vscode';

export interface TestCase {
  name: string;
  input: any;
  description?: string;
  createdAt?: string;
  lastUsed?: string;
}

/**
 * Manages saved test cases for workflows
 * Stores test cases in VS Code workspace state
 */
export class TestCaseManager {
  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Save or update a test case for a workflow
   */
  async saveTestCase(workflowKey: string, testCase: TestCase): Promise<void> {
    const key = this.getStorageKey(workflowKey);
    const existing = await this.loadTestCases(workflowKey);

    // Add timestamps
    const now = new Date().toISOString();
    const caseWithTimestamp = {
      ...testCase,
      createdAt: testCase.createdAt || now,
      lastUsed: now
    };

    // Replace if exists (by name), otherwise append
    const index = existing.findIndex(tc => tc.name === testCase.name);
    if (index >= 0) {
      existing[index] = caseWithTimestamp;
    } else {
      existing.push(caseWithTimestamp);
    }

    await this.context.workspaceState.update(key, existing);
  }

  /**
   * Load all test cases for a workflow
   */
  async loadTestCases(workflowKey: string): Promise<TestCase[]> {
    const key = this.getStorageKey(workflowKey);
    const cases = this.context.workspaceState.get<TestCase[]>(key, []);

    // Sort by last used (most recent first)
    return cases.sort((a, b) => {
      const aTime = a.lastUsed || a.createdAt || '';
      const bTime = b.lastUsed || b.createdAt || '';
      return bTime.localeCompare(aTime);
    });
  }

  /**
   * Delete a test case
   */
  async deleteTestCase(workflowKey: string, testCaseName: string): Promise<void> {
    const key = this.getStorageKey(workflowKey);
    const existing = await this.loadTestCases(workflowKey);
    const filtered = existing.filter(tc => tc.name !== testCaseName);
    await this.context.workspaceState.update(key, filtered);
  }

  /**
   * Update last used timestamp for a test case
   */
  async markTestCaseUsed(workflowKey: string, testCaseName: string): Promise<void> {
    const key = this.getStorageKey(workflowKey);
    const existing = await this.loadTestCases(workflowKey);
    const testCase = existing.find(tc => tc.name === testCaseName);

    if (testCase) {
      testCase.lastUsed = new Date().toISOString();
      await this.context.workspaceState.update(key, existing);
    }
  }

  /**
   * Get a specific test case by name
   */
  async getTestCase(workflowKey: string, testCaseName: string): Promise<TestCase | undefined> {
    const cases = await this.loadTestCases(workflowKey);
    return cases.find(tc => tc.name === testCaseName);
  }

  /**
   * Clear all test cases for a workflow
   */
  async clearAllTestCases(workflowKey: string): Promise<void> {
    const key = this.getStorageKey(workflowKey);
    await this.context.workspaceState.update(key, []);
  }

  /**
   * Get count of test cases for a workflow
   */
  async getTestCaseCount(workflowKey: string): Promise<number> {
    const cases = await this.loadTestCases(workflowKey);
    return cases.length;
  }

  /**
   * Generate storage key for workspace state
   */
  private getStorageKey(workflowKey: string): string {
    return `amorphie.testCases.${workflowKey}`;
  }
}
