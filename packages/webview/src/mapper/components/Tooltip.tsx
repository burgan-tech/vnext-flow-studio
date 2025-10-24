import { useState, useRef, useEffect } from 'react';
import './Tooltip.css';

export interface TooltipProps {
  content: {
    label: string;
    description?: string;
  };
  children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      // Position tooltip to the right of the trigger, centered vertically
      let top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
      let left = triggerRect.right + 8;

      // Adjust if tooltip goes off screen
      if (top < 10) top = 10;
      if (top + tooltipRect.height > window.innerHeight - 10) {
        top = window.innerHeight - tooltipRect.height - 10;
      }
      if (left + tooltipRect.width > window.innerWidth - 10) {
        left = triggerRect.left - tooltipRect.width - 8;
      }

      setPosition({ top, left });
    }
  }, [isVisible]);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="tooltip-trigger"
      >
        {children}
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          className="tooltip-popup"
          style={{
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          <div className="tooltip-label">{content.label}</div>
          {content.description && (
            <div className="tooltip-description">{content.description}</div>
          )}
        </div>
      )}
    </>
  );
}
