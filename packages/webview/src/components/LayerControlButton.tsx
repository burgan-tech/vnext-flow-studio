import React, { useState, useRef, useEffect } from 'react';
import { ControlButton } from '@xyflow/react';

interface LayerControlButtonProps {
  showRegularTransitions: boolean;
  showSharedTransitions: boolean;
  onToggleRegular: () => void;
  onToggleShared: () => void;
}

// Layer icon SVG component
const LayerIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2L3 7L12 12L21 7L12 2Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 12L12 17L21 12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 17L12 22L21 17"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const LayerControlButton: React.FC<LayerControlButtonProps> = ({
  showRegularTransitions,
  showSharedTransitions,
  onToggleRegular,
  onToggleShared
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hiddenCount = (!showRegularTransitions ? 1 : 0) + (!showSharedTransitions ? 1 : 0);

  // Close dropdown when clicking outside
  useEffect(() => {
  if (!isOpen) return;

  const onPointerDown = (e: PointerEvent) => {
    const target = e.target as Node;
    if (dropdownRef.current && !dropdownRef.current.contains(target)) {
      setIsOpen(false);
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setIsOpen(false);
  };

  document.addEventListener('pointerdown', onPointerDown, { capture: true });
  document.addEventListener('keydown', onKey);

  return () => {
    document.removeEventListener('pointerdown', onPointerDown, { capture: true } as any);
    document.removeEventListener('keydown', onKey);
  };
}, [isOpen]);

  return (
    <div className="layer-button-container">
      <ControlButton
        onClick={() => setIsOpen(!isOpen)}
        title="Layer visibility"
        aria-label="Toggle layer visibility"
        aria-pressed={isOpen}
        className="layer-control-btn"
      >
        <LayerIcon />
        {hiddenCount > 0 && <span className="layer-button-badge">{hiddenCount}</span>}
      </ControlButton>

      {isOpen && (
        <div ref={dropdownRef} className="layer-dropdown react-flow__panel">
          {/* header/items/footer as you already have */}
          <div className="layer-dropdown__header">Transition Layers</div>
          <div className="layer-dropdown__items">
            <label className="layer-dropdown__item">
              <input type="checkbox" checked={showRegularTransitions} onChange={onToggleRegular} />
              <span className="layer-dropdown__item-icon">→</span>
              <span className="layer-dropdown__item-label">Regular Transitions</span>
              <span className="layer-dropdown__item-hint">Ctrl+Shift+R</span>
            </label>
            <label className="layer-dropdown__item">
              <input type="checkbox" checked={showSharedTransitions} onChange={onToggleShared} />
              <span className="layer-dropdown__item-icon">⇶</span>
              <span className="layer-dropdown__item-label">Shared Transitions</span>
              <span className="layer-dropdown__item-hint">Ctrl+Shift+S</span>
            </label>
          </div>
          <div className="layer-dropdown__footer">
            <span className="layer-dropdown__help">Ctrl+Shift+A to toggle all</span>
          </div>
        </div>
      )}
    </div>
  );
};