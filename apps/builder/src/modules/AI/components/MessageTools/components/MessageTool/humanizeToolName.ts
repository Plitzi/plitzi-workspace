// Turn a raw tool id (e.g. "plitzi_search") into a friendly label ("Searching the space") so
// non-technical users understand what the assistant is doing without seeing internal names.
// Known MCP tools get an explicit label; anything else falls back to the verb heuristic so a
// newly added tool still reads sensibly without a code change here.
const LABELS: Record<string, string> = {
  plitzi_search: 'Searching the space',
  plitzi_read: 'Reading resources',
  plitzi_validate: 'Validating changes',
  plitzi_apply: 'Applying changes',
  plitzi_preview: 'Rendering preview',
  plitzi_screenshot: 'Capturing screenshot',
  preview_element: 'Previewing element',
  preview_concept: 'Previewing concept',
  sketch_wireframe: 'Sketching wireframe',
  design_color_palette: 'Designing color palette',
  design_brand_identity: 'Designing brand identity',
  design_style_guide: 'Designing style guide',
  get_element_types: 'Reading element types',
  get_style_tokens: 'Reading style tokens',
  ask_question: 'Asking a question',
  flag_irrelevant: 'Reviewing relevance'
};

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
  validate: 'Validating',
  search: 'Searching',
  preview: 'Previewing',
  render: 'Rendering',
  sketch: 'Sketching',
  design: 'Designing',
  flag: 'Reviewing'
};

export const humanizeToolName = (name: string): string => {
  const label = LABELS[name];
  if (label) {
    return label;
  }

  const parts = name.split('_');
  const verb = VERBS[parts[0]];
  const rest = (verb ? parts.slice(1) : parts).join(' ');

  if (verb) {
    return rest ? `${verb} ${rest}` : verb;
  }

  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : name;
};
