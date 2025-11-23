import React, { useState, useEffect, useCallback } from 'react';
import type { Mapping } from '@amorphie-workflow/core';
import { MappingSection, MappingData } from './MappingSection';

interface TransitionMappingPopupProps {
  transitionLabel: string;
  mapping: Mapping | null | undefined;
  onClose: () => void;
  onApply: (mapping: Mapping | null) => void;
  catalogs: Record<string, any[]>;
  stateKey?: string;
  workflowName?: string;
}

/**
 * Convert Mapping to MappingData format
 */
function mappingToData(mapping: Mapping | null | undefined): MappingData {
  if (!mapping || (!mapping.location && !mapping.code)) {
    return { mode: 'none' };
  }

  const location = mapping.location || '';
  const code = mapping.code || '';

  // Determine mode based on location
  if (location.endsWith('.mapper.json')) {
    return {
      mode: 'mapper',
      mapperRef: location,
      location,
      code,
    };
  } else if (location || code) {
    return {
      mode: 'code',
      location,
      code,
    };
  }

  return { mode: 'none' };
}

/**
 * Convert MappingData to Mapping format
 */
function dataToMapping(data: MappingData): Mapping | null {
  if (data.mode === 'none') {
    return null;
  }

  if (data.mode === 'mapper') {
    return {
      location: data.mapperRef || '',
      code: data.code || '',
    };
  }

  if (data.mode === 'code') {
    return {
      location: data.location || '',
      code: data.code || '',
    };
  }

  return null;
}

export function TransitionMappingPopup({
  transitionLabel,
  mapping,
  onClose,
  onApply,
  catalogs,
  stateKey,
  workflowName,
}: TransitionMappingPopupProps) {
  const [draftMapping, setDraftMapping] = useState<MappingData>(mappingToData(mapping));
  const [isDirty, setIsDirty] = useState(false);

  // Mark as dirty when draft changes
  useEffect(() => {
    const hasChanges = JSON.stringify(draftMapping) !== JSON.stringify(mappingToData(mapping));
    setIsDirty(hasChanges);
  }, [draftMapping, mapping]);

  // Update mapping code when catalog script is updated (for readonly display)
  useEffect(() => {
    // Get the location to check (either from mapperRef or location)
    const scriptLocation = draftMapping.mapperRef || draftMapping.location;

    // Check if this is any script file (.mapper.json, .csx, .cs, .js)
    const isScriptFile = scriptLocation && (
      scriptLocation.endsWith('.mapper.json') ||
      scriptLocation.endsWith('.csx') ||
      scriptLocation.endsWith('.cs') ||
      scriptLocation.endsWith('.js')
    );

    if (isScriptFile && draftMapping.code) {
      // Find the script in the catalog
      const catalogScript = availableMappers.find(m => m.location === scriptLocation);
      if (catalogScript && catalogScript.base64 && catalogScript.base64 !== draftMapping.code) {
        // Script was updated in catalog, refresh the readonly display
        console.log('[TransitionMappingPopup] Updating readonly script display for:', scriptLocation);
        console.log('[TransitionMappingPopup] Old code length:', draftMapping.code?.length, 'New code length:', catalogScript.base64.length);
        setDraftMapping(prev => ({
          ...prev,
          code: catalogScript.base64
        }));
      }
    }
  }, [availableMappers, draftMapping.mapperRef, draftMapping.location, draftMapping.code]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleApply = useCallback(() => {
    const finalMapping = dataToMapping(draftMapping);
    onApply(finalMapping);
    onClose();
  }, [draftMapping, onApply, onClose]);

  // Handle ESC key to close, Ctrl+S/Cmd+S to save
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

  const handleMappingChange = (data: MappingData) => {
    setDraftMapping(data);
  };

  return (
    <div className="task-mapping-popup-overlay" onClick={handleClose}>
      <div className="task-mapping-popup" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="task-mapping-popup__header">
          <h2 className="task-mapping-popup__title">
            Edit Transition Mapping: {transitionLabel}
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

        {/* Label */}
        <div className="task-mapping-popup__transition-label">
          <span className="task-mapping-popup__transition-label-text">Input Mapping</span>
        </div>

        {/* Content - Single Mapping Section */}
        <div className="task-mapping-popup__content" style={{ display: 'block', padding: '20px', overflowY: 'auto' }}>
          <MappingSection
            type="input"
            value={draftMapping}
            onChange={handleMappingChange}
            availableMappers={catalogs.mapper || []}
            stateKey={stateKey}
            workflowName={workflowName}
            interfaceType="ITransitionMapping"
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
