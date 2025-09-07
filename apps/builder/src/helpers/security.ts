declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: Record<string, unknown>;
  }
}

export const disableReactDevTools = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const noop = () => undefined;
  const DEV_TOOLS = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (typeof DEV_TOOLS !== 'object') {
    return;
  }

  Object.keys(DEV_TOOLS).forEach(toolKey => {
    const tool = DEV_TOOLS[toolKey];
    DEV_TOOLS[toolKey] = typeof tool === 'function' ? noop : null;
  });
};
