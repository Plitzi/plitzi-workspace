import { use, useEffect } from 'react';

import { RTEvent } from '@plitzi/sdk-shared/websockets/RTCodec';
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';

export type UseCollaboratorElementsProps = {
  rootId: string;
  elementHovered?: string;
  elementSelected?: string;
};

/** Broadcasts what this user has hovered/selected, which is what draws their overlays on everyone else's canvas. */
const useCollaboratorElements = ({ rootId, elementHovered, elementSelected }: UseCollaboratorElementsProps) => {
  const { supportRealTime, subscriptionsPush } = use(BuilderSubscriptionsContext);

  // `rootId` is deliberately out of the dependencies: changing root must not replay the element of the previous
  // one under the new id. The root change clears the selection, and that clearing is what publishes it.
  useEffect(() => {
    if (!supportRealTime) {
      return;
    }

    subscriptionsPush({ type: RTEvent.ELEMENT, payload: { action: 'selected', rootId, id: elementSelected } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementSelected, subscriptionsPush, supportRealTime]);

  useEffect(() => {
    if (!supportRealTime) {
      return;
    }

    subscriptionsPush({ type: RTEvent.ELEMENT, payload: { action: 'hovered', rootId, id: elementHovered } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementHovered, subscriptionsPush, supportRealTime]);
};

export default useCollaboratorElements;
