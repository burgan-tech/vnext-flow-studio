import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface ToolbarIconButtonProps {
  icon: LucideIcon;
  label: string;
  isActive?: boolean;
  onClick: () => void;
}

export function ToolbarIconButton({ icon: Icon, label, isActive = false, onClick }: ToolbarIconButtonProps) {
  return (
    <button
      className={`toolbar-icon-btn ${isActive ? 'toolbar-icon-btn--active' : ''}`}
      onClick={onClick}
      title={label}
      aria-label={label}
      type="button"
    >
      <Icon size={20} />
    </button>
  );
}
