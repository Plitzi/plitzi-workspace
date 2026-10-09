import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';

/**
 * What an element that publishes a source hands its `StoreProvider`: the data under the source's name, where what is
 * inside it binds to it. Nothing when it has no name to publish under — the same empty object every time, so a store
 * that publishes nothing never changes.
 */
const sourceStore = (sourceName: string | undefined, data: unknown) =>
  sourceName ? { runtime: { sources: { [sourceName]: data } } } : emptyObject;

export default sourceStore;
