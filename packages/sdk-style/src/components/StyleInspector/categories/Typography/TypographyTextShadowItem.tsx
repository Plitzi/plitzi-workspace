// // Packages
// import React, { useCallback, useMemo, useRef } from 'react';
// import classNames from 'classnames';
// import noop from 'lodash/noop';
// import Dropdown from '@plitzi/plitzi-ui-components/Dropdown';

// // Relatives
// import GroupButtons from '../../../components/GroupButtons';
// import InspectorButton from '../../../components/InspectorButton';

// /**
//  * @param {{
//  *   className?: string;
//  *   value?: string;
//  *   onChange?: (value: string) => void;
//  *   onRemove?: () => void;
//  * }} props
//  * @returns {React.ReactElement}
//  */
// const TypographyTextShadowItem = props => {
//   const { className = '', value, onRemove = noop, onChange = noop } = props;

//   const [posX = '2px', posY = '2px', blur = '0px', color = 'black'] = value.split(' ');
//   const valueRef = useRef(value);
//   valueRef.current = { posX, posY, blur, color };

//   const handleChange = useCallback(
//     itemValue => {
//       const { type, value } = itemValue;
//       const valueAux = { ...valueRef.current };
//       valueAux[type] = value;
//       const { posX, posY, blur, color } = valueAux;
//       onChange(`${posX} ${posY} ${blur} ${color}`);
//     },
//     [onChange]
//   );

//   const itemsPosition = useMemo(
//     () => [
//       { type: 'inputMetric', value: posX, extraValue: { type: 'posX' }, label: 'Pos X' },
//       { type: 'inputMetric', value: posY, extraValue: { type: 'posY' }, label: 'Pos Y' },
//       { type: 'inputMetric', value: blur, extraValue: { type: 'blur' }, label: 'Blur' }
//     ],
//     [value]
//   );

//   const itemsStyle = useMemo(
//     () => [{ type: 'color', value: color, extraValue: { type: 'color' }, label: 'Color' }],
//     [value]
//   );

//   return (
//     <Dropdown showIcon={false} className="w-full" backgroundDisabled closeOnClick={false}>
//       <Dropdown.Content
//         className={classNames(
//           'py-0.5 px-2 flex justify-between items-center border border-gray-300 cursor-pointer hover:bg-gray-100 rounded-sm w-full select-none',
//           className
//         )}
//       >
//         <div className="flex items-center">
//           <div className="h-5 w-5 mr-1 rounded-sm" style={{ backgroundColor: color }} />
//           <div>{value}</div>
//         </div>
//         <div className="flex">
//           <InspectorButton onClick={onRemove} intent="danger" title="Remove">
//             <i className="fas fa-trash-alt" />
//           </InspectorButton>
//         </div>
//       </Dropdown.Content>
//       <Dropdown.Container className="w-[212px] p-2">
//         <div className="p-2 flex flex-col">
//           <GroupButtons
//             className="w-full"
//             classNameContainer="w-[180px]"
//             items={itemsPosition}
//             label=""
//             onChange={handleChange}
//           />
//           <GroupButtons
//             className="w-full"
//             classNameContainer="w-[180px]"
//             items={itemsStyle}
//             label=""
//             onChange={handleChange}
//           />
//         </div>
//       </Dropdown.Container>
//     </Dropdown>
//   );
// };

// export default TypographyTextShadowItem;
