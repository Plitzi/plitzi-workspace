import { useFormContext, useFormWatch } from '@plitzi/plitzi-ui/Form';
import Heading from '@plitzi/plitzi-ui/Heading';
import { QueryBuilderFormatter } from '@plitzi/plitzi-ui/QueryBuilder';
import get from 'lodash-es/get';
import upperFirst from 'lodash-es/upperFirst';
import { useMemo } from 'react';

import utility from '@plitzi/sdk-data-source/utility/index';

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
  const [fromPath, toPath, source, when, transformers] = useFormWatch(form, [
    'fromPath',
    'toPath',
    'source',
    'when',
    'transformers'
  ]);
  const name = useMemo(() => fields?.find(f => f.path === fromPath)?.name ?? 'Unknown', [fields, fromPath]);

  const transformerString = useMemo(() => {
    const str = transformers.reduce((acum, transformer) => {
      const { action, params } = transformer;
      switch (action) {
        case 'staticValue':
          return `${acum}${acum === '' ? '' : ', '}${get(utility, `${action}.title`, action)} = ${params.value}`;

        default:
          return `${acum}${acum === '' ? '' : ', '}${get(utility, `${action}.title`, action)}`;
      }
    }, '');
    if (str) {
      return str;
    }

    return 'None';
  }, [transformers]);

  const whenString = useMemo(() => {
    if (!when) {
      return 'None';
    }

    const str = QueryBuilderFormatter(when as RuleGroup);
    if (str) {
      return str;
    }

    return 'None';
  }, [when]);

  const sourceName = useMemo(() => upperFirst(get(sources, `${source}.name`, source) as string), [source, sources]);

  console.log(when);

  return (
    <div className="flex flex-col">
      <Heading as="h5" className="mb-4">
        Preview
      </Heading>
      <div className="flex w-full flex-col truncate rounded-sm border border-gray-300">
        <div className="flex truncate px-1 py-0.5 text-xs" title={name}>
          <div className="font-bold">From:</div>
          <div className="ml-1 truncate">{`${sourceName} [${name}]`}</div>
        </div>
        <div className="flex truncate border-t border-gray-300 px-1 py-0.5 text-xs" title={fromPath}>
          <div className="font-bold">Path:</div>
          <div className="ml-1 truncate">{`${source}.${fromPath}`}</div>
        </div>
        <div className="flex truncate border-t border-gray-300 px-1 py-0.5 text-xs" title={upperFirst(toPath)}>
          <div className="font-bold">To:</div>
          <div className="ml-1 truncate">{`${upperFirst(category)} ${upperFirst(toPath)}`}</div>
        </div>
        <div className="flex truncate border-t border-gray-300 px-1 py-0.5 text-xs" title={transformerString}>
          <div className="font-bold">Transformers:</div>
          <div className="ml-1 truncate">{transformerString}</div>
        </div>
        <div className="flex truncate border-t border-gray-300 px-1 py-0.5 text-xs" title={whenString}>
          <div className="font-bold">When:</div>
          <div className="ml-1 truncate">{whenString}</div>
        </div>
      </div>
    </div>
  );
};

export default StepPreview;
