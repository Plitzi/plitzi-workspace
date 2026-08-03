// The SDK has no mutations left: every one of them wrote to the built-in Collections store, which no longer exists.
// Writes now go through the server's `/_action` endpoint, which resolves the target connector server-side instead of
// exposing a mutation per operation. The map stays so the network layer's generic typing keeps compiling.
export type SdkMutationsMap = Record<string, never>;

const SdkMutations: Record<string, never> = {};

export default SdkMutations;
