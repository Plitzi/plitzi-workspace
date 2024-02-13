import React from 'react';
// import Transformd from '@plitzi/plitzi-plugins/dist/plitzi-plugin-Transformd';

import Sdk from '../src/index';
// import demo1 from '../src/demos/demo1';

export default {
  title: 'Example/Sdk',
  decorators: [],
  component: Sdk,
  argTypes: {}
};

const heightOffset = 32;

export const demoA = () => (
  <div className="plitzi-container" style={{ height: `calc(100vh - ${heightOffset}px)` }}>
    {/* <Sdk {...demo1}>
      <Sdk.Plugin renderType="transformd" component={Transformd} />
    </Sdk> */}
  </div>
);

demoA.args = {};
