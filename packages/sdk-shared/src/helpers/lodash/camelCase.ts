export function camelCase(value: string): string {
  if (!value) {
    return '';
  }

  const str = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
    .replace(/[_\s-]+/g, ' ')
    .trim();

  const words = str.split(/\s+/);
  if (words.length === 0) {
    return '';
  }

  return words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
}
