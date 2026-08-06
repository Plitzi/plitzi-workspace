import Badge from '@plitzi/plitzi-ui/Badge';
import { Heading, Icon } from '@plitzi/plitzi-ui/components';
import clsx from 'clsx';
import { useCallback, useMemo } from 'react';

import { formatDate } from '@plitzi/sdk-shared';

import type { SpaceCredentialProvider } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type SpaceCredentialProps = {
  providersSupported?: SpaceCredentialProvider[];
  identifier: string;
  name: string;
  provider: SpaceCredentialProvider;
  selected?: boolean;
  inUse: boolean;
  usedIn: { usedFrom: string; name: string }[];
  createdAt: number;
  updatedAt: number;
  onSelect?: (identifier: string) => void;
  onRemove?: (identifier: string) => void;
};

const SpaceCredential = ({
  providersSupported,
  identifier,
  name,
  provider,
  selected = false,
  inUse = false,
  usedIn = [],
  createdAt,
  onSelect,
  onRemove
}: SpaceCredentialProps) => {
  const isSupported = useMemo(
    () => !providersSupported || !providersSupported.length || providersSupported.includes(provider),
    [provider, providersSupported]
  );
  const createdAtParsed = useMemo(() => formatDate(createdAt, 'MMMM dd, yyyy'), [createdAt]);
  const usedInLabel = useMemo(() => usedIn.map(item => `${item.usedFrom}:${item.name}`).join(', '), [usedIn]);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (!isSupported) {
        return;
      }

      onSelect?.(identifier);
    },
    [identifier, isSupported, onSelect]
  );

  const handleClickRemove = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onRemove?.(identifier);
    },
    [identifier, onRemove]
  );

  return (
    <div
      className={clsx('group relative flex flex-col gap-2 rounded border p-2', {
        'hover:bg-primary-100/30 border-gray-300 dark:border-zinc-700': !selected && isSupported,
        'border-primary-400 bg-primary-100/50 dark:bg-primary-500/20': selected && isSupported,
        'cursor-pointer': isSupported,
        'cursor-not-allowed border-gray-300 bg-gray-100 opacity-70 dark:border-zinc-700 dark:bg-zinc-800': !isSupported
      })}
      onClick={handleClick}
    >
      <div className="flex items-center justify-between">
        <Heading as="h6">{name}</Heading>
        {selected && (
          <div className="flex">
            <Icon size="2xl" intent="primaryActive" icon="fa-solid fa-circle-check" className="cursor-default" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {provider === 'r2' && (
          <>
            <Icon icon="fa-brands fa-cloudflare" />
            Cloudflare R2
          </>
        )}
        {provider === 's3' && (
          <>
            <Icon icon="fa-brands fa-aws" />
            Amazon S3
          </>
        )}
        {provider === 'ssr' && (
          <>
            <Icon icon="fa-solid fa-server" />
            Plitzi SSR
          </>
        )}
        {provider === 'custom' && (
          <>
            <Icon icon="fa-solid fa-plug" />
            API / CMS
          </>
        )}
        {inUse && (
          <span title={usedInLabel}>
            <Badge intent="info" solid={false} size="xs" icon="fa-solid fa-link">
              In Use
            </Badge>
          </span>
        )}
        {!isSupported && (
          <span title="This credential belongs to a provider that cannot be used here.">
            <Badge intent="warning" solid={false} size="xs">
              Not Supported
            </Badge>
          </span>
        )}
      </div>
      <div className="text-xs text-gray-500 dark:text-zinc-400">Created {createdAtParsed}</div>

      <div className="absolute right-2 bottom-2">
        {!inUse && (
          <Icon
            intent="danger"
            icon="fas fa-trash-alt"
            title="Remove"
            size="lg"
            className="hidden cursor-pointer rounded p-4 group-hover:flex hover:bg-red-200 dark:hover:bg-red-900/40"
            onClick={handleClickRemove}
          />
        )}
        {inUse && (
          <Icon
            intent="tertiary"
            icon="fa-solid fa-circle-exclamation"
            size="lg"
            title="This credential is currently in use and cannot be removed."
            className="cursor-default p-4 hover:bg-transparent"
          />
        )}
      </div>
    </div>
  );
};

export default SpaceCredential;
