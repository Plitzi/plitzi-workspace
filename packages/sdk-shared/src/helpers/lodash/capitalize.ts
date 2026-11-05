export function capitalize(value?: string | null): string {
  if (value == null || typeof value !== 'string' || !value.trim()) {
    return '';
  }

  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
