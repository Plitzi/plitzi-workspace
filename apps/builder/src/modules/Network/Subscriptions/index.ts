// Collaborator subscriptions
import CollaboratorConnectedSubscription from './Collaborator/CollaboratorConnectedSubscription';
import CollaboratorDisconnectedSubscription from './Collaborator/CollaboratorDisconnectedSubscription';
// Segment subscriptions
import SegmentAddElementSubscription from './Segment/SegmentAddElementSubscription';
import SegmentAddTemplateSubscription from './Segment/SegmentAddTemplateSubscription';
import SegmentCloneElementSubscription from './Segment/SegmentCloneElementSubscription';
import SegmentMoveElementSubscription from './Segment/SegmentMoveElementSubscription';
import SegmentRemoveElementSubscription from './Segment/SegmentRemoveElementSubscription';
import SegmentStyleAddSelectorSubscription from './Segment/SegmentStyleAddSelectorSubscription';
import SegmentStyleAddVariableSubscription from './Segment/SegmentStyleAddVariableSubscription';
import SegmentStyleRemoveSelectorSubscription from './Segment/SegmentStyleRemoveSelectorSubscription';
import SegmentStyleRemoveVariableSubscription from './Segment/SegmentStyleRemoveVariableSubscription';
import SegmentStyleUpdateSelectorSubscription from './Segment/SegmentStyleUpdateSelectorSubscription';
import SegmentStyleUpdateVariableSubscription from './Segment/SegmentStyleUpdateVariableSubscription';
import SegmentUpdateElementSubscription from './Segment/SegmentUpdateElementSubscription';
// Space subscriptions
import SpaceAddPageFolderSubscription from './Space/folders/SpaceAddPageFolderSubscription';
import SpaceRemovePageFolderSubscription from './Space/folders/SpaceRemovePageFolderSubscription';
import SpaceUpdatePageFolderSubscription from './Space/folders/SpaceUpdatePageFolderSubscription';
import SpaceAddPageSubscription from './Space/pages/SpaceAddPageSubscription';
import SpaceHomePageSubscription from './Space/pages/SpaceHomePageSubscription';
import SpaceRemovePageSubscription from './Space/pages/SpaceRemovePageSubscription';
import SpaceUpdatePageSubscription from './Space/pages/SpaceUpdatePageSubscription';
import SpaceAddElementSubscription from './Space/SpaceAddElementSubscription';
import SpaceAddTemplateSubscription from './Space/SpaceAddTemplateSubscription';
import SpaceCloneElementSubscription from './Space/SpaceCloneElementSubscription';
import SpaceMoveElementSubscription from './Space/SpaceMoveElementSubscription';
import SpaceRemoveElementSubscription from './Space/SpaceRemoveElementSubscription';
import SpaceUpdatedSubscription from './Space/SpaceUpdatedSubscription'; // Other Space Subscriptions
import SpaceUpdateElementSubscription from './Space/SpaceUpdateElementSubscription';
import SpaceUpdateSettingsSubscription from './Space/SpaceUpdateSettingsSubscription';
import SpaceAddVariableSubscription from './Space/variables/SpaceAddVariableSubscription';
import SpaceRemoveVariableSubscription from './Space/variables/SpaceRemoveVariableSubscription';
import SpaceUpdateVariableSubscription from './Space/variables/SpaceUpdateVariableSubscription';
// Style subscriptions
import StyleAddSelectorSubscription from './Style/StyleAddSelectorSubscription';
import StyleAddVariableSubscription from './Style/StyleAddVariableSubscription';
import StyleRemoveSelectorSubscription from './Style/StyleRemoveSelectorSubscription';
import StyleRemoveVariableSubscription from './Style/StyleRemoveVariableSubscription';
import StyleUpdatedSubscription from './Style/StyleUpdatedSubscription'; // Other Style Subscriptions
import StyleUpdateSelectorSubscription from './Style/StyleUpdateSelectorSubscription';
import StyleUpdateSettingsSubscription from './Style/StyleUpdateSettingsSubscription';
import StyleUpdateVariableSubscription from './Style/StyleUpdateVariableSubscription';

