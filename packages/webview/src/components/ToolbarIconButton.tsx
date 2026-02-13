import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';

interface ToolbarIconButtonProps {
  icon: LucideIcon;
  label: string;
  isActive?: boolean;
  onClick: () => void;
}

export function ToolbarIconButton({ icon: Icon, label, isActive = false, onClick }: ToolbarIconButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="toolbar-icon-btn-wrapper"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        className={`toolbar-icon-btn ${isActive ? 'toolbar-icon-btn--active' : ''}`}
        onClick={onClick}
        aria-label={label}
        type="button"
      >
        <Icon size={20} />
      </button>
      {showTooltip && (
        <div className="toolbar-icon-tooltip">
          {label}
        </div>
      )}
    </div>
  );
}
