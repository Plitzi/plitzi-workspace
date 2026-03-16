import { get } from '@plitzi/plitzi-ui/helpers/lodash';

import type { DisplayMode, Style } from '@plitzi/sdk-shared';

const getStyleItem = (platform: Style['platform'], displayMode: DisplayMode, selector: string) => {
  if (!selector) {
    return undefined;
  }

  return get(platform, `${displayMode}.${selector}`, undefined);
};

export default getStyleItem;
