import React, { useState } from 'react';

export interface TransitionHistoryEntry {
  timestamp: string;
  transitionKey: string;
  transitionType: 'start' | 'state';
  request: any;
  response?: any;
  error?: string;
  status: 'success' | 'error' | 'pending';
}

interface TransitionHistoryProps {
  history: TransitionHistoryEntry[];
}

export function TransitionHistory({ history }: TransitionHistoryProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpanded = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  if (history.length === 0) {
    return (
      <div className="transition-history-empty">
        <p>No transitions executed yet. Submit a transition to see history here.</p>
      </div>
    );
  }

  return (
    <div className="transition-history">
      <table className="transition-history-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Transition</th>
            <th>Type</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {history.map((entry, index) => (
            <React.Fragment key={index}>
              <tr className={`history-row ${entry.status}`}>
                <td className="time-cell">{new Date(entry.timestamp).toLocaleTimeString()}</td>
                <td className="transition-cell">{entry.transitionKey}</td>
                <td className="type-cell">
                  <span className={`type-badge ${entry.transitionType}`}>
                    {entry.transitionType === 'start' ? 'START' : 'STATE'}
                  </span>
                </td>
                <td className="status-cell">
                  <span className={`status-badge ${entry.status}`}>
                    {entry.status === 'success' ? '✓' : entry.status === 'error' ? '✗' : '⋯'}
                  </span>
                </td>
                <td className="actions-cell">
                  <button
                    className="btn-expand"
                    onClick={() => toggleExpanded(index)}
                  >
                    {expandedIndex === index ? '▼' : '▶'}
                  </button>
                </td>
              </tr>
              {expandedIndex === index && (
                <tr className="history-details-row">
                  <td colSpan={5}>
                    <div className="history-details">
                      <div className="history-section">
                        <h4>Request Data</h4>
                        <pre className="history-json">
                          {JSON.stringify(entry.request, null, 2)}
                        </pre>
                      </div>
                      {entry.error ? (
                        <div className="history-section error">
                          <h4>Error</h4>
                          <div className="error-message">{entry.error}</div>
                        </div>
                      ) : entry.response ? (
                        <div className="history-section">
                          <h4>Response Data</h4>
                          <pre className="history-json">
                            {JSON.stringify(entry.response, null, 2)}
                          </pre>
                        </div>
                      ) : (
                        <div className="history-section">
                          <h4>Response</h4>
                          <p className="pending-text">Pending...</p>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
