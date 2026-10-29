import { memo } from 'react';

import { useSpaceAccess } from '@pmodules/Space/hooks/useSpaceEntitlements';

/**
 * The person's role on the space, in the header, when it is less than everything: a control that is not
 * there is then never a mystery — "Can edit content" says why the style panel is gone. Nothing on a server that
 * answers no roles (self-hosted), or for whoever may do everything.
 */
const RoleBadge = () => {
  const { access, may } = useSpaceAccess();
  if (!access || may('spaceManage')) {
    return null;
  }

  return (
    <span
      id="header-role"
      className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
      title="Your role on this space: what the builder offers you is what it allows"
    >
      {access.label}
    </span>
  );
};

export default memo(RoleBadge);
