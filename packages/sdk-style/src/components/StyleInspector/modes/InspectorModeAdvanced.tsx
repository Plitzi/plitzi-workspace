// import Button from '@plitzi/plitzi-ui/Button';
// import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
// import Dropdown from '@plitzi/plitzi-ui-components/Dropdown';
// import { produce } from 'immer';
// import debounce from 'lodash/debounce';
// import set from 'lodash/set';
// import { useCallback, use, useMemo, useEffect, useState } from 'react';

// import DataSourceContext from '@plitzi/sdk-data-source/DataSourceContext';
// import BuilderContext from '@plitzi/sdk-shared/builder/BuilderContext';
// import { StyleConstants } from '@plitzi/sdk-shared/style';
// import {
//   cssToSelectors,
//   getReadOnlyRangesFromContent,
//   formatCssFromSelector,
//   makeSelector
// } from '@plitzi/sdk-style/StyleHelper';

// import type { DisplayMode, Element } from '@plitzi/sdk-shared';

// const selectorsDefault = [];

// export type InspectorModeAdvancedProps = {
//   element?: Element;
//   styleSelector: string;
//   selectors: object[];
//   selector: string;
//   displayMode: DisplayMode;
// };

// const InspectorModeAdvanced = ({
//   element,
//   styleSelector = '',
//   selectors = selectorsDefault,
//   selector,
//   displayMode
// }: InspectorModeAdvancedProps) => {
//   const [reRender, setReRender] = useState(false);
//   const { builderHandler } = use(BuilderContext);
//   const { useDataSource } = use(DataSourceContext);
//   const { variables } = useDataSource({ id: '', mode: 'read' });
//   const selectorInstance = useMemo(
//     () => selectors.find(selectorAux => selectorAux.name === selector),
//     [selector, selectors]
//   );
//   const CMValue = useMemo(
//     () => (selectorInstance ? formatCssFromSelector(selectorInstance?.cache, true, 2, false) : ''),
//     [selectorInstance?.name, reRender]
//   );
//   const variablesNames = useMemo(
//     () =>
//       Object.keys(variables).reduce((acum, variableKey) => [...acum, { type: 'css-token', value: variableKey }], []),
//     [variables]
//   );

//   const sync = useCallback(
//     (currentState, push = true) => {
//       if (typeof currentState === 'string') {
//         currentState = cssToSelectors(currentState, true);
//       }

//       if (!push) {
//         return;
//       }

//       if (currentState.name) {
//         builderHandler(
//           'styleUpdateSelector',
//           displayMode,
//           currentState.name,
//           selectorInstance?.type,
//           undefined,
//           currentState.attributes
//         );
//       }
//     },
//     [builderHandler, displayMode, selectorInstance?.type]
//   );

//   const syncDebounced = useMemo(() => debounce(sync, 500), [sync]);

//   const handleChange = useCallback(newValue => syncDebounced(newValue), [selectors]);

//   const handleClickFormat = useCallback(() => setReRender(state => !state), []);

//   const getReadOnlyRanges = useCallback(targetState => {
//     const content = targetState.doc.text.reduce((acum, line) => `${acum}${acum ? '\n' : ''}${line}`, '');

//     return getReadOnlyRangesFromContent(content, false, false);
//   }, []);

//   useEffect(() => {
//     if (element && !selector) {
//       const {
//         definition: { type }
//       } = element;

//       const customClass = makeSelector(type, styleSelector);
//       builderHandler(
//         'schemaUpdateElement',
//         produce(element, draft => {
//           set(draft, `definition.styleSelectors.${styleSelector}`, customClass);
//         })
//       );

//       builderHandler('styleAddSelector', displayMode, customClass, 'class', undefined, undefined);
//     }
//   }, [element, selector, builderHandler, styleSelector]);

//   return (
//     <div className="flex flex-col grow relative">
//       <CodeMirror
//         value={CMValue}
//         theme="dark"
//         lineWrapping
//         onChange={handleChange}
//         autoComplete={variablesNames}
//         getReadOnlyRanges={getReadOnlyRanges}
//       />
//       <div className="flex flex-col absolute top-3 right-3 gap-1">
//         <Dropdown showIcon={false} containerLeftOffset={-208}>
//           <Dropdown.Content>
//             <Button intent="custom" size="custom" className="p-2 bg-white rounded-sm">
//               <i className="fa-solid fa-circle-info" />
//             </Button>
//           </Dropdown.Content>
//           <Dropdown.Container>
//             <div className="w-60 flex flex-col justify-center p-4 gap-1 text-xs ">
//               <p className="text-xs">Add your own CSS code here to customize the appearance and layout of your site.</p>
//               <span className="font-bold">Properties Allowed</span>
//               <ul className="text-xs border border-gray-300 rounded-sm h-[100px] overflow-auto flex flex-col">
//                 {Object.values(StyleConstants).map(property => (
//                   <li key={property} className="px-1.5 py-1 [&:not(:last-child)]:border-b border-gray-300 w-full">
//                     {property}
//                   </li>
//                 ))}
//               </ul>
//               <p className="text-xs">
//                 <span className="font-bold">Tab</span> to autocomplete.
//               </p>
//             </div>
//           </Dropdown.Container>
//         </Dropdown>
//         <Button
//           intent="custom"
//           size="custom"
//           className="p-2 bg-white rounded-sm"
//           onClick={handleClickFormat}
//           // disabled={networkLoading}
//         >
//           <Button.Icon icon="fa-solid fa-wand-magic-sparkles" />
//           Auto format
//         </Button>
//       </div>
//     </div>
//   );
// };

// export default InspectorModeAdvanced;
