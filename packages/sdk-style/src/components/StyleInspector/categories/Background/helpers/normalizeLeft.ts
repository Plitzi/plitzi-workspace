const normalizeLeft = (left: string, max: number = Infinity): string => {
  if (!left) {
    return '0';
  }

  const trimmed = left.trim();
  const match = trimmed.match(/^(-?\d+(\.\d+)?)(%)?([a-zA-Z]+)?$/);
  if (!match) {
    return trimmed;
  }

  const value = Number(match[1]);
  const isPercent = !!match[3];
  const unit = match[4] || '';

  // percent logic
  if (isPercent) {
    const clamped = Math.min(100, Math.max(0, value));

    return `${clamped}%`;
  }

  // other units logic
  const numericMax = typeof max === 'number' ? max : Infinity;

  const clamped = Math.min(numericMax, Math.max(0, value));

  return `${clamped}${unit}`;
};

export default normalizeLeft;
