import PlitziSdk from './elements/PlitziSdk';

import type { ComponentPlugin } from '@plitzi/sdk-shared';

const elements = { plitziSdk: PlitziSdk } as unknown as Record<string, ComponentPlugin>;

export default elements;
