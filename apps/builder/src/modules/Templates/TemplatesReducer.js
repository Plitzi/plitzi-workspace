// Packages
import omit from 'lodash/omit';

export const TemplatesActions = {
  TEMPLATES_ADD: 'TEMPLATES_ADD',
  TEMPLATES_UPDATE: 'TEMPLATES_UPDATE',
  TEMPLATES_REMOVE: 'TEMPLATES_REMOVE'
};

const TemplatesReducer = (state, action = {}) => {
  switch (action.type) {
    case TemplatesActions.TEMPLATES_ADD:
    case TemplatesActions.TEMPLATES_UPDATE: {
      const { template } = action;

      return { ...state, [template.id]: template };
    }

    case TemplatesActions.TEMPLATES_REMOVE: {
      return omit(state, [action.templateId]);
    }

    default:
      return state;
  }
};

export default TemplatesReducer;
