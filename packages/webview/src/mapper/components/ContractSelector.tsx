/**
 * ContractSelector Component
 * UI for selecting contract type when creating a new mapper
 */

import React, { useState } from 'react';
import './ContractSelector.css';
import type { ContractType } from '@amorphie-flow-studio/core/mapper';

export interface ContractOption {
  type: ContractType;
  name: string;
  description: string;
  icon: string;
  methods: string[];
  useCases: string[];
}

export interface ContractSelectorProps {
  /** Currently selected contract type */
  selectedContract?: ContractType;

  /** Callback when contract type changes */
  onContractChange: (contractType: ContractType) => void;

  /** Suggested contract type (from context) */
  suggestedContract?: ContractType;

  /** Optional class name */
  className?: string;
}

/**
 * Contract type options with metadata
 */
export const CONTRACT_OPTIONS: ContractOption[] = [
  {
    type: 'IMapping',
    name: 'Task Mapping',
    description: 'Map data before and after task execution',
    icon: '🔄',
    methods: ['InputHandler', 'OutputHandler'],
    useCases: [
      'HTTP request/response transformation',
      'API call data preparation',
      'Task result processing'
    ]
  },
  {
    type: 'IConditionMapping',
    name: 'Condition',
    description: 'Boolean logic for auto-transitions',
    icon: '🔀',
    methods: ['Handler'],
    useCases: [
      'Approval thresholds',
      'Data validation checks',
      'Business rule evaluation'
    ]
  },
  {
    type: 'ITransitionMapping',
    name: 'Transition',
    description: 'Transform data during state transitions',
    icon: '➡️',
    methods: ['Handler'],
    useCases: [
      'State-specific data transformation',
      'Transition metadata generation',
      'Dynamic routing data'
    ]
  },
  {
    type: 'ISubFlowMapping',
    name: 'SubFlow',
    description: 'Prepare and process subflow data',
    icon: '🔁',
    methods: ['InputHandler', 'OutputHandler'],
    useCases: [
      'Approval workflows',
      'Child process integration',
      'Parallel subflow coordination'
    ]
  },
  {
    type: 'ISubProcessMapping',
    name: 'SubProcess',
    description: 'Fire-and-forget subprocess initialization',
    icon: '🚀',
    methods: ['InputHandler'],
    useCases: [
      'Background tasks',
      'Async notifications',
      'Audit log generation'
    ]
  },
  {
    type: 'ITimerMapping',
    name: 'Timer',
    description: 'Calculate timer schedules dynamically',
    icon: '⏱️',
    methods: ['Handler'],
    useCases: [
      'Business day calculations',
      'SLA deadline tracking',
      'Scheduled reminders'
    ]
  }
];

/**
 * Contract type selector with detailed information
 */
export function ContractSelector({
  selectedContract,
  onContractChange,
  suggestedContract,
  className = ''
}: ContractSelectorProps) {
  const [expandedCard, setExpandedCard] = useState<ContractType | null>(null);

  const handleCardClick = (contractType: ContractType) => {
    if (expandedCard === contractType) {
      setExpandedCard(null);
    } else {
      setExpandedCard(contractType);
    }
  };

  const handleSelect = (contractType: ContractType) => {
    onContractChange(contractType);
  };

  return (
    <div className={`contract-selector ${className}`}>
      <div className="contract-selector-header">
        <h3>Select Contract Type</h3>
        {suggestedContract && (
          <div className="suggested-contract-badge">
            <span className="badge-label">Suggested:</span>
            <span className="badge-value">
              {CONTRACT_OPTIONS.find(c => c.type === suggestedContract)?.name}
            </span>
          </div>
        )}
      </div>

      <div className="contract-grid">
        {CONTRACT_OPTIONS.map((option) => {
          const isSelected = selectedContract === option.type;
          const isSuggested = suggestedContract === option.type;
          const isExpanded = expandedCard === option.type;

          return (
            <div
              key={option.type}
              className={`contract-card ${isSelected ? 'selected' : ''} ${isSuggested ? 'suggested' : ''} ${isExpanded ? 'expanded' : ''}`}
              onClick={() => handleCardClick(option.type)}
            >
              <div className="card-header">
                <div className="card-icon">{option.icon}</div>
                <div className="card-title-section">
                  <h4 className="card-title">{option.name}</h4>
                  <p className="card-description">{option.description}</p>
                </div>
                {isSuggested && !isSelected && (
                  <div className="suggested-indicator">★</div>
                )}
              </div>

              <div className="card-meta">
                <div className="methods-list">
                  {option.methods.map((method) => (
                    <span key={method} className="method-badge">
                      {method}
                    </span>
                  ))}
                </div>
              </div>

              {isExpanded && (
                <div className="card-expanded-content">
                  <div className="use-cases-section">
                    <h5>Common Use Cases:</h5>
                    <ul className="use-cases-list">
                      {option.useCases.map((useCase, idx) => (
                        <li key={idx}>{useCase}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="card-actions">
                <button
                  className={`select-button ${isSelected ? 'selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(option.type);
                  }}
                >
                  {isSelected ? '✓ Selected' : 'Select'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Compact contract selector (dropdown style)
 */
export function CompactContractSelector({
  selectedContract,
  onContractChange,
  className = ''
}: Omit<ContractSelectorProps, 'suggestedContract'>) {
  return (
    <div className={`compact-contract-selector ${className}`}>
      <label htmlFor="contract-type-select" className="selector-label">
        Contract Type:
      </label>
      <select
        id="contract-type-select"
        className="contract-select"
        value={selectedContract || ''}
        onChange={(e) => onContractChange(e.target.value as ContractType)}
      >
        <option value="" disabled>
          Select a contract type...
        </option>
        {CONTRACT_OPTIONS.map((option) => (
          <option key={option.type} value={option.type}>
            {option.icon} {option.name} - {option.description}
          </option>
        ))}
      </select>
    </div>
  );
}
