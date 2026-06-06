import type { HistoryEntry } from '@plitzi/nexus/history';

export const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString(undefined, { hour12: false }) +
  '.' +
  String(timestamp % 1000).padStart(3, '0');

export const previewValue = (value: unknown): string => {
  if (value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  const fallback = Array.isArray(value) ? '[…]' : '{…}';
  let serialized: string;
  try {
    serialized = JSON.stringify(value) || fallback;
  } catch {
    serialized = fallback;
  }

  return serialized.length > 120 ? serialized.slice(0, 120) + '…' : serialized;
};

export const matchesFilter = <TState>(entry: HistoryEntry<TState>, filter: string): boolean => {
  if (!filter) {
    return true;
  }

  return (entry.path ?? '').toLowerCase().includes(filter.toLowerCase());
};
