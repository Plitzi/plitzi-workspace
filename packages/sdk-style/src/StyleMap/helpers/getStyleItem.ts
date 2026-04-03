import { get } from '@plitzi/plitzi-ui/helpers';

import type { DisplayMode, Style } from '@plitzi/sdk-shared';

const getStyleItem = (platform: Style['platform'], displayMode: DisplayMode, selector: string) => {
  return selector ? get(platform, `${displayMode}.${selector}`, undefined) : undefined;
};

export default getStyleItem;
