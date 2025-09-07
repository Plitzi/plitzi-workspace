export const selectorFormatter = (selector: string) => {
  if (selector.match(/^[0-9]/)) {
    selector = `_${selector}`;
  }

  return selector.replace(' ', '-').replace(/[^a-zA-Z0-9_-]+/, '');
};
