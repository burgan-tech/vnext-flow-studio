import { useEffect, useCallback } from 'react';
import type { MsgToWebview, MsgFromWebview } from '@nextcredit/core';

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
    vscodeApi = window.acquireVsCodeApi?.() ?? {
      postMessage: (msg: any) => console.log('WebView -> Host:', msg),
      getState: () => null,
      setState: () => {}
    };
  }
  return vscodeApi;
}

export function useBridge() {
  const vscode = getVSCodeAPI();

  const postMessage = useCallback((message: MsgFromWebview) => {
    vscode.postMessage(message);
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