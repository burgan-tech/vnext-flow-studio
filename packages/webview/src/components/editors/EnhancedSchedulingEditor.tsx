import React, { useState, useMemo } from 'react';
import type { TriggerType } from '../../types/workflow-types';
import { TriggerTypeInfo } from '../../types/workflow-types';

interface EnhancedSchedulingEditorProps {
  triggerType: TriggerType;
  onTriggerTypeChange: (triggerType: TriggerType) => void;
  // For timeout transitions
  duration?: string;
  onDurationChange?: (duration: string) => void;
  // Additional scheduling options
  businessHoursOnly?: boolean;
  onBusinessHoursChange?: (businessHours: boolean) => void;
  // Enhanced context
  title?: string;
}

interface DurationPreset {
  label: string;
  value: string;
  description: string;
  category: 'immediate' | 'minutes' | 'hours' | 'business' | 'days';
}

interface TriggerTypeInfo {
  type: TriggerType;
  label: string;
  description: string;
  category: 'immediate' | 'scheduled' | 'event';
  icon: string;
  supportsTimeout: boolean;
}

const DURATION_PRESETS: DurationPreset[] = [
  // Immediate
  { label: 'Instant', value: 'PT0S', description: 'Execute immediately', category: 'immediate' },
  { label: '5 seconds', value: 'PT5S', description: 'Quick response for testing', category: 'immediate' },
  { label: '30 seconds', value: 'PT30S', description: 'Brief delay', category: 'immediate' },

  // Minutes
  { label: '1 minute', value: 'PT1M', description: 'Quick turnaround', category: 'minutes' },
  { label: '5 minutes', value: 'PT5M', description: 'Short processing window', category: 'minutes' },
  { label: '15 minutes', value: 'PT15M', description: 'Standard timeout', category: 'minutes' },
  { label: '30 minutes', value: 'PT30M', description: 'Extended processing', category: 'minutes' },

  // Hours
  { label: '1 hour', value: 'PT1H', description: 'Hourly processing', category: 'hours' },
  { label: '2 hours', value: 'PT2H', description: 'Standard business timeout', category: 'hours' },
  { label: '4 hours', value: 'PT4H', description: 'Half-day processing', category: 'hours' },
  { label: '8 hours', value: 'PT8H', description: 'Business day timeout', category: 'hours' },

  // Business
  { label: '1 business day', value: 'P1D', description: 'Next business day', category: 'business' },
  { label: '2 business days', value: 'P2D', description: 'Standard SLA', category: 'business' },
  { label: '1 business week', value: 'P7D', description: 'Weekly processing', category: 'business' },

  // Days
  { label: '1 day (24h)', value: 'P1D', description: 'Daily processing', category: 'days' },
  { label: '3 days', value: 'P3D', description: 'Extended window', category: 'days' },
  { label: '1 week', value: 'P7D', description: 'Weekly cycle', category: 'days' },
  { label: '1 month', value: 'P30D', description: 'Monthly processing', category: 'days' }
];

// Use schema-based trigger type information
const TRIGGER_TYPES = Object.entries(TriggerTypeInfo).map(([type, info]) => ({
  type: parseInt(type) as TriggerType,
  ...info,
  category: type === '2' ? 'scheduled' as const : 'immediate' as const
}));

