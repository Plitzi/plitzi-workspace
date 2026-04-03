import CollectionAddRecordMutation from './Collection/CollectionAddRecordMutation';
import CollectionRemoveRecordMutation from './Collection/CollectionRemoveRecordMutation';
import CollectionUpdateRecordMutation from './Collection/CollectionUpdateRecordMutation';

import type { TCollectionAddRecordMutation } from './Collection/CollectionAddRecordMutation';
import type { TCollectionRemoveRecordMutation } from './Collection/CollectionRemoveRecordMutation';
import type { TCollectionUpdateRecordMutation } from './Collection/CollectionUpdateRecordMutation';

export type SdkMutationsMap = {
  CollectionAddRecord: TCollectionAddRecordMutation;
  CollectionUpdateRecord: TCollectionUpdateRecordMutation;
  CollectionRemoveRecord: TCollectionRemoveRecordMutation;
};

const SdkMutations = {
  CollectionAddRecord: CollectionAddRecordMutation,
  CollectionUpdateRecord: CollectionUpdateRecordMutation,
  CollectionRemoveRecord: CollectionRemoveRecordMutation
};

export default SdkMutations;
