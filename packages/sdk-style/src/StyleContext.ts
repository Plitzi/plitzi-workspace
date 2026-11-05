import { sharedContext } from '@plitzi/sdk-shared/react';

import type { StyleContextValue } from '@plitzi/sdk-shared';

const styleContextDefaultValue: StyleContextValue = {};

const StyleContext = sharedContext('StyleContext', styleContextDefaultValue);

export default StyleContext;
