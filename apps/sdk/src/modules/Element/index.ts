import PlitziSdk from './elements/PlitziSdk';

import type { ComponentPlugin } from '@plitzi/sdk-shared';

// The SDK's own element, registered as a plugin is: its component carries the plugin fields `withElement` adds.
const elements = { plitziSdk: PlitziSdk } as unknown as Record<string, ComponentPlugin>;

export default elements;
