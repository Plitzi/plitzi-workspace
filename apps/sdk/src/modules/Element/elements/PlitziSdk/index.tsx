import PlitziLogo from '@plitzi/plitzi-ui/icons/PlitziLogo';

import { PlitziSdkDeclaration as declaration } from '@plitzi/sdk-elements/elements/declarations';

import BasePlitziSdk from './PlitziSdk';

// The catalogue icon is a React component, so it is attached here rather than in the data-only declaration.
const PlitziSdk = Object.assign(BasePlitziSdk, {
  ...declaration,
  content: { ...declaration.content, market: { ...declaration.content.market, icon: <PlitziLogo /> } }
});

export default PlitziSdk;
