import { generateTokenKeys } from '../tokens/tokens';

/** One key pair for every test of a process: making one is a few milliseconds, and nothing tests a key's identity. */
export const TEST_KEYS = generateTokenKeys('test');
