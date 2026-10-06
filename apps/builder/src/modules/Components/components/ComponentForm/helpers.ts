import { z } from 'zod';

import type { PropEntry } from '../PropsEditor';
import type { ProviderModalProps } from '@plitzi/plitzi-ui/Modal';
import type { SpaceComponentDeclaration } from '@plitzi/sdk-shared';

export const componentFormSchema = z.object({
  label: z.string().min(2, { message: 'Too Short' }).max(40, { message: 'Too Long' }),
  folder: z.string().optional()
});

/**
 * How the modal that holds the component's form opens: wide enough for a prop's name, kind and switches on one line.
 * Its height is the form's to manage — the fields scroll and the buttons stay in view.
 */
export const COMPONENT_MODAL: ProviderModalProps = { className: { card: 'max-w-2xl' } };

/** The props a declaration has, as the editor's rows. */
export const entriesOf = (declaration?: SpaceComponentDeclaration): PropEntry[] =>
  Object.entries(declaration?.props ?? {}).map(([name, prop]) => ({ name, prop }));
