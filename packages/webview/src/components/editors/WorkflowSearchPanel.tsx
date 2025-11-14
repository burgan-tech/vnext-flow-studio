import React, { useState, useMemo } from 'react';
import type { AvailableComponent } from './ReferenceSelector';

interface WorkflowSearchPanelProps {
  availableWorkflows: AvailableComponent[];
  selectedWorkflowRef: string;
  onSelectWorkflow: (workflowRef: string) => void;
}

export function WorkflowSearchPanel({
  availableWorkflows,
  selectedWorkflowRef,
  onSelectWorkflow,
}: WorkflowSearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Filter workflows based on search query
  const filteredWorkflows = useMemo(() => {
    if (!searchQuery) return availableWorkflows.slice(0, 20);

    const query = searchQuery.toLowerCase();
    return availableWorkflows.filter(workflow => {
      const key = workflow.key?.toLowerCase() || '';
      const domain = workflow.domain?.toLowerCase() || '';
      const flow = workflow.flow?.toLowerCase() || '';
      const title = workflow.title?.toLowerCase() || '';
      const version = workflow.version?.toLowerCase() || '';

      return (
        key.includes(query) ||
        domain.includes(query) ||
        flow.includes(query) ||
        title.includes(query) ||
        version.includes(query)
      );
    }).slice(0, 20);
  }, [availableWorkflows, searchQuery]);

  // Format workflow reference (domain/flow/key@version or just key)
  const formatWorkflowRef = (workflow: AvailableComponent): string => {
    if (workflow.domain && workflow.version) {
      const flow = workflow.flow || 'sys-flows';
      return `${workflow.domain}/${flow}/${workflow.key}@${workflow.version}`;
    }
    return workflow.key || '';
  };

  // Get display name for selected workflow
  const selectedWorkflowDisplay = useMemo(() => {
    if (!selectedWorkflowRef) return '';

    // Try to find the workflow in available workflows
    const workflow = availableWorkflows.find(w => {
      const fullRef = formatWorkflowRef(w);
      return fullRef === selectedWorkflowRef || w.key === selectedWorkflowRef;
    });

    if (workflow) {
      return workflow.key || selectedWorkflowRef;
    }

    return selectedWorkflowRef;
  }, [selectedWorkflowRef, availableWorkflows]);

  const handleSelectWorkflow = (workflow: AvailableComponent) => {
    const ref = formatWorkflowRef(workflow);
    onSelectWorkflow(ref);
    setIsDropdownOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="task-search-panel">
      <label className="task-search-panel__label">
        Process Reference
        <span className="task-search-panel__required">*</span>
      </label>

      <div className="task-search-panel__input-container">
        <input
          type="text"
          className="task-search-panel__input"
          value={isDropdownOpen ? searchQuery : selectedWorkflowDisplay}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsDropdownOpen(true)}
          onBlur={() => {
            // Delay to allow click on dropdown items
            setTimeout(() => setIsDropdownOpen(false), 200);
          }}
          placeholder="Search workflows..."
        />

        {isDropdownOpen && (
          <div className="task-search-panel__dropdown">
            {filteredWorkflows.length > 0 ? (
              <div className="task-search-panel__results">
                {filteredWorkflows.map((workflow, index) => (
                  <div
                    key={index}
                    className="task-search-panel__result-item"
                    onClick={() => handleSelectWorkflow(workflow)}
                  >
                    <div className="task-search-panel__result-header">
                      <span className="task-search-panel__result-key">
                        {workflow.key}
                      </span>
                      {workflow.version && (
                        <span className="task-search-panel__result-version">
                          @{workflow.version}
                        </span>
                      )}
                    </div>
                    {workflow.domain && (
                      <div className="task-search-panel__result-path">
                        {workflow.domain}/{workflow.flow || 'sys-flows'}
                      </div>
                    )}
                    {workflow.title && (
                      <div className="task-search-panel__result-description">
                        {workflow.title}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="task-search-panel__empty">
                <p>No workflows found matching &quot;{searchQuery}&quot;</p>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="task-search-panel__help">
        Select the workflow/subflow to invoke
      </p>
    </div>
  );
}
