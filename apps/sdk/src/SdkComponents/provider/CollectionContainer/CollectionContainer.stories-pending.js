// Packages
// import React from 'react';
// import PlitziSdk from '@plitzi/plitzi-sdk';

// Relatives
import CollectionContainer from './CollectionContainer';

export default {
  title: 'Example/CollectionContainer',
  decorators: [],
  component: CollectionContainer,
  argTypes: {}
};

// const schema = {
//   settings: {
//     title: 'Default',
//     customCss: ''
//   },
//   flat: {
//     '5f544375ced80ed16f382b7b': {
//       attributes: {
//         name: 'Home'
//       },
//       definition: {
//         label: 'Page',
//         type: 'page',
//         slug: '',
//         items: ['5f47e7ca8294097d8b0a1715'],
//         styleSelectors: {
//           base: ''
//         }
//       },
//       id: '5f544375ced80ed16f382b7b'
//     },
//     '5f47e7ca8294097d8b0a1715': {
//       id: '5f47e7ca8294097d8b0a1715',
//       attributes: {},
//       definition: {
//         label: 'Demo',
//         type: 'demo',
//         description: '',
//         parentId: '5f544375ced80ed16f382b7b',
//         styleSelectors: {
//           base: ''
//         }
//       }
//     }
//   },
//   pages: ['5f544375ced80ed16f382b7b']
// };

// export const withHoc = () => (
//   <PlitziSdk offlineMode offlineData={{ schema }}>
//     <PlitziSdk.Plugin
//       renderType="collectionContainer"
//       component={CollectionContainer}
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
//     <PlitziSdk.Plugin renderType="collectionContainer" component={CollectionContainer} />
//   </PlitziSdk>
// );
