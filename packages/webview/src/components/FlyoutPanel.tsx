import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface FlyoutPanelProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function FlyoutPanel({ title, isOpen, onClose, children }: FlyoutPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        // Check if click is not on the icon bar either
        const iconBar = document.querySelector('.toolbar-icon-bar');
        if (iconBar && !iconBar.contains(event.target as Node)) {
          onClose();
        }
      }
    };

    // Add slight delay to prevent immediate close on button click
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div ref={panelRef} className="flyout-panel">
      <div className="flyout-panel__header">
        <h2 className="flyout-panel__title">{title}</h2>
        <button
          className="flyout-panel__close-btn"
          onClick={onClose}
          aria-label="Close"
          type="button"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flyout-panel__content">
        {children}
      </div>
    </div>
  );
}
