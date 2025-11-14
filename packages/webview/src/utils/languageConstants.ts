/**
 * Language constants for multi-language support
 */

export const DEFAULT_LANGUAGES = ['en-US', 'tr-TR'] as const;
export const DEFAULT_LANGUAGE_LABELS: Record<string, string> = {
  'en-US': 'English (US)',
  'tr-TR': 'Turkish'
};

/**
 * Validate that labels include all required default languages
 */
export function validateRequiredLanguages(labels: Array<{ language: string; label: string }>): {
  valid: boolean;
  missingLanguages: string[];
} {
  const presentLanguages = labels.map(l => l.language);
  const missingLanguages = DEFAULT_LANGUAGES.filter(lang => !presentLanguages.includes(lang));

  return {
    valid: missingLanguages.length === 0 && labels.some(l => l.label.trim()),
    missingLanguages
  };
}

/**
 * Ensure labels have all required languages, adding empty ones if missing
 */
export function ensureRequiredLanguages(labels: Array<{ language: string; label: string }>): Array<{ language: string; label: string }> {
  const result = [...labels];

  // Add missing default languages
  for (const lang of DEFAULT_LANGUAGES) {
    if (!result.find(l => l.language === lang)) {
      result.push({ language: lang, label: '' });
    }
  }

  return result;
}
