import React, { useState, useRef, useEffect } from 'react';

export interface SubmenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

interface ContextMenuSubmenuProps {
  label: string;
  icon?: React.ReactNode;
  items: SubmenuItem[];
  variant?: 'context-menu' | 'toolbar'; // Add variant prop
}

export function ContextMenuSubmenu({ label, icon, items, variant = 'context-menu' }: ContextMenuSubmenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [submenuPosition, setSubmenuPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setSubmenuPosition({
        top: rect.top,
        left: rect.right + 4, // 4px gap
      });
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    // Delay closing to allow mouse to move into submenu
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  const handleSubmenuMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const handleSubmenuMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  const handleItemClick = (item: SubmenuItem) => {
    if (!item.disabled) {
      item.onClick();
      setIsOpen(false);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  // Determine CSS classes based on variant
  const isToolbar = variant === 'toolbar';
  const buttonClass = isToolbar
    ? 'state-toolbar__button state-toolbar__button--has-submenu'
    : 'flow-context-menu__item flow-context-menu__item--has-submenu';
  const iconClass = isToolbar ? 'state-toolbar__icon' : 'flow-context-menu__icon';
  const arrowClass = isToolbar ? 'state-toolbar__arrow' : 'flow-context-menu__arrow';
  const labelClass = isToolbar ? 'state-toolbar__label' : '';
  const containerClass = isToolbar ? 'state-toolbar__container' : 'flow-context-menu flow-context-menu--submenu';
  const itemClass = isToolbar ? 'state-toolbar__button' : 'flow-context-menu__item';
  const itemDisabledClass = isToolbar ? 'state-toolbar__button--disabled' : 'flow-context-menu__item--disabled';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={buttonClass}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {icon && <span className={iconClass}>{icon}</span>}
        <span className={labelClass}>{label}</span>
        <span className={arrowClass}>→</span>
      </button>

      {isOpen && submenuPosition && (
        <div
          ref={submenuRef}
          className={containerClass}
          style={{
            position: 'fixed',
            top: `${submenuPosition.top}px`,
            left: `${submenuPosition.left}px`,
            zIndex: 100001,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
          }}
          onMouseEnter={handleSubmenuMouseEnter}
          onMouseLeave={handleSubmenuMouseLeave}
        >
          {items.map((item, index) => (
            <button
              key={index}
              type="button"
              className={`${itemClass} ${item.disabled ? itemDisabledClass : ''}`}
              onClick={() => handleItemClick(item)}
              disabled={item.disabled}
            >
              {item.icon && <span className={iconClass}>{item.icon}</span>}
              {isToolbar ? (
                <span className="state-toolbar__label">{item.label}</span>
              ) : (
                <span>{item.label}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
