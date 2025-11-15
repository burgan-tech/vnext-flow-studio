import React, { useState, useEffect, useCallback } from 'react';
import type { State, ExecutionTask, TaskRef, Mapping } from '@amorphie-workflow/core';
import { TaskListPanel } from './TaskListPanel';
import { TaskDetailsPanel } from './TaskDetailsPanel';

interface TaskMappingPopupProps {
  state: State;
  workflowName?: string;
  workflowDomain?: string;
  onClose: () => void;
  onApply: (updates: { onEntries?: ExecutionTask[]; onExits?: ExecutionTask[] }) => void;
  initialLane?: 'onEntries' | 'onExits';
  catalogs: Record<string, any[]>;
  isTransition?: boolean;
}

export function TaskMappingPopup({ state, workflowName, workflowDomain, onClose, onApply, initialLane = 'onEntries', catalogs, isTransition = false }: TaskMappingPopupProps) {
  const [activeTab, setActiveTab] = useState<'onEntries' | 'onExits'>(initialLane);
  const [draftOnEntries, setDraftOnEntries] = useState<ExecutionTask[]>(state.onEntries || []);
  const [draftOnExits, setDraftOnExits] = useState<ExecutionTask[]>(state.onExits || []);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Get current draft based on active tab
  const currentDraft = activeTab === 'onEntries' ? draftOnEntries : draftOnExits;
  const setCurrentDraft = activeTab === 'onEntries' ? setDraftOnEntries : setDraftOnExits;

  // Mark as dirty when drafts change
  useEffect(() => {
    const hasChanges =
      JSON.stringify(draftOnEntries) !== JSON.stringify(state.onEntries || []) ||
      JSON.stringify(draftOnExits) !== JSON.stringify(state.onExits || []);
    setIsDirty(hasChanges);
  }, [draftOnEntries, draftOnExits, state.onEntries, state.onExits]);

  const handleClose = useCallback(() => {
    // Allow closing without confirmation - changes are only applied when "Apply" is clicked
    // The dirty indicator (*) shows there are unsaved changes
    onClose();
  }, [onClose]);

  const handleApply = useCallback(() => {
    onApply({
      onEntries: draftOnEntries,
      onExits: draftOnExits,
    });
    onClose();
  }, [draftOnEntries, draftOnExits, onApply, onClose]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleApply();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, handleApply]);

  const handleTabChange = (tab: 'onEntries' | 'onExits') => {
    setActiveTab(tab);
    setSelectedTaskIndex(null);
  };

  // Task list operations
  const handleAddTask = () => {
    const newTask: ExecutionTask = {
      order: currentDraft.length + 1,
      task: { ref: '' } as TaskRef,
      mapping: {
        location: '',
        code: '',
      } as Mapping,
    };
    const updated = [...currentDraft, newTask];
    setCurrentDraft(updated);
    setSelectedTaskIndex(updated.length - 1);
  };

  const handleDeleteTask = (index: number) => {
    console.log('[TaskMappingPopup] handleDeleteTask called for index:', index);
    console.log('[TaskMappingPopup] Current draft length:', currentDraft.length);

    const updated = currentDraft.filter((_, i) => i !== index);
    // Re-number orders
    const renumbered = updated.map((task, i) => ({ ...task, order: i + 1 }));
    console.log('[TaskMappingPopup] After delete, new length:', renumbered.length);
    setCurrentDraft(renumbered);

    // Adjust selection
    if (selectedTaskIndex === index) {
      setSelectedTaskIndex(null);
    } else if (selectedTaskIndex !== null && selectedTaskIndex > index) {
      setSelectedTaskIndex(selectedTaskIndex - 1);
    }
  };

  const handleReorderTasks = (newOrder: ExecutionTask[]) => {
    // Re-number orders
    const renumbered = newOrder.map((task, i) => ({ ...task, order: i + 1 }));
    setCurrentDraft(renumbered);
  };

  const handleSelectTask = (index: number) => {
    setSelectedTaskIndex(index);
  };

  const handleUpdateTask = (index: number, updatedTask: ExecutionTask) => {
    const updated = currentDraft.map((task, i) => (i === index ? updatedTask : task));
    setCurrentDraft(updated);
  };

  const selectedTask = selectedTaskIndex !== null ? currentDraft[selectedTaskIndex] : null;

  return (
    <div className="task-mapping-popup-overlay" onClick={handleClose}>
      <div className="task-mapping-popup" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="task-mapping-popup__header">
          <h2 className="task-mapping-popup__title">
            {isTransition ? 'Edit Transition Tasks: ' : 'Edit Tasks: '}{state.key}
            {isDirty && <span className="task-mapping-popup__dirty-indicator"> *</span>}
          </h2>
          <button
            className="task-mapping-popup__close-btn"
            onClick={handleClose}
            aria-label="Close"
            type="button"
          >
            ×
          </button>
        </div>

        {/* Tabs - only show for states, not transitions */}
        {!isTransition && (
          <div className="task-mapping-popup__tabs">
            <button
              type="button"
              className={`task-mapping-popup__tab ${activeTab === 'onEntries' ? 'active' : ''}`}
              onClick={() => handleTabChange('onEntries')}
            >
              On Entry Tasks
              {draftOnEntries.length > 0 && (
                <span className="task-mapping-popup__tab-count">{draftOnEntries.length}</span>
              )}
            </button>
            <button
              type="button"
              className={`task-mapping-popup__tab ${activeTab === 'onExits' ? 'active' : ''}`}
              onClick={() => handleTabChange('onExits')}
            >
              On Exit Tasks
              {draftOnExits.length > 0 && (
                <span className="task-mapping-popup__tab-count">{draftOnExits.length}</span>
              )}
            </button>
          </div>
        )}

        {/* Transition label */}
        {isTransition && (
          <div className="task-mapping-popup__transition-label">
            <span className="task-mapping-popup__transition-label-text">On Execution Tasks</span>
          </div>
        )}

        {/* Content - Split Panel */}
        <div className="task-mapping-popup__content">
          <TaskListPanel
            tasks={currentDraft}
            selectedIndex={selectedTaskIndex}
            onSelectTask={handleSelectTask}
            onAddTask={handleAddTask}
            onDeleteTask={handleDeleteTask}
            onReorderTasks={handleReorderTasks}
          />

          <TaskDetailsPanel
            task={selectedTask}
            taskIndex={selectedTaskIndex}
            stateKey={state.key}
            workflowName={workflowName}
            workflowDomain={workflowDomain}
            lane={activeTab}
            catalogs={catalogs}
            onUpdateTask={(updatedTask) => {
              if (selectedTaskIndex !== null) {
                handleUpdateTask(selectedTaskIndex, updatedTask);
              }
            }}
          />
        </div>

        {/* Footer */}
        <div className="task-mapping-popup__footer">
          <button
            type="button"
            className="task-mapping-popup__btn task-mapping-popup__btn--secondary"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="task-mapping-popup__btn task-mapping-popup__btn--primary"
            onClick={handleApply}
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}
