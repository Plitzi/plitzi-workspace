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
  /**
   * The workspace whose allowance the account plane is — given only to a member of it, who may read where it went
   * (`/workspaces/:id/usage`). Null for somebody editing the space as a guest of another workspace.
   */
  workspaceId: number | null;
};

export type TSpaceQuotaQuery = { SpaceQuota: TSpaceQuota | null };

const SpaceQuotaQuery = /* GraphQL */ `
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
      workspaceId
    }
  }
`;

export default SpaceQuotaQuery;
