const getItemName = id => {
  return `web-${id}-state`;
};

export const loadState = id => {
  try {
    const serializedState = sessionStorage.getItem(getItemName(id));
    if (serializedState === null) {
      return {};
    }
    return JSON.parse(serializedState);
  } catch (err) {
    return {};
  }
};

export const saveState = (id, state) => {
  try {
    const serializedState = JSON.stringify(state);
    sessionStorage.setItem(getItemName(id), serializedState);
  } catch {
    // ignore write errors
    return false;
  }

  return true;
};

export const clearState = id => {
  try {
    sessionStorage.removeItem(getItemName(id));
  } catch {
    // ignore write errors
    return false;
  }

  return true;
};
