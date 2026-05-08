const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return 'a moment';
  }

  const s = ms / 1000;
  if (s < 60) {
    return `${Math.round(s * 10) / 10}s`;
  }

  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
};

export default formatDuration;
