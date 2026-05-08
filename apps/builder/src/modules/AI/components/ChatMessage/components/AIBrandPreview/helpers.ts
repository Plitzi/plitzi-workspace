export const needsWhiteText = (hex: string): boolean => {
  if (hex.length < 7) {
    return false;
  }

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
};

export const COLOR_LABELS: Record<string, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  accent: 'Accent',
  background: 'Background',
  surface: 'Surface',
  text: 'Text'
};
