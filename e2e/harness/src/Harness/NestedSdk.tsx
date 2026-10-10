import PlitziSdk from '@plitzi/plitzi-sdk';

import type { OfflineDataRaw } from '@plitzi/sdk-shared';

export type NestedSdkProps = {
  offlineData?: OfflineDataRaw;
};

/** A plugin drawing a space inside its own tree, the way an assistant draws a card it generated: the exported
 *  `<PlitziSdk>`, offline, imported as a plugin imports it. */
const NestedSdk = ({ offlineData }: NestedSdkProps) =>
  offlineData ? <PlitziSdk offlineMode offlineData={offlineData} routing="memory" /> : null;

export default NestedSdk;
