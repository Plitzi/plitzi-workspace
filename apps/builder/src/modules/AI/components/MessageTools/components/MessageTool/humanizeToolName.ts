// Turn a raw tool id (e.g. "get_elements") into a friendly label ("Reading elements") so
// non-technical users understand what the assistant is doing without seeing internal names.
const VERBS: Record<string, string> = {
  get: 'Reading',
  list: 'Reading',
  read: 'Reading',
  create: 'Creating',
  add: 'Adding',
  update: 'Updating',
  set: 'Updating',
  delete: 'Deleting',
  remove: 'Removing',
  move: 'Moving',
  clone: 'Duplicating',
  publish: 'Publishing',
  apply: 'Applying',
  render: 'Rendering',
  stage: 'Previewing',
  sketch: 'Sketching',
  design: 'Designing',
  flag: 'Reviewing'
};

export const humanizeToolName = (name: string): string => {
  const parts = name.split('_');
  const verb = VERBS[parts[0]];
  const rest = (verb ? parts.slice(1) : parts).join(' ');

  if (verb) {
    return rest ? `${verb} ${rest}` : verb;
  }

  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : name;
};
