import type { changeKv, changeListEntry } from '../../../actions/runtime/kvChange';
import type { createFunctionsDriver, describeFunctions } from '../../driver';

/** What the runner hands the guest: calls into the runner's own process, the only way out of the isolate. */
export type GuestHost = {
  /** A {@link FunctionCall} for the platform, as JSON; answers a `FunctionAnswer`, as JSON. */
  call: (message: string) => Promise<string>;
  /** Resolves after `ms` — the runner's clock, bounded by the invocation's time. */
  sleep: (ms: number) => Promise<void>;
  /** `length` random bytes, from the runner's CSPRNG. */
  random: (length: number) => number[];
  /** A `crypto.subtle` operation the runner does with its own implementation: `{ op, … }` → a `FunctionAnswer` whose
   *  value is the bytes, base64. */
  crypto: (message: string) => Promise<string>;
};

/**
 * Functions of the platform's the guest runs as they are, printed in beside it (`isolate.ts`) — one implementation for
 * native code and the sandbox alike. Each is self-contained by contract, as the guest is.
 */
export type GuestShared = {
  /** `ctx.kv.change`: the read-change-write loop, over the guest's own `get` and `swap` calls. */
  changeKv: typeof changeKv;
  changeListEntry: typeof changeListEntry;
  /** What a definition declares, as a manifest. */
  describeFunctions: typeof describeFunctions;
  /** An invocation of a definition with its `ctx` — the same driver a space runtime runs. */
  createFunctionsDriver: typeof createFunctionsDriver;
};

/** What the runner drives the guest with, once installed. */
export type GuestDriver = {
  /** What a definition declares — the manifest the platform reads and checks — as a `FunctionAnswer` (JSON). */
  describe: (definition: unknown) => string;
  /** Runs one invocation (JSON) of a definition, and answers a `FunctionAnswer` (JSON). Never rejects. */
  invoke: (definition: unknown, invocation: string) => Promise<string>;
  /** The run was aborted: `ctx.signal` fires, for code that listens, before the runner stops it. */
  abort: (reason: string) => void;
};

/** The bytes every part of the guest reads and writes. */
export type Bytes = Uint8Array<ArrayBuffer>;
