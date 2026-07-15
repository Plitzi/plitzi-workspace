import { useFormContext, useFormWatch } from '@plitzi/plitzi-ui/Form';
import Heading from '@plitzi/plitzi-ui/Heading';
import { get } from '@plitzi/plitzi-ui/helpers';
import { useMemo } from 'react';

import whenString from '@pmodules/DataSource/helpers/whenString';

import transformerString from '../../../helpers/transformerString';

import type { BindingSchema } from '../BindingForm';
import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';
import type { SourceField, SourceMeta } from '@plitzi/sdk-shared';

export type StepPreviewProps = {
  category?: string;
  fields?: SourceField[];
  sources?: Record<string, SourceMeta>;
};

const StepPreview = ({ category, fields, sources }: StepPreviewProps) => {
  const form = useFormContext<BindingSchema>();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const [path, to, source, when, transformers] = useFormWatch(form, [
    'path',
    'to',
    'source',
    'when',
    'transformers'
  ]);
  const name = useMemo(() => fields?.find(f => f.path === path)?.name ?? 'Unknown', [fields, path]);
  const transformerName = useMemo(() => transformerString(transformers), [transformers]);
  const whenStr = useMemo(() => whenString(when as RuleGroup), [when]);
  const sourceName = useMemo(() => get(sources, `${source}.name`, source), [source, sources]);
  const fullSource = useMemo(() => (path ? `${source}.${path}` : source), [source, path]);

  return (
    <div className="flex flex-col">
      <Heading as="h5" className="mb-4">
        Preview
      </Heading>
      <div className="flex w-full flex-col truncate rounded-sm border border-gray-300 dark:border-zinc-600">
        <div className="flex truncate px-1 py-0.5 text-xs" title={name}>
          <div className="font-bold">From:</div>
          <div className="ml-1 truncate capitalize">{path ? `${sourceName} [${name}]` : 'None'}</div>
        </div>
        <div
          className="flex truncate border-t border-gray-300 px-1 py-0.5 text-xs dark:border-zinc-600"
          title={fullSource}
        >
          <div className="font-bold">Path:</div>
          <div className="ml-1 truncate">{fullSource}</div>
        </div>
        <div className="flex truncate border-t border-gray-300 px-1 py-0.5 text-xs dark:border-zinc-600" title={to}>
          <div className="font-bold">To:</div>
          <div className="ml-1 truncate capitalize">{`${category} ${to}`}</div>
        </div>
        <div
          className="flex truncate border-t border-gray-300 px-1 py-0.5 text-xs dark:border-zinc-600"
          title={transformerName}
        >
          <div className="font-bold">Transformers:</div>
          <div className="ml-1 truncate">{transformerName}</div>
        </div>
        <div
          className="flex truncate border-t border-gray-300 px-1 py-0.5 text-xs dark:border-zinc-600"
          title={whenStr}
        >
          <div className="font-bold">When:</div>
          <div className="ml-1 truncate">{whenStr}</div>
        </div>
      </div>
    </div>
  );
};

export default StepPreview;
