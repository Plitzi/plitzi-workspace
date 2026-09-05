import { gql } from '@apollo/client/core';

/** One allowance and what has been spent of it. Both planes answer in this shape. */
export type TQuotaPlane = {
  views: number;
  viewsQuota: number;
  viewsUnlimited: boolean;
  viewsPercent: number | null;
  viewsRemaining: number | null;
  elements: number | null;
  elementsQuota: number;
  elementsUnlimited: boolean;
  elementsPercent: number | null;
  overLimit: boolean;
};

export type TSpaceQuota = {
  planName: string;
  tier: string;
  isFree: boolean;
  periodStart: number | null;
  periodEnd: number | null;
  /** What THIS space may spend on its own. */
  space: TQuotaPlane | null;
  /** What the account may spend across every space it owns. */
  account: TQuotaPlane;
  overLimit: boolean;
};

export type TSpaceQuotaQuery = { SpaceQuota: TSpaceQuota | null };

const SpaceQuotaQuery = gql`
  query SpaceQuotaQuery {
    SpaceQuota {
      planName
      tier
      isFree
      periodStart
      periodEnd
      space {
        views
        viewsQuota
        viewsUnlimited
        viewsPercent
        viewsRemaining
        elements
        elementsQuota
        elementsUnlimited
        elementsPercent
        overLimit
      }
      account {
        views
        viewsQuota
        viewsUnlimited
        viewsPercent
        viewsRemaining
        elements
        elementsQuota
        elementsUnlimited
        elementsPercent
        overLimit
      }
      overLimit
    }
  }
`;

export default SpaceQuotaQuery;
