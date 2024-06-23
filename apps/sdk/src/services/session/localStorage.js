const getItemName = id => {
  return `web_${id}_state`;
};

export const loadState = id => {
  try {
    const serializedState = localStorage.getItem(getItemName(id));
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
    localStorage.setItem(getItemName(id), serializedState);
  } catch {
    // ignore write errors
  }
};

export const clearState = id => {
  try {
    localStorage.removeItem(getItemName(id));
  } catch {
    // ignore write errors
  }
};
