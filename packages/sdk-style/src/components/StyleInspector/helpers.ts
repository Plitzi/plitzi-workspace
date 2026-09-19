import { STYLE_STATE_LABELS, STYLE_STATES } from '@plitzi/sdk-shared/style/styleStates';

import type { Option } from '@plitzi/plitzi-ui/Select2';

/** The states a selector can react to, as the state picker offers them — from the one list every layer reads. */
export const STYLE_STATE_OPTIONS: Option[] = STYLE_STATES.map(state => ({
  label: STYLE_STATE_LABELS[state],
  value: state
}));
