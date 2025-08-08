import omit from 'lodash/omit';

import type { Template } from './TemplatesContext';

export const TemplatesActions = {
  TEMPLATES_ADD: 'TEMPLATES_ADD',
  TEMPLATES_UPDATE: 'TEMPLATES_UPDATE',
  TEMPLATES_REMOVE: 'TEMPLATES_REMOVE'
} as const;

export type TemplatesState = Record<string, Template>;

export type TemplatesReducerActions =
  | { type: 'TEMPLATES_ADD' | 'TEMPLATES_UPDATE'; template: Template }
  | { type: 'TEMPLATES_REMOVE'; templateId: string };

const TemplatesReducer = (state: TemplatesState, action: TemplatesReducerActions) => {
  switch (action.type) {
    case TemplatesActions.TEMPLATES_ADD:
    case TemplatesActions.TEMPLATES_UPDATE: {
      const { template } = action;

      return { ...state, [template.id as string]: template };
    }

    case TemplatesActions.TEMPLATES_REMOVE: {
      return omit(state, [action.templateId]);
    }

    default:
      return state;
  }
};

export default TemplatesReducer;
