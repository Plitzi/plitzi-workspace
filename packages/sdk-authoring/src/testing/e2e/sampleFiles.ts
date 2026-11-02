/**
 * The files a journey picks in a file field, by the name a `type` step gives it: `type photo me.png`. Small and real of
 * their kind — a picture's first bytes are what a server reads to tell what it is — so an upload is refused or kept
 * for the reason a visitor's would be. The step names the file; nothing is read from the machine the journey runs on.
 */
const SAMPLES = {
  png: {
    type: 'image/png',
    base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
  },
  jpg: {
    type: 'image/jpeg',
    base64:
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='
  },
  gif: { type: 'image/gif', base64: 'R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==' },
  webp: { type: 'image/webp', base64: 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==' },
  pdf: {
    type: 'application/pdf',
    text: '%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n'
  },
  txt: { type: 'text/plain', text: 'A file a journey picked.\n' },
  csv: { type: 'text/csv', text: 'name,value\nsample,1\n' },
  json: { type: 'application/json', text: '{ "sample": true }\n' }
} as const;

const KINDS: Record<string, keyof typeof SAMPLES> = {
  png: 'png',
  jpg: 'jpg',
  jpeg: 'jpg',
  gif: 'gif',
  webp: 'webp',
  pdf: 'pdf',
  txt: 'txt',
  csv: 'csv',
  json: 'json'
};

/** A picked file, as the page builds it: its name, its type and its bytes in base64. */
export type SampleFile = { name: string; type: string; base64: string };

const base64Of = (text: string): string => btoa(String.fromCharCode(...new TextEncoder().encode(text)));

/** The file a step's name stands for, or what to write instead when its extension is none the journeys carry. */
export const sampleFile = (name: string): SampleFile | { problem: string } => {
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  const kind = extension === undefined ? undefined : KINDS[extension];
  if (kind === undefined) {
    return {
      problem: `"${name}" is no file a journey carries — a file field is given one by its name, ending in ${Object.keys(KINDS).join(', ')}: type photo me.png`
    };
  }

  const sample: { type: string; base64?: string; text?: string } = SAMPLES[kind];

  return { name, type: sample.type, base64: sample.base64 ?? base64Of(sample.text ?? '') };
};

/**
 * Runs in the page, on the file field: puts the file in it as a visitor's pick does — the field's own list of files —
 * and says so the way the browser does, `input` then `change`. Serialised: it uses nothing outside it.
 */
export const pickFile = (node: Element, file: SampleFile): boolean => {
  if (!(node instanceof HTMLInputElement) || node.type !== 'file') {
    return false;
  }

  const bytes = Uint8Array.from(atob(file.base64), char => char.charCodeAt(0));
  const picked = new DataTransfer();
  picked.items.add(new File([bytes], file.name, { type: file.type }));
  node.files = picked.files;
  node.dispatchEvent(new Event('input', { bubbles: true }));
  node.dispatchEvent(new Event('change', { bubbles: true }));

  return true;
};
