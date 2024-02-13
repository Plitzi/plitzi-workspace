// Packages
import qs from 'querystring';
import isEmpty from 'lodash/isEmpty';

const updateHistoryBrowser = (history, params, persistParams = true) => {
  const currentParams = qs.parse(history.location.search.slice(1));
  let requireUpdate = false;
  const newParams = {};
  Object.keys(params).forEach(key => {
    const currentValue = currentParams[key] || '';
    if (typeof params[key] === 'undefined' || params[key] === null) {
      return;
    }

    if (!isEmpty(params[key].toString())) {
      newParams[key] = params[key];
    }

    if (!requireUpdate && currentValue !== params[key].toString()) {
      requireUpdate = true;
    }
  });

  if (!requireUpdate) {
    return;
  }

  if (persistParams) {
    Object.keys(currentParams).forEach(k => {
      if (!params[k] && params[k] !== '') {
        newParams[k] = currentParams[k];
      }
    });
  }

  if (newParams) {
    history.replace({ ...history.location, search: `?${qs.stringify(newParams)}` });

    return;
  }

  if (!isEmpty(history.location.search)) {
    history.replace({ ...history.location, search: '' });
  }
};

export default updateHistoryBrowser;
