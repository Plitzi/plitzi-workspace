// Packages
import React, { useCallback, useMemo } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import Heading from '@plitzi/plitzi-ui-components/Heading';
import QueryBuilder from '@plitzi/plitzi-ui-components/QueryBuilder';
import ContainerCollapsable from '@plitzi/plitzi-ui-components/ContainerCollapsable';

// Relatives
import { emptyObject } from '../../../../../helpers/utils';

const NodeWhen = props => {
  const { className = '', when, fields = emptyObject, onChange = noop } = props;

  const handleChange = useCallback(query => onChange({ when: query }), [when, onChange]);

  const containerTitle = useMemo(
    () => (
      <Heading type="h5" className="w-full">
        When
      </Heading>
    ),
    []
  );

  const isCollapsed = useMemo(() => !when || !when.rules || when.rules.length === 0, [when]);

  return (
    <div
      className={classNames('flex flex-col py-2 px-4 items-center border-t-2 border-gray-300 border-dotted', className)}
    >
      <ContainerCollapsable className="w-full flex justify-center" title={containerTitle} collapsed={isCollapsed}>
        <QueryBuilder
          ruleDirection="vertical"
          className="w-full py-2"
          query={when}
          fields={fields}
          onChange={handleChange}
          showBranches
        />
      </ContainerCollapsable>
    </div>
  );
};

NodeWhen.propTypes = {
  className: PropTypes.string,
  id: PropTypes.string,
  when: PropTypes.object,
  fields: PropTypes.object,
  onChange: PropTypes.func,
  onClickOpen: PropTypes.func
};

export default NodeWhen;
