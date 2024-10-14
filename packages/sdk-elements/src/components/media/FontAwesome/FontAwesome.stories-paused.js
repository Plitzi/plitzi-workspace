// // Packages
// import React, { useState } from 'react';
// // import PlitziSdk, { PlitziServiceProvider } from '@plitzi/plitzi-sdk';

// // Relatives
// import FontAwesome from './FontAwesome.js';
// import Settings from './Settings.js';

// export default {
//   title: 'Example/FontAwesome',
//   decorators: [],
//   component: FontAwesome,
//   argTypes: {}
// };

// const schema = {
//   settings: {
//     title: 'Default',
//     customCss: ''
//   },
//   flat: {
//     '5f544375ced80ed16f382b7b': {
//       attributes: {
//         selectorClass: '',
//         name: 'Home'
//       },
//       builder: {
//         itemsAllowed: [],
//         itemsNotAllowed: []
//       },
//       definition: {
//         label: 'Page',
//         type: 'page',
//         slug: '',
//         items: ['5f47e7ca8294097d8b0a1715']
//       },
//       id: '5f544375ced80ed16f382b7b'
//     },
//     '5f47e7ca8294097d8b0a1715': {
//       id: '5f47e7ca8294097d8b0a1715',
//       attributes: {
//         selectorClass: ''
//       },
//       definition: {
//         label: 'Font Awesome',
//         type: 'fontAwesome',
//         description: '',
//         parentId: '5f544375ced80ed16f382b7b'
//       }
//     }
//   },
//   pages: ['5f544375ced80ed16f382b7b']
// };

// export const withHoc = () => (
//   <PlitziSdk offlineMode offlineData={{ schema }}>
//     <PlitziSdk.Plugin
//       renderType="demo"
//       component={FontAwesome}
//       assets={[
//         {
//           type: 'text/css',
//           href: '/main.css',
//           rel: 'stylesheet'
//         }
//       ]}
//     />
//   </PlitziSdk>
// );

// export const withHocNoPreview = () => (
//   <PlitziSdk offlineMode offlineData={{ schema }} previewMode={false}>
//     <PlitziSdk.Plugin
//       renderType="fontAwesome"
//       component={FontAwesome}
//       assets={[
//         {
//           type: 'text/css',
//           href: '/main.css',
//           rel: 'stylesheet'
//         }
//       ]}
//     />
//   </PlitziSdk>
// );

// export const withHocNoIframe = () => (
//   <PlitziSdk offlineMode renderMode="raw" offlineData={{ schema }}>
//     <PlitziSdk.Plugin renderType="fontAwesome" component={FontAwesome} />
//   </PlitziSdk>
// );

// export const componentRender = () => (
//   <PlitziServiceProvider value={{ previewMode: true }}>
//     <FontAwesome />
//   </PlitziServiceProvider>
// );

// export const componentSettings = args => {
//   const [props, setProps] = useState({});

//   const onUpdate = (key, value) => {
//     setProps(state => ({ ...state, [key]: value }));
//   };

//   return <Settings {...args} {...props} onUpdate={onUpdate} />;
// };

// componentSettings.args = {};
