/** Time left before a runtime stops, as the header counts it down: hours while there are any, then minutes. */
const timeLeftOf = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) {
    return `${String(hours)} h`;
  }

  return `${String(Math.max(1, Math.ceil(seconds / 60)))} min`;
};

export default timeLeftOf;
