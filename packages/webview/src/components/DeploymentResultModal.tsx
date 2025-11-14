import React from 'react';
import {
  Workflow,
  Cog,
  Database,
  Eye,
  Zap,
  Package
} from 'lucide-react';

interface DeploymentResult {
  key: string;
  domain: string;
  type: 'workflow' | 'task' | 'schema' | 'view' | 'function' | 'extension';
  success: boolean;
  error?: string;
}

const componentTypeIcons: Record<string, React.ReactNode> = {
  workflow: <Workflow size={16} />,
  task: <Cog size={16} />,
  schema: <Database size={16} />,
  view: <Eye size={16} />,
  function: <Zap size={16} />,
  extension: <Package size={16} />
};

const componentTypeLabels: Record<string, string> = {
  workflow: 'Workflow',
  task: 'Task',
  schema: 'Schema',
  view: 'View',
  function: 'Function',
  extension: 'Extension'
};

interface DeploymentResultModalProps {
  success: boolean;
  message: string;
  results?: DeploymentResult[];
  onClose: () => void;
}

export function DeploymentResultModal({ success, message, results, onClose }: DeploymentResultModalProps) {
  return (
    <div className="comment-modal-overlay" onClick={onClose}>
      <div className="comment-modal deployment-result-modal" onClick={(e) => e.stopPropagation()}>
        <div className="comment-modal__header">
          <h2 className="comment-modal__title">
            <span className="deploy-result__icon">{success ? '✅' : '❌'}</span>
            {' '}
            Deployment {success ? 'Successful' : 'Failed'}
          </h2>
          <button
            className="comment-modal__close-btn"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            ×
          </button>
        </div>

        <div className="comment-modal__content deployment-result-modal__content">
          <div className="deployment-result-modal__message">
            {message}
          </div>

          {results && results.length > 0 && (
            <div className="deployment-result-modal__results">
              <h3 className="deployment-result-modal__results-title">Deployment Details</h3>
              <div className="deployment-result-modal__results-list">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`deployment-result-modal__item ${result.success ? 'deployment-result-modal__item--success' : 'deployment-result-modal__item--error'}`}
                  >
                    <span className="deployment-result-modal__item-icon">
                      {result.success ? '✓' : '✗'}
                    </span>
                    <div className="deployment-result-modal__item-content">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ color: '#6b7280', display: 'flex', alignItems: 'center' }}>
                          {componentTypeIcons[result.type]}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: '500' }}>
                          {componentTypeLabels[result.type]}
                        </span>
                      </div>
                      <div className="deployment-result-modal__item-name">
                        {result.key}
                      </div>
                      <div className="deployment-result-modal__item-domain">
                        {result.domain}
                      </div>
                      {result.error && (
                        <div className="deployment-result-modal__item-error">
                          {result.error}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="comment-modal__footer">
          <button
            type="button"
            className="comment-modal__btn comment-modal__btn--primary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
