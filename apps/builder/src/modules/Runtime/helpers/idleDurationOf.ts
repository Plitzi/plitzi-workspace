const UNITS = [
  { minutes: 24 * 60, name: 'day' },
  { minutes: 60, name: 'hour' },
  { minutes: 1, name: 'minute' }
];

/**
 * How long a runtime may go unused, in the largest unit it is a whole number of: a week reads `7 days`, not `10080
 * minutes`.
 */
const idleDurationOf = (minutes: number): string => {
  const unit = UNITS.find(candidate => minutes % candidate.minutes === 0) ?? { minutes: 1, name: 'minute' };
  const count = minutes / unit.minutes;

  return `${String(count)} ${unit.name}${count === 1 ? '' : 's'}`;
};

export default idleDurationOf;
