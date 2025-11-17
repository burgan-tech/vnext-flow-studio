import React from 'react';
import {
  Key,
  Tag,
  ClipboardList,
  GitBranch,
  Shield,
  Timer,
  RefreshCw,
  Hand,
  Zap,
  Bell,
  Link2,
  ArrowRight,
  Trash2,
  FileCode
} from 'lucide-react';
import { ContextMenuSubmenu } from '../ContextMenuSubmenu';

interface TransitionToolbarProps {
  transitionLabel: string;
  position: { x: number; y: number };
  triggerType?: number; // 0=manual, 1=auto, 2=timeout, 3=event
  onEditKey: () => void;
  onEditLabels: () => void;
  onEditTasks?: () => void; // Not available for start transitions
  onEditMapping: () => void;
  onEditSchema?: () => void; // For manual, event, and start transitions
  onEditRule?: () => void; // Only for auto transitions (triggerType === 1)
  onEditTimeout?: () => void; // Only for timeout transitions
  onMakeShared?: () => void;
  onConvertToRegular?: () => void;
  onConvertToManual?: () => void;
  onConvertToAuto?: () => void;
  onConvertToTimeout?: () => void;
  onConvertToEvent?: () => void;
  onReconnectSource?: () => void;
  onReconnectTarget?: () => void;
  onDelete?: () => void;
}

export function TransitionToolbar({
  transitionLabel: _transitionLabel,
  position,
  triggerType,
  onEditKey,
  onEditLabels,
  onEditTasks,
  onEditMapping,
  onEditSchema,
  onEditRule,
  onEditTimeout,
  onMakeShared,
  onConvertToRegular,
  onConvertToManual,
  onConvertToAuto,
  onConvertToTimeout,
  onConvertToEvent,
  onReconnectSource,
  onReconnectTarget,
  onDelete,
}: TransitionToolbarProps) {
  // Schema validation and mapping only for manual (0) and event (3) transitions
  const supportsSchema = triggerType === 0 || triggerType === 3;
  const supportsMapping = triggerType === 0 || triggerType === 3;
  const isAuto = triggerType === 1;
  const isTimeout = triggerType === 2;

  // Build submenu items for type conversion (exclude current type)
  const conversionItems = [
    triggerType !== 0 && onConvertToManual && { label: 'Manual', icon: <Hand size={16} />, onClick: onConvertToManual },
    triggerType !== 1 && onConvertToAuto && { label: 'Auto', icon: <Zap size={16} />, onClick: onConvertToAuto },
    triggerType !== 2 && onConvertToTimeout && { label: 'Timeout', icon: <Timer size={16} />, onClick: onConvertToTimeout },
    triggerType !== 3 && onConvertToEvent && { label: 'Event', icon: <Bell size={16} />, onClick: onConvertToEvent },
  ].filter(Boolean) as Array<{ label: string; icon: React.ReactNode; onClick: () => void }>;

  // Build submenu items for reconnection
  const reconnectItems = [
    onReconnectSource && { label: 'Reconnect Source', icon: <ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} />, onClick: onReconnectSource },
    onReconnectTarget && { label: 'Reconnect Target', icon: <ArrowRight size={16} />, onClick: onReconnectTarget },
  ].filter(Boolean) as Array<{ label: string; icon: React.ReactNode; onClick: () => void }>;

  return (
    <div
      className="state-toolbar"
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000,
      }}
    >
      <div className="state-toolbar__container">
        <button
          className="state-toolbar__button"
          onClick={onEditKey}
          title="Edit Transition Key"
        >
          <span className="state-toolbar__icon"><Key size={16} /></span>
          <span className="state-toolbar__label">Edit Key</span>
        </button>

        {/* Reconnect submenu */}
        {reconnectItems.length > 0 && (
          <>
            <div className="state-toolbar__divider" />
            <ContextMenuSubmenu
              label="Reconnect"
              icon={<Link2 size={16} />}
              variant="toolbar"
              items={reconnectItems}
            />
          </>
        )}

        <div className="state-toolbar__divider" />
        <button
          className="state-toolbar__button"
          onClick={onEditLabels}
          title="Edit Transition Labels"
        >
          <span className="state-toolbar__icon"><Tag size={16} /></span>
          <span className="state-toolbar__label">Edit Labels</span>
        </button>

        {onEditTasks && (
          <>
            <div className="state-toolbar__divider" />
            <button
              className="state-toolbar__button"
              onClick={onEditTasks}
              title="Edit Transition Tasks"
            >
              <span className="state-toolbar__icon"><ClipboardList size={16} /></span>
              <span className="state-toolbar__label">Edit Tasks</span>
            </button>
          </>
        )}

        {supportsMapping && (
          <>
            <div className="state-toolbar__divider" />
            <button
              className="state-toolbar__button"
              onClick={onEditMapping}
              title="Edit Input Mapping"
            >
              <span className="state-toolbar__icon"><GitBranch size={16} /></span>
              <span className="state-toolbar__label">Edit Mapping</span>
            </button>
          </>
        )}

        {isAuto && onEditRule && (
          <>
            <div className="state-toolbar__divider" />
            <button
              className="state-toolbar__button"
              onClick={onEditRule}
              title="Edit Transition Rule (Condition)"
            >
              <span className="state-toolbar__icon"><FileCode size={16} /></span>
              <span className="state-toolbar__label">Edit Rule</span>
            </button>
          </>
        )}

        {supportsSchema && onEditSchema && (
          <>
            <div className="state-toolbar__divider" />
            <button
              className="state-toolbar__button"
              onClick={onEditSchema}
              title="Edit Schema Validation"
            >
              <span className="state-toolbar__icon"><Shield size={16} /></span>
              <span className="state-toolbar__label">Edit Schema</span>
            </button>
          </>
        )}

        {isTimeout && onEditTimeout && (
          <>
            <div className="state-toolbar__divider" />
            <button
              className="state-toolbar__button"
              onClick={onEditTimeout}
              title="Edit Timeout Configuration"
            >
              <span className="state-toolbar__icon"><Timer size={16} /></span>
              <span className="state-toolbar__label">Edit Timeout</span>
            </button>
          </>
        )}

        {/* Convert Type submenu */}
        {conversionItems.length > 0 && (
          <>
            <div className="state-toolbar__divider" />
            <ContextMenuSubmenu
              label="Convert Type"
              icon={<RefreshCw size={16} />}
              variant="toolbar"
              items={conversionItems}
            />
          </>
        )}

        {onMakeShared && (
          <>
            <div className="state-toolbar__divider" />
            <button
              className="state-toolbar__button"
              onClick={onMakeShared}
              title="Make Shared Transition"
            >
              <span className="state-toolbar__icon"><Link2 size={16} /></span>
              <span className="state-toolbar__label">Make Shared</span>
            </button>
          </>
        )}

        {onConvertToRegular && (
          <>
            <div className="state-toolbar__divider" />
            <button
              className="state-toolbar__button"
              onClick={onConvertToRegular}
              title="Convert to Regular Transition"
            >
              <span className="state-toolbar__icon"><ArrowRight size={16} /></span>
              <span className="state-toolbar__label">Make Regular</span>
            </button>
          </>
        )}

        {/* Delete transition */}
        {onDelete && (
          <button
            className="state-toolbar__button state-toolbar__button--danger"
            onClick={onDelete}
            title="Delete Transition"
          >
            <span className="state-toolbar__icon"><Trash2 size={16} /></span>
            <span className="state-toolbar__label">Delete Transition</span>
          </button>
        )}
      </div>
    </div>
  );
}