export const EnhancedSchedulingEditor: React.FC<EnhancedSchedulingEditorProps> = ({
  triggerType,
  onTriggerTypeChange,
  duration = 'PT1H',
  onDurationChange,
  businessHoursOnly = false,
  onBusinessHoursChange,
  title = 'Trigger Configuration'
}) => {
  const [showPresets, setShowPresets] = useState(false);
  const [customDuration, setCustomDuration] = useState(duration);
  const [selectedCategory, setSelectedCategory] = useState<'immediate' | 'minutes' | 'hours' | 'business' | 'days'>('hours');

  const currentTriggerInfo = useMemo(() =>
    TRIGGER_TYPES.find(t => t.type === triggerType) || TRIGGER_TYPES[0],
    [triggerType]
  );

  const filteredPresets = useMemo(() =>
    DURATION_PRESETS.filter(p => p.category === selectedCategory),
    [selectedCategory]
  );

  const showTimeoutSettings = currentTriggerInfo.supportsTimeout;

  const handleTriggerTypeChange = (newType: TriggerType) => {
    onTriggerTypeChange(newType);

    // Auto-show presets for timeout type
    if (newType === 2) { // Timeout
      setShowPresets(true);
    }
  };

  const handlePresetSelect = (preset: DurationPreset) => {
    setCustomDuration(preset.value);
    if (onDurationChange) {
      onDurationChange(preset.value);
    }
    setShowPresets(false);
  };

  const handleCustomDurationChange = (value: string) => {
    setCustomDuration(value);
    if (onDurationChange) {
      onDurationChange(value);
    }
  };

  const parseDuration = (iso8601Duration: string): string => {
    try {
      const match = iso8601Duration.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!match) return iso8601Duration;

      const [, days, hours, minutes, seconds] = match;
      const parts: string[] = [];

      if (days) parts.push(`${days} day${days !== '1' ? 's' : ''}`);
      if (hours) parts.push(`${hours} hour${hours !== '1' ? 's' : ''}`);
      if (minutes) parts.push(`${minutes} minute${minutes !== '1' ? 's' : ''}`);
      if (seconds) parts.push(`${seconds} second${seconds !== '1' ? 's' : ''}`);

      return parts.join(', ') || '0 seconds';
    } catch {
      return iso8601Duration;
    }
  };

  return (
    <div className="property-panel__group">
      <div className="property-panel__group-header">
        <span>{title}</span>
        {showTimeoutSettings && (
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            className="property-panel__action-button"
            title="Duration presets"
          >
            ⏱️
          </button>
        )}
      </div>

      <div className="property-panel__field">
        <label>Trigger Type:</label>
        <div className="property-panel__trigger-grid">
          {TRIGGER_TYPES.map((trigger) => (
            <button
              key={trigger.type}
              type="button"
              onClick={() => handleTriggerTypeChange(trigger.type)}
              className={`property-panel__trigger-option ${
                triggerType === trigger.type ? 'property-panel__trigger-option--selected' : ''
              }`}
              title={trigger.description}
            >
              <span className="property-panel__trigger-icon">{trigger.icon}</span>
              <span className="property-panel__trigger-label">{trigger.label}</span>
              <span className="property-panel__trigger-category">{trigger.category}</span>
            </button>
          ))}
        </div>
      </div>

      {showTimeoutSettings && (
        <>
          <div className="property-panel__timeout-section">
            <h4 className="property-panel__section-title">⏰ Timeout Configuration</h4>

            {showPresets && (
              <div className="property-panel__presets-panel">
                <div className="property-panel__preset-categories">
                  {(['immediate', 'minutes', 'hours', 'business', 'days'] as const).map(category => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setSelectedCategory(category)}
                      className={`property-panel__preset-category ${
                        selectedCategory === category ? 'property-panel__preset-category--active' : ''
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                <div className="property-panel__preset-grid">
                  {filteredPresets.map((preset, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handlePresetSelect(preset)}
                      className={`property-panel__preset-item ${
                        customDuration === preset.value ? 'property-panel__preset-item--selected' : ''
                      }`}
                      title={preset.description}
                    >
                      <span className="property-panel__preset-label">{preset.label}</span>
                      <span className="property-panel__preset-value">{preset.value}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="property-panel__field">
              <label>Duration (ISO 8601):</label>
              <div className="property-panel__input-group">
                <input
                  type="text"
                  value={customDuration}
                  onChange={(e) => handleCustomDurationChange(e.target.value)}
                  placeholder="PT1H (1 hour)"
                  className="property-panel__input"
                />
                <button
                  type="button"
                  onClick={() => setShowPresets(!showPresets)}
                  className="property-panel__action-button"
                  title="Select from presets"
                >
                  📋
                </button>
              </div>
              <div className="property-panel__help">
                <strong>Parsed:</strong> {parseDuration(customDuration)}
              </div>
            </div>

            {onBusinessHoursChange && (
              <div className="property-panel__field">
                <label className="property-panel__checkbox-label">
                  <input
                    type="checkbox"
                    checked={businessHoursOnly}
                    onChange={(e) => onBusinessHoursChange(e.target.checked)}
                    className="property-panel__checkbox"
                  />
                  <span>Business hours only</span>
                </label>
                <div className="property-panel__help">
                  Only execute during business hours (9 AM - 5 PM, Monday-Friday)
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <div className="property-panel__current-config">
        <h4 className="property-panel__section-title">📋 Current Configuration</h4>
        <div className="property-panel__config-summary">
          <div className="property-panel__config-item">
            <span className="property-panel__config-label">Type:</span>
            <span className="property-panel__config-value">
              {currentTriggerInfo.icon} {currentTriggerInfo.label}
            </span>
          </div>

          {showTimeoutSettings && (
            <>
              <div className="property-panel__config-item">
                <span className="property-panel__config-label">Duration:</span>
                <span className="property-panel__config-value">{parseDuration(customDuration)}</span>
              </div>

              <div className="property-panel__config-item">
                <span className="property-panel__config-label">Business Hours:</span>
                <span className="property-panel__config-value">
                  {businessHoursOnly ? '✅ Yes' : '❌ No'}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="property-panel__config-description">
          {currentTriggerInfo.description}
          {showTimeoutSettings && businessHoursOnly && (
            <span> The timeout will only be evaluated during business hours.</span>
          )}
        </div>
      </div>

      <div className="property-panel__help">
        <h4>💡 Scheduling Tips:</h4>
        <ul>
          <li><strong>Manual:</strong> User must trigger explicitly (buttons, forms)</li>
          <li><strong>Automatic:</strong> System triggers when conditions are met</li>
          <li><strong>Timeout:</strong> Triggers after specified time duration</li>
          <li><strong>On Entry/Exit:</strong> State lifecycle events</li>
          <li><strong>ISO 8601:</strong> PT1H30M = 1 hour 30 minutes, P1D = 1 day</li>
        </ul>
      </div>
    </div>
  );
};
