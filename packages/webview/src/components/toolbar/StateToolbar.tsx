import React from 'react';
import type { State, SharedTransition } from '@amorphie-workflow/core';
import {
  ClipboardList,
  Tag,
  Image,
  Edit3,
  Play,
  XCircle,
  ArrowLeftRight,
  Repeat,
  Settings,
  Trash2,
  Flag,
  Share2,
  Sparkles
} from 'lucide-react';
import { ContextMenuSubmenu } from '../ContextMenuSubmenu';

interface StateToolbarProps {
  state: State;
  position: { x: number; y: number };
  sharedTransitions?: SharedTransition[];
  onEditTasks: () => void;
  onEditLabel: () => void;
  onEditView: () => void;
  onEditKey: () => void;
  onStartFromHere?: () => void;
  onSetAsCancel?: () => void;
  onConvertToFinal?: () => void;
  onConvertToIntermediate?: () => void;
  onConvertToSubFlow?: () => void;
  onConvertToWizard?: () => void;
  onConfigureSubFlow?: () => void;
  onToggleSharedTransition?: (transitionKey: string, enabled: boolean) => void;
  onDelete: () => void;
}

export function StateToolbar({
  state,
  position,
  sharedTransitions,
  onEditTasks,
  onEditLabel,
  onEditView,
  onEditKey,
  onStartFromHere,
  onSetAsCancel,
  onConvertToFinal,
  onConvertToIntermediate,
  onConvertToSubFlow,
  onConvertToWizard,
  onConfigureSubFlow,
  onToggleSharedTransition,
  onDelete,
}: StateToolbarProps) {
  const stateType = state.stateType || 2;
  const taskCount = (state.onEntries?.length || 0) + (state.onExits?.length || 0);

  // Build shared transition items with proper handler capture
  const sharedTransitionItems = sharedTransitions && onToggleSharedTransition
    ? sharedTransitions.map(st => {
        const isEnabled = st.availableIn.includes(state.key);
        return {
          label: st.key,
          icon: isEnabled ? <Check size={16} /> : <span style={{ width: 16, height: 16, display: 'inline-block' }} />,
          onClick: () => onToggleSharedTransition(st.key, !isEnabled)
        };
      })
    : [];

  return (
    <div
      className="state-toolbar"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 2000,
      }}
    >
      <div className="state-toolbar__container">
        {/* Universal actions */}
        <button
          className="state-toolbar__button"
          onClick={onEditTasks}
          title="Edit Tasks"
        >
          <span className="state-toolbar__icon"><ClipboardList size={16} /></span>
          <span className="state-toolbar__label">
            Edit Tasks
            {taskCount > 0 && <span className="state-toolbar__badge">{taskCount}</span>}
          </span>
        </button>

        <button
          className="state-toolbar__button"
          onClick={onEditLabel}
          title="Edit Label"
        >
          <span className="state-toolbar__icon"><Tag size={16} /></span>
          <span className="state-toolbar__label">Edit Label</span>
        </button>

        <button
          className="state-toolbar__button"
          onClick={onEditView}
          title="Edit View"
        >
          <span className="state-toolbar__icon"><Image size={16} /></span>
          <span className="state-toolbar__label">Edit View</span>
        </button>

        <button
          className="state-toolbar__button"
          onClick={onEditKey}
          title="Edit Key"
        >
          <span className="state-toolbar__icon"><Edit3 size={16} /></span>
          <span className="state-toolbar__label">Edit Key</span>
        </button>

        <div className="state-toolbar__divider" />

        {/* State-type-specific actions */}
        {/* Start from here - available for Initial, Intermediate, and Wizard states */}
        {(stateType === 1 || stateType === 2 || stateType === 5) && onStartFromHere && (
          <>
            <button
              className="state-toolbar__button"
              onClick={onStartFromHere}
              title="Start from here"
            >
              <span className="state-toolbar__icon"><Play size={16} /></span>
              <span className="state-toolbar__label">Start from here</span>
            </button>

            <div className="state-toolbar__divider" />
          </>
        )}

        {/* Set as Cancel Target - available for all states */}
        {onSetAsCancel && (
          <>
            <button
              className="state-toolbar__button"
              onClick={onSetAsCancel}
              title="Set as Cancel Target"
            >
              <span className="state-toolbar__icon"><XCircle size={16} /></span>
              <span className="state-toolbar__label">Set as Cancel Target</span>
            </button>

            <div className="state-toolbar__divider" />
          </>
        )}

        {/* Shared Transitions - not available for Final and Wizard states */}
        {sharedTransitionItems.length > 0 && stateType !== 3 && stateType !== 5 && (
          <>
            <ContextMenuSubmenu
              label="Shared Transitions"
              icon={<Share2 size={16} />}
              variant="toolbar"
              items={sharedTransitionItems}
            />
            <div className="state-toolbar__divider" />
          </>
        )}

        {/* Initial state conversion actions */}
        {stateType === 1 && (
          <>
            {onConvertToIntermediate && (
              <button
                className="state-toolbar__button"
                onClick={onConvertToIntermediate}
                title="Convert to Intermediate"
              >
                <span className="state-toolbar__icon"><ArrowLeftRight size={16} /></span>
                <span className="state-toolbar__label">Convert to Intermediate</span>
              </button>
            )}

            {onConvertToFinal && (
              <button
                className="state-toolbar__button"
                onClick={onConvertToFinal}
                title="Convert to Final"
              >
                <span className="state-toolbar__icon"><Flag size={16} /></span>
                <span className="state-toolbar__label">Convert to Final</span>
              </button>
            )}

            {onConvertToSubFlow && (
              <button
                className="state-toolbar__button"
                onClick={onConvertToSubFlow}
                title="Convert to SubFlow"
              >
                <span className="state-toolbar__icon"><Repeat size={16} /></span>
                <span className="state-toolbar__label">Convert to SubFlow</span>
              </button>
            )}

            {onConvertToWizard && (
              <button
                className="state-toolbar__button"
                onClick={onConvertToWizard}
                title="Convert to Wizard"
              >
                <span className="state-toolbar__icon"><Sparkles size={16} /></span>
                <span className="state-toolbar__label">Convert to Wizard</span>
              </button>
            )}
          </>
        )}

        {/* Intermediate state conversion actions */}
        {stateType === 2 && (
          <>
            {onConvertToFinal && (
              <button
                className="state-toolbar__button"
                onClick={onConvertToFinal}
                title="Convert to Final"
              >
                <span className="state-toolbar__icon"><Flag size={16} /></span>
                <span className="state-toolbar__label">Convert to Final</span>
              </button>
            )}

            {onConvertToSubFlow && (
              <button
                className="state-toolbar__button"
                onClick={onConvertToSubFlow}
                title="Convert to SubFlow"
              >
                <span className="state-toolbar__icon"><Repeat size={16} /></span>
                <span className="state-toolbar__label">Convert to SubFlow</span>
              </button>
            )}

            {onConvertToWizard && (
              <button
                className="state-toolbar__button"
                onClick={onConvertToWizard}
                title="Convert to Wizard"
              >
                <span className="state-toolbar__icon"><Sparkles size={16} /></span>
                <span className="state-toolbar__label">Convert to Wizard</span>
              </button>
            )}
          </>
        )}

        {stateType === 3 && (
          <>
            {/* Final state actions */}
            {onConvertToIntermediate && (
              <button
                className="state-toolbar__button"
                onClick={onConvertToIntermediate}
                title="Convert to Intermediate"
              >
                <span className="state-toolbar__icon"><ArrowLeftRight size={16} /></span>
                <span className="state-toolbar__label">Convert to Intermediate</span>
              </button>
            )}
          </>
        )}

        {stateType === 4 && (
          <>
            {/* SubFlow state actions */}
            {onConfigureSubFlow && (
              <button
                className="state-toolbar__button"
                onClick={onConfigureSubFlow}
                title="Configure SubFlow"
              >
                <span className="state-toolbar__icon"><Settings size={16} /></span>
                <span className="state-toolbar__label">Configure SubFlow</span>
              </button>
            )}

            <div className="state-toolbar__divider" />

            {onConvertToIntermediate && (
              <button
                className="state-toolbar__button"
                onClick={onConvertToIntermediate}
                title="Convert to Intermediate"
              >
                <span className="state-toolbar__icon"><ArrowLeftRight size={16} /></span>
                <span className="state-toolbar__label">Convert to Intermediate</span>
              </button>
            )}
          </>
        )}

        {stateType === 5 && (
          <>
            {/* Wizard state actions */}
            {onConvertToIntermediate && (
              <button
                className="state-toolbar__button"
                onClick={onConvertToIntermediate}
                title="Convert to Intermediate"
              >
                <span className="state-toolbar__icon"><ArrowLeftRight size={16} /></span>
                <span className="state-toolbar__label">Convert to Intermediate</span>
              </button>
            )}
          </>
        )}

        {/* Delete action */}
        <button
          className="state-toolbar__button state-toolbar__button--danger"
          onClick={onDelete}
          title="Delete State"
        >
          <span className="state-toolbar__icon"><Trash2 size={16} /></span>
          <span className="state-toolbar__label">Delete State</span>
        </button>
      </div>
    </div>
  );
}
