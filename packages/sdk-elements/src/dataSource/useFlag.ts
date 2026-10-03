import { useCommonStore } from '@plitzi/sdk-shared/store';

/**
 * Whether one of the space's feature flags is on, for a plugin — the `flags` source an element reads as
 * `{{ flags.<name> }}`, read without a binding.
 *
 * It follows every layer that decides a flag, a tester forcing it included, and renders again when it changes. A
 * flag the space does not declare is off: a plugin cannot invent one, only ask about the ones the space has.
 */
const useFlag = (name: string): boolean => {
  const [value] = useCommonStore(`runtime.sources.flags.${name}`);

  return value === true;
};

export default useFlag;
