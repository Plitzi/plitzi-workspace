import type { FunctionSize } from '../types/FunctionTypes';

/**
 * The memory each size of task runs with, smallest first. A runner keeps a task's memory whole while it runs, so small
 * is what most code needs, and a task that parses large answers asks to be larger rather than every invocation keeping
 * room for the one that does. One table: the runner, the plans, the builder and the pools' sizes read it.
 */
export const FUNCTION_SIZES = {
  small: { memoryMb: 32 },
  medium: { memoryMb: 128 },
  large: { memoryMb: 256 }
} as const satisfies Record<FunctionSize, { memoryMb: number }>;

/** Every size, smallest first. */
// `Object.keys` answers strings; they are the table's own keys, which `satisfies` above holds to every `FunctionSize`.
export const FUNCTION_SIZE_NAMES = Object.keys(FUNCTION_SIZES) as FunctionSize[];

/** Whether a value names a size. */
export const isFunctionSize = (value: unknown): value is FunctionSize =>
  typeof value === 'string' && Object.hasOwn(FUNCTION_SIZES, value);

/** The sizes whose memory fits within `memoryMb` — what a plan or a server of that much lets a task ask for. */
export const functionSizesWithin = (memoryMb: number): FunctionSize[] =>
  FUNCTION_SIZE_NAMES.filter(size => FUNCTION_SIZES[size].memoryMb <= memoryMb);

/** The size that runs with `memoryMb`, when one does: what a message about an invocation's memory names. */
export const functionSizeOfMemory = (memoryMb: number): FunctionSize | undefined =>
  FUNCTION_SIZE_NAMES.find(size => FUNCTION_SIZES[size].memoryMb === memoryMb);

/** The next size up, or none past the largest. */
export const largerFunctionSize = (size: FunctionSize): FunctionSize | undefined =>
  FUNCTION_SIZE_NAMES[FUNCTION_SIZE_NAMES.indexOf(size) + 1];
