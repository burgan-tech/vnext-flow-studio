import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface FlyoutPanelProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  closeOnClickOutside?: boolean; // Default true, set false for drag-and-drop panels
}

export function FlyoutPanel({ title, isOpen, onClose, children, closeOnClickOutside = true }: FlyoutPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('[FlyoutPanel] useEffect - isOpen:', isOpen, 'closeOnClickOutside:', closeOnClickOutside);
    if (!isOpen || !closeOnClickOutside) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      console.log('[FlyoutPanel] Click detected on:', target.className, target.tagName);

      // Don't close if clicking inside the panel
      if (panelRef.current && panelRef.current.contains(target)) {
        console.log('[FlyoutPanel] Click inside panel, not closing');
        return;
      }

      // Don't close if clicking on the toolbar icons
      const iconBar = document.querySelector('.toolbar-icon-bar');
      if (iconBar && iconBar.contains(target)) {
        console.log('[FlyoutPanel] Click on toolbar, not closing');
        return;
      }

      // Close for any other click
      console.log('[FlyoutPanel] Click outside detected, closing panel');
      onClose();
    };

    // Add slight delay to prevent immediate close on button click that opened the panel
    const timeoutId = setTimeout(() => {
      console.log('[FlyoutPanel] Adding mousedown listener');
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      console.log('[FlyoutPanel] Cleanup - removing mousedown listener');
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, closeOnClickOutside]);

  if (!isOpen) return null;

  return (
    <>
      {closeOnClickOutside && (
        <div className="flyout-panel-backdrop" onClick={onClose} />
      )}
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
    </>
  );
}
