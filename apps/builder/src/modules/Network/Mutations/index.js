// Relatives
import SpaceAddPageMutation from './Space/pages/SpaceAddPageMutation';
import SpaceHomePageMutation from './Space/pages/SpaceHomePageMutation';
import SpaceUpdatePageMutation from './Space/pages/SpaceUpdatePageMutation';
import SpaceRemovePageMutation from './Space/pages/SpaceRemovePageMutation';
import SpaceAddPageFolderMutation from './Space/folders/SpaceAddPageFolderMutation';
import SpaceUpdatePageFolderMutation from './Space/folders/SpaceUpdatePageFolderMutation';
import SpaceRemovePageFolderMutation from './Space/folders/SpaceRemovePageFolderMutation';
import SpaceAddElementMutation from './Space/SpaceAddElementMutation';
import SpaceUpdateElementMutation from './Space/SpaceUpdateElementMutation';
import SpaceRemoveElementMutation from './Space/SpaceRemoveElementMutation';
import SpaceMoveElementMutation from './Space/SpaceMoveElementMutation';
import SpaceCloneElementMutation from './Space/SpaceCloneElementMutation';
import SpaceAddTemplateMutation from './Space/SpaceAddTemplateMutation';
import SpaceUpdateSchemaMutation from './Space/SpaceUpdateSchemaMutation';
import SpaceAddResourceMutation from './Space/SpaceAddResourceMutation';
import SpaceRemoveResourceMutation from './Space/SpaceRemoveResourceMutation';
import SpaceUpdateMutation from './Space/SpaceUpdateMutation';
import SpacePublishMutation from './Space/SpacePublishMutation';
import SpaceDeployMutation from './Space/SpaceDeployMutation';
import SpaceUpdateSettingsMutation from './Space/SpaceUpdateSettingsMutation';

import StyleAddSelectorMutation from './Style/StyleAddSelectorMutation';
import StyleUpdateSelectorMutation from './Style/StyleUpdateSelectorMutation';
import StyleRemoveSelectorMutation from './Style/StyleRemoveSelectorMutation';
import StyleUpdateMutation from './Style/StyleUpdateMutation';

import SegmentAddMutation from './Segment/SegmentAddMutation';
import SegmentUpdateMutation from './Segment/SegmentUpdateMutation';
import SegmentRemoveMutation from './Segment/SegmentRemoveMutation';
import SegmentAddElementMutation from './Segment/SegmentAddElementMutation';
import SegmentUpdateElementMutation from './Segment/SegmentUpdateElementMutation';
import SegmentRemoveElementMutation from './Segment/SegmentRemoveElementMutation';
import SegmentMoveElementMutation from './Segment/SegmentMoveElementMutation';
import SegmentCloneElementMutation from './Segment/SegmentCloneElementMutation';
import SegmentAddTemplateMutation from './Segment/SegmentAddTemplateMutation';
import SegmentStyleAddSelectorMutation from './Segment/SegmentStyleAddSelectorMutation';
import SegmentStyleUpdateSelectorMutation from './Segment/SegmentStyleUpdateSelectorMutation';
import SegmentStyleRemoveSelectorMutation from './Segment/SegmentStyleRemoveSelectorMutation';
import SegmentPublishMutation from './Segment/SegmentPublishMutation';

import TemplateAddMutation from './Template/TemplateAddMutation';
import TemplateUpdateMutation from './Template/TemplateUpdateMutation';
import TemplateRemoveMutation from './Template/TemplateRemoveMutation';

import SpaceAddPluginMutation from './Space/SpaceAddPluginMutation';
import SpaceUpdatePluginMutation from './Space/SpaceUpdatePluginMutation';
import SpaceRemovePluginMutation from './Space/SpaceRemovePluginMutation';

import CollectionAddMutation from './Collection/CollectionAddMutation';
import CollectionUpdateMutation from './Collection/CollectionUpdateMutation';
import CollectionRemoveMutation from './Collection/CollectionRemoveMutation';

import CollectionAddRecordMutation from './Collection/CollectionAddRecordMutation';
import CollectionUpdateRecordMutation from './Collection/CollectionUpdateRecordMutation';
import CollectionRemoveRecordMutation from './Collection/CollectionRemoveRecordMutation';

const Mutations = {
  SpaceUpdate: SpaceUpdateMutation,
  SpaceUpdateSchema: SpaceUpdateSchemaMutation,
  SpaceAddPage: SpaceAddPageMutation,
  SpaceHomePage: SpaceHomePageMutation,
  SpaceUpdatePage: SpaceUpdatePageMutation,
  SpaceRemovePage: SpaceRemovePageMutation,
  SpaceAddPageFolder: SpaceAddPageFolderMutation,
  SpaceUpdatePageFolder: SpaceUpdatePageFolderMutation,
  SpaceRemovePageFolder: SpaceRemovePageFolderMutation,
  SpaceAddElement: SpaceAddElementMutation,
  SpaceUpdateElement: SpaceUpdateElementMutation,
  SpaceRemoveElement: SpaceRemoveElementMutation,
  SpaceMoveElement: SpaceMoveElementMutation,
  SpaceCloneElement: SpaceCloneElementMutation,
  SpaceAddTemplate: SpaceAddTemplateMutation,
  SpaceAddPlugin: SpaceAddPluginMutation,
  SpaceUpdatePlugin: SpaceUpdatePluginMutation,
  SpaceRemovePlugin: SpaceRemovePluginMutation,
  SpaceAddResource: SpaceAddResourceMutation,
  SpaceRemoveResource: SpaceRemoveResourceMutation,
  SpacePublish: SpacePublishMutation,
  SpaceDeploy: SpaceDeployMutation,
  SpaceUpdateSettings: SpaceUpdateSettingsMutation,

  StyleAddSelector: StyleAddSelectorMutation,
  StyleUpdateSelector: StyleUpdateSelectorMutation,
  StyleRemoveSelector: StyleRemoveSelectorMutation,
  StyleUpdate: StyleUpdateMutation,

  SegmentAdd: SegmentAddMutation,
  SegmentUpdate: SegmentUpdateMutation,
  SegmentRemove: SegmentRemoveMutation,
  SegmentAddElement: SegmentAddElementMutation,
  SegmentUpdateElement: SegmentUpdateElementMutation,
  SegmentRemoveElement: SegmentRemoveElementMutation,
  SegmentMoveElement: SegmentMoveElementMutation,
  SegmentCloneElement: SegmentCloneElementMutation,
  SegmentAddTemplate: SegmentAddTemplateMutation,
  SegmentStyleAddSelector: SegmentStyleAddSelectorMutation,
  SegmentStyleUpdateSelector: SegmentStyleUpdateSelectorMutation,
  SegmentStyleRemoveSelector: SegmentStyleRemoveSelectorMutation,
  SegmentPublish: SegmentPublishMutation,

  TemplateAdd: TemplateAddMutation,
  TemplateUpdate: TemplateUpdateMutation,
  TemplateRemove: TemplateRemoveMutation,

  CollectionAdd: CollectionAddMutation,
  CollectionUpdate: CollectionUpdateMutation,
  CollectionRemove: CollectionRemoveMutation,
  CollectionAddRecord: CollectionAddRecordMutation,
  CollectionUpdateRecord: CollectionUpdateRecordMutation,
  CollectionRemoveRecord: CollectionRemoveRecordMutation
};

export default Mutations;
