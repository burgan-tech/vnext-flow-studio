import type { Label, Lang } from './types/index.js';

export function getLocalizedLabel(labels: Label[], lang: Lang = 'en'): string | undefined {
  return labels.find(l => l.language === lang)?.label || labels[0]?.label;
}

export function createLabel(text: string, language: Lang = 'en'): Label {
  return { label: text, language };
}

export function generateUniqueKey(prefix: string, existingKeys: Set<string>): string {
  let counter = 1;
  let key = `${prefix}${counter}`;
  while (existingKeys.has(key)) {
    counter++;
    key = `${prefix}${counter}`;
  }
  return key;
}

export function isValidDuration(duration: string): boolean {
  return /^PT\d+[HMS]$/.test(duration);
}

export function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10)
  };
}

export function compareVersions(a: string, b: string): number {
  const versionA = parseVersion(a);
  const versionB = parseVersion(b);

  if (!versionA || !versionB) {
    return a.localeCompare(b, 'en', { numeric: true });
  }

  if (versionA.major !== versionB.major) return versionA.major - versionB.major;
  if (versionA.minor !== versionB.minor) return versionA.minor - versionB.minor;
  return versionA.patch - versionB.patch;
}