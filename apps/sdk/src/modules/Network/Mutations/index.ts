import CollectionAddRecordMutation from './Collection/CollectionAddRecordMutation';
import CollectionRemoveRecordMutation from './Collection/CollectionRemoveRecordMutation';
import CollectionUpdateRecordMutation from './Collection/CollectionUpdateRecordMutation';

const Mutations = {
  CollectionAddRecord: CollectionAddRecordMutation,
  CollectionUpdateRecord: CollectionUpdateRecordMutation,
  CollectionRemoveRecord: CollectionRemoveRecordMutation
};

export default Mutations;
