export type TransformArgKind = 'length' | 'number' | 'angle';

export type TransformArgSpec = {
  label: string;
  kind: TransformArgKind;
  default: string;
};

export type TransformFunctionSpec = {
  name: string;
  label: string;
  category: string;
  args: TransformArgSpec[];
};

export type TransformFunctionValue = {
  name: string;
  args: string[];
};

const length = (label: string): TransformArgSpec => ({ label, kind: 'length', default: '0px' });
const number = (label: string): TransformArgSpec => ({ label, kind: 'number', default: '1' });
const angle = (label: string): TransformArgSpec => ({ label, kind: 'angle', default: '0deg' });

export const TRANSFORM_FUNCTIONS: TransformFunctionSpec[] = [
  { name: 'translate', label: 'Translate 2D', category: 'Translate', args: [length('X'), length('Y')] },
  { name: 'translate3d', label: 'Translate 3D', category: 'Translate', args: [length('X'), length('Y'), length('Z')] },
  { name: 'translateX', label: 'Translate X', category: 'Translate', args: [length('X')] },
  { name: 'translateY', label: 'Translate Y', category: 'Translate', args: [length('Y')] },
  { name: 'translateZ', label: 'Translate Z', category: 'Translate', args: [length('Z')] },
  { name: 'scale', label: 'Scale 2D', category: 'Scale', args: [number('X'), number('Y')] },
  { name: 'scale3d', label: 'Scale 3D', category: 'Scale', args: [number('X'), number('Y'), number('Z')] },
  { name: 'scaleX', label: 'Scale X', category: 'Scale', args: [number('X')] },
  { name: 'scaleY', label: 'Scale Y', category: 'Scale', args: [number('Y')] },
  { name: 'scaleZ', label: 'Scale Z', category: 'Scale', args: [number('Z')] },
  { name: 'rotate', label: 'Rotate', category: 'Rotate', args: [angle('Angle')] },
  { name: 'rotateX', label: 'Rotate X', category: 'Rotate', args: [angle('X')] },
  { name: 'rotateY', label: 'Rotate Y', category: 'Rotate', args: [angle('Y')] },
  { name: 'rotateZ', label: 'Rotate Z', category: 'Rotate', args: [angle('Z')] },
  { name: 'skew', label: 'Skew 2D', category: 'Skew', args: [angle('X'), angle('Y')] },
  { name: 'skewX', label: 'Skew X', category: 'Skew', args: [angle('X')] },
  { name: 'skewY', label: 'Skew Y', category: 'Skew', args: [angle('Y')] },
  { name: 'perspective', label: 'Perspective', category: 'Perspective', args: [length('Distance')] }
];

export const DEFAULT_FUNCTION = 'translate3d';

// Unitless (empty list) keeps scale numbers free of a unit; an empty array is
// distinct from `undefined`, which would make the metric input fall back to its
// length-based defaults.
const UNITS_BY_KIND: Record<TransformArgKind, { label: string; value: string }[]> = {
  length: [
    { label: 'PX', value: 'px' },
    { label: '%', value: '%' },
    { label: 'EM', value: 'em' },
    { label: 'REM', value: 'rem' },
    { label: 'VW', value: 'vw' },
    { label: 'VH', value: 'vh' }
  ],
  angle: [
    { label: 'DEG', value: 'deg' },
    { label: 'RAD', value: 'rad' },
    { label: 'TURN', value: 'turn' }
  ],
  number: []
};

export const unitsForKind = (kind: TransformArgKind) => UNITS_BY_KIND[kind];

const specByName = new Map(TRANSFORM_FUNCTIONS.map(spec => [spec.name.toLowerCase(), spec]));

export const getFunctionSpec = (name: string): TransformFunctionSpec | undefined => specByName.get(name.toLowerCase());

const FUNCTION_REGEX = /([a-zA-Z][a-zA-Z0-9]*)\s*\(([^)]*)\)/g;

export const parseTransforms = (value: string): TransformFunctionValue[] => {
  const result: TransformFunctionValue[] = [];
  for (const match of value.matchAll(FUNCTION_REGEX)) {
    const [, name, rawArgs] = match;
    const args = rawArgs
      .split(',')
      .map(arg => arg.trim())
      .filter(arg => arg !== '');
    result.push({ name, args });
  }

  return result;
};

export const serializeTransform = ({ name, args }: TransformFunctionValue): string => `${name}(${args.join(', ')})`;

export const serializeTransforms = (transforms: TransformFunctionValue[]): string =>
  transforms.map(serializeTransform).join(' ');

export const createFunctionValue = (name: string): TransformFunctionValue => {
  const spec = getFunctionSpec(name);
  const args = spec ? spec.args.map(arg => arg.default) : ['0px'];

  return { name, args };
};
