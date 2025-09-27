import CollectionAddMutation from './Collection/CollectionAddMutation';
import CollectionAddRecordMutation from './Collection/CollectionAddRecordMutation';
import CollectionRemoveMutation from './Collection/CollectionRemoveMutation';
import CollectionRemoveRecordMutation from './Collection/CollectionRemoveRecordMutation';
import CollectionUpdateMutation from './Collection/CollectionUpdateMutation';
import CollectionUpdateRecordMutation from './Collection/CollectionUpdateRecordMutation';
import SegmentAddElementMutation from './Segment/SegmentAddElementMutation';
import SegmentAddMutation from './Segment/SegmentAddMutation';
import SegmentAddTemplateMutation from './Segment/SegmentAddTemplateMutation';
import SegmentCloneElementMutation from './Segment/SegmentCloneElementMutation';
import SegmentMoveElementMutation from './Segment/SegmentMoveElementMutation';
import SegmentPublishMutation from './Segment/SegmentPublishMutation';
import SegmentRemoveElementMutation from './Segment/SegmentRemoveElementMutation';
import SegmentRemoveMutation from './Segment/SegmentRemoveMutation';
import SegmentStyleAddSelectorMutation from './Segment/SegmentStyleAddSelectorMutation';
import SegmentStyleAddVariableMutation from './Segment/SegmentStyleAddVariableMutation';
import SegmentStyleRemoveSelectorMutation from './Segment/SegmentStyleRemoveSelectorMutation';
import SegmentStyleRemoveVariableMutation from './Segment/SegmentStyleRemoveVariableMutation';
import SegmentStyleUpdateSelectorMutation from './Segment/SegmentStyleUpdateSelectorMutation';
import SegmentStyleUpdateVariableMutation from './Segment/SegmentStyleUpdateVariableMutation';
import SegmentUpdateElementMutation from './Segment/SegmentUpdateElementMutation';
import SegmentUpdateMutation from './Segment/SegmentUpdateMutation';
import SpaceAddCdnMutation from './Space/cdns/SpaceAddCdnMutation';
import SpaceRemoveCdnMutation from './Space/cdns/SpaceRemoveCdnMutation';
import SpaceUpdateCdnMutation from './Space/cdns/SpaceUpdateCdnMutation';
import SpaceAddPageFolderMutation from './Space/folders/SpaceAddPageFolderMutation';
import SpaceRemovePageFolderMutation from './Space/folders/SpaceRemovePageFolderMutation';
import SpaceUpdatePageFolderMutation from './Space/folders/SpaceUpdatePageFolderMutation';
import SpaceAddPageMutation from './Space/pages/SpaceAddPageMutation';
import SpaceHomePageMutation from './Space/pages/SpaceHomePageMutation';
import SpaceRemovePageMutation from './Space/pages/SpaceRemovePageMutation';
import SpaceUpdatePageMutation from './Space/pages/SpaceUpdatePageMutation';
import SpaceAddResourceMutation from './Space/resources/SpaceAddResourceMutation';
import SpaceRemoveResourceMutation from './Space/resources/SpaceRemoveResourceMutation';
import SpaceAddElementMutation from './Space/SpaceAddElementMutation';
import SpaceAddPluginMutation from './Space/SpaceAddPluginMutation';
import SpaceAddTemplateMutation from './Space/SpaceAddTemplateMutation';
import SpaceCloneElementMutation from './Space/SpaceCloneElementMutation';
import SpaceDeployMutation from './Space/SpaceDeployMutation';
import SpaceMoveElementMutation from './Space/SpaceMoveElementMutation';
import SpacePublishMutation from './Space/SpacePublishMutation';
import SpaceRemoveElementMutation from './Space/SpaceRemoveElementMutation';
import SpaceRemovePluginMutation from './Space/SpaceRemovePluginMutation';
import SpaceUpdateElementMutation from './Space/SpaceUpdateElementMutation';
import SpaceUpdateMutation from './Space/SpaceUpdateMutation';
import SpaceUpdatePluginMutation from './Space/SpaceUpdatePluginMutation';
import SpaceUpdateSchemaMutation from './Space/SpaceUpdateSchemaMutation';
import SpaceUpdateSettingsMutation from './Space/SpaceUpdateSettingsMutation';
import SpaceAddVariableMutation from './Space/variables/SpaceAddVariableMutation';
import SpaceRemoveVariableMutation from './Space/variables/SpaceRemoveVariableMutation';
import SpaceUpdateVariableMutation from './Space/variables/SpaceUpdateVariableMutation';
import StyleAddSelectorMutation from './Style/StyleAddSelectorMutation';
import StyleAddVariableMutation from './Style/StyleAddVariableMutation';
import StyleRemoveSelectorMutation from './Style/StyleRemoveSelectorMutation';
import StyleRemoveVariableMutation from './Style/StyleRemoveVariableMutation';
import StyleUpdateMutation from './Style/StyleUpdateMutation';
import StyleUpdateSelectorMutation from './Style/StyleUpdateSelectorMutation';
import StyleUpdateVariableMutation from './Style/StyleUpdateVariableMutation';
import TemplateAddMutation from './Template/TemplateAddMutation';
import TemplateRemoveMutation from './Template/TemplateRemoveMutation';
import TemplateUpdateMutation from './Template/TemplateUpdateMutation';

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
  SpaceAddVariable: SpaceAddVariableMutation,
  SpaceUpdateVariable: SpaceUpdateVariableMutation,
  SpaceRemoveVariable: SpaceRemoveVariableMutation,
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
  SpaceAddCdn: SpaceAddCdnMutation,
  SpaceUpdateCdn: SpaceUpdateCdnMutation,
  SpaceRemoveCdn: SpaceRemoveCdnMutation,
  SpacePublish: SpacePublishMutation,
  SpaceDeploy: SpaceDeployMutation,
  SpaceUpdateSettings: SpaceUpdateSettingsMutation,

  StyleAddSelector: StyleAddSelectorMutation,
  StyleUpdateSelector: StyleUpdateSelectorMutation,
  StyleRemoveSelector: StyleRemoveSelectorMutation,
  StyleAddVariable: StyleAddVariableMutation,
  StyleUpdateVariable: StyleUpdateVariableMutation,
  StyleRemoveVariable: StyleRemoveVariableMutation,
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
  SegmentStyleAddVariable: SegmentStyleAddVariableMutation,
  SegmentStyleUpdateVariable: SegmentStyleUpdateVariableMutation,
  SegmentStyleRemoveVariable: SegmentStyleRemoveVariableMutation,
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
