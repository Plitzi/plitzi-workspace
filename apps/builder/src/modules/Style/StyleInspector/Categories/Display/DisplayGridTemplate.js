// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Monorepo
import {
  GRID_AUTO_COLUMNS,
  GRID_AUTO_FLOW,
  GRID_AUTO_ROWS,
  GRID_TEMPLATE_COLUMNS,
  GRID_TEMPLATE_ROWS
} from '@plitzi/sdk-style/StyleConstants';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

const DisplayGridTemplate = props => {
  const {
    templateAreas = 'none',
    templateColumns = 'none',
    templateRows = 'none',
    templateAutoFlow = 'row',
    templateAutoRows = 'none',
    templateAutoColumns = 'none',
    onChange = noop
  } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue.type, itemValue.value), [onChange]);

  const items = useMemo(
    () => [
      // {
      //   type: 'inputMetric',
      //   value: templateAreas,
      //   extraValue: { type: GRID_TEMPLATE_AREAS },
      //   keyValue: GRID_TEMPLATE_AREAS,
      //   label: 'Area'
      // },
      {
        type: 'input',
        value: templateRows,
        extraValue: { type: GRID_TEMPLATE_ROWS },
        keyValue: GRID_TEMPLATE_ROWS,
        label: 'Row',
        inputProps: { type: 'text' }
      },
      {
        type: 'input',
        value: templateColumns,
        extraValue: { type: GRID_TEMPLATE_COLUMNS },
        keyValue: GRID_TEMPLATE_COLUMNS,
        label: 'Column',
        inputProps: { type: 'text' }
      }
    ],
    [templateAreas, templateColumns, templateRows]
  );

  const itemsAuto = useMemo(
    () => [
      {
        type: 'inputMetric',
        value: templateAutoRows,
        extraValue: { type: GRID_AUTO_ROWS },
        keyValue: GRID_AUTO_ROWS,
        label: 'Row',
        inputProps: { type: 'text' }
      },
      {
        type: 'inputMetric',
        value: templateAutoColumns,
        extraValue: { type: GRID_AUTO_COLUMNS },
        keyValue: GRID_AUTO_COLUMNS,
        label: 'Column',
        inputProps: { type: 'text' }
      }
    ],
    [templateAutoRows, templateAutoColumns]
  );

  const itemsDirection = useMemo(
    () => [
      {
        value: { value: 'row', type: GRID_AUTO_FLOW },
        children: <div className="text-xs whitespace-nowrap select-none px-1">Row</div>,
        description: '',
        active: templateAutoFlow === 'row'
      },
      {
        value: { value: 'column', type: GRID_AUTO_FLOW },
        children: <div className="text-xs select-none px-1">Column</div>,
        description: '',
        active: templateAutoFlow === 'column'
      }
    ],
    [templateAutoFlow]
  );

  const keyValueTemplate = useMemo(() => [GRID_TEMPLATE_COLUMNS, GRID_TEMPLATE_ROWS], []);

  const keyValueAuto = useMemo(() => [GRID_AUTO_COLUMNS, GRID_AUTO_ROWS], []);

  return (
    <>
      <GroupButtons
        className="w-full"
        classNameContainer="w-[180px]"
        items={itemsDirection}
        label="Direction"
        keyValue={GRID_AUTO_FLOW}
        onChange={handleChange}
      />
      <GroupButtons
        className="w-full"
        classNameContainer="w-[180px]"
        items={items}
        keyValue={keyValueTemplate}
        label="Template"
        onChange={handleChange}
      />
      <GroupButtons
        className="w-full"
        classNameContainer="w-[180px]"
        items={itemsAuto}
        keyValue={keyValueAuto}
        label="Default"
        onChange={handleChange}
      />
    </>
  );
};

DisplayGridTemplate.propTypes = {
  templateAreas: PropTypes.string,
  templateColumns: PropTypes.string,
  templateRows: PropTypes.string,
  templateAutoFlow: PropTypes.string,
  templateAutoRows: PropTypes.string,
  templateAutoColumns: PropTypes.string,
  onChange: PropTypes.func
};

export default DisplayGridTemplate;
