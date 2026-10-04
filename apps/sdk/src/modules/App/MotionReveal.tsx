import { ContainerRootContext } from '@plitzi/plitzi-ui/ContainerRoot';
import { use, useEffect } from 'react';

import { revealOnView } from '@plitzi/sdk-shared/schema/motionReveal';

/**
 * Plays the space's arrivals that wait to be seen (`motion: { on: 'view' }`) as each first comes into view — every one
 * under the SDK's root, the pages navigated to included. Renders nothing.
 */
const MotionReveal = () => {
  const { rootRef } = use(ContainerRootContext);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return undefined;
    }

    return revealOnView(root);
  }, [rootRef]);

  return null;
};

export default MotionReveal;
