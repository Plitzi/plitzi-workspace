// Relatives
import SpaceUpdatedSubscription from './Space/SpaceUpdatedSubscription';
import StyleUpdatedSubscription from './Style/StyleUpdatedSubscription';

import CollaboratorConnectedSubscription from './Collaborator/CollaboratorConnectedSubscription';
import CollaboratorDisconnectedSubscription from './Collaborator/CollaboratorDisconnectedSubscription';

import SpaceAddPageSubscription from './Space/pages/SpaceAddPageSubscription';
import SpaceHomePageSubscription from './Space/pages/SpaceHomePageSubscription';
import SpaceUpdatePageSubscription from './Space/pages/SpaceUpdatePageSubscription';
import SpaceRemovePageSubscription from './Space/pages/SpaceRemovePageSubscription';
import SpaceAddPageFolderSubscription from './Space/folders/SpaceAddPageFolderSubscription';
import SpaceUpdatePageFolderSubscription from './Space/folders/SpaceUpdatePageFolderSubscription';
import SpaceRemovePageFolderSubscription from './Space/folders/SpaceRemovePageFolderSubscription';
import SpaceAddElementSubscription from './Space/SpaceAddElementSubscription';
import SpaceUpdateElementSubscription from './Space/SpaceUpdateElementSubscription';
import SpaceRemoveElementSubscription from './Space/SpaceRemoveElementSubscription';
import SpaceMoveElementSubscription from './Space/SpaceMoveElementSubscription';
import SpaceCloneElementSubscription from './Space/SpaceCloneElementSubscription';
import SpaceAddTemplateSubscription from './Space/SpaceAddTemplateSubscription';
import SpaceUpdateSettingsSubscription from './Space/SpaceUpdateSettingsSubscription';

import StyleAddSelectorSubscription from './Style/StyleAddSelectorSubscription';
import StyleUpdateSelectorSubscription from './Style/StyleUpdateSelectorSubscription';
import StyleRemoveSelectorSubscription from './Style/StyleRemoveSelectorSubscription';

import SegmentAddElementSubscription from './Segment/SegmentAddElementSubscription';
import SegmentUpdateElementSubscription from './Segment/SegmentUpdateElementSubscription';
import SegmentRemoveElementSubscription from './Segment/SegmentRemoveElementSubscription';
import SegmentMoveElementSubscription from './Segment/SegmentMoveElementSubscription';
import SegmentCloneElementSubscription from './Segment/SegmentCloneElementSubscription';
import SegmentAddTemplateSubscription from './Segment/SegmentAddTemplateSubscription';
import SegmentStyleAddSelectorSubscription from './Segment/SegmentStyleAddSelectorSubscription';
import SegmentStyleUpdateSelectorSubscription from './Segment/SegmentStyleUpdateSelectorSubscription';
import SegmentStyleRemoveSelectorSubscription from './Segment/SegmentStyleRemoveSelectorSubscription';

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

  SegmentAddElement: SegmentAddElementSubscription,
  SegmentUpdateElement: SegmentUpdateElementSubscription,
  SegmentRemoveElement: SegmentRemoveElementSubscription,
  SegmentMoveElement: SegmentMoveElementSubscription,
  SegmentCloneElement: SegmentCloneElementSubscription,
  SegmentAddTemplate: SegmentAddTemplateSubscription,
  SegmentStyleAddSelector: SegmentStyleAddSelectorSubscription,
  SegmentStyleUpdateSelector: SegmentStyleUpdateSelectorSubscription,
  SegmentStyleRemoveSelector: SegmentStyleRemoveSelectorSubscription
};

export default Subscriptions;
