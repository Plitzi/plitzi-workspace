/** What a file of server code is, read from where it is kept (`<space>/server/<folder>/<digest>`). */
const serverCodeKindOf = (id: string): string => {
  if (id.includes('/server/runtimes/')) {
    return 'Runtime';
  }

  if (id.includes('/server/functions/source/')) {
    return 'Functions source';
  }

  if (id.includes('/server/functions/bundles/')) {
    return 'Functions bundle';
  }

  return 'Server code';
};

export default serverCodeKindOf;
