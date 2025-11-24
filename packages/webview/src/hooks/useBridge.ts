import { useCallback } from 'react';
import type { MsgToWebview, MsgFromWebview } from '@amorphie-flow-studio/core';

// VS Code API type
interface VSCodeAPI {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VSCodeAPI;
  }
}

// Acquire VS Code API only once globally
let vscodeApi: VSCodeAPI | null = null;

function getVSCodeAPI(): VSCodeAPI {
  if (!vscodeApi) {
    console.log('[useBridge] Acquiring VS Code API...');
    console.log('[useBridge] window.acquireVsCodeApi exists?', typeof window.acquireVsCodeApi);
    const api = window.acquireVsCodeApi?.();
    console.log('[useBridge] acquireVsCodeApi() returned:', api ? 'VS Code API' : 'null/undefined');

    vscodeApi = api ?? {
      postMessage: (msg: any) => {
        console.warn('[useBridge] FALLBACK: Message not sent to VS Code (API not available):', msg);
        console.log('WebView -> Host:', msg);
      },
      getState: () => null,
      setState: () => {}
    };
  }
  return vscodeApi;
}

export function useBridge() {
  const vscode = getVSCodeAPI();

  const postMessage = useCallback((message: MsgFromWebview) => {
    console.log('[useBridge] postMessage called with:', message.type, message);
    console.log('[useBridge] vscode object:', vscode);
    console.log('[useBridge] vscode.postMessage type:', typeof vscode.postMessage);
    try {
      vscode.postMessage(message);
      console.log('[useBridge] postMessage executed successfully');
    } catch (error) {
      console.error('[useBridge] postMessage threw error:', error);
    }
  }, [vscode]);

  const onMessage = useCallback((handler: (message: MsgToWebview) => void) => {
    const messageHandler = (event: MessageEvent) => {
      handler(event.data);
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  return {
    postMessage,
    onMessage,
    getState: vscode.getState,
    setState: vscode.setState
  };
}