export type SubscriptionsMap = {
  CollaboratorConnected: unknown;
  CollaboratorDisconnected: unknown;
  SpaceUpdated: unknown;
  StyleUpdated: unknown;

  SpaceAddPage: unknown;
  SpaceHomePage: unknown;
  SpaceUpdatePage: unknown;
  SpaceRemovePage: unknown;
  SpaceAddPageFolder: unknown;
  SpaceUpdatePageFolder: unknown;
  SpaceRemovePageFolder: unknown;
  SpaceAddVariable: unknown;
  SpaceUpdateVariable: unknown;
  SpaceRemoveVariable: unknown;
  SpaceAddElement: unknown;
  SpaceUpdateElement: unknown;
  SpaceRemoveElement: unknown;
  SpaceMoveElement: unknown;
  SpaceCloneElement: unknown;
  SpaceAddTemplate: unknown;
  SpaceUpdateSettings: unknown;

  StyleAddSelector: unknown;
  StyleUpdateSelector: unknown;
  StyleRemoveSelector: unknown;
  StyleAddVariable: unknown;
  StyleUpdateVariable: unknown;
  StyleRemoveVariable: unknown;
  StyleUpdateSettings: unknown;

  SegmentAddElement: unknown;
  SegmentUpdateElement: unknown;
  SegmentRemoveElement: unknown;
  SegmentMoveElement: unknown;
  SegmentCloneElement: unknown;
  SegmentAddTemplate: unknown;
  SegmentStyleAddSelector: unknown;
  SegmentStyleUpdateSelector: unknown;
  SegmentStyleRemoveSelector: unknown;
  SegmentStyleAddVariable: unknown;
  SegmentStyleUpdateVariable: unknown;
  SegmentStyleRemoveVariable: unknown;
};

const Subscriptions = {
  CollaboratorConnected: CollaboratorConnectedSubscription,
  CollaboratorDisconnected: CollaboratorDisconnectedSubscription,
  SpaceUpdated: SpaceUpdatedSubscription,
  StyleUpdated: StyleUpdatedSubscription,

  SpaceAddPage: SpaceAddPageSubscription,
  SpaceHomePage: SpaceHomePageSubscription,
  SpaceUpdatePage: SpaceUpdatePageSubscription,
  SpaceRemovePage: SpaceRemovePageSubscription,
  SpaceAddPageFolder: SpaceAddPageFolderSubscription,
  SpaceUpdatePageFolder: SpaceUpdatePageFolderSubscription,
  SpaceRemovePageFolder: SpaceRemovePageFolderSubscription,
  SpaceAddVariable: SpaceAddVariableSubscription,
  SpaceUpdateVariable: SpaceUpdateVariableSubscription,
  SpaceRemoveVariable: SpaceRemoveVariableSubscription,
  SpaceAddElement: SpaceAddElementSubscription,
  SpaceUpdateElement: SpaceUpdateElementSubscription,
  SpaceRemoveElement: SpaceRemoveElementSubscription,
  SpaceMoveElement: SpaceMoveElementSubscription,
  SpaceCloneElement: SpaceCloneElementSubscription,
  SpaceAddTemplate: SpaceAddTemplateSubscription,
  SpaceUpdateSettings: SpaceUpdateSettingsSubscription,

  StyleAddSelector: StyleAddSelectorSubscription,
  StyleUpdateSelector: StyleUpdateSelectorSubscription,
  StyleRemoveSelector: StyleRemoveSelectorSubscription,
  StyleAddVariable: StyleAddVariableSubscription,
  StyleUpdateVariable: StyleUpdateVariableSubscription,
  StyleRemoveVariable: StyleRemoveVariableSubscription,
  StyleUpdateSettings: StyleUpdateSettingsSubscription,

  SegmentAddElement: SegmentAddElementSubscription,
  SegmentUpdateElement: SegmentUpdateElementSubscription,
  SegmentRemoveElement: SegmentRemoveElementSubscription,
  SegmentMoveElement: SegmentMoveElementSubscription,
  SegmentCloneElement: SegmentCloneElementSubscription,
  SegmentAddTemplate: SegmentAddTemplateSubscription,
  SegmentStyleAddSelector: SegmentStyleAddSelectorSubscription,
  SegmentStyleUpdateSelector: SegmentStyleUpdateSelectorSubscription,
  SegmentStyleRemoveSelector: SegmentStyleRemoveSelectorSubscription,
  SegmentStyleAddVariable: SegmentStyleAddVariableSubscription,
  SegmentStyleUpdateVariable: SegmentStyleUpdateVariableSubscription,
  SegmentStyleRemoveVariable: SegmentStyleRemoveVariableSubscription
};

export default Subscriptions;
