// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import get from 'lodash/get';
import Input from '@plitzi/plitzi-ui-components/Input';
import Button from '@plitzi/plitzi-ui-components/Button';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

const ElementDefinitionSettings = props => {
  const { definition = emptyObject, onUpdate = noop } = props;
  const { label, initialState } = definition;
  const visibility = useMemo(() => get(initialState, 'visibility', true), [initialState]);

  const handleChangeLabel = useCallback(e => onUpdate('label', e.target.value, true), [onUpdate]);

  const handleClickVisibility = useCallback(
    () => onUpdate('initialState', { ...initialState, visibility: !visibility }, true),
    [onUpdate, initialState, visibility]
  );

  return (
    <div className="flex p-2 gap-2">
      <Input className="grow" size="sm" value={label} onChange={handleChangeLabel} inputClassName="rounded" />
      <Button size="sm" className="rounded" onClick={handleClickVisibility}>
        {visibility && <i className="fa-solid fa-eye" />}
        {!visibility && <i className="fa-solid fa-eye-slash" />}
      </Button>
    </div>
  );
};

ElementDefinitionSettings.propTypes = {
  type: PropTypes.string,
  definition: PropTypes.object,
  onUpdate: PropTypes.func
};

export default ElementDefinitionSettings;
