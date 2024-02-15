// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import get from 'lodash/get';
import upperFirst from 'lodash/upperFirst';
import Button from '@plitzi/plitzi-ui-components/Button';
import Heading from '@plitzi/plitzi-ui-components/Heading';
import QueryBuilderFormatter from '@plitzi/plitzi-ui-components/QueryBuilder/helpers/QueryBuilderFormatter';

// Monorepo
import { emptyObject } from '@repo/shared';

// Relatives
import utility from '../../../utility';

const fieldsDefault = [];
const transformersDefault = [];

const StepPreview = props => {
  const {
    fields = fieldsDefault,
    sources = emptyObject,
    source = '',
    category = '',
    fromPath = '',
    toPath = '',
    transformers = transformersDefault,
    when = emptyObject,
    onBack = noop,
    onNext = noop
  } = props;
  const name = useMemo(() => fields.find(f => f.path === fromPath)?.name ?? 'Unknown', [fields]);

  const handleClickBack = useCallback(() => onBack(), [onBack]);

  const handleClickNext = useCallback(() => onNext({}), [onNext]);

  const transformerString = useMemo(() => {
    const str = transformers.reduce((acum, transformer) => {
      switch (transformer.action) {
        case 'staticValue':
          return `${acum}${acum === '' ? '' : ', '}${get(
            utility,
            `${transformer.action}.title`,
            transformer.action
          )} = ${transformer.params.value}`;

        default:
          return `${acum}${acum === '' ? '' : ', '}${get(utility, `${transformer.action}.title`, transformer.action)}`;
      }
    }, '');
    if (str) {
      return str;
    }

    return 'None';
  }, [transformers]);

  const whenString = useMemo(() => {
    const str = QueryBuilderFormatter(when);
    if (str) {
      return str;
    }

    return 'None';
  }, [when]);

  const sourceName = useMemo(() => upperFirst(get(sources, `${source}.name`, source)), [source, sources]);

  return (
    <div className="flex flex-col">
      <Heading type="h5" className="mb-4">
        Preview
      </Heading>
      <div className="flex flex-col truncate border border-gray-300 rounded w-full">
        <div className="flex px-1 py-0.5 text-xs truncate" title={name}>
          <div className="font-bold">From:</div>
          <div className="truncate ml-1">{`${sourceName} [${name}]`}</div>
        </div>
        <div className="flex px-1 py-0.5 text-xs border-t border-gray-300 truncate" title={fromPath}>
          <div className="font-bold">Path:</div>
          <div className="truncate ml-1">{`${source}.${fromPath}`}</div>
        </div>
        <div className="flex px-1 py-0.5 text-xs border-t border-gray-300 truncate" title={upperFirst(toPath)}>
          <div className="font-bold">To:</div>
          <div className="truncate ml-1">{`${upperFirst(category)} ${upperFirst(toPath)}`}</div>
        </div>
        <div className="flex px-1 py-0.5 text-xs border-t border-gray-300 truncate" title={transformerString}>
          <div className="font-bold">Transformers:</div>
          <div className="truncate ml-1">{transformerString}</div>
        </div>
        <div className="flex px-1 py-0.5 text-xs border-t border-gray-300 truncate" title={whenString}>
          <div className="font-bold">When:</div>
          <div className="truncate ml-1">{whenString}</div>
        </div>
      </div>
      <div className="flex justify-between mt-4">
        <Button onClick={handleClickBack} className="mr-4 rounded-md text-xs">
          Back
        </Button>
        <Button onClick={handleClickNext} className="rounded-md text-xs">
          Save
        </Button>
      </div>
    </div>
  );
};

StepPreview.propTypes = {
  className: PropTypes.string,
  sources: PropTypes.object,
  fields: PropTypes.array,
  category: PropTypes.string,
  fromPath: PropTypes.string,
  toPath: PropTypes.string,
  source: PropTypes.string,
  transformers: PropTypes.array,
  when: PropTypes.object,
  onBack: PropTypes.func,
  onNext: PropTypes.func
};

export default StepPreview;
