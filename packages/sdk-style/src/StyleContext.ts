import { sharedContext } from '@plitzi/sdk-shared/helpers/sharedContext';

import type { StyleContextValue } from '@plitzi/sdk-shared';

const styleContextDefaultValue: StyleContextValue = {};

const StyleContext = sharedContext('StyleContext', styleContextDefaultValue);

export default StyleContext;
