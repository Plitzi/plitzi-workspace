// Compact human formatting for social-proof counts: 980 → "980", 1240 → "1.2k", 3_400_000 → "3.4M".
const formatCount = (n: number): string => {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }

  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  }

  return String(n);
};

export default formatCount;
