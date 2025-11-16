import React, { useState, useEffect } from 'react';
import styles from './WorkflowSettingsPanel.module.css';
import {
  validateTag,
  validateAllSettings
} from '../utils/workflowValidation';
import { ComponentSearchPanel } from './editors/ComponentSearchPanel';
import type { ComponentReference } from './editors/ReferenceSelector';
import { DEFAULT_LANGUAGES, DEFAULT_LANGUAGE_LABELS, ensureRequiredLanguages } from '../utils/languageConstants';

interface LanguageLabel {
  label: string;
  language: string;
}

interface WorkflowSettings {
  key: string;
  domain: string;
  version: string;
  tags: string[];
  type: 'C' | 'F' | 'S' | 'P';
  subFlowType?: 'S' | 'P';
  labels?: LanguageLabel[];
  timeout?: {
    key: string;
    target: string;
    versionStrategy: string;
    timer: any;
  } | null;
  functions?: any[];
  features?: any[];
  extensions?: any[];
}

interface WorkflowSettingsPanelProps {
  postMessage: (message: any) => void;
  catalogs?: Record<string, any[]>;
  workflow?: any;
}

export function WorkflowSettingsPanel({ postMessage, catalogs = {}, workflow }: WorkflowSettingsPanelProps) {
  console.log('[WorkflowSettingsPanel] Component rendering');

  const [settings, setSettings] = useState<WorkflowSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<WorkflowSettings | null>(null);
  const [newTag, setNewTag] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'labels-tags' | 'timeout' | 'dependencies'>('general');
  const [activeLanguage, setActiveLanguage] = useState<string>('en-US');
  const [timeoutDuration, setTimeoutDuration] = useState<string>('PT1H');

  // Request settings when component mounts
  useEffect(() => {
    console.log('[WorkflowSettingsPanel] Requesting settings');
    try {
      postMessage({ type: 'workflow:getSettings' });
    } catch (error) {
      console.error('[WorkflowSettingsPanel] Error posting message:', error);
    }

    // Listen for settings response
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      console.log('[WorkflowSettingsPanel] Received message:', message.type);
      if (message.type === 'workflow:settings') {
        console.log('[WorkflowSettingsPanel] Received settings:', message.data);
        // Ensure required languages are present
        const settingsWithLanguages = {
          ...message.data,
          labels: ensureRequiredLanguages(message.data.labels || [])
        };
        setSettings(settingsWithLanguages);
        setOriginalSettings(JSON.parse(JSON.stringify(settingsWithLanguages)));
      } else if (message.type === 'workflow:settingsSaved') {
        setSaving(false);
        if (message.success) {
          setSettings(current => {
            if (current) {
              setOriginalSettings(JSON.parse(JSON.stringify(current)));
            }
            return current;
          });
          setErrors({});
        } else {
          // Show error
          console.error('Failed to save settings:', message.error);
        }
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, [postMessage]);

  const handleFieldChange = (field: keyof WorkflowSettings, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });

    // Clear error for this field
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  const handleAddTag = () => {
    if (!settings || !newTag.trim()) return;

    const validationResult = validateTag(newTag);
    if (!validationResult.valid) {
      setErrors({ ...errors, newTag: validationResult.error! });
      return;
    }

    setSettings({
      ...settings,
      tags: [...settings.tags, newTag.trim()]
    });
    setNewTag('');
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.newTag;
      return newErrors;
    });
  };

  const handleRemoveTag = (index: number) => {
    if (!settings) return;
    setSettings({
      ...settings,
      tags: settings.tags.filter((_, i) => i !== index)
    });
  };

  const handleAddLabel = (language?: string) => {
    if (!settings) return;

    // Use provided language or find first unused common language
    const COMMON_LANGUAGES = ['en-US', 'tr-TR', 'de-DE', 'fr-FR', 'es-ES'];
    const unusedLang = language || COMMON_LANGUAGES.find(lang => !settings.labels?.some(l => l.language === lang));
    const newLang = unusedLang || `lang-${(settings.labels?.length || 0) + 1}`;

    setSettings({
      ...settings,
      labels: [...(settings.labels || []), { label: '', language: newLang }]
    });
    setActiveLanguage(newLang);
  };

  const handleRemoveLabel = (index: number) => {
    if (!settings || !settings.labels) return;

    const labelToRemove = settings.labels[index];

    // Prevent removal of required languages
    if ((DEFAULT_LANGUAGES as readonly string[]).includes(labelToRemove.language)) {
      return;
    }

    const newLabels = settings.labels.filter((_, i) => i !== index);
    setSettings({
      ...settings,
      labels: newLabels
    });

    // Switch to first remaining language if active language was removed
    if (activeLanguage === labelToRemove.language && newLabels.length > 0) {
      setActiveLanguage(newLabels[0].language);
    }
  };

  const handleAddFunction = (reference: ComponentReference) => {
    if (!settings) return;
    const newFunctions = [...(settings.functions || []), reference];
    setSettings({
      ...settings,
      functions: newFunctions
    });
  };

  const handleRemoveFunction = (index: number) => {
    if (!settings) return;
    setSettings({
      ...settings,
      functions: settings.functions?.filter((_, i) => i !== index) || []
    });
  };

  const handleAddFeature = (reference: ComponentReference) => {
    if (!settings) return;
    const newFeatures = [...(settings.features || []), reference];
    setSettings({
      ...settings,
      features: newFeatures
    });
  };

  const handleRemoveFeature = (index: number) => {
    if (!settings) return;
    setSettings({
      ...settings,
      features: settings.features?.filter((_, i) => i !== index) || []
    });
  };

  const handleAddExtension = (reference: ComponentReference) => {
    if (!settings) return;
    const newExtensions = [...(settings.extensions || []), reference];
    setSettings({
      ...settings,
      extensions: newExtensions
    });
  };

  const handleRemoveExtension = (index: number) => {
    if (!settings) return;
    setSettings({
      ...settings,
      extensions: settings.extensions?.filter((_, i) => i !== index) || []
    });
  };

  const handleSave = () => {
    if (!settings) return;

    // Validate all settings
    const validation = validateAllSettings(settings);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setSaving(true);
    postMessage({
      type: 'workflow:updateSettings',
      data: settings
    });
  };

  const handleCancel = () => {
    if (originalSettings) {
      setSettings(JSON.parse(JSON.stringify(originalSettings)));
      setErrors({});
    }
  };

  const isDirty = () => {
    if (!settings || !originalSettings) return false;
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  };

  console.log('[WorkflowSettingsPanel] Settings:', settings);

  if (!settings) {
    return (
      <div style={{ padding: '20px', background: 'white' }}>
        <div>Loading workflow settings...</div>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'general' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'labels-tags' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('labels-tags')}
        >
          Labels & Tags
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'timeout' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('timeout')}
        >
          Timeout
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'dependencies' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('dependencies')}
        >
          Dependencies
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.content} style={{ flex: 1, overflowY: 'auto' }}>
        <div className={styles.tabContent}>
          {/* General Tab */}
          {activeTab === 'general' && (
            <>
              <div className={styles.sectionGroup}>
                <div className={styles.sectionTitle}>Metadata</div>
                <div className={styles.warning}>
                  ⚠️ Warning: Changing these fields affects workflow identity
                </div>

                <div className={styles.field}>
                  <label>Key *</label>
                  <input
                    type="text"
                    value={settings.key}
                    onChange={e => handleFieldChange('key', e.target.value)}
                    className={errors.key ? styles.inputError : ''}
                    placeholder="loan-approval"
                  />
                  {errors.key && <div className={styles.errorMessage}>{errors.key}</div>}
                </div>

                <div className={styles.field}>
                  <label>Domain *</label>
                  <input
                    type="text"
                    value={settings.domain}
                    onChange={e => handleFieldChange('domain', e.target.value)}
                    className={errors.domain ? styles.inputError : ''}
                    placeholder="finance"
                  />
                  {errors.domain && <div className={styles.errorMessage}>{errors.domain}</div>}
                </div>

                <div className={styles.field}>
                  <label>Version *</label>
                  <input
                    type="text"
                    value={settings.version}
                    onChange={e => handleFieldChange('version', e.target.value)}
                    className={errors.version ? styles.inputError : ''}
                    placeholder="1.0.0"
                  />
                  {errors.version && <div className={styles.errorMessage}>{errors.version}</div>}
                </div>
              </div>

              <div className={styles.sectionGroup}>
                <div className={styles.sectionTitle}>Type Configuration</div>

                <div className={styles.field}>
                  <label>Type *</label>
                  <select
                    value={settings.type}
                    onChange={e => handleFieldChange('type', e.target.value as 'C' | 'F' | 'S' | 'P')}
                    className={errors.type ? styles.inputError : ''}
                  >
                    <option value="C">Core (C)</option>
                    <option value="F">Flow (F)</option>
                    <option value="S">SubFlow (S)</option>
                    <option value="P">Sub Process (P)</option>
                  </select>
                  {errors.type && <div className={styles.errorMessage}>{errors.type}</div>}
                </div>

                {(settings.type === 'S' || settings.type === 'P') && (
                  <div className={styles.field}>
                    <label>SubFlow Type</label>
                    <select
                      value={settings.subFlowType || ''}
                      onChange={e => handleFieldChange('subFlowType', e.target.value || undefined)}
                      className={errors.subFlowType ? styles.inputError : ''}
                    >
                      <option value="">Not specified</option>
                      <option value="S">SubFlow (S)</option>
                      <option value="P">Sub Process (P)</option>
                    </select>
                    {errors.subFlowType && <div className={styles.errorMessage}>{errors.subFlowType}</div>}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Labels & Tags Tab */}
          {activeTab === 'labels-tags' && (
            <>
              <div className={styles.sectionGroup}>
                <div className={styles.sectionTitle}>Labels</div>
                <div className={styles.hint} style={{ marginBottom: '12px' }}>
                  Multi-language workflow labels
                </div>

                {/* Language Tabs */}
                {settings.labels && settings.labels.length > 0 && (
                  <div className={styles.languageTabs}>
                    {settings.labels.map((label, index) => {
                      const isRequired = (DEFAULT_LANGUAGES as readonly string[]).includes(label.language);
                      const canRemove = !isRequired;
                      return (
                        <button
                          key={index}
                          type="button"
                          className={`${styles.languageTab} ${activeLanguage === label.language ? styles.languageTabActive : ''}`}
                          onClick={() => setActiveLanguage(label.language)}
                        >
                          {DEFAULT_LANGUAGE_LABELS[label.language] || label.language}
                          {isRequired && <span style={{ marginLeft: '4px', color: 'inherit', opacity: 0.7 }} title="Required language">*</span>}
                          {canRemove && (
                            <span
                              className={styles.languageTabRemove}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveLabel(index);
                              }}
                              title="Remove language"
                            >
                              ×
                            </span>
                          )}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className={`${styles.languageTab} ${styles.languageTabAdd}`}
                      onClick={() => handleAddLabel()}
                      title="Add language"
                    >
                      + Add Language
                    </button>
                  </div>
                )}

                {/* Active Language Editor */}
                {settings.labels && settings.labels.length > 0 && (
                  <div className={styles.field}>
                    <label>
                      Label ({DEFAULT_LANGUAGE_LABELS[activeLanguage] || activeLanguage})
                      {(DEFAULT_LANGUAGES as readonly string[]).includes(activeLanguage) && (
                        <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={settings.labels.find(l => l.language === activeLanguage)?.label || ''}
                      onChange={e => {
                        const newLabels = settings.labels?.map(l =>
                          l.language === activeLanguage ? { ...l, label: e.target.value } : l
                        );
                        handleFieldChange('labels', newLabels);
                      }}
                      placeholder={`Enter label in ${DEFAULT_LANGUAGE_LABELS[activeLanguage] || activeLanguage}`}
                    />
                    <div className={styles.hint}>
                      Labels are displayed in the workflow UI for different languages. Languages marked with * are required.
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.sectionGroup}>
                <div className={styles.sectionTitle}>Tags</div>

                <div className={styles.tagsList}>
                  {settings.tags.map((tag, index) => (
                    <div key={index} className={styles.tag}>
                      <span>{tag}</span>
                      <button onClick={() => handleRemoveTag(index)} title="Remove tag">×</button>
                    </div>
                  ))}
                </div>

                <div className={styles.tagInput}>
                  <input
                    type="text"
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                    className={errors.newTag ? styles.inputError : ''}
                    placeholder="Add tag..."
                  />
                  <button onClick={handleAddTag} className={styles.addButton}>+ Add</button>
                </div>
                {errors.newTag && <div className={styles.errorMessage}>{errors.newTag}</div>}
              </div>
            </>
          )}

          {/* Timeout Tab */}
          {activeTab === 'timeout' && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionTitle}>Workflow Timeout</div>
              <div className={styles.hint} style={{ marginBottom: '16px' }}>
                Configure a timeout that will be rendered as a state node on the canvas.
              </div>

              {settings.timeout ? (
                <>
                  <div className={styles.field}>
                    <label>Timeout State Key <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="text"
                      value={settings.timeout.key}
                      onChange={e => handleFieldChange('timeout', { ...settings.timeout!, key: e.target.value })}
                      className={errors.timeoutKey ? styles.inputError : ''}
                      placeholder="timeout"
                    />
                    {errors.timeoutKey && <div className={styles.errorMessage}>{errors.timeoutKey}</div>}
                    <div className={styles.hint}>The key for the timeout state node</div>
                  </div>

                  <div className={styles.field}>
                    <label>Target State <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      value={settings.timeout.target}
                      onChange={e => handleFieldChange('timeout', { ...settings.timeout!, target: e.target.value })}
                      className={errors.timeoutTarget ? styles.inputError : ''}
                    >
                      <option value="">Select a state...</option>
                      {workflow?.attributes?.states?.map((state: any) => (
                        <option key={state.key} value={state.key}>
                          {state.key}
                        </option>
                      ))}
                    </select>
                    {errors.timeoutTarget && <div className={styles.errorMessage}>{errors.timeoutTarget}</div>}
                    <div className={styles.hint}>The state to transition to after timeout</div>
                  </div>

                  <div className={styles.field}>
                    <label>Duration <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="text"
                      value={settings.timeout.timer?.duration || timeoutDuration}
                      onChange={e => {
                        const newDuration = e.target.value;
                        setTimeoutDuration(newDuration);
                        handleFieldChange('timeout', {
                          ...settings.timeout!,
                          timer: { ...(settings.timeout!.timer || {}), duration: newDuration }
                        });
                      }}
                      placeholder="PT1H30M"
                      className={errors.timeoutDuration ? styles.inputError : ''}
                    />
                    {errors.timeoutDuration && <div className={styles.errorMessage}>{errors.timeoutDuration}</div>}
                    <div className={styles.hint}>
                      ISO 8601 duration format. Examples: PT30S (30 seconds), PT5M (5 minutes), PT1H (1 hour)
                    </div>

                    {/* Duration Presets */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                      {['PT30S', 'PT1M', 'PT5M', 'PT15M', 'PT30M', 'PT1H', 'PT24H'].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          className={styles.cancelButton}
                          onClick={() => {
                            setTimeoutDuration(preset);
                            handleFieldChange('timeout', {
                              ...settings.timeout!,
                              timer: { ...(settings.timeout!.timer || {}), duration: preset }
                            });
                          }}
                          style={{ padding: '4px 8px', fontSize: '12px', width: 'auto' }}
                        >
                          {preset.replace('PT', '').replace('H', 'h').replace('M', 'm').replace('S', 's')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label>Reset Strategy</label>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="reset"
                          value="N"
                          checked={(settings.timeout.timer?.reset || 'N') === 'N'}
                          onChange={() => {
                            handleFieldChange('timeout', {
                              ...settings.timeout!,
                              timer: { ...(settings.timeout!.timer || {}), reset: 'N' }
                            });
                          }}
                          style={{ marginRight: '8px' }}
                        />
                        <span>No Reset (N)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="reset"
                          value="R"
                          checked={settings.timeout.timer?.reset === 'R'}
                          onChange={() => {
                            handleFieldChange('timeout', {
                              ...settings.timeout!,
                              timer: { ...(settings.timeout!.timer || {}), reset: 'R' }
                            });
                          }}
                          style={{ marginRight: '8px' }}
                        />
                        <span>Reset (R)</span>
                      </label>
                    </div>
                    <div className={styles.hint}>Whether the timer should reset when the state is re-entered</div>
                  </div>

                  <div className={styles.field}>
                    <label>Version Strategy <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      value={settings.timeout.versionStrategy}
                      onChange={e => handleFieldChange('timeout', { ...settings.timeout!, versionStrategy: e.target.value })}
                    >
                      <option value="Major">Major</option>
                      <option value="Minor">Minor</option>
                      <option value="Patch">Patch</option>
                    </select>
                  </div>

                  <button
                    onClick={() => handleFieldChange('timeout', null)}
                    className={styles.cancelButton}
                    style={{ width: '100%', marginTop: '16px' }}
                  >
                    Remove Timeout
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleFieldChange('timeout', {
                    key: 'timeout',
                    target: 'end',
                    versionStrategy: 'Major',
                    timer: { duration: 'PT1H', reset: 'N' }
                  })}
                  className={styles.addButton}
                  style={{ width: '100%' }}
                >
                  + Configure Timeout
                </button>
              )}
            </div>
          )}

          {/* Dependencies Tab */}
          {activeTab === 'dependencies' && (
            <>
              <div className={styles.sectionGroup}>
                <div className={styles.sectionTitle}>Functions ({settings.functions?.length || 0})</div>

                {settings.functions && settings.functions.length > 0 && (
                  <div className={styles.referenceList}>
                    {settings.functions.map((func, index) => (
                      <div key={index} className={styles.referenceItem}>
                        <span className={styles.referenceText}>
                          {func.domain}/{func.key}@{func.version}
                        </span>
                        <button
                          onClick={() => handleRemoveFunction(index)}
                          className={styles.removeButton}
                          title="Remove function"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <ComponentSearchPanel
                  label="Add Function"
                  availableComponents={catalogs.function || []}
                  componentType="Function"
                  defaultFlow="sys-functions"
                  onSelectComponent={handleAddFunction}
                  placeholder="Search functions..."
                />
              </div>

              <div className={styles.sectionGroup}>
                <div className={styles.sectionTitle}>Features ({settings.features?.length || 0})</div>

                {settings.features && settings.features.length > 0 && (
                  <div className={styles.referenceList}>
                    {settings.features.map((feature, index) => (
                      <div key={index} className={styles.referenceItem}>
                        <span className={styles.referenceText}>
                          {feature.domain}/{feature.key}@{feature.version}
                        </span>
                        <button
                          onClick={() => handleRemoveFeature(index)}
                          className={styles.removeButton}
                          title="Remove feature"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <ComponentSearchPanel
                  label="Add Feature"
                  availableComponents={catalogs.feature || []}
                  componentType="Extension"
                  defaultFlow="sys-features"
                  onSelectComponent={handleAddFeature}
                  placeholder="Search features..."
                />
              </div>

              <div className={styles.sectionGroup}>
                <div className={styles.sectionTitle}>Extensions ({settings.extensions?.length || 0})</div>

                {settings.extensions && settings.extensions.length > 0 && (
                  <div className={styles.referenceList}>
                    {settings.extensions.map((ext, index) => (
                      <div key={index} className={styles.referenceItem}>
                        <span className={styles.referenceText}>
                          {ext.domain}/{ext.key}@{ext.version}
                        </span>
                        <button
                          onClick={() => handleRemoveExtension(index)}
                          className={styles.removeButton}
                          title="Remove extension"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <ComponentSearchPanel
                  label="Add Extension"
                  availableComponents={catalogs.extension || []}
                  componentType="Extension"
                  defaultFlow="sys-extensions"
                  onSelectComponent={handleAddExtension}
                  placeholder="Search extensions..."
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <button onClick={handleCancel} className={styles.cancelButton} disabled={saving}>
          Cancel
        </button>
        <button
          onClick={handleSave}
          className={styles.saveButton}
          disabled={saving || !isDirty()}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {isDirty() && <span className={styles.dirtyIndicator}>● Unsaved changes</span>}
      </div>
    </div>
  );
}
