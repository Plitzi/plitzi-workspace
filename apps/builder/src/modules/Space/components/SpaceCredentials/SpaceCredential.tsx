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
        'hover:bg-primary-100/30 border-gray-300': !selected && isSupported,
        'border-primary-400 bg-primary-100/50': selected && isSupported,
        'cursor-pointer': isSupported,
        'cursor-not-allowed border-gray-300 bg-gray-100 opacity-70': !isSupported
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
        {inUse && (
          <div
            className="border-secondary-300 bg-secondary-100 flex gap-1 rounded border px-2 py-1 text-xs"
            title={usedIn.map(usedInItem => `${usedInItem.usedFrom}:${usedInItem.name}`).join(', ')}
          >
            <Icon icon="fa-solid fa-link" intent="custom" />
            In Use
          </div>
        )}
        {!isSupported && (
          <div
            className="flex gap-1 rounded border border-yellow-300 bg-yellow-100 px-2 py-1 text-xs"
            title={usedIn.map(usedInItem => `${usedInItem.usedFrom}:${usedInItem.name}`).join(', ')}
          >
            <Icon icon="fa-solid fa-triangle-exclamation" intent="custom" />
            Not Supported
          </div>
        )}
      </div>
      <div className="text-xs text-gray-500">Created {createdAtParsed}</div>

      {isSupported && (
        <div className="absolute right-2 bottom-2">
          {!inUse && (
            <Icon
              intent="danger"
              icon="fas fa-trash-alt"
              title="Remove"
              size="lg"
              className="hidden cursor-pointer rounded p-4 group-hover:flex hover:bg-red-200"
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
      )}
    </div>
  );
};

export default SpaceCredential;
