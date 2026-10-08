export const ANGLE_UNITS = [
  { label: 'DEG', value: 'deg' },
  { label: 'TURN', value: 'turn' },
  { label: 'RAD', value: 'rad' }
];

export const LINEAR_DIRECTIONS = [
  'to top',
  'to right',
  'to bottom',
  'to left',
  'to top right',
  'to bottom right',
  'to bottom left',
  'to top left'
];

export const CENTER_X_WORDS = ['center', 'left', 'right'];

export const CENTER_Y_WORDS = ['center', 'top', 'bottom'];

/** The keywords a radial gradient's size can be; anything else is a size of its own (`100px`, `40% 20%`). */
export const RADIAL_EXTENTS = [
  { value: 'farthest-corner', label: 'Farthest corner' },
  { value: 'farthest-side', label: 'Farthest side' },
  { value: 'closest-corner', label: 'Closest corner' },
  { value: 'closest-side', label: 'Closest side' }
];

export const isExtentKeyword = (extent: string): boolean => RADIAL_EXTENTS.some(option => option.value === extent);

/** A size a circle takes as one length; an ellipse needs two. */
export const customExtentFor = (shape: 'circle' | 'ellipse'): string => (shape === 'circle' ? '100px' : '50% 50%');

/** A gradient's center as its two axes — CSS's default (the middle) when it names none. */
export const centerParts = (position: string): [string, string] => {
  const [x = 'center', y = 'center'] = position.split(' ').filter(Boolean);

  return [x, y];
};

/** Back to the one value, left out when it is the default — so a gradient that never named a center still names none. */
export const joinCenter = (x: string, y: string): string => (x === 'center' && y === 'center' ? '' : `${x} ${y}`);
