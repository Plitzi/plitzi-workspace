// Packages
import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import Button from '@plitzi/plitzi-ui-components/Button';
import Heading from '@plitzi/plitzi-ui-components/Heading';
import QueryBuilder from '@plitzi/plitzi-ui-components/QueryBuilder';

// Relatives
import { emptyObject } from '../../../../../helpers/utils';

const StepWhen = props => {
  const { when: whenProp, dataSourceFields = emptyObject, onBack = noop, onNext = noop } = props;
  const [when, setWhen] = useState(whenProp);

  const handleChangeQuery = useCallback(query => setWhen(query), []);

  const handleClickBack = useCallback(() => onBack(), [onBack]);

  const handleClickNext = useCallback(() => onNext({ when }), [onNext, when]);

  const fieldsDataSource = useMemo(
    () =>
      Object.keys(dataSourceFields).reduce(
        (acum1, source) => ({
          ...acum1,
          ...dataSourceFields[source].reduce(
            (acum2, { path, inputType, values }) => ({
              ...acum2,
              [`${source}.${path}`]: {
                name: `${source}.${path}`,
                label: path,
                placeholder: `Enter ${path}`,
                group: `Data Source - ${source}`,
                inputType,
                values
              }
            }),
            {}
          )
        }),
        {}
      ),
    [dataSourceFields]
  );

  const isSkipped = useMemo(() => !when || !when.rules || when.rules.length === 0, [when]);

  return (
    <div className="flex flex-col">
      <Heading type="h5" className="mb-4">
        When Happens
      </Heading>
      <div className="flex flex-col">
        <QueryBuilder
          ruleDirection="vertical"
          className="w-full"
          query={when}
          fields={fieldsDataSource}
          onChange={handleChangeQuery}
          showBranches
        />
      </div>
      <div className="flex justify-between mt-4">
        <Button onClick={handleClickBack} className="mr-4 rounded-md text-xs">
          Back
        </Button>
        <Button onClick={handleClickNext} className="rounded-md text-xs">
          {isSkipped ? 'Skip' : 'Next'}
        </Button>
      </div>
    </div>
  );
};

StepWhen.propTypes = {
  className: PropTypes.string,
  when: PropTypes.object,
  dataSourceFields: PropTypes.object,
  onNext: PropTypes.func,
  onBack: PropTypes.func
};

export default StepWhen;
